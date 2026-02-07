/**
 * =====================================================
 * EXAM ENGINE - FINAL FIXED VERSION
 * 1. Logic Render: 3 Phần (Chuẩn Excel mới).
 * 2. Timer: Fix lỗi đếm ngược.
 * 3. Result UI: Khôi phục giao diện gốc (Gradient Circle).
 * =====================================================
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let timerInterval = null;

// --- 1. KHỞI TẠO & LOAD DỮ LIỆU ---
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
    // Lấy thông tin phiên thi
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) {
        alert('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html';
        return;
    }

    // Hiển thị Tiêu đề (Header)
    const titleEl = document.getElementById('exam-title');
    if (titleEl) {
        titleEl.innerText = sessionData.title ? sessionData.title : `MÃ ĐỀ: ${sessionData.examId}`;
    }

    const container = document.getElementById('exam-container');
    container.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Đang tải đề thi...</div>';

    // Gọi API lấy câu hỏi
    const url = `${examConfig.api_endpoint}?action=getQuestions&examId=${sessionData.examId}`;

    try {
        const res = await fetch(url);
        const json = await res.json();

        if (json.success) {
            currentQuestions = json.data;

            // [FIX 1] Khởi động đồng hồ (Chuyển phút sang giây)
            // Đảm bảo sessionData.remainingMinutes là số
            const minutes = parseFloat(sessionData.remainingMinutes) || 45; 
            startTimer(minutes * 60);

            // Render đề thi 3 phần
            renderExamSections(currentQuestions);
        } else {
            container.innerHTML = `<div style="color:red; text-align:center;">❌ ${json.message}</div>`;
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="color:red; text-align:center;">❌ Lỗi kết nối máy chủ.</div>`;
    }
}

// --- 2. RENDER GIAO DIỆN (3 PHẦN) ---
function renderExamSections(questions) {
    const container = document.getElementById('exam-container');
    container.innerHTML = ''; 

    const p1 = questions.filter(q => q.type === 'MULTIPLE_CHOICE');
    const p2 = questions.filter(q => q.type === 'TRUE_FALSE');
    const p3 = questions.filter(q => q.type === 'FILL_IN');

    // PHẦN I
    if (p1.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN I: TRẮC NGHIỆM (${p1.length} câu)</div>`;
        p1.forEach((q, index) => container.appendChild(createQuestionCard_P1(q, index + 1)));
    }

    // PHẦN II (Gom nhóm)
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

    // PHẦN III
    if (p3.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN III: TRẢ LỜI NGẮN</div>`;
        p3.forEach((q, index) => container.appendChild(createQuestionCard_P3(q, index + 1)));
    }

    // KaTeX Render
    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}]
        });
    }
    restoreProgress();
}

// --- 3. TEMPLATE CÂU HỎI ---
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

// --- 4. TIỆN ÍCH HỆ THỐNG ---
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

// --- 5. ĐỒNG HỒ ĐẾM NGƯỢC (Đã sửa logic) ---
function startTimer(durationInSeconds) {
    let timer = durationInSeconds; 
    const display = document.getElementById('timer');
    
    // Xóa interval cũ nếu có để tránh chạy chồng chéo
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(function () {
        let minutes = parseInt(timer / 60, 10);
        let seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        if (display) {
            display.textContent = minutes + ":" + seconds;
            
            // Hiệu ứng sắp hết giờ (đổi màu đỏ khi còn dưới 5 phút)
            if (timer < 300) display.style.color = "red";
        }

        if (--timer < 0) {
            clearInterval(timerInterval);
            alert("Hết giờ làm bài!");
            submitExam(true); // true = nộp bắt buộc
        }
    }, 1000);
}

// --- 6. NỘP BÀI & GIAO DIỆN KẾT QUẢ (KHÔI PHỤC CODE GỐC) ---
async function submitExam(force = false) {
    if (!force && !confirm('Bạn có chắc chắn muốn nộp bài không?')) return;

    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    const payload = {
        examId: sessionData.examId,
        studentName: sessionData.studentName || 'Học sinh',
        // [FIX] Lấy đúng tên biến studentClass từ sessionStorage
        className: sessionData.studentClass || sessionData.className || '', 
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
            // --- [FIX 2] GIAO DIỆN KẾT QUẢ GỐC CỦA BẠN ---
            // Code này thay thế toàn bộ body bằng giao diện kết quả
            document.body.innerHTML = `
                <style>
                    /* Inline CSS dự phòng trường hợp mất file style */
                    .score-gradient {
                        width: 150px; height: 150px; margin: 20px auto;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white; display: flex; align-items: center; justify-content: center;
                        font-size: 48px; font-weight: bold;
                        box-shadow: 0 10px 20px rgba(118, 75, 162, 0.4);
                        font-family: 'Segoe UI', sans-serif;
                    }
                    .result-container {
                        text-align: center; padding-top: 50px; font-family: 'Segoe UI', sans-serif;
                        background-color: #f4f6f9; min-height: 100vh;
                    }
                    .btn-group button {
                        padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin: 5px;
                    }
                    .btn-retry { background: #e9ecef; color: #333; }
                    .btn-home { background: #007bff; color: white; }
                </style>
                
                <div class="result-container">
                    <h2 style="color:#333; margin:0">KẾT QUẢ</h2>
                    
                    <div class="score-gradient">${res.score}</div>
                    
                    <p style="font-size: 18px; color: #555;">
                        Số câu đúng: <b>${res.correctCount !== undefined ? res.correctCount : '?'}</b> / ${res.totalQuestions !== undefined ? res.totalQuestions : '?'}
                    </p>
                    
                    <div class="btn-group">
                        <button class="btn-retry" onclick="location.reload()">Làm lại</button>
                        <button class="btn-home" onclick="location.href='index.html'">Thoát</button>
                    </div>
                </div>
            `;
            // ---------------------------------------------------

            sessionStorage.removeItem('currentExam');
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
        console.error(e);
        if(btn) { btn.innerText = "Nộp Bài Thi"; btn.disabled = false; }
    }
}
