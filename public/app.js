// 전역 변수
let currentUser = null;
let currentSession = null;
let currentStep = 1;
let fontSizeLevel = 1; // 1: normal, 2: medium, 3: large
let isVoiceEnabled = false;
let isHighContrast = false;
let speechSynthesis = window.speechSynthesis;
let surveyData = null;
let surveyAnswers = {};

// API 기본 URL - 자동으로 환경에 맞게 설정
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api'
    : `${window.location.protocol}//${window.location.host}/api`;

// DOM 요소들
const userInfoModal = document.getElementById('user-info-modal');
const lookupModal = document.getElementById('lookup-modal');
const startSurveyBtn = document.getElementById('start-survey-btn');
const lookupResultsBtn = document.getElementById('lookup-results-btn');
const userInfoForm = document.getElementById('user-info-form');
const lookupForm = document.getElementById('lookup-form');
const cancelBtn = document.getElementById('cancel-btn');
const lookupCancelBtn = document.getElementById('lookup-cancel-btn');
const fontSizeBtn = document.getElementById('font-size-btn');
const voiceToggleBtn = document.getElementById('voice-toggle-btn');
const highContrastBtn = document.getElementById('high-contrast-btn');
const floatingVoiceBtn = document.getElementById('floating-voice-btn');
const mainBody = document.getElementById('main-body');

// 페이지 요소들
const mainPage = document.querySelector('.container');
const surveyPage = document.getElementById('survey-page');
const resultsPage = document.getElementById('results-page');

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 남해 복지 추천 서비스 (Node.js 버전) 시작!');
    initializeEventListeners();
    loadUserPreferences();
    
    // 페이지 로드 시 음성 안내
    if (isVoiceEnabled) {
        speak('남해군 노인 복지 추천 서비스에 오신 것을 환영합니다.');
    }
});

// 이벤트 리스너 초기화
function initializeEventListeners() {
    // 설문 시작 버튼
    startSurveyBtn.addEventListener('click', function() {
        showUserInfoModal();
    });
    
    // 결과 조회 버튼
    lookupResultsBtn.addEventListener('click', function() {
        showLookupModal();
    });
    
    // 모달 닫기 버튼들
    cancelBtn.addEventListener('click', hideUserInfoModal);
    lookupCancelBtn.addEventListener('click', hideLookupModal);
    
    // 폼 제출 이벤트
    userInfoForm.addEventListener('submit', handleUserInfoSubmit);
    lookupForm.addEventListener('submit', handleLookupSubmit);
    
    // 접근성 버튼들
    fontSizeBtn.addEventListener('click', toggleFontSize);
    voiceToggleBtn.addEventListener('click', toggleVoice);
    highContrastBtn.addEventListener('click', toggleHighContrast);
    floatingVoiceBtn.addEventListener('click', toggleVoice);
    
    // 모달 외부 클릭 시 닫기
    userInfoModal.addEventListener('click', function(e) {
        if (e.target === userInfoModal) hideUserInfoModal();
    });
    
    lookupModal.addEventListener('click', function(e) {
        if (e.target === lookupModal) hideLookupModal();
    });
}

// 사용자 설정 로드
function loadUserPreferences() {
    const savedFontSize = localStorage.getItem('fontSizeLevel');
    const savedVoice = localStorage.getItem('isVoiceEnabled');
    const savedContrast = localStorage.getItem('isHighContrast');
    
    if (savedFontSize) {
        fontSizeLevel = parseInt(savedFontSize);
        updateFontSize();
    }
    
    if (savedVoice === 'true') {
        isVoiceEnabled = true;
        voiceToggleBtn.classList.add('active');
        floatingVoiceBtn.classList.remove('hidden');
    }
    
    if (savedContrast === 'true') {
        isHighContrast = true;
        highContrastBtn.classList.add('active');
        document.body.classList.add('high-contrast');
    }
}

// 모달 표시/숨기기 함수들
function showUserInfoModal() {
    userInfoModal.classList.add('show');
    document.getElementById('user-name').focus();
    
    if (isVoiceEnabled) {
        speak('기본 정보를 입력해주세요.');
    }
}

function hideUserInfoModal() {
    userInfoModal.classList.remove('show');
}

function showLookupModal() {
    lookupModal.classList.add('show');
    document.getElementById('lookup-key').focus();
    
    if (isVoiceEnabled) {
        speak('조회 키를 입력해주세요.');
    }
}

