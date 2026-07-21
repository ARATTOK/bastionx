const CACHE = 'bastionx-v1'
const STATIC = [
  './',
  './login.html',
  './dashboard.html',
  './server-detail.html',
  './add-server.html',
  './edit-server.html',
  './tags.html',
  './report.html',
  './labels.html',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './css/style.css',
  './js/supabase.js',
  './js/toast.js',
  './js/audit.js',
  './js/app.js',
  './js/detail-server.js',
  './js/add-server.js',
  './js/edit-server.js',
  './js/login.js',
  './js/tags-app.js',
  './js/report.js',
  './js/labels.js',
  './manifest.json'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => { if (k !== CACHE) return caches.delete(k) }))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  if (url.hostname.includes('supabase')) {
    e.respondWith(networkFirst(e.request))
    return
  }

  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirst(e.request))
  }
})

async function cacheFirst(req) {
  const cached = await caches.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    if (res.ok) {
      const cache = await caches.open(CACHE)
      cache.put(req, res.clone())
    }
    return res
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req)
    if (res.ok) {
      const cache = await caches.open(CACHE)
      cache.put(req, res.clone())
    }
    return res
  } catch {
    const cached = await caches.match(req)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
