const scope = new URL(self.registration.scope);
const index = new URL("index.html", scope).href;
const assetUrls = new Set(assets.map((path) => new URL(path, scope).href));
const cachePrefix = `quartier-libre:${scope.href}:`;
const cacheName = cachePrefix + revision;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assetUrls].map((url) => new Request(url, { cache: "reload" })));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function loadStartPage(request) {
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.status < 500) return response;
  } catch {
    // Losing the network must not replace the last complete offline release.
  }
  const cache = await caches.open(cacheName);
  return await cache.match(index) ?? Response.error();
}

async function loadAsset(request) {
  const cache = await caches.open(cacheName);
  return await cache.match(request) ?? fetch(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    const url = new URL(request.url);
    if (url.origin === scope.origin &&
        (url.pathname === scope.pathname || url.pathname === new URL(index).pathname)) {
      event.respondWith(loadStartPage(request));
    }
  } else if (assetUrls.has(request.url)) {
    event.respondWith(loadAsset(request));
  }
});
