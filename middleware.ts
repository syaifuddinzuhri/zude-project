import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, UNLOCK_COOKIE, cookieBase, signUnlock, verifySession, verifyUnlock } from "@/lib/auth/session";

const PUBLIC = ["/login", "/setup", "/offline", "/api/cron", "/api/auth", "/api/health"];
const PIN_FREE = ["/kunci", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sesi berakhir" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  // PIN diminta setiap website dibuka & setelah tidak aktif (IDLE_MINUTES)
  if (session.pin && !PIN_FREE.some((p) => pathname.startsWith(p))) {
    const unlock = await verifyUnlock(req.cookies.get(UNLOCK_COOKIE)?.value, session.uid);
    if (!unlock) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Website terkunci" }, { status: 423 });
      const url = req.nextUrl.clone();
      url.pathname = "/kunci";
      url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
    // Perpanjang (sliding) bila sudah > 1 menit
    if (Date.now() / 1000 - unlock.iat > 60) {
      const res = NextResponse.next();
      // Tanpa maxAge = cookie sesi: hilang saat aplikasi ditutup → PIN diminta lagi.
      res.cookies.set(UNLOCK_COOKIE, await signUnlock(session.uid), cookieBase);
      return res;
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sw.js|manifest.webmanifest|favicon.ico|icon.svg|icon-.*\\.png|apple-touch-icon.png|logo-.*|robots.txt).*)"],
};
