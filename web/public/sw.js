self.addEventListener("push", (event) => {
  let payload = { title: "Lila Agent", body: "New activity", url: "/bot", tag: "lila" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    /* ignore */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag || "lila",
      data: { url: payload.url || "/bot" },
      icon: "/lila-icon.svg",
      badge: "/lila-icon.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/bot";
  const path = url.startsWith("http") ? new URL(url).pathname + new URL(url).search : url;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(path);
    }),
  );
});
