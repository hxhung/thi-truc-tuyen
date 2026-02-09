/**
 * EXAM ENGINE – FINAL VERSION
 * - Render: Logic chuẩn hóa dữ liệu của BẠN (Fix lỗi trắng trang).
 * - Core: Chống reload, Khôi phục UI, Timer an toàn, Khớp API.
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
    
    // Lưu tạm vào biến toàn cục (để dùng cho logic nộp bài)
    currentQuestions = data.questions || [];
    
    // --- LOGIC TIMER (GIỮ NGUYÊN) ---
    const now = Date.now();
    const startToken = parseInt(sessionData.startToken) || now;
    const elapsedSeconds = Math.floor((now - startToken) / 1000);
    const totalDurationSeconds = parseInt(sessionData.duration) * 60;
    
    timeLeft = totalDurationSeconds - elapsedSeconds;

    if (timeLeft <= 0) {
        timeLeft = 0;
        // Vẫn render để thấy đề rồi nộp
        renderExam(currentQuestions); 
        processSubmitExam(true);
        return;
    }

    // Khôi phục đáp án từ localStorage
    const raw = localStorage.getItem(`autosave_${sessionData.examId}`);
    if (raw) {
        try {
            const saved = JSON.parse(raw);
            if (saved.examId === sessionData.examId) {
                studentAnswers = saved.answers || {};
            }
        } catch (e) { console.error("Restore error:", e); }
    }
    
    // --- GỌI HÀM RENDER MỚI CỦA BẠN ---
    renderExam(currentQuestions);
    
    // Khôi phục giao diện (UI) sau khi render
    syncAnswersToUI();
    
    startTimer();
    
    if (autosaveInterval) clearInterval(autosaveInterval);
    autosaveInterval = setInterval(doAutosave, AUTOSAVE_INTERVAL);
    
    const titleEl = document.getElementById('exam-title');
    if (titleEl) titleEl.innerText = sessionData.title || "Bài thi trực tuyến";
};

function syncAnswersToUI() {
    // Logic này chạy SAU khi renderExam xong để tích lại các ô đã chọn
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
   2. HÀM RENDER (PHIÊN BẢN CỦA BẠN - ĐÃ CHUẨN HÓA)
   ===================================================== */
/* =====================================================
   HÀM RENDER "ĂN TẠP" (FIX LỖI KEY SENSITIVE)
   ===================================================== */
