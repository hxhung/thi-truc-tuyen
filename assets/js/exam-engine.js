/*************************************************
 * EXAM ENGINE - FIX STACK OVERFLOW
 * KHÔNG thay đổi logic hiện có
 *************************************************/

let examId = '';
let studentId = '';
let studentName = '';
let studentClass = '';

let currentQuestions = [];
let studentAnswers = {};
let examStartTime = null;
let timeLeft = 0;
let timerInterval = null;

/* ================== LOAD & START ================== */

async function loadConfigAndStart() {
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) {
        alert('Không tìm thấy dữ liệu đề thi.');
        location.href = 'index.html';
        return;
    }

    examId = sessionData.examId;
    studentId = sessionData.studentId;
    studentName = sessionData.studentName;
    studentClass = sessionData.studentClass;

    currentQuestions = sessionData.questions;
    examStartTime = new Date();
    timeLeft = (sessionData.duration || 45) * 60;

    // PATCH 5: khôi phục nháp
    studentAnswers = JSON.parse(localStorage.getItem('draft_answers') || '{}');

    renderAllQuestions();
    startTimer();
}

/* ================== RENDER ================== */

function renderAllQuestions() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';

    container.innerHTML += renderPart1();
    container.innerHTML += renderPart2();
    container.innerHTML += renderPart3();

    renderKaTeX();

    // PATCH 5: restore UI
    restoreDraftAnswers();
}

/* ================== SAVE ANSWER ================== */

window.saveAnswer = function (questionId, answer) {
    studentAnswers[questionId] = answer;

    const card = document.querySelector(`[data-id="${questionId}"]`);
    if (card) card.classList.add('answered');

    localStorage.setItem('draft_answers', JSON.stringify(studentAnswers));
};

/* ================== RESTORE ANSWERS ================== */

function restoreDraftAnswers() {
    Object.entries(studentAnswers).forEach(([qid, answer]) => {
        const radio = document.querySelector(
            `input[name="q${qid}"][value="${answer}"]`
        );
        if (radio) radio.checked = true;

        const input = document.querySelector(
            `.question-card[data-id="${qid}"] input.fill-input`
        );
        if (input) input.value = answer;

        const card = document.querySelector(`[data-id="${qid}"]`);
        if (card) card.classList.add('answered');
    });
}

/* ================== TIMER ================== */

function startTimer() {
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            timeLeft = 0;
            updateTimerDisplay();
            clearInterval(timerInterval);
            handleSubmitExam(true);
            return;
        }

        timeLeft--;
        updateTimerDisplay();

        if (timeLeft === 300) {
            alert('⚠️ Còn 5 phút!');
        }
    }, 1000);
}

/* ================== SUBMIT ================== */

window.handleSubmitExam = async function (force = false) {
    if (!force) {
        if (!confirm('Bạn chắc chắn muốn nộp bài?')) return;
    }

    clearInterval(timerInterval);

    const payload = {
        examId,
        studentId,
        studentName,
        studentClass,
        answers: studentAnswers,
        startTime: examStartTime.toISOString(),
        submitTime: new Date().toISOString()
    };

    const result = await submitExamAPI(payload);

    if (!result || !result.success) {
        alert('❌ Lỗi nộp bài: ' + (result?.message || 'Không xác định'));
        return;
    }

    sessionStorage.setItem(
        'examResult',
        JSON.stringify({
            studentName,
            studentClass,
            score: result.score,
            detail: result.detail
        })
    );

    localStorage.removeItem('draft_answers');
    sessionStorage.removeItem('currentExam');

    // 🔴 FIX CHÍNH: TẮT beforeunload TRƯỚC KHI REDIRECT
    timerInterval = null;
    window.onbeforeunload = null;

    window.location.href = 'result.html';
};

/* ================== BEFORE UNLOAD ================== */

window.onbeforeunload = function (e) {
    if (timerInterval) {
        e.preventDefault();
        return 'Bạn chưa nộp bài. Rời khỏi trang sẽ mất dữ liệu!';
    }
};

/* ================== INIT ================== */

document.addEventListener('DOMContentLoaded', loadConfigAndStart);
