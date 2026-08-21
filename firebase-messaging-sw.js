const CACHE_NAME = 'crm-app-v2';
const ASSETS = [
  '/',
  'index.html',
  'manifest.json'
];

// 최초 설치 시 필수 파일 캐싱
self.addEventListener('install', e => {
  self.skipWaiting(); // 새 서비스워커 즉시 활성화
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// 서비스 워커 활성화 및 구버전 캐시 정리
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 오프라인 상태 지원 (API 요청 및 외부 통신 제외)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
  
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBNp-ZFEUjF_QoYG7OaEWB234-hC8hj8Fc",
    authDomain: "my-crm-app-f9628.firebaseapp.com",
    projectId: "my-crm-app-f9628",
    storageBucket: "my-crm-app-f9628.firebasestorage.app",
    messagingSenderId: "944641343634",
    appId: "1:944641343634:web:3a7f5c432dadbea7cba64b"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 💡 [핵심 수정] 백그라운드 메시지 수신 시 로그만 출력합니다.
// (showNotification을 지워야 브라우저 중복 알림이 발생하지 않습니다.)
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] 백그라운드 메시지 수신:', payload);
});