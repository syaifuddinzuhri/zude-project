/* ZuDe service worker — REQUIREMENTS 5.2 & 3.13.1
 * - Cache aset statis saja (JS, CSS, font, ikon).
 * - Data keuangan & halaman: network-only (tidak ada mode offline).
 * - Push notification + notificationclick + badge ikon.
 */
const VERSION = "zude-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon.svg", "/logo-horizontal.svg", "/logo-horizontal-dark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStatic(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      /\.(?:js|css|woff2?|ttf|png|svg|ico|webp)$/.test(url.pathname)) &&
    !url.pathname.startsWith("/api/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (isStatic(url)) {
    // cache-first untuk aset statis berhash
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    // network-only; jika tidak ada koneksi tampilkan halaman offline
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
  // selain itu (API, RSC): biarkan browser (network-only, tidak di-cache)
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ZuDe", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ZuDe";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
    lang: "id",
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      if (typeof data.badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
        try {
          if (data.badge > 0) await self.navigator.setAppBadge(data.badge);
          else await self.navigator.clearAppBadge();
        } catch {}
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          await c.focus();
          if ("navigate" in c) return c.navigate(target);
          return;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