function renderExam(rawQuestions) {
    const container = document.getElementById('exam-container');
    if (!container) return;

    // 1. Kiểm tra dữ liệu thô
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:red;">⚠️ Không có dữ liệu câu hỏi (Data Empty)</div>';
        console.error("❌ DATA RỖNG:", rawQuestions);
        return;
    }

    // 2. CHUẨN HÓA DỮ LIỆU (QUAN TRỌNG NHẤT)
    // Tự động map các tên cột khác nhau về chuẩn chung
    const questions = rawQuestions.map((q, idx) => {
        // Tìm trường PART (Chấp nhận: part, Part, PART, Phan, phan...)
        let rawPart = q.part ?? q.Part ?? q.PART ?? q.Phan ?? q.phan ?? q.PHAN;
        
        // Tìm trường ID (Chấp nhận: id, ID, Id, question_id...)
        let rawId = q.id ?? q.ID ?? q.Id ?? q.question_id ?? `auto_id_${idx}`;

        // Tìm trường Nội dung (Chấp nhận: questionText, QuestionText, noi_dung, Content...)
        let rawText = q.questionText ?? q.QuestionText ?? q.question_text ?? q.noi_dung ?? q.Content ?? "";

        return {
            ...q, // Giữ lại các trường khác
            id: rawId,
            part: Number(rawPart), // Ép về số
            questionText: rawText  // Gán vào biến chuẩn để hàm render con đọc được
        };
    });

    // 3. Debug xem nó nhận được gì
    console.log("✅ Dữ liệu sau khi chuẩn hóa:", questions);

    // 4. Lọc câu hỏi theo phần
    const p1 = questions.filter(q => q.part === 1);
    const p2 = questions.filter(q => q.part === 2);
    const p3 = questions.filter(q => q.part === 3);

    console.log(`📊 P1: ${p1.length}, P2: ${p2.length}, P3: ${p3.length}`);

    // 5. Kiểm tra lại lần cuối
    if (p1.length === 0 && p2.length === 0 && p3.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <h3 style="color:#dc3545;">❌ Không đọc được phân loại câu hỏi</h3>
                <p>Hệ thống nhận được ${questions.length} dòng dữ liệu nhưng không tìm thấy cột <b>part/Phần</b> (1, 2, 3).</p>
                <div style="background:#eee; padding:10px; text-align:left; font-family:monospace; font-size:12px; overflow:auto;">
                    Dữ liệu dòng 1: ${JSON.stringify(questions[0])}
                </div>
            </div>`;
        return;
    }

    // 6. Vẽ giao diện
    container.innerHTML = '';
    if (p1.length) container.innerHTML += renderPart1(p1);
    if (p2.length) container.innerHTML += renderPart2(p2);
    if (p3.length) container.innerHTML += renderPart3(p3);

    // 7. Kích hoạt KaTeX
    if (window.renderMathInElement) {
        try {
            renderMathInElement(container, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ]
            });
        } catch (e) { console.warn(e); }
    }
}

/* --- CÁC HÀM RENDER CON (HELPER) --- */
function renderPart1(questions) {
    return `<div class="section-header">Phần I: Trắc nghiệm nhiều lựa chọn</div>` + 
    questions.map((q, i) => `
    <div class="question-card">
        <div class="question-text"><b>Câu ${i + 1}.</b> ${q.contentRoot || q.questionText || ""}</div>
        ${q.image ? `<img src="${q.image}" class="question-image">` : ''}
        <div class="options-grid">
            ${['A', 'B', 'C', 'D'].map(opt => `
                <label class="option-item">
                    <input type="radio" name="${q.id || q.rowIndex}" value="${opt}" onchange="saveAnswer('${q.id || q.rowIndex}', '${opt}')">
                    <span><b>${opt}.</b> ${q.options ? q.options[opt] : (q['option'+opt] || "")}</span>
                </label>`).join('')}
        </div>
    </div>`).join('');
}

function renderPart2(questions) {
    // Group câu hỏi True/False nếu cần, hoặc render lẻ
    // Ở đây render lẻ theo logic gốc đơn giản hóa
    return `<div class="section-header">Phần II: Trắc nghiệm Đúng/Sai</div>` + 
    questions.map((q, i) => `
    <div class="question-card">
        ${i === 0 || q.contentRoot !== questions[i-1].contentRoot ? `<div class="root-title">${q.contentRoot}</div>` : ''}
        <div class="tf-row">
            <div class="tf-content"><b>Ý ${i + 1}.</b> ${q.contentSub || q.questionText || ""}</div>
            <div class="tf-options">
                <label><input type="radio" name="${q.id || q.rowIndex}" value="T" onchange="saveAnswer('${q.id || q.rowIndex}', 'TRUE')"> Đ</label>
                <label><input type="radio" name="${q.id || q.rowIndex}" value="F" onchange="saveAnswer('${q.id || q.rowIndex}', 'FALSE')"> S</label>
            </div>
        </div>
    </div>`).join('');
}

function renderPart3(questions) {
    return `<div class="section-header">Phần III: Trả lời ngắn</div>` + 
    questions.map((q, i) => `
    <div class="question-card">
        <div class="question-text"><b>Câu ${i + 1}.</b> ${q.contentRoot || q.questionText || ""}</div>
        ${q.image ? `<img src="${q.image}" class="question-image">` : ''}
        <input type="text" class="fill-input" data-qid="${q.id || q.rowIndex}" 
               placeholder="Nhập đáp án của bạn..." 
               oninput="saveAnswer('${q.id || q.rowIndex}', this.value)">
    </div>`).join('');
}

/* =====================================================
   3. CÁC HÀM HỖ TRỢ (TIMER, SAVE, SUBMIT)
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
            processSubmitExam(true); // Nộp bài ngay khi hết giờ
            return;
        }
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        // Đổi màu đỏ khi còn < 1 phút
        if (timeLeft <= 60) {
            timerDisplay.style.color = '#dc3545';
            timerDisplay.style.borderColor = '#dc3545';
        }
    }, 1000);
}

window.saveAnswer = function (questionId, answer) {
    if (submitted) return;
    studentAnswers[questionId] = answer;
    doAutosave();
};

function doAutosave() {
    if (submitted || !sessionData) return;
    try {
        localStorage.setItem(`autosave_${sessionData.examId}`, JSON.stringify({
            examId: sessionData.examId,
            answers: studentAnswers,
            savedAt: Date.now()
        }));
    } catch (e) {}
}

// Hàm nộp bài an toàn (gọi API)
async function processSubmitExam(force = false) {
    if (submitted) return;
    if (!force && !confirm('Bạn chắc chắn muốn nộp bài?')) return;

    submitted = true;
    
    // Hiện loading overlay
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div><div class="loading-msg">Đang nộp bài...</div>';
    document.body.appendChild(overlay);

    clearInterval(timerInterval);
    clearInterval(autosaveInterval);

    try {
        // Gọi hàm từ api-connector.js (đảm bảo file kia tên hàm là submitExam hoặc submitExamAPI cho khớp)
        // Ở đây giả định file api-connector.js có hàm window.submitExamAPI hoặc window.submitExam
        const submitFn = window.submitExam || window.submitExamAPI;
        
        if (typeof submitFn !== 'function') {
            throw new Error("Không tìm thấy hàm nộp bài trong api-connector.js");
        }

        const result = await submitFn({
            examId: sessionData.examId,
            studentName: sessionData.studentName,
            studentClass: sessionData.studentClass,
            answers: studentAnswers,
            usedTime: (parseInt(sessionData.duration) * 60) - timeLeft
        });

        if (result && result.success) {
            localStorage.removeItem(`autosave_${sessionData.examId}`);
            // Lưu kết quả để trang result.html hiển thị
            sessionStorage.setItem('examResult', JSON.stringify(result));
            sessionStorage.removeItem('currentExam'); // Xóa phiên thi
            location.href = 'result.html';
        } else {
            throw new Error(result?.message || 'Lỗi server trả về');
        }
    } catch (e) {
        if(document.getElementById('loading-overlay')) document.body.removeChild(document.getElementById('loading-overlay'));
        alert('❌ Lỗi nộp bài: ' + e.message);
        submitted = false;
        startTimer(); // Chạy lại đồng hồ nếu lỗi
    }
}

// Gắn hàm nộp bài vào window để nút bấm HTML gọi được
window.submitExam = () => processSubmitExam(false);

/* =====================================================
   4. TỰ ĐỘNG CHẠY KHI DOM SẴN SÀNG
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Tự động đọc session và khởi động
    const rawData = sessionStorage.getItem('currentExam');
    if (rawData) {
        try {
            window.initExam(JSON.parse(rawData));
        } catch (e) {
            console.error("Session data corrupted");
        }
    }
});