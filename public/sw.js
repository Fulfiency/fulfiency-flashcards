const APP_SHELL_CACHE = "fulfiency-shell-v1";
// /dashboard exclu volontairement : route authentifiée, la précacher à l'install (avant tout login)
// figerait la redirection /login sous la clé /dashboard dans le cache.
const APP_SHELL_URLS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  // Pas de skipWaiting() : on laisse le cycle de vie normal du SW s'appliquer, pour ne pas
  // prendre le contrôle d'une page déjà en cours de chargement/hydratation (ça provoquait
  // un cycle de rechargement en boucle en dev avec Turbopack).
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== APP_SHELL_CACHE).map((k) => caches.delete(k)))
    )
  );
});

// Network-first pour les navigations (pages HTML) : le réseau est toujours prioritaire, le cache
// ne sert que de secours hors-ligne. Sert du cache-first pour les navigations, on se retrouve avec
// du HTML périmé référençant des chunks JS qui n'existent plus dès que le build change (nouveau
// déploiement, ou même juste un redémarrage du serveur dev) → ChunkLoadError en boucle.
// Les assets statiques (JS/CSS/images hashés) restent en cache-first, sûr car leur nom change à
// chaque contenu différent.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isNavigation = req.mode === "navigate" || req.destination === "document";

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, res.clone()));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.open(APP_SHELL_CACHE).then((cache) => cache.match(req));
          return cached ?? Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.open(APP_SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? "Fulfiency Flashcards";
  const body = data.body ?? "Tu as des cartes à réviser !";
  const icon = data.icon ?? "/icon-192.png";
  const badge = data.badge ?? "/icon-192.png";
  const url = data.url ?? "/dashboard";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
