// Porch service worker — deliberately minimal. It only caches the app shell
// (this page, the manifest, the icons) so the app still OPENS with no signal.
// It never touches Supabase requests, fonts, or the supabase-js script —
// those always go straight to the network, untouched.
const CACHE = "porch-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Only ever handle our own shell files, same-origin, GET requests.
  // Everything else (Supabase, realtime websockets, fonts, the supabase-js
  // CDN script) is left completely alone — this service worker does not
  // intercept it at all.
  if (event.request.method !== "GET" || url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(res => { caches.open(CACHE).then(c => c.put(event.request, res.clone())); return res; })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
