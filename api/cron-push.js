// api/cron-push.js
import admin from 'firebase-admin';

// 서버용 Firebase Admin SDK 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  // Vercel 시스템에서 보낸 정당한 크론 요청인지 보안 검증
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  const db = admin.firestore();
  const today = new Date();
  // 한국 시간에 맞추기 위해 시간 조정 (Vercel 서버는 기본적으로 UTC 세계 표준시 기준임)
  const kstToday = new Date(today.getTime() + (9 * 60 * 60 * 1000));
  const todayMMDD = `${String(kstToday.getMonth() + 1).padStart(2, '0')}-${String(kstToday.getDate()).padStart(2, '0')}`;

  try {
    // 1. 등록된 모든 고객 정보 가져오기
    const customersSnapshot = await db.collection('customers').get();
    
    for (const doc of customersSnapshot.docs) {
      const c = doc.data();
      
      // 2. 만약 오늘이 고객의 생일이라면? (index.html에 있던 로직을 서버에서 수행)
      if (c.birthdate && c.birthdate.substring(5, 10) === todayMMDD) {
        
        // 3. 해당 고객을 등록한 유저(UID)의 스마트폰 푸시 토큰 주소를 찾음
        const tokenSnapshot = await db.collection('user_tokens').where('uid', '==', c.uid).get();
        
        for (const tokenDoc of tokenSnapshot.docs) {
          const userToken = tokenDoc.data().token;
          
          // 4. 스마트폰으로 즉시 푸시 알림 발송!
          const message = {
            notification: {
              title: '🎂 생일 축하 알림',
              body: `${c.name} 고객님의 생일 당일입니다! 🎉`,
            },
            token: userToken,
          };
          
          await admin.messaging().send(message);
        }
      }
    }

    return res.status(200).json({ success: true, message: '백그라운드 푸시 발송 완료' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}