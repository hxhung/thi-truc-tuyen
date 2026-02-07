/**
 * =====================================================
 * EXAM ENGINE - FINAL VERSION (2025 STANDARD)
 * Cập nhật: Render 3 phần, Gom nhóm True/False, Xử lý Content_Sub
 * =====================================================
 */

// --- GLOBAL VARIABLES ---
let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let timerInterval = null;

// --- 1. KHỞI TẠO & LOAD DỮ LIỆU ---
document.addEventListener('DOMContentLoaded', () => {
    loadConfig().then(() => {
        loadExamData();
        setupAutoSave(); // Khôi phục bài làm nếu lỡ tải lại trang
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
    // Lấy thông tin phiên thi từ sessionStorage (lưu lúc đăng nhập)
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) { 
        alert('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html'; 
        return; 
    }

    // Hiển thị loading
    const container = document.getElementById('exam-container');
    container.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Đang tải đề thi...</div>';

    // Gọi API lấy câu hỏi
    // api-connector.js đã có hàm getQuestions, ta dùng nó hoặc fetch trực tiếp
    const url = `${examConfig.api_endpoint}?action=getQuestions&examId=${sessionData.examId}`;
    
    try {
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success) {
            currentQuestions = json.data;
            document.getElementById('exam-title').innerText = `MÃ ĐỀ: ${sessionData.examId}`;
            
            // Khởi động đồng hồ
            startTimer(sessionData.remainingMinutes * 60);
            
            // Render đề thi
            renderExamSections(currentQuestions);
        } else {
            container.innerHTML = `<div style="color:red; text-align:center;">❌ ${json.message}</div>`;
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="color:red; text-align:center;">❌ Lỗi kết nối máy chủ.</div>`;
    }
}

// --- 2. RENDER GIAO DIỆN (CORE LOGIC) ---
function renderExamSections(questions) {
    const container = document.getElementById('exam-container');
    container.innerHTML = ''; // Clear loading

    // Phân loại câu hỏi
    const p1 = questions.filter(q => q.type === 'MULTIPLE_CHOICE');
    const p2 = questions.filter(q => q.type === 'TRUE_FALSE');
    const p3 = questions.filter(q => q.type === 'FILL_IN');

    // --- PHẦN I: TRẮC NGHIỆM ---
    if (p1.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN I: TRẮC NGHIỆM (${p1.length} câu)</div>`;
        p1.forEach((q, index) => {
            container.appendChild(createQuestionCard_P1(q, index + 1));
        });
    }

    // --- PHẦN II: ĐÚNG/SAI (GOM NHÓM) ---
    if (p2.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN II: TRẮC NGHIỆM ĐÚNG/SAI</div>`;
        
        // Logic gom nhóm: Các câu có cùng Content sẽ vào 1 cụm
        let currentContent = null;
        let groupDiv = null;
        let questionCount = 0; // Đếm số câu lớn (Câu 1, Câu 2...)

        p2.forEach((q) => {
            // Nếu nội dung gốc khác câu trước -> Bắt đầu câu hỏi lớn mới
            if (q.content !== currentContent) {
                questionCount++;
                currentContent = q.content;
                
                // Tạo khung cho câu hỏi lớn
                groupDiv = document.createElement('div');
                groupDiv.className = 'question-group';
                groupDiv.innerHTML = `
                    <div class="q-stem"><strong>Câu ${questionCount}:</strong> ${renderLatex(q.content)}</div>
                    ${q.image ? `<img src="${q.image}" class="q-image" onerror="this.style.display='none'">` : ''}
                `;
                container.appendChild(groupDiv);
            }

            // Thêm các ý nhỏ (a, b, c, d) vào khung câu hỏi lớn hiện tại
            // q.content_sub chứa "a) ...", ta hiển thị nó
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

    // --- PHẦN III: TRẢ LỜI NGẮN ---
    if (p3.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN III: TRẢ LỜI NGẮN</div>`;
        p3.forEach((q, index) => {
            container.appendChild(createQuestionCard_P3(q, index + 1));
        });
    }

    // Render lại công thức toán (KaTeX)
    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ]
        });
    }
    
    // Khôi phục bài làm đã lưu (nếu có)
    restoreProgress();
}

