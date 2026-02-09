/**
 * EXAM ENGINE - PHIÊN BẢN ĐỒNG BỘ DATA & FIX TRUE/FALSE
 * Khớp hoàn toàn với Config.csv và Code.js hiện tại
 */

let currentQuestions = [];
let studentAnswers = {};
let sessionData = null;
let timerInterval = null;
let timeLeft = 0;
let submitted = false;

// =====================================================
// 1. KHỞI TẠO & XỬ LÝ DỮ LIỆU
// =====================================================
window.initExam = function (data) {
    if (!data) return;
    sessionData = data;
    
    const allQuestions = data.questions || [];
    
    // 1. Lọc câu hỏi theo mã đề (Chấp nhận cả hoa/thường)
    // Đồng thời xử lý "Fill Down" cho câu True/False bị khuyết nội dung gốc
    let lastContentRoot = "";
    
    currentQuestions = allQuestions.filter(q => {
        const qId = q.ExamID || q.examId || q.MaDe || ""; 
        return String(qId).trim().toLowerCase() === String(sessionData.examId).trim().toLowerCase();
    }).map(q => {
        // Fix lỗi CSV: Nếu dòng dưới khuyết Content_Root thì lấy của dòng trên
        if (q.Type === "TRUE_FALSE") {
            if (q.Content_Root && q.Content_Root.trim() !== "") {
                lastContentRoot = q.Content_Root;
            } else {
                q.Content_Root = lastContentRoot;
            }
        }
        return q;
    });

    // Kiểm tra dữ liệu
    if (currentQuestions.length === 0) {
        alert(`❌ Lỗi: Không tìm thấy câu hỏi cho mã đề "${sessionData.examId}"!\n(Đã nhận data nhưng lọc ra 0 kết quả)`);
        setTimeout(() => window.location.href = 'index.html', 3000);
        return;
    }

    // 2. Thiết lập thời gian
    const now = Date.now();
    const startToken = parseInt(sessionData.startToken) || now;
    const elapsedSeconds = Math.floor((now - startToken) / 1000);
    const totalDurationSeconds = parseInt(sessionData.duration) * 60;
    
    timeLeft = totalDurationSeconds - elapsedSeconds;

    if (timeLeft <= 0) {
        alert('Đã hết giờ làm bài!');
        finishExam();
        return;
    }

    // 3. Hiển thị thông tin
    document.getElementById('exam-title').innerText = `Đề thi: ${sessionData.title || sessionData.examId}`;
    startTimer();
    renderQuestions();
    
    // Auto-save mỗi 15 giây
    setInterval(autoSave, 15000);
};

