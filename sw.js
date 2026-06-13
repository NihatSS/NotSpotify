const CACHE = "nospotify-v2";
const ASSETS = ["./", "./index.html", "./css/style.css", "./css/responsive.css"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
