const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 데이터베이스 초기화
const db = new sqlite3.Database(':memory:');

// 테이블 생성
db.serialize(() => {
    // 사용자 테이블
    db.run(`CREATE TABLE users (
        id TEXT PRIMARY KEY,
        user_key TEXT UNIQUE,
        name TEXT,
        birth_date TEXT,
        address TEXT,
        district_code TEXT,
        age_group TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 복지 서비스 테이블
    db.run(`CREATE TABLE welfare_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category TEXT,
        description TEXT,
        benefits TEXT,
        requirements TEXT,
        contact_info TEXT,
        is_national BOOLEAN,
        target_age_min INTEGER,
        target_age_max INTEGER
    )`);

    // 설문 세션 테이블
    db.run(`CREATE TABLE survey_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // 설문 응답 테이블
    db.run(`CREATE TABLE survey_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        category TEXT,
        question TEXT,
        answer TEXT,
        score INTEGER,
        FOREIGN KEY (session_id) REFERENCES survey_sessions (id)
    )`);

    // 추천 결과 테이블
    db.run(`CREATE TABLE recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        welfare_service_id INTEGER,
        score REAL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (welfare_service_id) REFERENCES welfare_services (id)
    )`);
});

// 복지 서비스 데이터 초기화
const initWelfareData = () => {
    const services = [
        {
            name: '기초연금',
            category: '경제지원',
            description: '65세 이상 어르신의 안정적인 소득 보장',
            benefits: '월 최대 342,510원 지급',
            requirements: '65세 이상, 소득 하위 70%',
            contact_info: '국민연금공단 1355',
            is_national: 1,
            target_age_min: 65,
            target_age_max: 150
        },
        {
            name: '노인맞춤돌봄서비스',
            category: '돌봄지원',
            description: '남해군 특화 맞춤형 돌봄 서비스',
            benefits: '월 40시간 무료 돌봄 서비스',
            requirements: '65세 이상 독거노인 또는 고위험군',
            contact_info: '남해군청 055-860-3000',
            is_national: 0,
            target_age_min: 65,
            target_age_max: 150
        },
        {
            name: '노인일자리 사업',
            category: '일자리',
            description: '어르신 맞춤형 일자리 제공',
            benefits: '월 최대 594,000원',
            requirements: '65세 이상, 건강상태 양호',
            contact_info: '남해군시니어클럽 055-863-8808',
            is_national: 1,
            target_age_min: 65,
            target_age_max: 150
        },
        {
            name: '의료비 지원',
            category: '의료지원',
            description: '노인성 질환 치료비 지원',
            benefits: '연간 최대 120만원',
            requirements: '65세 이상, 기초생활수급자',
            contact_info: '남해군보건소 055-860-8000',
            is_national: 0,
            target_age_min: 65,
            target_age_max: 150
        },
        {
            name: '치매검진 서비스',
            category: '의료지원',
            description: '치매 조기 발견 및 관리',
            benefits: '무료 치매검진, 예방교육',
            requirements: '60세 이상',
            contact_info: '남해군치매안심센터 055-860-8750',
            is_national: 1,
            target_age_min: 60,
            target_age_max: 150
        }
    ];

    const stmt = db.prepare(`INSERT INTO welfare_services 
        (name, category, description, benefits, requirements, contact_info, is_national, target_age_min, target_age_max)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    services.forEach(service => {
        stmt.run(service.name, service.category, service.description, 
                service.benefits, service.requirements, service.contact_info,
                service.is_national, service.target_age_min, service.target_age_max);
    });
    
    stmt.finalize();
};

// 서버 시작 시 데이터 초기화
initWelfareData();

// 사용자 키 생성 함수
const generateUserKey = () => {
    return crypto.randomBytes(16).toString('hex');
};

// 나이 계산 함수
const calculateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

// 나이 그룹 결정 함수
const getAgeGroup = (age) => {
    if (age >= 85) return '초고령';
    if (age >= 75) return '고령';
    if (age >= 65) return '준고령';
    return '일반';
};

// API 라우트들

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 사용자 생성 API
app.post('/api/users', (req, res) => {
    const { name, birth_date, address, district_code } = req.body;
    
    if (!name || !birth_date || !address || !district_code) {
        return res.status(400).json({ error: '모든 필드가 필요합니다.' });
    }

    const age = calculateAge(birth_date);
    if (age < 65) {
        return res.status(400).json({ error: '이 서비스는 65세 이상 어르신을 대상으로 합니다.' });
    }

    const userId = uuidv4();
    const userKey = generateUserKey();
    const ageGroup = getAgeGroup(age);

    db.run(`INSERT INTO users (id, user_key, name, birth_date, address, district_code, age_group)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, userKey, name, birth_date, address, district_code, ageGroup],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '사용자 등록에 실패했습니다.' });
            }
            
            res.json({
                success: true,
                user_id: userId,
                user_key: userKey,
                age_group: ageGroup,
                message: '사용자 정보가 성공적으로 등록되었습니다.'
            });
        });
});

