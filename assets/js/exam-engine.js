/**
 * EXAM ENGINE – FINAL VERSION
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
   1. KHỞI TẠO & KHÔI PHỤC
   ===================================================== */
window.initExam = function (data) {
    if (!data) return;
    sessionData = data;
    currentQuestions = data.questions || [];
    
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

    const raw = localStorage.getItem(`autosave_${sessionData.examId}`);
    if (raw) {
        try {
            const saved = JSON.parse(raw);
            if (saved.examId === sessionData.examId) {
                studentAnswers = saved.answers || {};
            }
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
        // Tìm cả radio của Part 1 và Part 2
        const radio = document.querySelector(`input[name="q${qId}"][value="${val}"]`) || 
                      document.querySelector(`input[name="${qId}"][value="${val}"]`);
        if (radio) radio.checked = true;
        
        // Điền lại input cho Part 3
        const input = document.querySelector(`input[data-qid="${qId}"]`);
        if (input) input.value = val;
    });
}

/* =====================================================
   2. HÀM RENDER CHUẨN HÓA
   ===================================================== */
function renderExam(rawQuestions) {
    const container = document.getElementById('exam-container');
    if (!container) return;

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:red;">⚠️ Không có dữ liệu câu hỏi</div>';
        return;
    }

    // Chuẩn hóa Part và ID
    const questions = rawQuestions.map((q, idx) => {
        let rawPart = q.part ?? q.Part ?? q.Phan ?? 1;
        let rawId = q.id ?? q.ID ?? `auto_${idx}`;
        return { ...q, id: String(rawId), part: Number(rawPart) };
    });

    const p1 = questions.filter(q => q.part === 1);
    const p2 = questions.filter(q => q.part === 2);
    const p3 = questions.filter(q => q.part === 3);

    container.innerHTML = '';
    if (p1.length) container.innerHTML += renderPart1(p1);
    if (p2.length) container.innerHTML += renderPart2(p2);
    if (p3.length) container.innerHTML += renderPart3(p3);

    // Render KaTeX sau khi HTML đã được nạp
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
    let html = `<div class="section-header">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.</div>`;
    html += questions.map((q, i) => `
    <div class="question-card">
        <div class="question-text"><b>Câu ${i + 1}.</b> ${q.contentRoot || q.questionText || ""}</div>
        ${q.image ? `<img src="${q.image}" class="question-image">` : ''}
        <div class="options-grid">
            ${['A', 'B', 'C', 'D'].map(opt => {
                const optText = q.options ? q.options[opt] : (q['option' + opt] || "");
                return `
                <label class="option-item">
                    <input type="radio" name="${q.id}" value="${opt}" onchange="saveAnswer('${q.id}', '${opt}')">
                    <span><b>${opt}.</b> ${optText}</span>
                </label>`;
            }).join('')}
        </div>
    </div>`).join('');
    return html;
}

function renderPart2(questions) {
    if (!questions.length) return '';
    let html = `<div class="section-header">PHẦN II. Câu trắc nghiệm đúng sai.</div>`;
    
    const chunkSize = 4;
    for (let i = 0; i < questions.length; i += chunkSize) {
        const group = questions.slice(i, i + chunkSize);
        const groupIndex = Math.floor(i / chunkSize) + 1;
        const firstItem = group[0];
        const rootText = firstItem.contentRoot || "Chọn Đúng hoặc Sai cho mỗi mệnh đề:";

        html += `
        <div class="question-card">
            <div class="question-text" style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <b style="color:var(--primary);">Câu ${groupIndex}.</b> ${rootText}
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
    let html = `<div class="section-header">PHẦN III. Câu trắc nghiệm trả lời ngắn.</div>`;
    html += questions.map((q, i) => `
    <div class="question-card">
        <div class="question-text"><b>Câu ${i + 1}.</b> ${q.contentRoot || q.questionText || ""}</div>
        ${q.image ? `<img src="${q.image}" class="question-image">` : ''}
        <input type="text" class="fill-input" data-qid="${q.id}" 
               placeholder="Nhập đáp án..." 
               oninput="saveAnswer('${q.id}', this.value)">
    </div>`).join('');
    return html;
}

/* =====================================================
   3. LOGIC HỆ THỐNG
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
        if (timerDisplay) timerDisplay.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
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
    if (!force && !confirm('Bạn muốn nộp bài?')) return;

    submitted = true;
    clearInterval(timerInterval);
    clearInterval(autosaveInterval);

    // Hiển thị overlay chờ
    const div = document.createElement('div');
    div.id = 'loading-overlay';
    div.innerHTML = '<div class="spinner"></div><p>Đang nộp bài...</p>';
    document.body.appendChild(div);

    try {
        const result = await google.script.run
            .withFailureHandler(err => { throw err; })
            .submitExamAPI({
                examId: sessionData.examId,
                studentName: sessionData.studentName,
                studentClass: sessionData.studentClass,
                answers: studentAnswers,
                usedTime: (parseInt(sessionData.duration) * 60) - timeLeft
            });

        if (result.success) {
            localStorage.removeItem(`autosave_${sessionData.examId}`);
            sessionStorage.setItem('examResult', JSON.stringify(result));
            location.href = result.redirectUrl || 'result.html';
        } else {
            alert("Lỗi: " + result.message);
            submitted = false;
        }
    } catch (e) {
        alert("Lỗi nộp bài: " + e.message);
        document.getElementById('loading-overlay')?.remove();
        submitted = false;
    }
}

window.submitExam = () => processSubmitExam(false);

document.addEventListener('DOMContentLoaded', () => {
    const raw = sessionStorage.getItem('currentExam');
    if (raw) window.initExam(JSON.parse(raw));
});