// =====================================================
// 2. RENDER GIAO DIỆN (QUAN TRỌNG NHẤT)
// =====================================================
function renderQuestions() {
    const container = document.getElementById('exam-container');
    container.innerHTML = '';

    // --- PHẦN 1: TRẮC NGHIỆM (MULTIPLE_CHOICE) ---
    const p1 = currentQuestions.filter(q => q.Type === 'MULTIPLE_CHOICE');
    if (p1.length > 0) {
        container.innerHTML += `<div class="part-title">PHẦN 1: TRẮC NGHIỆM KHÁCH QUAN (${p1.length} câu)</div>`;
        p1.forEach((q, index) => {
            const qIndex = currentQuestions.indexOf(q); // Index thực tế trong mảng gốc
            container.innerHTML += `
                <div class="question-card" id="q-${qIndex}">
                    <div class="question-header">
                        <span class="question-number">Câu ${index + 1}</span>
                        <span>(ID: ${q.ExamID})</span>
                    </div>
                    <div class="question-content">
                        ${q.Content_Root || ''}
                        ${q.Image ? `<div class="text-center mt-2"><img src="${q.Image}" style="max-width:100%; border-radius:8px;"></div>` : ''}
                    </div>
                    <div class="options-grid">
                        ${renderOption(qIndex, 'A', q.Option_A)}
                        ${renderOption(qIndex, 'B', q.Option_B)}
                        ${renderOption(qIndex, 'C', q.Option_C)}
                        ${renderOption(qIndex, 'D', q.Option_D)}
                    </div>
                </div>`;
        });
    }

    // --- PHẦN 2: ĐÚNG SAI (TRUE_FALSE) ---
    // Cần gom nhóm các câu hỏi cùng Content_Root
    const p2Raw = currentQuestions.filter(q => q.Type === 'TRUE_FALSE');
    if (p2Raw.length > 0) {
        const groups = {};
        p2Raw.forEach(q => {
            const key = q.Content_Root || "unknown";
            if (!groups[key]) groups[key] = [];
            groups[key].push(q);
        });

        container.innerHTML += `<div class="part-title">PHẦN 2: TRẮC NGHIỆM ĐÚNG SAI</div>`;
        let groupCount = 1;
        
        for (const [content, items] of Object.entries(groups)) {
            let subRows = '';
            items.forEach((item, subIdx) => {
                const globalIdx = currentQuestions.indexOf(item);
                const label = String.fromCharCode(97 + subIdx); // a, b, c, d
                subRows += `
                    <div class="tf-row">
                        <div class="tf-content"><b>${label})</b> ${item.Content_Sub || ''}</div>
                        <div class="tf-options">
                            <label class="tf-btn"><input type="radio" name="q${globalIdx}" value="T" onchange="saveAnswer(${globalIdx}, 'T')"> ĐÚNG</label>
                            <label class="tf-btn"><input type="radio" name="q${globalIdx}" value="F" onchange="saveAnswer(${globalIdx}, 'F')"> SAI</label>
                        </div>
                    </div>`;
            });

            container.innerHTML += `
                <div class="question-card">
                    <div class="question-header">Câu ${groupCount++}</div>
                    <div class="question-content">${content}</div>
                    <div class="tf-container">${subRows}</div>
                </div>`;
        }
    }

    // --- PHẦN 3: ĐIỀN ĐÁP ÁN (FILL_IN) ---
    const p3 = currentQuestions.filter(q => q.Type === 'FILL_IN' || q.Type === 'SHORT_ANSWER');
    if (p3.length > 0) {
        container.innerHTML += `<div class="part-title">PHẦN 3: TRẮC NGHIỆM TRẢ LỜI NGẮN</div>`;
        p3.forEach((q, index) => {
            const qIndex = currentQuestions.indexOf(q);
            container.innerHTML += `
                <div class="question-card" id="q-${qIndex}">
                    <div class="question-header">Câu ${index + 1}</div>
                    <div class="question-content">
                        ${q.Content_Root || ''}
                        ${q.Image ? `<div class="text-center mt-2"><img src="${q.Image}" style="max-width:100%"></div>` : ''}
                    </div>
                    <div class="fill-input-container">
                        <label>Đáp án của bạn:</label>
                        <input type="text" class="fill-input" placeholder="Nhập kết quả..." 
                            onchange="saveAnswer(${qIndex}, this.value)">
                    </div>
                </div>`;
        });
    }
    
    // Render công thức Toán (nếu có KaTeX)
    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ]
        });
    }
}

// Helper: Render nút chọn A, B, C, D
function renderOption(qIdx, label, content) {
    if (!content) return '';
    return `
        <label class="option-item">
            <input type="radio" name="q${qIdx}" value="${label}" onchange="saveAnswer(${qIdx}, '${label}')">
            <span class="opt-label">${label}</span>
            <span class="opt-text">${content}</span>
        </label>`;
}

// =====================================================
// 3. XỬ LÝ SỰ KIỆN & TIMER
// =====================================================

window.saveAnswer = function(qIndex, value) {
    studentAnswers[qIndex] = value;
};

function autoSave() {
    if (submitted) return;
    localStorage.setItem(`autosave_${sessionData.examId}`, JSON.stringify(studentAnswers));
}

function startTimer() {
    const timerEl = document.getElementById('timer');
    timerInterval = setInterval(() => {
        timeLeft--;
        
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        timerEl.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        
        // Cảnh báo khi còn 5 phút
        if (timeLeft === 300) timerEl.style.color = 'red';

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert('Hết giờ làm bài! Hệ thống sẽ tự động nộp.');
            finishExam();
        }
    }, 1000);
}

// =====================================================
// 4. NỘP BÀI (Đã đổi tên hàm để tránh xung đột)
// =====================================================
window.finishExam = async function() {
    if (submitted) return;
    if (!confirm('Bạn có chắc chắn muốn nộp bài?')) return;

    submitted = true;
    clearInterval(timerInterval);
    
    // Hiển thị loading
    const btn = document.querySelector('.btn-submit');
    if(btn) { btn.disabled = true; btn.innerText = 'Đang nộp...'; }

    try {
        // Gọi hàm submitExam từ api-connector.js
        const result = await submitExam({
            examId: sessionData.examId,
            studentName: sessionData.studentName,
            studentClass: sessionData.studentClass,
            answers: studentAnswers, // Object { "0": "A", "1": "B"... }
            usedTime: (parseInt(sessionData.duration) * 60) - timeLeft
        });

        if (result.success) {
            localStorage.removeItem(`autosave_${sessionData.examId}`);
            sessionStorage.setItem('examResult', JSON.stringify(result));
            window.location.href = 'result.html';
        } else {
            alert('❌ Lỗi server: ' + result.message);
            submitted = false;
            if(btn) { btn.disabled = false; btn.innerText = 'Nộp bài'; }
        }
    } catch (e) {
        alert('❌ Lỗi kết nối: ' + e.message);
        submitted = false;
        if(btn) { btn.disabled = false; btn.innerText = 'Nộp bài'; }
    }
};