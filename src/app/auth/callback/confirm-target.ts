export function confirmTarget(search: string): string {
  const code = new URLSearchParams(search).get("code");
  if (code) return `/auth/confirm?code=${encodeURIComponent(code)}`;
  return "/sign-in?reason=auth_error";
}