// --- 3. CÁC HÀM TẠO HTML CON ---

// Tạo thẻ câu hỏi Phần I (Trắc nghiệm)
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

// Tạo thẻ câu hỏi Phần III (Điền khuyết)
function createQuestionCard_P3(q, index) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.innerHTML = `
        <div class="q-title"><strong>Câu ${index}:</strong> ${renderLatex(q.content)} ${renderLatex(q.content_sub || "")}</div>
        ${q.image ? `<img src="${q.image}" class="q-image" onerror="this.style.display='none'">` : ''}
        <div class="fill-in-box">
            <input type="text" class="fill-input" placeholder="Nhập đáp án của bạn..." 
                   onblur="saveAnswer(${q.id}, this.value)">
        </div>
    `;
    return card;
}

// --- 4. XỬ LÝ SỰ KIỆN & TIỆN ÍCH ---

function saveAnswer(qId, value) {
    studentAnswers[qId] = value;
    // Lưu vào LocalStorage phòng khi lỡ tắt trình duyệt
    localStorage.setItem('exam_progress', JSON.stringify(studentAnswers));
}

function restoreProgress() {
    const saved = localStorage.getItem('exam_progress');
    if (saved) {
        studentAnswers = JSON.parse(saved);
        // Điền lại lên giao diện
        for (let [qId, val] of Object.entries(studentAnswers)) {
            // Radio buttons (Trắc nghiệm + Đúng Sai)
            const radio = document.querySelector(`input[name="q_${qId}"][value="${val}"]`);
            if (radio) radio.checked = true;
            
            // Text inputs (Điền khuyết) - Cần tìm input có sự kiện onblur chứa ID này
            // Cách đơn giản hơn: Tìm theo DOM
            // (Phần này để đơn giản ta chỉ khôi phục Radio, text input làm sau nếu cần kỹ)
        }
    }
}

function renderLatex(text) {
    if (!text) return "";
    return text; // KaTeX sẽ tự render sau
}

function setupAutoSave() {
    // Auto-save mỗi 30 giây
    setInterval(() => {
        if (Object.keys(studentAnswers).length > 0) {
            localStorage.setItem('exam_progress', JSON.stringify(studentAnswers));
        }
    }, 30000);
}

// --- 5. NỘP BÀI (SUBMIT) ---
async function submitExam() {
    // 1. Xác nhận
    if (!confirm('Bạn có chắc chắn muốn nộp bài không?')) return;
    
    // 2. Chuẩn bị dữ liệu
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    const payload = {
        examId: sessionData.examId,
        studentName: sessionData.studentName || 'Học sinh', // Cần lấy từ lúc đăng nhập nếu có
        className: sessionData.className || '',
        answers: studentAnswers
    };

    // 3. Gửi lên Server
    const btn = document.querySelector('button[onclick="submitExam()"]');
    if(btn) { btn.innerText = "Đang nộp bài..."; btn.disabled = true; }

    try {
        const res = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        
        if (json.success) {
            alert(`Nộp bài thành công!\nĐiểm số: ${json.score}`);
            localStorage.removeItem('exam_progress'); // Xóa bản nháp
            
            // Lưu kết quả để trang statistics hiển thị
            let history = JSON.parse(localStorage.getItem('exam_results') || '[]');
            history.push({
                examId: sessionData.examId,
                score: json.score,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('exam_results', JSON.stringify(history));

            // Quay về trang chủ hoặc trang kết quả
            window.location.href = 'index.html';
        } else {
            alert('Lỗi: ' + json.message);
            if(btn) { btn.innerText = "Nộp Bài Thi"; btn.disabled = false; }
        }
    } catch (err) {
        alert('Lỗi kết nối! Vui lòng thử lại.');
        if(btn) { btn.innerText = "Nộp Bài Thi"; btn.disabled = false; }
    }
}

// --- 6. TIMER ---
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