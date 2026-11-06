import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { currentPasswordError } from "./password-update-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the caller's JWT (functions deploy with verify_jwt = false).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    // Validate the request body.
    const body = await req.json().catch(() => null);
    const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    const secretKey = typeof body?.secretKey === "string" ? body.secretKey : "";

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "targetUserId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!newPassword) {
      return new Response(JSON.stringify({ error: "Enter a new password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is a super_admin (server-side, never client-supplied).
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRows, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    if (roleError || !roleRows?.some((r) => r.role === "super_admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Self-service changes require both the current password and the secret key.
    if (targetUserId === callerId) {
      const missingCurrentPassword = currentPasswordError(callerId, targetUserId, currentPassword);
      if (missingCurrentPassword) {
        return new Response(JSON.stringify({ error: missingCurrentPassword }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!userData.user.email) {
        return new Response(JSON.stringify({ error: "Unable to verify current password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const passwordCheckClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      const { error: passwordCheckError } = await passwordCheckClient.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });
      if (passwordCheckError) {
        return new Response(JSON.stringify({ error: "Current password is incorrect" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expected = (Deno.env.get("SUPER_ADMIN_PASSWORD_KEY") ?? "").trim();
      if (!expected) {
        return new Response(
          JSON.stringify({ error: "Secret key is not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (secretKey.trim() !== expected) {
        return new Response(JSON.stringify({ error: "Incorrect secret key" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword },
    );
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
