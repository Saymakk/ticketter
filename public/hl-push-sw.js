self.addEventListener("push", (event) => {
  let data = {
    title: "Healthy Life",
    body: "",
    url: "/",
    tag: "healthy-life",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        title: parsed.title || data.title,
        body: parsed.body || "",
        url: parsed.url || "/",
        tag: parsed.tag || data.tag,
      };
    }
  } catch {
    try {
      data.body = event.data ? event.data.text() : "";
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/hl-192.png",
      badge: "/icons/hl-32.png",
      tag: data.tag,
      renotify: true,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(target);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
