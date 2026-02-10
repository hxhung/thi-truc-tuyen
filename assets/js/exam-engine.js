/**
 * =====================================================
 * EXAM ENGINE - PHIÊN BẢN FINAL (ĐÃ FIX LỖI CÚ PHÁP)
 * =====================================================
 */

// =====================================================
// BIẾN TOÀN CỤC
// =====================================================
let currentQuestions = [];
let studentAnswers = {};
let sessionData = null;
let timerInterval = null;
let timeLeft = 0;
let submitted = false;

// =====================================================
// 1. KHỞI TẠO BÀI THI (INIT EXAM)
// =====================================================
window.initExam = function(data) {
    console.log("🚀 Khởi tạo bài thi:", data);
    
    if (!data || !data.questions) {
        alert("❌ Lỗi: Không có dữ liệu đề thi!");
        window.location.href = 'index.html';
        return;
    }
    
    sessionData = data;
    
    // --- XỬ LÝ CÂU HỎI ---
    const allQuestions = data.questions || [];
    let lastContentRoot = "";

    // Lọc câu hỏi theo mã đề
    let filteredQuestions = allQuestions.filter(q => {
        const qId = q.ExamID || q.examId || q.MaDe || ""; 
        return String(qId).trim().toLowerCase() === String(sessionData.examId).trim().toLowerCase();
    });

    // Xử lý câu hỏi & gán ID
    currentQuestions = filteredQuestions.map((q, index) => {
        if (q.Type === "TN_DUNG_SAI" || q.Type === "TRUE_FALSE") {
            const root = q.Content_Root || q.Question_Root;
            if (root) {
                lastContentRoot = root;
            } else {
                q.Content_Root = lastContentRoot;
            }
        }
        q.QuestionID = String(index); 
        if (q.Type === 'FILL_IN' || q.Type === 'TuLuan') q.Type = 'SHORT_ANSWER';
        if (q.Type === 'TN_DUNG_SAI') q.Type = 'TRUE_FALSE';
        return q;
    });

    // --- XỬ LÝ THỜI GIAN ---
    let durationMin = parseInt(data.duration) || parseInt(data.Duration) || parseInt(data.Duration_Min);
    if (!durationMin || isNaN(durationMin) || durationMin <= 0) {
        durationMin = 60;
    }
    
    renderQuestions();
    startTimer(durationMin);
};

