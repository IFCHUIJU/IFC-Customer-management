const CACHE_NAME = 'crm-app-v1';
const ASSETS = [
  'index.html',
  'manifest.json'
];

// 최초 설치 시 필수 파일 캐싱
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// 오프라인 상태에서도 캐시된 파일로 구동
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});