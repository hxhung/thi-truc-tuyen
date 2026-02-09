/**
 * EXAM ENGINE – PHIÊN BẢN THI CHÍNH THỨC (STABLE)
 * - GIỮ NGUYÊN: Toàn bộ logic renderPart1/2/3 và saveAnswer.
 * - KHẮC PHỤC: Chống reload, khôi phục UI, khớp API, Timer an toàn.
 */

let currentQuestions = [];
let studentAnswers = {};
let sessionData = null;
let timerInterval = null;
let autosaveInterval = null;

const AUTOSAVE_INTERVAL = 15000;
const AUTOSAVE_MAX_AGE = 30 * 60 * 1000; 

let timeLeft = 0;
let submitted = false;

/* =====================================================
   1. KHỞI TẠO & KHÔI PHỤC (FIX VẤN ĐỀ 3 & 4)
   ===================================================== */
window.initExam = function (data) {
    if (!data) return;
    sessionData = data;
    currentQuestions = data.questions || [];
    
    // FIX VẤN ĐỀ 3: Tính toán thời gian thực dựa trên startToken (Chống gian lận reload)
    const now = Date.now();
    const startToken = parseInt(sessionData.startToken) || now;
    const elapsedSeconds = Math.floor((now - startToken) / 1000);
    const totalDurationSeconds = parseInt(sessionData.duration) * 60;
    
    timeLeft = totalDurationSeconds - elapsedSeconds;

    if (timeLeft <= 0) {
        timeLeft = 0;
        renderExam(currentQuestions);
        processSubmitExam(true);
        return;
    }

    // Khôi phục dữ liệu từ localStorage
    const raw = localStorage.getItem(`autosave_${sessionData.examId}`);
    if (raw) {
        try {
            const saved = JSON.parse(raw);
            if (saved.examId === sessionData.examId) {
                studentAnswers = saved.answers || {};
            }
        } catch (e) { console.error("Restore error:", e); }
    }
    
    // Render đề thi (Sử dụng logic render gốc của bạn)
    renderExam(currentQuestions);
    
    // FIX VẤN ĐỀ 4: Khôi phục trạng thái lựa chọn trên giao diện (UI)
    syncAnswersToUI();
    
    startTimer();
    
    if (autosaveInterval) clearInterval(autosaveInterval);
    autosaveInterval = setInterval(doAutosave, AUTOSAVE_INTERVAL);
    
    const titleEl = document.getElementById('exam-title');
    if (titleEl) titleEl.innerText = sessionData.title || "Bài thi trực tuyến";
};

function syncAnswersToUI() {
    Object.keys(studentAnswers).forEach(qId => {
        const val = studentAnswers[qId];
        // Radio (Part 1 & 2)
        const radio = document.querySelector(`input[name="${qId}"][value="${val}"]`);
        if (radio) radio.checked = true;
        // Text/Input (Part 3)
        const input = document.querySelector(`input[data-qid="${qId}"]`);
        if (input) input.value = val;
    });
}

/* =====================================================
   2. ĐỒNG HỒ & TỰ ĐỘNG LƯU (FIX VẤN ĐỀ 2)
   ===================================================== */
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const timerDisplay = document.getElementById('timer');
    if (!timerDisplay) return;

    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timeLeft = 0;
            timerDisplay.innerText = "00:00";
            // FIX VẤN ĐỀ 2: Nộp bài thẳng, không alert gây đứng script
            processSubmitExam(true); 
            return;
        }
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (timeLeft <= 60) timerDisplay.style.color = 'red';
    }, 1000);
}

function doAutosave() {
    if (submitted || !sessionData) return;
    localStorage.setItem(`autosave_${sessionData.examId}`, JSON.stringify({
        examId: sessionData.examId,
        answers: studentAnswers,
        savedAt: Date.now()
    }));
}

/* =====================================================
   3. LOGIC RENDER CỦA BẠN (GIỮ NGUYÊN TUYỆT ĐỐI)
   ===================================================== */