// =====================================================
// 2. RENDER GIAO DIỆN CÂU HỎI
// =====================================================
function renderQuestions() {
    const container = document.getElementById('exam-container');
    if (!container) return;

    // Cập nhật tiêu đề
    const titleEl = document.getElementById('exam-title');
    if (titleEl && sessionData) {
        titleEl.innerText = `ĐỀ: ${sessionData.title || sessionData.examId}`;
    }
    
    // Helper functions
    const getMainText = (q) => q.Content_Root || q.Content || q.Question || q.DeBai || q.NoiDung || "";
    const getSubText = (q) => q.Content_Sub || q.Content || q.Question || "";
    const getImg = (q) => q.Image || q.Image_URL || q.HinhAnh || null;
    const getID = (q) => q.QuestionID;

    // Phân loại
    const parts = { "MULTIPLE_CHOICE": [], "TRUE_FALSE": [], "SHORT_ANSWER": [] };
    const partTitles = {
        "MULTIPLE_CHOICE": "PHẦN 1: TRẮC NGHIỆM KHÁCH QUAN",
        "TRUE_FALSE": "PHẦN 2: TRẮC NGHIỆM ĐÚNG SAI",
        "SHORT_ANSWER": "PHẦN 3: TRẢ LỜI NGẮN"
    };

    currentQuestions.forEach(q => {
        let type = q.Type || "MULTIPLE_CHOICE";
        if (type === 'FILL_IN' || type === 'TuLuan') type = 'SHORT_ANSWER';
        if (type === 'TN_DUNG_SAI') type = 'TRUE_FALSE';
        if (parts[type]) parts[type].push(q);
    });

    let html = '';
    const createHeader = (idx, content, img) => `
        <div class="question-header">
            <div class="q-badge">Câu ${idx}</div>
            <div class="q-content">
                ${content}
                ${img ? `<div style="margin-top:10px"><img src="${img}" alt="Minh họa" class="question-image"></div>` : ''}
            </div>
        </div>`;

    // --- RENDER PHẦN 1 ---
    if (parts["MULTIPLE_CHOICE"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["MULTIPLE_CHOICE"]}</div>`;
        parts["MULTIPLE_CHOICE"].forEach((q, i) => {
            const realIdx = i + 1;
            const qID = getID(q);
            const savedVal = studentAnswers[qID] || "";
            html += `<div class="question-item">
                ${createHeader(realIdx, getMainText(q), getImg(q))}
                <div class="options-grid">
                    ${['A','B','C','D'].map(opt => {
                        const optVal = q['Option_' + opt] || q[opt] || ''; 
                        const checked = savedVal === opt ? 'checked' : '';
                        return `<label class="option-item"><input type="radio" name="q_${qID}" value="${opt}" ${checked} onchange="saveAnswer('${qID}', '${opt}')"><span><b>${opt}.</b> ${optVal}</span></label>`;
                    }).join('')}
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    // --- RENDER PHẦN 2 ---
    if (parts["TRUE_FALSE"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["TRUE_FALSE"]}</div>`;
        let currentRoot = "###INIT###";
        let globalIdx = parts["MULTIPLE_CHOICE"].length;
        let subIdx = 0;
        let isGroupOpen = false;

        parts["TRUE_FALSE"].forEach((q) => {
            const rootText = q.Content_Root || q.Question_Root || "Đề bài chung";
            const qID = getID(q);
            
            if (rootText !== currentRoot) {
                if (isGroupOpen) { html += `</div></div>`; isGroupOpen = false; }
                currentRoot = rootText;
                globalIdx++;
                subIdx = 0;
                html += `<div class="question-item">${createHeader(globalIdx, currentRoot, null)}<div class="tf-container" style="margin-top:15px; padding-left:5px;">`;
                isGroupOpen = true;
            }

            const labelChar = String.fromCharCode(97 + (subIdx++ % 4));
            const sVal = studentAnswers[qID] || "";
            html += `<div class="tf-row">
                <span style="flex:1; font-size: 1rem; padding-right:10px;"><b>${labelChar})</b> ${getSubText(q)}</span>
                <div class="tf-options">
                    <label class="tf-btn"><input type="radio" name="q_${qID}" value="TRUE" ${sVal==='TRUE'?'checked':''} onchange="saveAnswer('${qID}', 'TRUE')"> ĐÚNG</label>
                    <label class="tf-btn"><input type="radio" name="q_${qID}" value="FALSE" ${sVal==='FALSE'?'checked':''} onchange="saveAnswer('${qID}', 'FALSE')"> SAI</label>
                </div>
            </div>`;
        });
        if (isGroupOpen) html += `</div></div>`;
        html += `</div>`;
    }

    // --- RENDER PHẦN 3 ---
    if (parts["SHORT_ANSWER"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["SHORT_ANSWER"]}</div>`;
        let currentIdx = parts["MULTIPLE_CHOICE"].length + (new Set(parts["TRUE_FALSE"].map(x => x.Content_Root || x.Question_Root))).size;
        parts["SHORT_ANSWER"].forEach((q) => {
            currentIdx++;
            const qID = getID(q);
            const sVal = studentAnswers[qID] || "";
            html += `<div class="question-item">
                ${createHeader(currentIdx, getMainText(q), getImg(q))}
                <div class="fill-input-container">
                    <input type="text" class="fill-input" placeholder="Nhập đáp án..." value="${sVal}" onchange="saveAnswer('${qID}', this.value)">
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
    
    // Render KaTeX
    if (window.renderMathInElement) {
        try { renderMathInElement(container, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] }); } catch(e) {}
    }
}

// =====================================================
// 3. XỬ LÝ ĐỒNG HỒ & HẾT GIỜ (Đã Fix Syntax)
// =====================================================
function startTimer(minutes) {
    if (timerInterval) clearInterval(timerInterval);

    // Tính thời gian
    if (sessionData && sessionData.startToken) {
        const now = Date.now();
        const startTime = parseInt(sessionData.startToken);
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        timeLeft = (minutes * 60) - elapsedSeconds;
    } else {
        timeLeft = minutes * 60;
    }

    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            
            // --- LOGIC HẾT GIỜ (3-2-1) ---
            
            // 1. Chặn thao tác
            const container = document.getElementById('exam-container');
            if(container) {
                container.style.pointerEvents = 'none';
                container.style.opacity = '0.5';
            }

            // 2. Hiện Modal đếm ngược
            const timeoutHTML = `
                <div id="timeout-modal" class="modal-overlay">
                    <div class="modal-box">
                        <h2 style="color: #e53e3e;">⏰ HẾT GIỜ!</h2>
                        <p>Hệ thống đang thu bài...</p>
                        <div id="cd-sync" class="countdown-number">3</div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', timeoutHTML);

            // 3. Đếm lùi 3s rồi nộp
            let count = 3;
            const cd = setInterval(() => {
                count--;
                const numEl = document.getElementById('cd-sync');
                if (numEl) numEl.innerText = count;

                if (count <= 0) {
                    clearInterval(cd);
                    submitFinal(); // Gọi nộp bài
                }
            }, 1000);
        }
    }, 1000); // <-- Đã thêm đóng ngoặc đúng
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;
    if (timeLeft < 0) timeLeft = 0;
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    timerEl.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
    if (timeLeft < 300) timerEl.style.color = 'red';
}

