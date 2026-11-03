# Project Notes

- Password changes for any user go through the `update-user-password` edge function only (server-side super_admin role check via `user_roles`; admin API is never called from the browser). A super admin changing their own password must additionally pass the `SUPER_ADMIN_PASSWORD_KEY` secret, verified server-side in the function — never client-side.
