import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionFromClaims } from "./admin";
import { createLoginPath } from "./routes";
import { readSupabasePublicConfig } from "./supabase-config";

const PUBLIC_PATH_PREFIXES = ["/login", "/design-map"];

export async function updateAdminSession(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const config = readSupabasePublicConfig();

  if (!config.ok) {
    return redirectToLogin(request, "configuration");
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    config.value.url,
    config.value.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();

  if (error !== null || getAdminSessionFromClaims(data?.claims) === null) {
    return redirectToLogin(request, "session");
  }

  return supabaseResponse;
}

function redirectToLogin(request: NextRequest, error: string): NextResponse {
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginPath = createLoginPath(error, nextPath);
  const loginSearch = loginPath.includes("?")
    ? loginPath.slice(loginPath.indexOf("?"))
    : "";
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = loginSearch;
  return NextResponse.redirect(url);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
