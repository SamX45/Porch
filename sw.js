// Porch service worker — deliberately minimal. It only caches the app shell
// (this page, the manifest, the icons) so the app still OPENS with no signal.
// It never touches Supabase requests, fonts, or the supabase-js script —
// those always go straight to the network, untouched.
const CACHE = "porch-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  // addAll() is all-or-nothing — if even one file 404s, the whole install
  // silently fails and this service worker never activates. Cache each file
  // on its own instead, so one bad file can't take down the rest.
  event.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(url => c.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
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
      .catch(() => caches.match(event.request)
        .then(cached => cached || caches.match("./index.html"))
        // last resort: never let respondWith resolve to nothing — an empty
        // response here can be exactly the kind of failure that crashes a
        // standalone launch instead of just showing an error page.
        .then(found => found || new Response("Porch is offline and this page isn't cached yet.", {status: 503, headers:{"Content-Type":"text/plain"}})))
  );
});
