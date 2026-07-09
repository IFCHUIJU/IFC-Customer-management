import admin from 'firebase-admin';

// Firebase Admin SDK 초기화 (중복 초기화 방지)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Vercel 환경변수에서 줄바꿈(\n) 처리가 깨지는 것을 방지하는 정규식 고정
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        }),
    });
}

const db = admin.firestore();
const messaging = admin.messaging();

export default async function handler(req, res) {
    // ============================================================
    // 🌟 [추가됨] 1. PC에서 실시간으로 푸시 요청을 보냈을 때 (POST)
    // ============================================================
    if (req.method === 'POST') {
        try {
            const { tokens, title, body } = req.body;

            if (!tokens || tokens.length === 0) {
                return res.status(400).json({ success: false, error: '전송할 스마트폰 토큰 주소가 없습니다.' });
            }

            // 다중 스마트폰 기기에 실시간 FCM 클라우드 푸시 신호 발송
            const message = {
                notification: { title, body },
                tokens: tokens,
            };

            const response = await messaging.sendEachForMulticast(message);
            console.log('실시간 푸시 발송 완료:', response.successCount, '건 성공');

            return res.status(200).json({ success: true, successCount: response.successCount });
        } catch (error) {
            console.error('실시간 푸시 서버 오류:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // ============================================================
    // ⏰ 2. 기존 로직: 매일 아침 9시 자동 스케줄러 작동할 때 (GET)
    // ============================================================
    if (req.method === 'GET') {
        // Vercel 크론잡 보안 검증 (내가 설정한 비밀키와 일치하는지 확인)
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ success: false, error: '권한이 없는 요청입니다.' });
        }

        try {
            // 오늘 날짜 구하기 (KST 기준 가공)
            const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            
            const todayFormated = `${year}-${month}-${day}`; // "2026-07-09"
            const todayMMDD = `${month}-${day}`; // "07-09"

            console.log(`[크론잡 시작] 기준 날짜: ${todayFormated}`);

            // 1. 전체 고객 명단 가져오기
            const customersSnapshot = await db.collection('customers').get();
            
            // 2. 푸시 주소록(토큰) 전체 가져오기
            const tokensSnapshot = await db.collection('user_tokens').get();
            const userTokensMap = {}; // { uid: [token1, token2] } 구조로 맵핑
            
            tokensSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.uid && data.token) {
                    if (!userTokensMap[data.uid]) userTokensMap[data.uid] = [];
                    userTokensMap[data.uid].push(data.token);
                }
            });

            let totalSentCount = 0;

            // 3. 오늘 알림 대상 고객 선별 및 발송
            for (const doc of customersSnapshot.docs) {
                const customer = doc.data();
                const userTokens = userTokensMap[customer.uid] || [];
                
                if (userTokens.length === 0) continue; // 전송할 스마트폰 기기가 없으면 패스

                let isTarget = false;
                let alertTitle = '';
                let alertBody = '';

                // ① 생일 체크
                if (customer.birthdate && customer.birthdate !== '미입력') {
                    if (customer.birthdate.substring(5, 10) === todayMMDD) {
                        isTarget = true;
                        alertTitle = '🎂 생일 축하 알림';
                        alertBody = `${customer.name} 고객님의 생일입니다! 축하 메시지를 보내보세요. 🎉`;
                    }
                }

                // ② 보험 가입일 디데이 체크 (100일, 1년 단위 등)
                if (!isTarget && customer.baseDate) {
                    const startDate = new Date(customer.baseDate);
                    const timeDiff = today.getTime() - startDate.getTime();
                    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24)); // 지나온 날짜수 계산

                    if (daysDiff === 100) {
                        isTarget = true;
                        alertTitle = '💯 가입 100일 기념 알림';
                        alertBody = `${customer.name} 고객님이 가입하신 지 100일째 되는 날입니다! ✨`;
                    } else if (daysDiff > 0 && daysDiff % 365 === 0) {
                        const years = daysDiff / 365;
                        isTarget = true;
                        alertTitle = `🚀 가입 ${years}주년 기념 알림`;
                        alertBody = `${customer.name} 고객님이 가입하신 지 벌써 ${years}주년이 되었습니다! ❤️`;
                    }
                }

                // 대상자일 경우 FCM 서버를 통해 스마트폰으로 알림 일괄 전송
                if (isTarget) {
                    const message = {
                        notification: { title: alertTitle, body: alertBody },
                        tokens: userTokens,
                    };
                    await messaging.sendEachForMulticast(message);
                    totalSentCount++;
                }
            }

            return res.status(200).json({ success: true, message: `아침 정기 알림 ${totalSentCount}건 발송 완료.` });

        } catch (error) {
            console.error('크론잡 자동 알림 오류:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // 허용되지 않은 다른 통신 방식 필터링
    return res.status(405).json({ success: false, error: '허용되지 않은 요청 메서드입니다.' });
}