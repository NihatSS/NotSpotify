const CACHE = "pulsestream-v1";
const ASSETS = ["./", "./index.html", "./login.html", "./signup.html", "./artist-dashboard.html", "./css/style.css", "./css/responsive.css"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
