/**
 * EXAM ENGINE – PHIÊN BẢN CẬP NHẬT MÃ ĐỀ (examId)
 */

let currentQuestions = [];
let studentAnswers = {};
let sessionData = null;
let timerInterval = null;
let autosaveInterval = null;

const AUTOSAVE_INTERVAL = 15000; 
let timeLeft = 0;
let submitted = false;

/* =====================================================
   1. KHỞI TẠO & LỌC DỮ LIỆU THEO MÃ ĐỀ
   ===================================================== */
window.initExam = function (data) {
    if (!data) return;
    sessionData = data;
    
   // 1. Lấy toàn bộ câu hỏi từ nguồn
    const allQuestions = data.questions || [];
    
    // 2. 🔥 FIX: Lọc câu hỏi (Phần này bạn đang thiếu)
    // Code này chấp nhận cả ExamID (hoa) và examId (thường)
    currentQuestions = allQuestions.filter(q => {
        const qId = q.ExamID || q.examId || q.MaDe || ""; 
        return String(qId).trim() === String(sessionData.examId).trim();
    });

    // 3. Kiểm tra kết quả sau khi lọc (Đoạn if bạn hỏi)
    if (currentQuestions.length === 0) {
        console.error("Dữ liệu gốc:", allQuestions); // Log ra để kiểm tra nếu lỗi
        alert(`❌ Lỗi: Không tìm thấy câu hỏi cho mã đề "${sessionData.examId}"!\n\n(Kiểm tra lại cột ExamID trong file CSV)`);
        setTimeout(() => window.location.href = 'index.html', 2000);
        return; // Dừng lại, không chạy tiếp các lệnh bên dưới
    }
    
    // --- LOGIC TIMER ---
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

    // Khôi phục đáp án đã lưu (nếu có)
    const raw = localStorage.getItem(`autosave_${sessionData.examId}`);
    if (raw) {
        try {
            const saved = JSON.parse(raw);
            studentAnswers = saved.answers || {};
        } catch (e) { console.error("Restore error:", e); }
    }
    
    renderExam(currentQuestions);
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
        const radio = document.querySelector(`input[name="q${qId}"][value="${val}"]`) || 
                      document.querySelector(`input[name="${qId}"][value="${val}"]`);
        if (radio) radio.checked = true;
        const input = document.querySelector(`input[data-qid="${qId}"]`);
        if (input) input.value = val;
    });
}

/* =====================================================
   2. RENDER GIAO DIỆN (PHẦN I, II, III)
   ===================================================== */
function renderExam(questions) {
    const container = document.getElementById('exam-container');
    if (!container) return;

    // Phân loại Part
    const p1 = questions.filter(q => Number(q.part) === 1);
    const p2 = questions.filter(q => Number(q.part) === 2);
    const p3 = questions.filter(q => Number(q.part) === 3);

    container.innerHTML = '';
    if (p1.length) container.innerHTML += renderPart1(p1);
    if (p2.length) container.innerHTML += renderPart2(p2);
    if (p3.length) container.innerHTML += renderPart3(p3);

    // Render công thức Toán KaTeX
    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
            ],
            throwOnError: false
        });
    }
}

function renderPart1(questions) {
    return `<div class="section-header">PHẦN I. Trắc nghiệm nhiều lựa chọn</div>` + 
    questions.map((q, i) => `
    <div class="question-card">
        <div class="question-text"><b>Câu ${i + 1}.</b> ${q.contentRoot || q.questionText || ""}</div>
        ${q.image ? `<img src="${q.image}" class="question-image">` : ''}
        <div class="options-grid">
            ${['A', 'B', 'C', 'D'].map(opt => `
                <label class="option-item">
                    <input type="radio" name="${q.id}" value="${opt}" onchange="saveAnswer('${q.id}', '${opt}')">
                    <span><b>${opt}.</b> ${q['option' + opt] || q.options?.[opt] || ""}</span>
                </label>`).join('')}
        </div>
    </div>`).join('');
}

