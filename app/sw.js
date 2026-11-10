/* NUMMAZA — service worker: приложение открывается и без интернета (iPhone «На экран Домой», Android Chrome).
   Сначала сеть, чтобы обновление приходило сразу после деплоя; нет сети или она висит дольше 4 секунд —
   берём сохранённую копию. pdf.js и шрифты не меняются — сразу из копии. Запросы к /api не трогаем.
   При установке сохраняем все файлы текущей версии по списку из /api/bundle. */
'use strict';
const CACHE = 'nummaza-files';
const TIMEOUT = 4000;
const BASE = new URL('./', self.location).href;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let files = [];
    try {
      const m = await (await fetch(BASE + 'api/bundle', { cache: 'no-store' })).json();
      files = m.files.map((f) => f.p).filter((p) => p !== 'sw.js');
    } catch (err) { /* нет сети — сохраним только страницу, остальное по мере загрузки */ }
    await Promise.all(['./', 'js/config.js'].concat(files).map((p) =>
      fetch(BASE + p, { cache: 'no-cache' }).then((r) => (r.ok ? cache.put(BASE + p, r) : null)).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function keyOf(req) {
  // Все переходы по страницам — это одна страница приложения (маршруты в #hash)
  return req.mode === 'navigate' ? BASE : req.url.split('#')[0].split('?')[0];
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const key = keyOf(req);
  const net = fetch(req).then((r) => {
    if (r.ok && r.type === 'basic') cache.put(key, r.clone());
    return r;
  });
  net.catch(() => { /* ответили из копии — ошибка сети уже не важна */ });
  const timer = new Promise((resolve) => setTimeout(resolve, TIMEOUT));
  try {
    const first = await Promise.race([net, timer.then(() => null)]);
    if (first) return first;
    const saved = await cache.match(key);
    return saved || await net; // сохранённого нет — ждём сеть дальше
  } catch (err) {
    const saved = await cache.match(key);
    if (saved) return saved;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const key = keyOf(req);
  const saved = await cache.match(key);
  if (saved) return saved;
  const r = await fetch(req);
  if (r.ok && r.type === 'basic') cache.put(key, r.clone());
  return r;
}

// Push-напоминания с сервера (сколько можно потратить, завтра платёж)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'NUMMAZA', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'NUMMAZA', { body: d.body || '', tag: d.tag, icon: BASE + 'icons/icon-192.png', badge: BASE + 'icons/favicon-32.png' }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = list.find((c) => c.url.startsWith(BASE));
    if (open) return open.focus();
    return self.clients.openWindow(BASE);
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith(new URL(BASE).pathname + 'api/')) return;
  e.respondWith(/\/(vendor|fonts)\//.test(url.pathname) ? cacheFirst(req) : networkFirst(req));
});