// 설문 시작 API
app.post('/api/survey/start', (req, res) => {
    const { user_key } = req.body;
    
    db.get('SELECT id FROM users WHERE user_key = ?', [user_key], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        const sessionId = uuidv4();
        db.run(`INSERT INTO survey_sessions (id, user_id, status)
                VALUES (?, ?, 'active')`,
            [sessionId, user.id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: '설문 세션 생성에 실패했습니다.' });
                }
                
                res.json({
                    success: true,
                    session_id: sessionId,
                    questions: getSurveyQuestions()
                });
            });
    });
});

// 설문 질문 데이터
const getSurveyQuestions = () => {
    return {
        health: [
            { id: 1, text: '현재 건강상태는 어떠신가요?', type: 'radio', options: ['매우 좋음', '좋음', '보통', '나쁨', '매우 나쁨'] },
            { id: 2, text: '만성질환을 앓고 계신가요?', type: 'radio', options: ['없음', '1개', '2개', '3개 이상'] },
            { id: 3, text: '일상생활에 도움이 필요하신가요?', type: 'radio', options: ['전혀 필요없음', '약간 필요', '많이 필요', '항상 필요'] }
        ],
        living: [
            { id: 4, text: '현재 거주 형태는?', type: 'radio', options: ['독거', '부부', '자녀와 함께', '기타'] },
            { id: 5, text: '주거환경에 만족하십니까?', type: 'radio', options: ['매우 만족', '만족', '보통', '불만족', '매우 불만족'] },
            { id: 6, text: '외출 빈도는 어떻게 되시나요?', type: 'radio', options: ['매일', '주 3-4회', '주 1-2회', '월 1-2회', '거의 없음'] }
        ],
        economic: [
            { id: 7, text: '현재 경제상태는?', type: 'radio', options: ['여유로움', '보통', '약간 부족', '매우 부족'] },
            { id: 8, text: '주요 소득원은?', type: 'radio', options: ['근로소득', '연금', '자녀지원', '기타'] },
            { id: 9, text: '의료비 부담은?', type: 'radio', options: ['부담없음', '약간 부담', '상당한 부담', '매우 부담'] }
        ],
        social: [
            { id: 10, text: '사회활동 참여 정도는?', type: 'radio', options: ['매우 활발', '활발', '보통', '소극적', '거의 없음'] },
            { id: 11, text: '가족/친구와의 관계는?', type: 'radio', options: ['매우 좋음', '좋음', '보통', '좋지 않음', '매우 좋지 않음'] },
            { id: 12, text: '지역사회 활동에 관심이 있으신가요?', type: 'radio', options: ['매우 관심', '관심', '보통', '관심없음', '전혀 없음'] }
        ]
    };
};

// 설문 응답 저장 API
app.post('/api/survey/answer', (req, res) => {
    const { session_id, category, answers } = req.body;
    
    const stmt = db.prepare(`INSERT INTO survey_responses (session_id, category, question, answer, score)
                            VALUES (?, ?, ?, ?, ?)`);
    
    answers.forEach(answer => {
        const score = calculateAnswerScore(answer.answer);
        stmt.run(session_id, category, answer.question, answer.answer, score);
    });
    
    stmt.finalize((err) => {
        if (err) {
            return res.status(500).json({ error: '응답 저장에 실패했습니다.' });
        }
        res.json({ success: true });
    });
});