function hideLookupModal() {
    lookupModal.classList.remove('show');
}

// 로딩 표시 함수들
function showLoading(message = '처리 중입니다...') {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    text.textContent = message;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
}

// 사용자 정보 제출 처리
async function handleUserInfoSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('user-name').value.trim();
    const birthDate = document.getElementById('birth-date').value;
    const district = document.getElementById('district').value;
    
    if (!name || !birthDate || !district) {
        alert('모든 정보를 입력해주세요.');
        return;
    }
    
    // 나이 확인
    const birth = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    
    if (age < 65) {
        alert('이 서비스는 65세 이상 어르신을 대상으로 합니다.');
        return;
    }
    
    try {
        showLoading('사용자 정보를 등록하고 있습니다...');
        
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                birth_date: birthDate,
                address: `남해군 ${district}`,
                district_code: district
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data;
            hideUserInfoModal();
            
            // 설문 시작
            await startSurvey();
            
            if (isVoiceEnabled) {
                speak('설문을 시작합니다.');
            }
        } else {
            alert('사용자 등록에 실패했습니다: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('서버 연결에 실패했습니다. Node.js 서버가 정상 작동 중입니다.');
    } finally {
        hideLoading();
    }
}

// 설문 시작
async function startSurvey() {
    try {
        showLoading('설문을 준비하고 있습니다...');
        
        const response = await fetch(`${API_BASE_URL}/survey/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_key: currentUser.user_key
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentSession = data.session_id;
            surveyData = data.questions;
            currentStep = 1;
            surveyAnswers = {};
            
            // 메인 페이지 숨기고 설문 페이지 표시
            mainPage.style.display = 'none';
            surveyPage.classList.remove('hidden');
            
            showSurveyStep();
        } else {
            alert('설문 시작에 실패했습니다: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('설문 시작에 실패했습니다.');
    } finally {
        hideLoading();
    }
}

// 설문 단계 표시
function showSurveyStep() {
    const categories = ['health', 'living', 'economic', 'social'];
    const titles = ['🏥 건강 상태', '🏠 생활 환경', '💰 경제 상태', '👥 사회 활동'];
    const currentCategory = categories[currentStep - 1];
    
    // 제목 및 진행률 업데이트
    document.getElementById('survey-title').textContent = titles[currentStep - 1];
    document.getElementById('progress-text').textContent = `${currentStep}/4`;
    document.getElementById('progress-bar').style.width = `${(currentStep / 4) * 100}%`;
    
    // 질문 내용 생성
    const content = document.getElementById('survey-content');
    content.innerHTML = '';
    
    const questions = surveyData[currentCategory];
    
    questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question fade-in';
        
        const questionHtml = `
            <h3>${question.text}</h3>
            <div class="question-options">
                ${question.options.map((option, optionIndex) => `
                    <div class="option" onclick="selectOption(${question.id}, '${option}', this)">
                        <input type="radio" name="question-${question.id}" value="${option}" id="option-${question.id}-${optionIndex}">
                        <label for="option-${question.id}-${optionIndex}">${option}</label>
                    </div>
                `).join('')}
            </div>
        `;
        
        questionDiv.innerHTML = questionHtml;
        content.appendChild(questionDiv);
    });
    
    // 버튼 상태 업데이트
    const prevBtn = document.getElementById('survey-prev-btn');
    const nextBtn = document.getElementById('survey-next-btn');
    
    if (currentStep > 1) {
        prevBtn.classList.remove('hidden');
        prevBtn.onclick = () => goToPreviousStep();
    } else {
        prevBtn.classList.add('hidden');
    }
    
    if (currentStep < 4) {
        nextBtn.textContent = '다음';
        nextBtn.onclick = () => goToNextStep();
    } else {
        nextBtn.textContent = '결과 보기';
        nextBtn.onclick = () => generateRecommendations();
    }
    
    // 음성 안내
    if (isVoiceEnabled) {
        speak(titles[currentStep - 1] + ' 설문입니다. 질문에 답변해주세요.');
    }
}

// 옵션 선택
function selectOption(questionId, answer, element) {
    // 기존 선택 해제
    const questionDiv = element.closest('.question');
    questionDiv.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
        opt.querySelector('input').checked = false;
    });
    
    // 새로운 선택
    element.classList.add('selected');
    element.querySelector('input').checked = true;
    
    // 답변 저장
    const categories = ['health', 'living', 'economic', 'social'];
    const currentCategory = categories[currentStep - 1];
    
    if (!surveyAnswers[currentCategory]) {
        surveyAnswers[currentCategory] = [];
    }
    
    // 기존 답변 제거 후 새로 추가
    surveyAnswers[currentCategory] = surveyAnswers[currentCategory].filter(ans => ans.question_id !== questionId);
    surveyAnswers[currentCategory].push({
        question_id: questionId,
        question: questionDiv.querySelector('h3').textContent,
        answer: answer
    });
}

// 다음 단계로
async function goToNextStep() {
    const categories = ['health', 'living', 'economic', 'social'];
    const currentCategory = categories[currentStep - 1];
    
    // 모든 질문에 답변했는지 확인
    const questions = surveyData[currentCategory];
    const answers = surveyAnswers[currentCategory] || [];
    
    if (answers.length < questions.length) {
        alert('모든 질문에 답변해주세요.');
        return;
    }
    
    // 답변 저장
    try {
        showLoading('답변을 저장하고 있습니다...');
        
        const response = await fetch(`${API_BASE_URL}/survey/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: currentSession,
                category: currentCategory,
                answers: answers
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentStep++;
            showSurveyStep();
        } else {
            alert('답변 저장에 실패했습니다: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('답변 저장에 실패했습니다.');
    } finally {
        hideLoading();
    }
}

// 이전 단계로
function goToPreviousStep() {
    if (currentStep > 1) {
        currentStep--;
        showSurveyStep();
    }
}

// 추천 결과 생성
async function generateRecommendations() {
    const categories = ['health', 'living', 'economic', 'social'];
    const currentCategory = categories[currentStep - 1];
    
    // 마지막 단계 답변 확인
    const questions = surveyData[currentCategory];
    const answers = surveyAnswers[currentCategory] || [];
    
    if (answers.length < questions.length) {
        alert('모든 질문에 답변해주세요.');
        return;
    }
    
    try {
        showLoading('마지막 답변을 저장하고 추천 결과를 생성하고 있습니다...');
        
        // 마지막 답변 저장
        await fetch(`${API_BASE_URL}/survey/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: currentSession,
                category: currentCategory,
                answers: answers
            })
        });
        
        // 추천 결과 생성
        const response = await fetch(`${API_BASE_URL}/recommendations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: currentSession
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showResults(data);
        } else {
            alert('추천 결과 생성에 실패했습니다: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('추천 결과 생성에 실패했습니다.');
    } finally {
        hideLoading();
    }
}

// 결과 표시
function showResults(data) {
    // 설문 페이지 숨기고 결과 페이지 표시
    surveyPage.classList.add('hidden');
    resultsPage.classList.remove('hidden');
    
    // 사용자 요약 정보
    const userSummary = document.getElementById('user-summary');
    userSummary.innerHTML = `
        <p><strong>${currentUser.name}</strong> 어르신 (${data.user_info.age_group}, ${data.user_info.age}세)</p>
        <p>고유 조회 키: <strong>${currentUser.user_key}</strong></p>
        <p class="text-sm text-blue-600 mt-2">※ 조회 키를 저장하시면 나중에 결과를 다시 볼 수 있습니다.</p>
    `;
    
    // 추천 결과 표시
    const container = document.getElementById('recommendations-container');
    container.innerHTML = '';
    
    data.recommendations.forEach((rec, index) => {
        const card = document.createElement('div');
        card.className = 'recommendation-card fade-in';
        card.style.animationDelay = `${index * 0.1}s`;
        
        const scorePercent = Math.round(rec.score * 100);
        const categoryColors = {
            '경제지원': 'bg-green-100 text-green-800',
            '돌봄지원': 'bg-blue-100 text-blue-800',
            '일자리': 'bg-purple-100 text-purple-800',
            '의료지원': 'bg-red-100 text-red-800'
        };
        
        card.innerHTML = `
            <div class="recommendation-header">
                <div>
                    <div class="recommendation-category ${categoryColors[rec.category] || 'bg-gray-100 text-gray-800'}">
                        ${rec.category}
                    </div>
                    <h3 class="recommendation-title">${rec.name}</h3>
                </div>
                <div class="recommendation-score">${scorePercent}% 매칭</div>
            </div>
            
            <div class="recommendation-benefits">${rec.benefits}</div>
            <div class="recommendation-description">${rec.description}</div>
            <div class="text-sm text-blue-600 mb-4">${rec.reason}</div>
            
            <div class="recommendation-details">
                <div class="detail-item">
                    <span class="detail-label">신청 자격</span>
                    <div class="detail-value">${rec.requirements}</div>
                </div>
                <div class="detail-item">
                    <span class="detail-label">문의처</span>
                    <div class="detail-value">${rec.contact_info}</div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // 결과 페이지 버튼 이벤트 리스너
    document.getElementById('print-results-btn').onclick = () => window.print();
    document.getElementById('new-survey-btn').onclick = () => location.reload();
    
    // 음성 안내
    if (isVoiceEnabled) {
        speak(`${data.recommendations.length}개의 맞춤 복지 서비스를 추천드립니다.`);
    }
}

// 결과 조회 처리
async function handleLookupSubmit(e) {
    e.preventDefault();
    
    const lookupKey = document.getElementById('lookup-key').value.trim();
    
    if (!lookupKey) {
        alert('조회 키를 입력해주세요.');
        return;
    }
    
    try {
        showLoading('결과를 조회하고 있습니다...');
        
        const response = await fetch(`${API_BASE_URL}/results/${lookupKey}`);
        const data = await response.json();
        
        if (data.success) {
            if (data.has_survey) {
                hideLookupModal();
                
                // 현재 사용자 정보 설정
                currentUser = { 
                    name: data.user_info.name, 
                    user_key: lookupKey 
                };
                
                showResults(data);
            } else {
                alert('아직 설문조사를 완료하지 않았습니다.');
            }
        } else {
            alert('조회 키를 찾을 수 없습니다: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('결과 조회에 실패했습니다.');
    } finally {
        hideLoading();
    }
}

// 접근성 기능들
function toggleFontSize() {
    fontSizeLevel = fontSizeLevel >= 3 ? 1 : fontSizeLevel + 1;
    updateFontSize();
    localStorage.setItem('fontSizeLevel', fontSizeLevel);
    
    const sizes = ['기본', '크게', '매우 크게'];
    if (isVoiceEnabled) {
        speak(`글자 크기를 ${sizes[fontSizeLevel - 1]}로 변경했습니다.`);
    }
}

function updateFontSize() {
    document.body.className = document.body.className.replace(/font-size-\d/, '');
    document.body.classList.add(`font-size-${fontSizeLevel}`);
    
    fontSizeBtn.textContent = fontSizeLevel === 1 ? '🔤' : fontSizeLevel === 2 ? '🔤+' : '🔤++';
}

function toggleVoice() {
    isVoiceEnabled = !isVoiceEnabled;
    localStorage.setItem('isVoiceEnabled', isVoiceEnabled);
    
    if (isVoiceEnabled) {
        voiceToggleBtn.classList.add('active');
        floatingVoiceBtn.classList.remove('hidden');
        speak('음성 안내가 켜졌습니다.');
    } else {
        voiceToggleBtn.classList.remove('active');
        floatingVoiceBtn.classList.add('hidden');
    }
}

function toggleHighContrast() {
    isHighContrast = !isHighContrast;
    localStorage.setItem('isHighContrast', isHighContrast);
    
    if (isHighContrast) {
        highContrastBtn.classList.add('active');
        document.body.classList.add('high-contrast');
    } else {
        highContrastBtn.classList.remove('active');
        document.body.classList.remove('high-contrast');
    }
    
    if (isVoiceEnabled) {
        speak(isHighContrast ? '고대비 모드가 켜졌습니다.' : '고대비 모드가 꺼졌습니다.');
    }
}

// 음성 안내 함수
function speak(text) {
    if (!isVoiceEnabled || !speechSynthesis) return;
    
    speechSynthesis.cancel(); // 이전 음성 중단
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.8;
    utterance.pitch = 1;
    
    speechSynthesis.speak(utterance);
}

// 유틸리티 함수들
function formatCurrency(amount) {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('ko-KR');
}

// 에러 핸들링
window.addEventListener('error', function(e) {
    console.error('JavaScript 오류:', e.error);
    
    // 사용자에게 친화적인 에러 메시지
    if (e.error.name === 'TypeError' && e.error.message.includes('fetch')) {
        console.log('✅ Node.js 서버 연결 확인 중...');
    }
});

// 페이지 언로드 시 음성 중단
window.addEventListener('beforeunload', function() {
    if (speechSynthesis) {
        speechSynthesis.cancel();
    }
});

console.log('✅ Node.js 남해 복지 추천 서비스 준비 완료!'); 