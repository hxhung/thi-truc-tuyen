/**
 * EXAM ENGINE - PHIÊN BẢN FIX LOADING & TIMER - Ver 1.10
 * Đang fix thẩm mĩ trang bài làm
 1. Thay thế hàm renderQuestions cũ trong assets/js/exam-engine.js
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
    console.log("Đang khởi tạo bài thi với dữ liệu:", data); // Log để debug
    if (!data) return;
    sessionData = data;
    
    const allQuestions = data.questions || [];
    
    // 1. Lọc câu hỏi theo mã đề (Chấp nhận cả hoa/thường)
    // Đồng thời xử lý "Fill Down" cho câu True/False bị khuyết nội dung gốc
    let lastContentRoot = "";
    
    currentQuestions = allQuestions.filter(q => {
        // Lấy ID từ cột ExamID (CSV) hoặc examId (JSON)
        const qId = q.ExamID || q.examId || q.MaDe || ""; 
        return String(qId).trim().toLowerCase() === String(sessionData.examId).trim().toLowerCase();
    }).map(q => {
        // Fix lỗi CSV: Nếu dòng dưới khuyết Content_Root thì lấy của dòng trên
        if (q.Type === "TRUE_FALSE") {
            if (q.Content_Root && String(q.Content_Root).trim() !== "") {
                lastContentRoot = q.Content_Root;
            } else {
                q.Content_Root = lastContentRoot;
            }
        }
        return q;
    });

    console.log("Số câu hỏi sau khi lọc:", currentQuestions.length);

    // Kiểm tra dữ liệu
    if (currentQuestions.length === 0) {
        alert(`❌ Lỗi: Không tìm thấy câu hỏi cho mã đề "${sessionData.examId}"!\n(Server trả về ${allQuestions.length} dòng, nhưng không dòng nào khớp mã đề)`);
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

    // 3. Hiển thị thông tin header
    const titleEl = document.getElementById('exam-title');
    if (titleEl) titleEl.innerText = `Đề thi: ${sessionData.title || sessionData.examId}`;
    
    // 4. Bắt đầu chạy
    startTimer();
    renderQuestions();
    
    // Auto-save mỗi 15 giây
    setInterval(autoSave, 15000);
};

// =====================================================
// 2. RENDER GIAO DIỆN (thay hàm mới)
// =====================================================
// Hàm thay thế mới
function renderQuestions() {
    const container = document.getElementById('exam-container');
    if (!container) return;
    container.innerHTML = '';

    // --- PHẦN 1: TRẮC NGHIỆM KHÁCH QUAN ---
    const p1 = currentQuestions.filter(q => q.Type === 'MULTIPLE_CHOICE');
    if (p1.length > 0) {
        // Thẻ tiêu đề Phần 1
        container.innerHTML += `<div class="part-header">PHẦN 1: TRẮC NGHIỆM KHÁCH QUAN (3 điểm)</div>`;
        
        p1.forEach((q, index) => {
            const qIndex = currentQuestions.indexOf(q); 
            container.innerHTML += `
                <div class="question-card" id="q-${qIndex}">
                    <div class="question-content-wrapper">
                        <strong class="q-label">Câu ${index + 1}:</strong> 
                        <span class="q-text">${q.Content_Root || ''}</span>
                    </div>
                    ${q.Image ? `<div class="q-image"><img src="${q.Image}"></div>` : ''}
                    
                    <div class="options-grid">
                        ${renderOption(qIndex, 'A', q.Option_A)}
                        ${renderOption(qIndex, 'B', q.Option_B)}
                        ${renderOption(qIndex, 'C', q.Option_C)}
                        ${renderOption(qIndex, 'D', q.Option_D)}
                    </div>
                </div>`;
        });
    }

    // --- PHẦN 2: ĐÚNG SAI ---
    const p2Raw = currentQuestions.filter(q => q.Type === 'TRUE_FALSE');
    if (p2Raw.length > 0) {
        const groups = {};
        p2Raw.forEach(q => {
            const key = q.Content_Root || "unknown";
            if (!groups[key]) groups[key] = [];
            groups[key].push(q);
        });

        // Thẻ tiêu đề Phần 2
        container.innerHTML += `<div class="part-header">PHẦN 2: TRẮC NGHIỆM ĐÚNG SAI (4 điểm)</div>`;
        
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
                    <div class="question-content-wrapper">
                        <strong class="q-label">Câu ${groupCount++}:</strong>
                        <span class="q-text">${content}</span>
                    </div>
                    <div class="tf-container">${subRows}</div>
                </div>`;
        }
    }

    // --- PHẦN 3: TRẢ LỜI NGẮN ---
    const p3 = currentQuestions.filter(q => q.Type === 'FILL_IN' || q.Type === 'SHORT_ANSWER');
    if (p3.length > 0) {
        // Thẻ tiêu đề Phần 3
        container.innerHTML += `<div class="part-header">PHẦN 3: TRẮC NGHIỆM TRẢ LỜI NGẮN (3 điểm)</div>`;
        
        p3.forEach((q, index) => {
            const qIndex = currentQuestions.indexOf(q);
            container.innerHTML += `
                <div class="question-card" id="q-${qIndex}">
                    <div class="question-content-wrapper">
                        <strong class="q-label">Câu ${index + 1}:</strong>
                        <span class="q-text">${q.Content_Root || ''}</span>
                    </div>
                    ${q.Image ? `<div class="q-image"><img src="${q.Image}"></div>` : ''}
                    
                    <div class="fill-input-container">
                        <label>Đáp án của bạn:</label>
                        <input type="text" class="fill-input" placeholder="Nhập kết quả..." 
                            onchange="saveAnswer(${qIndex}, this.value)">
                    </div>
                </div>`;
        });
    }
    
    // Render công thức Toán (KaTeX)
    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ]
        });
    }
}
/** ============== Bắt đầu hàm cũ function renderQuestions() ======================
 function renderQuestions() {
    const container = document.getElementById('exam-container');
    if (!container) return;
    container.innerHTML = '';

    // --- PHẦN 1: TRẮC NGHIỆM (MULTIPLE_CHOICE) ---
    const p1 = currentQuestions.filter(q => q.Type === 'MULTIPLE_CHOICE');
    if (p1.length > 0) {
        container.innerHTML += `<div class="part-title">PHẦN 1: TRẮC NGHIỆM KHÁCH QUAN (${p1.length} câu)</div>`;
        p1.forEach((q, index) => {
            const qIndex = currentQuestions.indexOf(q); 
            container.innerHTML += `
                <div class="question-card" id="q-${qIndex}">
                    <div class="question-header">
                        <span class="question-number">Câu ${index + 1}</span>
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
    
    // Render công thức Toán (KaTeX)
    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ]
        });
    }
}
============== Kết thúc hàm cũ function renderQuestions() ====================== */

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
    if (submitted || !sessionData) return;
    localStorage.setItem(`autosave_${sessionData.examId}`, JSON.stringify(studentAnswers));
}