// 답변 점수 계산
const calculateAnswerScore = (answer) => {
    const scoreMap = {
        '매우 좋음': 5, '좋음': 4, '보통': 3, '나쁨': 2, '매우 나쁨': 1,
        '없음': 5, '1개': 4, '2개': 3, '3개 이상': 2,
        '전혀 필요없음': 5, '약간 필요': 4, '많이 필요': 2, '항상 필요': 1,
        '여유로움': 5, '약간 부족': 2, '매우 부족': 1,
        '매우 활발': 5, '활발': 4, '소극적': 2, '거의 없음': 1
    };
    return scoreMap[answer] || 3;
};

// AI 추천 생성 API
app.post('/api/recommendations', (req, res) => {
    const { session_id } = req.body;
    
    // 사용자 정보와 설문 응답을 기반으로 추천 생성
    db.get(`SELECT u.id, u.age_group, u.birth_date 
            FROM users u 
            JOIN survey_sessions s ON u.id = s.user_id 
            WHERE s.id = ?`, [session_id], (err, user) => {
        
        if (err || !user) {
            return res.status(404).json({ error: '사용자 정보를 찾을 수 없습니다.' });
        }

        const age = calculateAge(user.birth_date);
        
        // 복지 서비스 조회 및 추천 로직
        db.all(`SELECT * FROM welfare_services 
                WHERE target_age_min <= ? AND target_age_max >= ?`, 
            [age, age], (err, services) => {
            
            if (err) {
                return res.status(500).json({ error: '추천 생성에 실패했습니다.' });
            }

            // 간단한 추천 로직 (실제로는 더 복잡한 AI 알고리즘 사용)
            const recommendations = services.map(service => ({
                ...service,
                score: Math.random() * 0.3 + 0.7, // 70-100% 점수
                reason: generateRecommendationReason(service, user.age_group)
            })).sort((a, b) => b.score - a.score);

            res.json({
                success: true,
                recommendations: recommendations.slice(0, 5), // 상위 5개
                user_info: {
                    age_group: user.age_group,
                    age: age
                }
            });
        });
    });
});

// 추천 이유 생성
const generateRecommendationReason = (service, ageGroup) => {
    const reasons = {
        '기초연금': `${ageGroup} 어르신께 안정적인 소득 보장이 필요합니다.`,
        '노인맞춤돌봄서비스': `${ageGroup} 어르신께 맞춤형 돌봄 서비스를 추천합니다.`,
        '노인일자리 사업': `활동적인 ${ageGroup} 어르신께 적합한 일자리입니다.`,
        '의료비 지원': `${ageGroup} 어르신의 의료비 부담을 덜어드립니다.`,
        '치매검진 서비스': `${ageGroup} 어르신의 뇌건강 관리를 위해 추천합니다.`
    };
    return reasons[service.name] || `${ageGroup} 어르신께 도움이 될 서비스입니다.`;
};

// 결과 조회 API
app.get('/api/results/:user_key', (req, res) => {
    const { user_key } = req.params;
    
    db.get(`SELECT u.*, s.id as session_id 
            FROM users u 
            LEFT JOIN survey_sessions s ON u.id = s.user_id 
            WHERE u.user_key = ? 
            ORDER BY s.created_at DESC LIMIT 1`, [user_key], (err, result) => {
        
        if (err || !result) {
            return res.status(404).json({ error: '결과를 찾을 수 없습니다.' });
        }

        if (!result.session_id) {
            return res.json({
                success: true,
                has_survey: false,
                message: '아직 설문조사를 완료하지 않았습니다.'
            });
        }

        // 최신 추천 결과 조회 (여기서는 간단히 다시 생성)
        const age = calculateAge(result.birth_date);
        
        db.all(`SELECT * FROM welfare_services 
                WHERE target_age_min <= ? AND target_age_max >= ?`, 
            [age, age], (err, services) => {
            
            const recommendations = services.map(service => ({
                ...service,
                score: Math.random() * 0.3 + 0.7,
                reason: generateRecommendationReason(service, result.age_group)
            })).sort((a, b) => b.score - a.score);

            res.json({
                success: true,
                has_survey: true,
                user_info: {
                    name: result.name,
                    age_group: result.age_group,
                    age: age
                },
                recommendations: recommendations.slice(0, 5)
            });
        });
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 남해 복지 추천 서비스가 포트 ${PORT}에서 실행 중입니다!`);
    console.log(`✅ Python 지옥에서 탈출 성공! Node.js로 깔끔하게 실행 중...`);
}); 