// =====================================================
// 4. LƯU & NỘP BÀI (Đã loại bỏ hàm trùng)
// =====================================================
window.saveAnswer = function(qIndex, value) {
    studentAnswers[qIndex] = value;
    if (!submitted && sessionData) {
        localStorage.setItem(`autosave_${sessionData.examId}`, JSON.stringify(studentAnswers));
    }
};

window.finishExam = function(forced = false) {
    if (submitted) return;
    
    if (forced === true) {
        submitFinal();
        return;
    }

    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        if(confirm("Nộp bài ngay?")) submitFinal();
    }
};

window.closeModal = function() {
    document.getElementById('confirm-modal').classList.add('hidden');
    document.body.style.overflow = 'auto';
};

// Hàm nộp bài chính (Chỉ giữ lại 1 hàm duy nhất này)
window.submitFinal = async function() {
    if (submitted) return;
    submitted = true;

    if (timerInterval) clearInterval(timerInterval);

    // Ẩn modal xác nhận
    if(document.getElementById('confirm-modal')) 
        document.getElementById('confirm-modal').classList.add('hidden');
    
    // Hiện modal đang chấm
    const procModal = document.getElementById('processing-modal');
    if (procModal) procModal.classList.remove('hidden');

    try {
        const result = await submitExam({
            examId: sessionData.examId,
            studentName: sessionData.studentName,
            studentClass: sessionData.studentClass,
            answers: studentAnswers,
            usedTime: (parseInt(sessionData.duration) * 60) - timeLeft
        });

        if (result.success) {
            localStorage.removeItem(`autosave_${sessionData.examId}`);
            sessionStorage.setItem('examResult', JSON.stringify(result));
            window.location.href = 'result.html';
        } else {
            throw new Error(result.message || 'Lỗi server');
        }
    } catch (e) {
        console.error("Lỗi nộp bài:", e);
        if (procModal) procModal.classList.add('hidden');
        alert('❌ Lỗi: ' + e.message + '\nẤn OK để thử nộp lại.');
        submitted = false; 
    }
};

// =====================================================
// 5. KHỞI ĐỘNG
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    const rawData = sessionStorage.getItem('currentExam');
    if (!rawData) {
        alert('❌ Chưa đăng nhập!');
        window.location.href = 'index.html';
        return;
    }

    try {
        const data = JSON.parse(rawData);
        const savedAns = localStorage.getItem(`autosave_${data.examId}`);
        if (savedAns) studentAnswers = JSON.parse(savedAns);
        
        initExam(data);
    } catch (e) {
        console.error(e);
        window.location.href = 'index.html';
    }
});