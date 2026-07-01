const cacheName = "mesay-v7";
const coreAssets = ["/", "/app/login", "/manifest.webmanifest", "/favicon.png?v=7", "/icon-192.png?v=7", "/icon-512.png?v=7", "/apple-touch-icon.png?v=7"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(coreAssets)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/app/login")))
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: "/icon-192.png?v=7",
      badge: "/icon-192.png?v=7",
      tag: data.tag || "mesay-notification",
      data: { url: data.url || "/app/tables" },
      vibrate: [200, 100, 200]
    };
    event.waitUntil(self.registration.showNotification(data.title || "MesaY", options));
  } catch {
    // Fallback for plain text push
    event.waitUntil(self.registration.showNotification("MesaY", { body: event.data.text() }));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app/tables";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url) && "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
