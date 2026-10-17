import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function supabaseOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function contentSecurityPolicy(nonce: string): string {
  const origin = supabaseOrigin();
  const connectSrc = origin ? `'self' ${origin}` : "'self'";
  const evalSource = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalSource}`,
    process.env.NODE_ENV === "production"
      ? `style-src 'self' 'nonce-${nonce}'`
      : "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://avatars.githubusercontent.com",
    `connect-src ${connectSrc}`,
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action 'self'${origin ? ` ${origin}` : ""}`,
  ].join("; ");
}

function isSessionExempt(pathname: string): boolean {
  return (
    pathname === "/sign-in" ||
    pathname === "/auth/callback" ||
    pathname === "/auth/sign-out" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let signedIn = false;

  if (url && key && !request.nextUrl.pathname.startsWith("/_next/")) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set("Content-Security-Policy", policy);
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    try {
      const { data } = await supabase.auth.getUser();
      signedIn = Boolean(data.user);
    } catch {
      signedIn = false;
    }
  }

  const pathname = request.nextUrl.pathname;
  if (!signedIn && !isSessionExempt(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.search = "";
    const redirect = NextResponse.redirect(redirectUrl, 302);
    redirect.headers.set("Content-Security-Policy", policy);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
