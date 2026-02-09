/**
 * EXAM ENGINE – FIX STABLE (COMPAT 1.8)
 * - Không reset thời gian khi reload
 * - Không alert trong timer
 * - Autosave an toàn
 * - Giữ nguyên renderPart1/2/3
 */

/* ================== BIẾN GỐC ================== */
let currentQuestions = [];
let studentAnswers = {};
let sessionData = null;
let timerInterval = null;
let autosaveInterval = null;

const AUTOSAVE_INTERVAL = 15000;
const AUTOSAVE_MAX_AGE = 5 * 60 * 1000;

let timeLeft = 0;
let submitted = false;

/* ================== AUTOSAVE ================== */
function getAutosaveKey() {
    return `autosave_${sessionData.examId}`;
}

function doAutosave() {
    if (submitted || timeLeft <= 0) return;

    try {
        localStorage.setItem(
            getAutosaveKey(),
            JSON.stringify({
                examId: sessionData.examId,
                answers: studentAnswers,
                timeLeft: timeLeft,
                savedAt: Date.now()
            })
        );
    } catch {}
}

function restoreAutosaveIfAny() {
    const raw = localStorage.getItem(getAutosaveKey());
    if (!raw) return;

    try {
        const data = JSON.parse(raw);

        if (data.examId !== sessionData.examId) return;
        if (Date.now() - data.savedAt > AUTOSAVE_MAX_AGE) return;
        if (data.timeLeft > timeLeft) return;

        if (confirm('Phát hiện bài làm chưa nộp. Khôi phục?')) {
            studentAnswers = data.answers || {};
            timeLeft = data.timeLeft;
        } else {
            localStorage.removeItem(getAutosaveKey());
        }
    } catch {
        localStorage.removeItem(getAutosaveKey());
    }
}

/* ================== KHỞI TẠO ================== */
document.addEventListener('DOMContentLoaded', () => {
    sessionData = JSON.parse(sessionStorage.getItem('currentExam'));

    if (!sessionData || !sessionData.questions || !sessionData.startToken) {
        alert('Phiên thi không hợp lệ');
        location.href = 'index.html';
        return;
    }

    currentQuestions = sessionData.questions;

    // 🔒 KHÓA THỜI GIAN – KHÔNG RESET KHI RELOAD
    const startKey = `exam_start_${sessionData.examId}`;
    const savedStart = localStorage.getItem(startKey);

    if (savedStart) {
        const elapsed = Math.floor((Date.now() - Number(savedStart)) / 1000);
        timeLeft = sessionData.duration * 60 - elapsed;
    } else {
        localStorage.setItem(startKey, Date.now());
        timeLeft = sessionData.duration * 60;
    }

    if (timeLeft <= 0) {
        submitExam(true);
        return;
    }

    restoreAutosaveIfAny();

    renderExamHeader();
    renderAllQuestions();
    startTimer();

    autosaveInterval = setInterval(doAutosave, AUTOSAVE_INTERVAL);
});

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

        if (timeLeft <= 0) {
            submitExam(true);
        }
    }, 1000);
}

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;

    const t = document.getElementById('timer');
    t.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (timeLeft <= 300) {
        t.style.color = '#dc3545';
    }
}

/* ================== RENDER CÂU HỎI (GIỮ NGUYÊN LOGIC GỐC) ================== */
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
window.saveAnswer = function (questionId, answer) {
    if (submitted) return;
    studentAnswers[questionId] = answer;
    doAutosave();
};

/* ================== NỘP BÀI ================== */
async function submitExam(force = false) {
    if (submitted) return;
    if (!force && !confirm('Bạn chắc chắn muốn nộp bài?')) return;

    submitted = true;
    clearInterval(timerInterval);
    clearInterval(autosaveInterval);

    try {
        const result = await submitExamAPI({
            examId: sessionData.examId,
            answers: studentAnswers,
            duration: sessionData.duration * 60 - timeLeft
        });

        if (result?.success) {
            localStorage.removeItem(getAutosaveKey());
            localStorage.removeItem(`exam_start_${sessionData.examId}`);
            sessionStorage.removeItem('currentExam');
            location.href = 'result.html';
        } else {
            alert('Nộp bài thất bại');
            submitted = false;
        }
    } catch {
        alert('Lỗi kết nối khi nộp bài');
        submitted = false;
    }
}
