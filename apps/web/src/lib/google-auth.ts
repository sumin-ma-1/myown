type GoogleAuthPurpose = "login" | "signup";

export function googleAuthUrl(purpose: GoogleAuthPurpose, inviteCode?: string): string {
  const params = new URLSearchParams({ purpose });
  if (inviteCode?.trim()) {
    params.set("code", inviteCode.trim());
  }
  return `/api/auth/google/start?${params.toString()}`;
}
