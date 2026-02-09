/**
 * EXAM ENGINE - PHIÊN BẢN HOÀN CHỈNH & ĐÃ FIX AUTOSAVE
 * Quản lý hiển thị câu hỏi, đếm giờ, lưu đáp án, nộp bài
 */

/* ================== BIẾN GỐC ================== */
let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let sessionData = null;
let timerInterval = null;
let examStartTime = null;
let timeLeft = 0; // giây

/* ================== AUTOSAVE (ADD-ON AN TOÀN) ================== */
const AUTOSAVE_INTERVAL = 15000;        // 15s
const AUTOSAVE_MAX_AGE = 5 * 60 * 1000; // 5 phút
let autosaveInterval = null;

function getAutosaveKey() {
    return `autosave_${sessionData?.examId || 'unknown'}`;
}

function doAutosave() {
    if (!sessionData || typeof timeLeft !== 'number' || timeLeft <= 0) return;

    try {
        const data = {
            examId: sessionData.examId,
            answers: studentAnswers,
            timeLeft: timeLeft,
            savedAt: Date.now()
        };
        localStorage.setItem(getAutosaveKey(), JSON.stringify(data));
    } catch (e) {
        console.warn('[AUTOSAVE] failed', e);
    }
}

function restoreAutosaveIfAny() {
    const raw = localStorage.getItem(getAutosaveKey());
    if (!raw) return;

    try {
        const data = JSON.parse(raw);

        if (data.examId !== sessionData.examId) {
            localStorage.removeItem(getAutosaveKey());
            return;
        }

        if (Date.now() - data.savedAt > AUTOSAVE_MAX_AGE) {
            localStorage.removeItem(getAutosaveKey());
            return;
        }

        if (typeof data.timeLeft !== 'number' || data.timeLeft > timeLeft) return;

        const ok = confirm('Phát hiện bài làm chưa nộp. Bạn có muốn khôi phục không?');
        if (!ok) {
            localStorage.removeItem(getAutosaveKey());
            return;
        }

        studentAnswers = data.answers || {};
        timeLeft = data.timeLeft;

        console.log('[AUTOSAVE] restored');
    } catch (e) {
        console.error('[AUTOSAVE] corrupted → removed');
        localStorage.removeItem(getAutosaveKey());
    }
}

/* ================== KHỞI TẠO ================== */
document.addEventListener('DOMContentLoaded', () => {
    loadConfigAndStart();
});

async function loadConfigAndStart() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
        console.log('✅ Config loaded:', examConfig);
    } catch (error) {
        alert('Lỗi tải cấu hình hệ thống!');
        return;
    }

    sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData || !sessionData.questions) {
        alert('Không tìm thấy dữ liệu đề thi.');
        window.location.href = 'index.html';
        return;
    }

    currentQuestions = sessionData.questions;
    examStartTime = new Date();
    timeLeft = (sessionData.duration || 45) * 60;

    restoreAutosaveIfAny(); // ✅ autosave restore (AN TOÀN)

    renderExamHeader();
    renderAllQuestions();
    startTimer();

    autosaveInterval = setInterval(doAutosave, AUTOSAVE_INTERVAL); // ✅ autosave định kỳ
}

/* ================== HEADER + TIMER ================== */
function renderExamHeader() {
    document.getElementById('exam-title').textContent =
        sessionData.title || 'BÀI THI TRỰC TUYẾN';
}

function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft === 300) alert('⚠️ Còn 5 phút nữa hết giờ!');

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert('⏰ Hết giờ làm bài!');
            submitExam(true);
        }
    }, 1000);
}

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    document.getElementById('timer').textContent =
        `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    if (timeLeft < 300) {
        const t = document.getElementById('timer');
        t.style.color = '#dc3545';
        t.style.animation = 'blink 1s infinite';
    }
}

/* ================== RENDER CÂU HỎI ================== */
function renderAllQuestions() {
    const container = document.getElementById('exam-container');
    container.innerHTML = '';

    const p1 = currentQuestions.filter(q => q.type === 'MULTIPLE_CHOICE');
    const p2 = currentQuestions.filter(q => q.type === 'TRUE_FALSE');
    const p3 = currentQuestions.filter(q => q.type === 'FILL_IN');

    if (p1.length) container.innerHTML += renderPart1(p1);
    if (p2.length) container.innerHTML += renderPart2(p2);
    if (p3.length) container.innerHTML += renderPart3(p3);

    if (window.renderMathInElement) {
        renderMathInElement(document.body, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
            ]
        });
    }
}

/* ================== LƯU ĐÁP ÁN ================== */
window.saveAnswer = function (questionId, answer, type) {
    studentAnswers[questionId] = answer;

    const card = document.querySelector(`[data-id="${questionId}"]`);
    if (card) card.classList.add('answered');

    doAutosave(); // ✅ HOOK DUY NHẤT
};

/* ================== NỘP BÀI ================== */
async function submitExam(force = false) {
    if (!force && !confirm('Bạn chắc chắn muốn nộp bài?')) return;

    clearInterval(timerInterval);
    if (autosaveInterval) clearInterval(autosaveInterval);

    try {
        const result = await submitExamAPI({
            examId: sessionData.examId,
            answers: studentAnswers,
            duration: (sessionData.duration * 60 - timeLeft)
        });

        if (result?.success) {
            localStorage.removeItem(getAutosaveKey()); // ✅ XÓA AUTOSAVE
            sessionStorage.removeItem('currentExam');
            alert('✅ Nộp bài thành công!');
            window.location.href = 'result.html';
        } else {
            alert('❌ Nộp bài thất bại!');
        }
    } catch (e) {
        alert('❌ Lỗi kết nối khi nộp bài!');
    }
}
