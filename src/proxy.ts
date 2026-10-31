import { NextResponse, type NextRequest } from "next/server";
import { isLocale, matchLocale } from "@/lib/i18n/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    const res = NextResponse.next();
    res.cookies.set("NEXT_LOCALE", first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }
  const cookie = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = isLocale(cookie) ? cookie : matchLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*|opengraph-image|icon|apple-icon).*)"],
};
