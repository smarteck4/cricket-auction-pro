import { currentPasswordError } from "./password-update-policy.ts";

Deno.test("changing your own password requires the current password", () => {
  const error = currentPasswordError("user-1", "user-1", "");
  if (error !== "Current password is required") {
    throw new Error(`Expected current password requirement, got ${String(error)}`);
  }
});

Deno.test("changing another user's password does not require the caller's current password", () => {
  const error = currentPasswordError("admin-1", "user-2", "");
  if (error !== null) {
    throw new Error(`Expected no current password requirement, got ${error}`);
  }
});