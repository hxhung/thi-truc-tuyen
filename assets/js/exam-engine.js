/**
 * EXAM ENGINE - PHIÊN BẢN FINAL (RENDER + TIMER + SUBMIT)
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let sessionData = null;
let timerInterval = null;

// --- 1. KHỞI TẠO ---
document.addEventListener('DOMContentLoaded', () => {
    loadConfig().then(() => {
        loadExamData();
        injectLoadingStyles();
    });
});

async function loadConfig() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
    } catch (error) {
        console.error("Không đọc được config.json");
    }
}

// --- 2. HÀM TẢI VÀ HIỂN THỊ DỮ LIỆU (QUAN TRỌNG NHẤT) ---
async function loadExamData() {
    // Lấy dữ liệu từ index.html đã lưu
    const sessionRaw = sessionStorage.getItem('currentExam');
    
    if (!sessionRaw) {
        alert('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html';
        return;
    }

    sessionData = JSON.parse(sessionRaw);
    
    // 1. Hiển thị tiêu đề và Tên
    document.getElementById('exam-title').innerText = (sessionData.title || "BÀI THI") + " - " + sessionData.examId;
    
    // 2. Lấy danh sách câu hỏi
    if (sessionData.questions && sessionData.questions.length > 0) {
        currentQuestions = sessionData.questions;
        
        // GỌI HÀM VẼ GIAO DIỆN (Phần bạn còn thiếu)
        renderExamInterface(currentQuestions);
        
        // BẮT ĐẦU ĐẾM NGƯỢC
        startTimer(sessionData.duration);
    } else {
        document.getElementById('exam-container').innerHTML = `<h3 style="text-align:center; color:red">Không có dữ liệu câu hỏi!</h3>`;
    }
}

// --- 3. HÀM VẼ GIAO DIỆN CÂU HỎI ---
function renderExamInterface(questions) {
    const container = document.getElementById('exam-container');
    container.innerHTML = ''; // Xóa chữ "Đang tải..."

    // Phân loại câu hỏi
    const p1 = questions.filter(q => q.type === 'MULTIPLE_CHOICE');
    const p2 = questions.filter(q => q.type === 'TRUE_FALSE');
    const p3 = questions.filter(q => q.type === 'FILL_IN');

    // --- VẼ PHẦN I: TRẮC NGHIỆM ---
    if (p1.length > 0) {
        let html = `<div class="section-header">PHẦN I: TRẮC NGHIỆM KHÁCH QUAN</div>`;
        p1.forEach((q, index) => {
            html += `
            <div class="question-card">
                <div class="q-stem"><strong>Câu ${index + 1}:</strong> ${renderMath(q.contentSub || q.contentRoot)}</div>
                ${q.image ? `<img src="${q.image}" style="max-width:100%; margin-bottom:10px">` : ''}
                <div class="options-grid">
                    ${['A', 'B', 'C', 'D'].map(opt => `
                        <label class="option-label" style="display:flex; align-items:center; gap:5px; padding:8px; border:1px solid #ddd; border-radius:5px; cursor:pointer">
                            <input type="radio" name="q_${q.id}" value="${opt}" onchange="saveAnswer(${q.rowIndex}, '${opt}')">
                            <span><b>${opt}.</b> ${q.options[opt] || ''}</span>
                        </label>
                    `).join('')}
                </div>
            </div>`;
        });
        container.innerHTML += html;
    }

    // --- VẼ PHẦN II: ĐÚNG SAI (NHÓM THEO CÂU DẪN) ---
    if (p2.length > 0) {
        let html = `<div class="section-header">PHẦN II: TRẮC NGHIỆM ĐÚNG SAI</div>`;
        
        // Nhóm các câu hỏi theo contentRoot (Câu dẫn chung)
        const groups = {};
        p2.forEach(q => {
            const root = q.contentRoot || "Câu hỏi chung";
            if (!groups[root]) groups[root] = [];
            groups[root].push(q);
        });

        let gIndex = 1;
        for (const [rootText, items] of Object.entries(groups)) {
            html += `
            <div class="question-group">
                <div class="q-stem"><strong>Câu ${gIndex}:</strong> ${renderMath(rootText)}</div>
                ${items.map((q, i) => `
                    <div class="sub-question-row">
                        <div class="sub-text">
                             <strong>${String.fromCharCode(97 + i)})</strong> ${renderMath(q.contentSub)}
                        </div>
                        <div class="tf-options">
                            <label><input type="radio" name="q_${q.id}" value="T" onchange="saveAnswer(${q.rowIndex}, 'T')"> Đúng</label>
                            <label><input type="radio" name="q_${q.id}" value="F" onchange="saveAnswer(${q.rowIndex}, 'F')"> Sai</label>
                        </div>
                    </div>
                `).join('')}
            </div>`;
            gIndex++;
        }
        container.innerHTML += html;
    }

    // --- VẼ PHẦN III: ĐIỀN SỐ ---
    if (p3.length > 0) {
        let html = `<div class="section-header">PHẦN III: TRẮC NGHIỆM TRẢ LỜI NGẮN</div>`;
        p3.forEach((q, index) => {
            html += `
            <div class="question-card">
                <div class="q-stem"><strong>Câu ${index + 1}:</strong> ${renderMath(q.contentSub || q.contentRoot)}</div>
                ${q.image ? `<img src="${q.image}" style="max-width:100%">` : ''}
                <input type="text" class="fill-input" placeholder="Nhập đáp án của bạn..." 
                    onchange="saveAnswer(${q.rowIndex}, this.value)">
            </div>`;
        });
        container.innerHTML += html;
    }

    // Render công thức toán (nếu có dùng Katex)
    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ]
        });
    }
}

// Hàm hỗ trợ render text (đơn giản)
function renderMath(text) {
    if (!text) return "";
    return text.replace(/\n/g, "<br>");
}

// --- 4. LOGIC LƯU ĐÁP ÁN ---
window.saveAnswer = function(rowIndex, value) {
    studentAnswers[rowIndex] = value;
    // Có thể lưu vào sessionStorage để F5 không mất bài (Tuỳ chọn)
    sessionStorage.setItem('studentAnswers', JSON.stringify(studentAnswers));
};

// --- 5. LOGIC ĐỒNG HỒ ĐẾM NGƯỢC ---
function startTimer(durationMinutes) {
    let timeLeft = durationMinutes * 60;
    const timerElement = document.getElementById('timer');
    
    // Cập nhật ngay lập tức
    updateTimerDisplay(timeLeft, timerElement);

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft, timerElement);

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert("Hết giờ làm bài! Hệ thống sẽ tự động nộp bài.");
            submitExam(true); // Force submit
        }
    }, 1000);
}

function updateTimerDisplay(seconds, element) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    element.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    
    // Đổi màu khi sắp hết giờ
    if (seconds < 300) element.style.color = "red";
}

// --- 6. HÀM NỘP BÀI (ĐÃ SỬA CHUẨN TỪ CODE TRƯỚC CỦA BẠN) ---
window.submitExam = async function(force = false) {
    if (!force && !confirm('Bạn có chắc chắn muốn nộp bài?')) return;

    // 1. Hiện Loading
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `<div class="spinner"></div><div class="loading-msg">Đang chấm điểm...</div>`;
    document.body.appendChild(overlay);

    try {
        const sName = sessionData.studentName || localStorage.getItem('lastStudentName') || "Thí sinh";
        const sClass = localStorage.getItem('lastStudentClass') || "";

        const payload = JSON.stringify({
            examId: sessionData.examId,
            studentName: sName,
            studentClass: sClass,
            answers: studentAnswers,
            startTime: sessionData.startTime,
            submitTime: new Date().toISOString()
        });

        const response = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload
        });

        const result = await response.json();

        if (result.success) {
            // Lưu lịch sử
            saveToHistory({
                testName: sessionData.title || result.examId,
                examId: result.examId,
                studentName: sName,
                score: result.score,
                date: new Date().toISOString()
            });

            // Lưu kết quả để trang result.html hiển thị
            result.studentName = sName;
            result.studentClass = sClass;
            sessionStorage.setItem('examResult', JSON.stringify(result));

            // Dọn dẹp và chuyển trang
            sessionStorage.removeItem('currentExam');
            localStorage.removeItem('exam_progress');
            window.location.href = 'result.html';
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        if(document.getElementById('loading-overlay')) document.getElementById('loading-overlay').remove();
        alert("Lỗi nộp bài: " + error.message);
    }
};

function injectLoadingStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        #loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.95); z-index: 99999; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .spinner { width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
}

function saveToHistory(record) {
    try {
        const oldData = JSON.parse(localStorage.getItem('exam_results') || '[]');
        oldData.push(record);
        localStorage.setItem('exam_results', JSON.stringify(oldData));
    } catch (e) {}
}
