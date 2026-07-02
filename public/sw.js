const cacheName = "mesay-v8";
const coreAssets = ["/", "/app/login", "/manifest.webmanifest", "/favicon.png?v=8", "/icon-192.png?v=8", "/icon-512.png?v=8", "/apple-touch-icon.png?v=8"];

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
      icon: "/icon-192.png?v=8",
      badge: "/icon-192.png?v=8",
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
  const targetUrl = safeAppUrl(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin && "focus" in client);
      if (existing) {
        if ("navigate" in existing) return existing.navigate(targetUrl).then((client) => client?.focus());
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

function safeAppUrl(value) {
  try {
    const url = new URL(value || "/app/tables", self.location.origin);
    if (url.origin !== self.location.origin) return `${self.location.origin}/app/tables`;
    return url.href;
  } catch {
    return `${self.location.origin}/app/tables`;
  }
}
