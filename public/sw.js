// Service worker for the two installed apps: the door scanner (/scan) and a
// security contact's alert page (/guard/<key>). Its one job is gate alerts —
// it caches nothing, so a stale scanner can never be served from here.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "دعوة", body: event.data ? event.data.text() : "" };
  }

  const isTest = data.type === "test";
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "دعوة — تنبيه أمن", {
        body: data.body || "",
        icon: "/icons/guard-192.png",
        badge: "/icons/badge-96.png",
        dir: "rtl",
        lang: "ar",
        // One notification per alert: a repeat push for the same alert
        // replaces it, and renotify makes the replacement ring again.
        tag: data.alertId || "da3wa-security",
        renotify: true,
        // Stays on screen until it is answered — an alarm that dismisses
        // itself after five seconds is one that gets missed.
        requireInteraction: !isTest,
        silent: false,
        vibrate: isTest ? [200, 100, 200] : [800, 200, 800, 200, 800, 200, 1500],
        data,
        actions: data.ack ? [{ action: "ack", title: "🏃 أنا جاي" }, { action: "open", title: "فتح" }] : [],
      });

      // An open guard page rings and flashes on its own as well.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: "security-alert", alert: data });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();

  event.waitUntil(
    (async () => {
      if (data.ack) {
        // Tapping the notification at all means the person saw it; the
        // explicit button and a plain tap both count as "on my way".
        await fetch(data.ack.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.ack.body),
        }).catch(() => {});
      }

      const target = new URL(data.url || "/", self.location.origin);
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).pathname === target.pathname && "focus" in client) {
          client.postMessage({ type: "security-acked", alertId: data.alertId });
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })()
  );
});
