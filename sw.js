const CACHE = 'bastionx-v9'
const STATIC = [
  './',
  './login.html',
  './dashboard.html',
  './servers.html',
  './services.html',
  './networks.html',
  './infrastructure.html',
  './admin.html',
  './admin-users.html',
  './admin-services.html',
  './admin-subnets.html',
  './admin-audit.html',
  './server-detail.html',
  './add-server.html',
  './edit-server.html',
  './tags.html',
  './report.html',
  './labels.html',
  './images/favicon.svg',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/icon-180.png',
  './css/style.css',
  './js/core/supabase.js',
  './js/core/toast.js',
  './js/core/utils.js',
  './js/core/audit.js',
  './js/pages/login.js',
  './js/pages/dashboard.js',
  './js/pages/servers.js',
  './js/pages/services.js',
  './js/pages/networks.js',
  './js/pages/infrastructure.js',
  './js/pages/server-detail.js',
  './js/pages/add-server.js',
  './js/pages/edit-server.js',
  './js/pages/admin.js',
  './js/pages/admin-users.js',
  './js/pages/admin-services.js',
  './js/pages/admin-subnets.js',
  './js/pages/admin-audit.js',
  './js/pages/tags.js',
  './js/pages/report.js',
  './js/pages/labels.js',
  './manifest.json'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return c.addAll(STATIC).catch(err => console.warn('Cache addAll skipped:', err))
    }).then(() => self.skipWaiting())
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
