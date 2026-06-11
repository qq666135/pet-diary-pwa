// PWA Service Worker — 毛孩子成长记
// 策略：网络优先 + 离线兜底
const CACHE_NAME = 'petdiary-v4'
const RUNTIME_CACHE = 'petdiary-runtime-v4'

// 需要预缓存的核心资源
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './app-icon.png',
]

// ========== 安装：预缓存核心资源 ==========
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ========== 激活：清理所有旧版本缓存 ==========
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  )
})

// ========== 请求：全部网络优先，失败时用缓存兜底 ==========
self.addEventListener('fetch', (event) => {
  const { request } = event

  // 跳过非 GET 请求
  if (request.method !== 'GET') return

  // 跳过非 http(s) 请求
  if (!request.url.startsWith('http')) return

  // 跳过 API 请求（始终走网络）
  if (request.url.includes('/api/') || request.url.includes('dashscope.aliyuncs.com')) {
    return
  }

  // 全部请求：网络优先，失败时用缓存兜底
  event.respondWith(networkFirst(request))
})

// ========== 网络优先策略 ==========
async function networkFirst(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const clone = res.clone()
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone))
    }
    return res
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // HTML 导航请求 → 返回缓存的 index.html
    if (request.mode === 'navigate') {
      return caches.match('./index.html') || caches.match('./')
    }
    return new Response('离线状态，请连接网络后重试', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

// ========== 推送通知（预留） ==========
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || '毛孩子成长记'
  const options = {
    body: data.body || '快来看看你家宝贝的新变化吧 🐾',
    icon: './app-icon.png',
    badge: './app-icon.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
