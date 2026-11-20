import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieBase, signSession, verifySession } from "@/lib/auth/session";

const PUBLIC = ["/login", "/offline", "/api/cron", "/api/health"];

/** Semua halaman butuh PIN. Sesi diperpanjang (sliding) selama masih aktif. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Terkunci, masukkan PIN" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + search)}` : "";
    return NextResponse.redirect(url);
  }
  if (Date.now() / 1000 - session.iat > 60) {
    const res = NextResponse.next();
    res.cookies.set(SESSION_COOKIE, await signSession(session), cookieBase);
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sw.js|manifest.webmanifest|favicon.ico|icon.svg|icon-.*\\.png|apple-touch-icon.png|logo-.*|avatar.*|robots.txt).*)"],
};