function renderPart2(questions) {
    if (!questions.length) return '';
    let html = `<div class="section-header">PHẦN II. Trắc nghiệm Đúng - Sai (Gồm 4 câu)</div>`;
    
    const chunkSize = 4;
    for (let i = 0; i < questions.length; i += chunkSize) {
        const group = questions.slice(i, i + chunkSize);
        const groupIndex = Math.floor(i / chunkSize) + 1;
        const firstItem = group[0];

        html += `
        <div class="question-card">
            <div class="question-text" style="border-bottom: 1px solid #eee; padding-bottom:10px; margin-bottom:15px;">
                <b style="color:var(--primary);">Câu ${groupIndex}.</b> ${firstItem.contentRoot || "Chọn Đúng hoặc Sai cho mỗi mệnh đề:"}
                ${firstItem.image ? `<div style="margin-top:10px;"><img src="${firstItem.image}" class="question-image"></div>` : ''}
            </div>
            <div class="tf-container">
                ${group.map((item, idx) => {
                    const label = String.fromCharCode(97 + idx); // a, b, c, d
                    const answerKey = item.id;
                    return `
                    <div class="tf-row">
                        <div class="tf-content"><b>${label})</b> ${item.contentSub || item.questionText || ''}</div>
                        <div class="tf-options">
                            <label class="badge-option-t">
                                <input type="radio" name="q${answerKey}" value="T" onchange="saveAnswer('${answerKey}', 'T')">
                                <span class="label-t">Đúng</span>
                            </label>
                            <label class="badge-option-f">
                                <input type="radio" name="q${answerKey}" value="F" onchange="saveAnswer('${answerKey}', 'F')">
                                <span class="label-s">Sai</span>
                            </label>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }
    return html;
}

function renderPart3(questions) {
    return `<div class="section-header">PHẦN III. Trắc nghiệm trả lời ngắn</div>` + 
    questions.map((q, i) => `
    <div class="question-card">
        <div class="question-text"><b>Câu ${i + 1}.</b> ${q.contentRoot || q.questionText || ""}</div>
        ${q.image ? `<img src="${q.image}" class="question-image">` : ''}
        <input type="text" class="fill-input" data-qid="${q.id}" 
               placeholder="Nhập đáp án của bạn..." 
               oninput="saveAnswer('${q.id}', this.value)">
    </div>`).join('');
}

/* =====================================================
   3. HỆ THỐNG ĐIỀU KHIỂN
   ===================================================== */
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const timerDisplay = document.getElementById('timer');
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            processSubmitExam(true);
            return;
        }
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        if (timerDisplay) timerDisplay.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

window.saveAnswer = function (id, val) {
    if (submitted) return;
    studentAnswers[id] = val;
    doAutosave();
};

function doAutosave() {
    if (!sessionData) return;
    localStorage.setItem(`autosave_${sessionData.examId}`, JSON.stringify({
        examId: sessionData.examId,
        answers: studentAnswers
    }));
}

async function processSubmitExam(force = false) {
    if (submitted) return;
    if (!force && !confirm('Bạn chắc chắn muốn nộp bài?')) return;

    submitted = true;
    clearInterval(timerInterval);
    clearInterval(autosaveInterval); // ✅ Dừng autosave khi nộp bài

    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div><p class="loading-msg">Đang nộp bài...</p>';
    document.body.appendChild(overlay);

    try {
        // ✅ ĐÚNG - Dùng submitExam() từ api-connector.js
        const result = await submitExam({
            examId: sessionData.examId,
            studentName: sessionData.studentName,
            studentClass: sessionData.studentClass,
            answers: studentAnswers,
            usedTime: (parseInt(sessionData.duration) * 60) - timeLeft
        });

        if (result.success) {
            // Xóa autosave sau khi nộp thành công
            localStorage.removeItem(`autosave_${sessionData.examId}`);
            
            // Lưu kết quả vào sessionStorage
            sessionStorage.setItem('examResult', JSON.stringify(result));
            
            // Chuyển sang trang kết quả
            window.location.href = 'result.html';
        } else {
            // Xử lý lỗi từ backend
            alert('❌ Lỗi: ' + (result.message || 'Không thể nộp bài'));
            submitted = false;
            document.getElementById('loading-overlay').remove();
        }
    } catch (error) {
        console.error('Submit error:', error);
        alert('❌ Lỗi kết nối: ' + error.message + '\n\nĐáp án đã được lưu tự động. Vui lòng thử lại.');
        submitted = false;
        document.getElementById('loading-overlay').remove();
    }
}

// Đổi tên thành finishExam để tránh trùng với hàm submitExam của API
window.finishExam = () => processSubmitExam(false);

document.addEventListener('DOMContentLoaded', () => {
    const rawData = sessionStorage.getItem('currentExam');
    if (rawData) window.initExam(JSON.parse(rawData));
});