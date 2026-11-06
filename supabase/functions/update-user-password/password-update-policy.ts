export function currentPasswordError(
  callerId: string,
  targetUserId: string,
  currentPassword: string,
): string | null {
  if (callerId === targetUserId && currentPassword.length === 0) {
    return "Current password is required";
  }
  return null;
}