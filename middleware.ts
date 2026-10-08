import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  createSupabaseFetch,
} from "@/lib/supabase/fetch";

// Refreshes the Supabase session cookie on every request, so server components
// and route handlers always see a valid session.
// (Next.js 16 prefers the name "proxy.ts"; middleware.ts still works and is kept
// for now so the Supabase docs snippets copy-paste cleanly.)
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Auth links (Google sign-in, email confirmation, password reset) come back as
  // ?code=... (PKCE). Exchange the code for a session cookie here on the server, so
  // server-checked pages like /app see the user on the very first request. Then
  // redirect to the same URL without the code.
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("code");
    const redirect = NextResponse.redirect(clean);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // Do not put code between createServerClient and getUser(): getUser() is what
  // refreshes an expired session and writes the new cookie.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, image files, and the payment callbacks:
    // the Stripe webhook and 藍新 notify/return (machine-to-machine or cross-site
    // POSTs — no session to refresh, and the body must reach the handler untouched
    // for signature verification).
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|api/stripe/webhook|api/credits/newebpay/notify|api/credits/newebpay/return|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