function renderExam(questions) {
    const container = document.getElementById('exam-container');
    if (!container) return;
    container.innerHTML = '';

    const p1 = questions.filter(q => q.part === 1);
    const p2 = questions.filter(q => q.part === 2);
    const p3 = questions.filter(q => q.part === 3);

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

function renderPart1(questions) {
    return `<div class=\"part-section\"><h3>Phần I: Trắc nghiệm nhiều lựa chọn</h3>${questions.map((q, i) => `
        <div class=\"question-card\">
            <div class=\"question-text\"><b>Câu ${i + 1}.</b> ${q.questionText}</div>
            <div class=\"options-grid\">
                ${['A', 'B', 'C', 'D'].map(opt => `
                    <label class=\"option-item\">
                        <input type=\"radio\" name=\"${q.id}\" value=\"${opt}\" onchange=\"saveAnswer('${q.id}', '${opt}')\">
                        <span>${opt}. ${q['option' + opt]}</span>
                    </label>`).join('')}
            </div>
        </div>`).join('')}</div>`;
}

function renderPart2(questions) {
    return `<div class=\"part-section\"><h3>Phần II: Trắc nghiệm Đúng/Sai</h3>${questions.map((q, i) => `
        <div class=\"question-card\">
            <div class=\"question-text\"><b>Câu ${i + 1}.</b> ${q.questionText}</div>
            <div class=\"tf-row\">
                <span>Chọn Đúng/Sai:</span>
                <div class=\"tf-options\">
                    <label><input type=\"radio\" name=\"${q.id}\" value=\"T\" onchange=\"saveAnswer('${q.id}', 'T')\"> Đúng</label>
                    <label><input type=\"radio\" name=\"${q.id}\" value=\"F\" onchange=\"saveAnswer('${q.id}', 'F')\"> Sai</label>
                </div>
            </div>
        </div>`).join('')}</div>`;
}

function renderPart3(questions) {
    return `<div class=\"part-section\"><h3>Phần III: Trả lời ngắn</h3>${questions.map((q, i) => `
        <div class=\"question-card\">
            <div class=\"question-text\"><b>Câu ${i + 1}.</b> ${q.questionText}</div>
            <input type=\"text\" class=\"short-answer-input\" data-qid=\"${q.id}\" placeholder=\"Nhập đáp án...\" oninput=\"saveAnswer('${q.id}', this.value)\">
        </div>`).join('')}</div>`;
}

window.saveAnswer = function (questionId, answer) {
    if (submitted) return;
    studentAnswers[questionId] = answer;
    doAutosave();
};

/* =====================================================
   4. NỘP BÀI (FIX VẤN ĐỀ 1: Khớp API submitExam)
   ===================================================== */
async function processSubmitExam(force = false) {
    if (submitted) return;
    if (!force && !confirm('Bạn chắc chắn muốn nộp bài?')) return;

    submitted = true;
    clearInterval(timerInterval);
    clearInterval(autosaveInterval);

    try {
        // Gọi hàm submitExam từ api-connector.js
        const result = await window.submitExam({
            examId: sessionData.examId,
            studentName: sessionData.studentName,
            studentClass: sessionData.studentClass,
            answers: studentAnswers,
            usedTime: (parseInt(sessionData.duration) * 60) - timeLeft
        });

        if (result && result.success) {
            localStorage.removeItem(`autosave_${sessionData.examId}`);
            sessionStorage.removeItem('currentExam');
            location.href = 'result.html';
        } else {
            alert('Nộp bài thất bại: ' + (result?.message || 'Lỗi kết nối'));
            submitted = false;
        }
    } catch (e) {
        alert('Lỗi kết nối nghiêm trọng khi nộp bài!');
        submitted = false;
    }
}

// Gán cho nút Nộp bài trong exam.html: onclick="handleManualSubmit()"
window.handleManualSubmit = () => processSubmitExam(false);

/* =====================================================
   5. TỰ ĐỘNG KÍCH HOẠT (DOMContentLoaded)
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const rawData = sessionStorage.getItem('currentExam');
    if (rawData) {
        window.initExam(JSON.parse(rawData));
    }
});