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

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// index.html(205번째 줄 부근)에 기재된 본인의 firebaseConfig 정보입니다.
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

// 앱이 완전히 꺼져 있을 때 백그라운드에서 푸시 메시지를 수신하는 리스너
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] 백그라운드 메시지 수신:', payload);
    
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/9485/9485945.png', // 알림 팝업에 뜰 아이콘 주소
        vibrate: [200, 100, 200]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});