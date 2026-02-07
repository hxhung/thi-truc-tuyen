/**
 * =====================================================
 * EXAM ENGINE - FINAL STANDARD VERSION
 * 1. Render: 3 Phần (Trắc nghiệm, Đúng/Sai, Điền khuyết).
 * 2. Submit: Hiển thị màn hình Kết quả (Result Screen) như bản gốc.
 * 3. Feature: Header hiển thị Title, Auto-save, Restore.
 * =====================================================
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let timerInterval = null;

// --- 1. KHỞI TẠO ---
document.addEventListener('DOMContentLoaded', () => {
    loadConfig().then(() => {
        loadExamData();
        setupAutoSave();
    });
});

async function loadConfig() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
    } catch (error) {
        console.error('Lỗi Config:', error);
        alert('Không thể tải cấu hình hệ thống!');
    }
}

async function loadExamData() {
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) {
        alert('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html';
        return;
    }

    // [CHUẨN GỐC] Hiển thị Title
    const titleEl = document.getElementById('exam-title');
    if (titleEl) {
        titleEl.innerText = sessionData.title ? sessionData.title : `MÃ ĐỀ: ${sessionData.examId}`;
    }

    const container = document.getElementById('exam-container');
    container.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Đang tải đề thi...</div>';

    const url = `${examConfig.api_endpoint}?action=getQuestions&examId=${sessionData.examId}`;

    try {
        const res = await fetch(url);
        const json = await res.json();

        if (json.success) {
            currentQuestions = json.data;
            startTimer(sessionData.remainingMinutes * 60);
            renderExamSections(currentQuestions);
        } else {
            container.innerHTML = `<div style="color:red; text-align:center;">❌ ${json.message}</div>`;
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="color:red; text-align:center;">❌ Lỗi kết nối máy chủ.</div>`;
    }
}

// --- 2. RENDER 3 PHẦN (LOGIC MỚI) ---
function renderExamSections(questions) {
    const container = document.getElementById('exam-container');
    container.innerHTML = '';

    const p1 = questions.filter(q => q.type === 'MULTIPLE_CHOICE');
    const p2 = questions.filter(q => q.type === 'TRUE_FALSE');
    const p3 = questions.filter(q => q.type === 'FILL_IN');

    // PHẦN 1
    if (p1.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN I: TRẮC NGHIỆM (${p1.length} câu)</div>`;
        p1.forEach((q, index) => container.appendChild(createQuestionCard_P1(q, index + 1)));
    }

    // PHẦN 2 (Gom nhóm)
    if (p2.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN II: TRẮC NGHIỆM ĐÚNG/SAI</div>`;
        let currentContent = null;
        let groupDiv = null;
        let questionCount = 0;

        p2.forEach((q) => {
            if (q.content !== currentContent) {
                questionCount++;
                currentContent = q.content;
                groupDiv = document.createElement('div');
                groupDiv.className = 'question-group';
                groupDiv.innerHTML = `
                    <div class="q-stem"><strong>Câu ${questionCount}:</strong> ${renderLatex(q.content)}</div>
                    ${q.image ? `<img src="${q.image}" class="q-image" onerror="this.style.display='none'">` : ''}
                `;
                container.appendChild(groupDiv);
            }
            const subDiv = document.createElement('div');
            subDiv.className = 'sub-question-row';
            subDiv.innerHTML = `
                <div class="sub-text">${renderLatex(q.content_sub || "Ý hỏi:")}</div>
                <div class="tf-options">
                    <label class="tf-btn"><input type="radio" name="q_${q.id}" value="T" onchange="saveAnswer(${q.id}, 'T')"> ĐÚNG</label>
                    <label class="tf-btn"><input type="radio" name="q_${q.id}" value="F" onchange="saveAnswer(${q.id}, 'F')"> SAI</label>
                </div>
            `;
            groupDiv.appendChild(subDiv);
        });
    }

    // PHẦN 3
    if (p3.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN III: TRẢ LỜI NGẮN</div>`;
        p3.forEach((q, index) => container.appendChild(createQuestionCard_P3(q, index + 1)));
    }

    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}]
        });
    }
    restoreProgress();
}

function createQuestionCard_P1(q, index) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.innerHTML = `
        <div class="q-title"><strong>Câu ${index}:</strong> ${renderLatex(q.content)} ${renderLatex(q.content_sub || "")}</div>
        ${q.image ? `<img src="${q.image}" class="q-image" onerror="this.style.display='none'">` : ''}
        <div class="options-grid">
            ${['A', 'B', 'C', 'D'].map(opt => `
                <label class="option-item">
                    <input type="radio" name="q_${q.id}" value="${opt}" onchange="saveAnswer(${q.id}, '${opt}')">
                    <span class="opt-label">${opt}.</span> ${renderLatex(q.options[opt] || "")}
                </label>
            `).join('')}
        </div>
    `;
    return card;
}

function createQuestionCard_P3(q, index) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.innerHTML = `
        <div class="q-title"><strong>Câu ${index}:</strong> ${renderLatex(q.content)} ${renderLatex(q.content_sub || "")}</div>
        ${q.image ? `<img src="${q.image}" class="q-image" onerror="this.style.display='none'">` : ''}
        <div class="fill-in-box">
            <input type="text" id="input_${q.id}" class="fill-input" placeholder="Nhập đáp án..." onblur="saveAnswer(${q.id}, this.value)">
        </div>
    `;
    return card;
}

// --- 3. TIỆN ÍCH ---
function saveAnswer(qId, value) {
    studentAnswers[qId] = value;
    localStorage.setItem('exam_progress', JSON.stringify(studentAnswers));
}

function restoreProgress() {
    const saved = localStorage.getItem('exam_progress');
    if (saved) {
        studentAnswers = JSON.parse(saved);
        for (let [qId, val] of Object.entries(studentAnswers)) {
            const radio = document.querySelector(`input[name="q_${qId}"][value="${val}"]`);
            if (radio) radio.checked = true;
            const textInput = document.getElementById(`input_${qId}`);
            if (textInput) textInput.value = val;
        }
    }
}

function renderLatex(text) { return text || ""; }

function setupAutoSave() {
    setInterval(() => {
        if (Object.keys(studentAnswers).length > 0) localStorage.setItem('exam_progress', JSON.stringify(studentAnswers));
    }, 30000);
}

// --- 4. NỘP BÀI (LOGIC GỐC TỪ ZIP - HIỂN THỊ KẾT QUẢ) ---
async function submitExam() {
    if (!confirm('Bạn có chắc chắn muốn nộp bài không?')) return;

    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    const payload = {
        examId: sessionData.examId,
        studentName: sessionData.studentName || 'Học sinh',
        className: sessionData.className || '',
        answers: studentAnswers
    };

    const btn = document.querySelector('button[onclick="submitExam()"]');
    if(btn) { btn.innerText = "Đang chấm điểm..."; btn.disabled = true; }

    try {
        const res = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            body: JSON.stringify(payload)
        }).then(r => r.json());

        if (res.success) {
            // [QUAN TRỌNG] Thay vì Alert, dùng giao diện Kết quả như file gốc
            // Lưu ý: Backend hiện tại chỉ trả về 'score', chưa trả 'correctCount'. 
            // Nên ta hiển thị Điểm số là chính.
            
            document.body.innerHTML = `
                <div style="font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #f4f6f9;">
                    <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%;">
                        <h2 style="color: #333; margin: 0 0 20px 0;">KẾT QUẢ BÀI THI</h2>
                        
                        <div style="
                            width: 120px; height: 120px; margin: 0 auto 20px;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            display: flex; align-items: center; justify-content: center;
                            font-size: 36px; font-weight: bold;
                            box-shadow: 0 10px 20px rgba(118, 75, 162, 0.4);
                        ">
                            ${res.score}
                        </div>

                        <p style="font-size: 16px; color: #555; margin-bottom: 30px;">
                            Chúc mừng bạn đã hoàn thành bài thi!
                        </p>

                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button onclick="location.href='index.html'" style="
                                background: #007bff; color: white; border: none; padding: 12px 24px;
                                border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 15px;
                            ">
                                Về Trang Chủ
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Xóa dữ liệu phiên thi
            localStorage.removeItem('exam_progress');
            
            // Lưu lịch sử
            let history = JSON.parse(localStorage.getItem('exam_results') || '[]');
            history.push({
                examId: sessionData.examId,
                score: res.score,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('exam_results', JSON.stringify(history));

        } else {
            alert('Lỗi: ' + res.message);
            if(btn) { btn.innerText = "Nộp Bài Thi"; btn.disabled = false; }
        }
    } catch (e) {
        alert('Lỗi kết nối! Vui lòng thử lại.');
        if(btn) { btn.innerText = "Nộp Bài Thi"; btn.disabled = false; }
    }
}

// --- 5. TIMER ---
function startTimer(duration) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById('timer');
    
    timerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        if (display) display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(timerInterval);
            alert("Hết giờ làm bài!");
            submitExam();
        }
    }, 1000);
}