function startTimer() {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;

    // Cập nhật ngay lập tức để không bị delay 1s
    updateTimerDisplay(timerEl);

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timerEl);
        
        if (timeLeft === 300) timerEl.style.color = 'red'; // Cảnh báo còn 5 phút

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert('Hết giờ làm bài! Hệ thống sẽ tự động nộp.');
            finishExam();
        }
    }, 1000);
}

function updateTimerDisplay(el) {
    if (timeLeft < 0) timeLeft = 0;
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    el.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
}

// =====================================================
// 3. NỘP BÀI VÀ TÍNH ĐIỂM
// =====================================================
window.finishExam = async function () {
    if (submitted) return;
    
    // Ngừng đồng hồ
    if (timerInterval) clearInterval(timerInterval);
    submitted = true;

    // Hiển thị loading
    const btn = document.querySelector('.btn-submit');
    if(btn) { btn.disabled = true; btn.innerText = 'Đang chấm điểm...'; }

    // Tính điểm
    const result = calculateScore();
    console.log("Kết quả thi:", result);

    try {
        // Gửi kết quả lên Google Sheet (nếu có API)
        if (typeof sendResultToSheet === 'function') {
            await sendResultToSheet({
                ...sessionData,
                score: result.finalScore,
                detail: JSON.stringify(result.detail)
            });
        }

        // Lưu kết quả vào Session để trang result.html hiển thị
        sessionStorage.setItem('examResult', JSON.stringify(result));

        // --- BẮT ĐẦU ĐOẠN LƯU LỊCH SỬ CHO THỐNG KÊ (STATISTICS.HTML) ---
        // Đây là đoạn quan trọng để trang Thống kê không bị trắng
        try {
            const historyItem = {
                testName: sessionData.title || ("Mã đề: " + sessionData.examId),
                studentName: sessionData.studentName || "Học sinh",
                score: (result.finalScore !== undefined) ? result.finalScore : result.score,
                timestamp: new Date().toISOString(),
                examId: sessionData.examId
            };

            let history = [];
            const rawHistory = localStorage.getItem('math_master_history');
            if (rawHistory) history = JSON.parse(rawHistory);

            history.push(historyItem);
            localStorage.setItem('math_master_history', JSON.stringify(history));
            console.log("✅ Đã lưu lịch sử thi thành công!");
        } catch (err) {
            console.error("❌ Lỗi lưu lịch sử:", err);
        }
        // --- KẾT THÚC ĐOẠN LƯU LỊCH SỬ ---

        // Chuyển sang trang kết quả
        window.location.href = 'result.html';

    } catch (e) {
        alert('❌ Lỗi nộp bài: ' + e.message);
        submitted = false;
        if(btn) { btn.disabled = false; btn.innerText = 'Nộp bài'; }
    }
};

// =====================================================
// 🔥 QUAN TRỌNG: KÍCH HOẠT KHI TRANG LOAD XONG 🔥
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Lấy dữ liệu từ sessionStorage (Do trang index.html lưu vào)
    const rawData = sessionStorage.getItem('currentExam');
    
    if (!rawData) {
        alert('Bạn chưa đăng nhập! Vui lòng quay lại trang chủ.');
        window.location.href = 'index.html';
        return;
    }

    try {
        const data = JSON.parse(rawData);
        
        // 2. Kiểm tra nếu có autosave cũ thì khôi phục (Tùy chọn)
        const savedAns = localStorage.getItem(`autosave_${data.examId}`);
        if (savedAns) {
            studentAnswers = JSON.parse(savedAns);
            // Lưu ý: Việc tích chọn lại UI (radio button) sẽ phức tạp hơn, 
            // ở mức cơ bản ta chỉ load vào biến để nộp bài không bị mất.
        }

        // 3. CHẠY ENGINE
        initExam(data);

    } catch (e) {
        console.error("Lỗi parse dữ liệu thi:", e);
        alert("Dữ liệu thi bị lỗi. Vui lòng đăng nhập lại.");
        window.location.href = 'index.html';
    }
});