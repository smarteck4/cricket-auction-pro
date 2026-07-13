import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Strip whitespace and any non-printable / non-ASCII characters (e.g. a stray
// zero-width space or newline saved into the secret) that would silently
// corrupt the cloud name or signature.
function sanitizeCredential(value: string | undefined): string {
  return (value ?? "").replace(/[^\x21-\x7E]/g, "");
}

async function sha1Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cloudName = sanitizeCredential(Deno.env.get("CLOUDINARY_CLOUD_NAME"));
    const apiKey = sanitizeCredential(Deno.env.get("CLOUDINARY_API_KEY"));
    const apiSecret = sanitizeCredential(Deno.env.get("CLOUDINARY_API_SECRET"));

    if (!cloudName || !apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: "Cloudinary is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Authenticate the caller and ensure they are an admin/super_admin.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("is_admin_or_super", {
      _user_id: userData.user.id,
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file, folder = "players", action = "upload", public_id: publicIdToDelete } =
      await req.json();

    // Deletion path: remove an existing asset from Cloudinary.
    if (action === "destroy") {
      if (!publicIdToDelete || typeof publicIdToDelete !== "string") {
        return new Response(JSON.stringify({ error: "No public_id provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const destroyTs = Math.round(Date.now() / 1000).toString();
      const destroyParams = `public_id=${publicIdToDelete}&timestamp=${destroyTs}`;
      const destroySignature = await sha1Hex(destroyParams + apiSecret);

      const destroyForm = new FormData();
      destroyForm.append("public_id", publicIdToDelete);
      destroyForm.append("api_key", apiKey);
      destroyForm.append("timestamp", destroyTs);
      destroyForm.append("signature", destroySignature);

      const destroyRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
        { method: "POST", body: destroyForm },
      );
      const destroyResult = await destroyRes.json();

      if (!destroyRes.ok) {
        console.error("Cloudinary destroy failed", destroyResult);
        return new Response(
          JSON.stringify({ error: destroyResult?.error?.message || "Delete failed" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ result: destroyResult.result }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!file || typeof file !== "string") {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timestamp = Math.round(Date.now() / 1000).toString();

    // Sign the request: params sorted alphabetically + api_secret.
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = await sha1Hex(paramsToSign + apiSecret);

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", apiKey);
    form.append("timestamp", timestamp);
    form.append("folder", folder);
    form.append("signature", signature);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: form },
    );

    const result = await uploadRes.json();

    if (!uploadRes.ok) {
      console.error("Cloudinary upload failed", result);
      return new Response(
        JSON.stringify({ error: result?.error?.message || "Upload failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        secure_url: result.secure_url,
        public_id: result.public_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("cloudinary-upload error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
