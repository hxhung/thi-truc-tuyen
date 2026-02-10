/**
 * =====================================================
 * EXAM ENGINE - PHIÊN BẢN FIXED & CLEAN
 * Version: 4.0 - Đã sửa tất cả lỗi
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

    // Lọc câu hỏi theo mã đề (case-insensitive)
    let filteredQuestions = allQuestions.filter(q => {
        const qId = q.ExamID || q.examId || q.MaDe || ""; 
        return String(qId).trim().toLowerCase() === String(sessionData.examId).trim().toLowerCase();
    });

    // Xử lý câu hỏi & gán ID
    currentQuestions = filteredQuestions.map((q, index) => {
        // Fix lỗi CSV True/False bị khuyết Content_Root
        if (q.Type === "TN_DUNG_SAI" || q.Type === "TRUE_FALSE") {
            const root = q.Content_Root || q.Question_Root;
            if (root) {
                lastContentRoot = root;
            } else {
                q.Content_Root = lastContentRoot;
            }
        }

        // QUAN TRỌNG: Gán QuestionID theo index để khớp với Server
        q.QuestionID = String(index); 
        
        // Chuẩn hóa loại câu hỏi
        if (q.Type === 'FILL_IN' || q.Type === 'TuLuan') q.Type = 'SHORT_ANSWER';
        if (q.Type === 'TN_DUNG_SAI') q.Type = 'TRUE_FALSE';
        
        return q;
    });

    console.log("✅ Đã load", currentQuestions.length, "câu hỏi");

    // --- XỬ LÝ THỜI GIAN ---
    let durationMin = parseInt(data.duration) || parseInt(data.Duration) || parseInt(data.Duration_Min);
    
    if (!durationMin || isNaN(durationMin) || durationMin <= 0) {
        console.warn("⚠️ Không tìm thấy thời gian, mặc định 60 phút");
        durationMin = 60;
    }
    
    // Render giao diện
    renderQuestions();
    
    // Khởi động đồng hồ
    startTimer(durationMin);
};

// =====================================================
// 2. RENDER GIAO DIỆN CÂU HỎI
// =====================================================
function renderQuestions() {
    console.log("🎨 Render giao diện...");
    
    const container = document.getElementById('exam-container');
    if (!container) {
        console.error("❌ Không tìm thấy #exam-container");
        return;
    }

    // Cập nhật tiêu đề
    const titleEl = document.getElementById('exam-title');
    if (titleEl && sessionData) {
        titleEl.innerText = `ĐỀ: ${sessionData.title || sessionData.examId}`;
    }
    
    // --- HÀM TRỢ GIÚP ---
    const getMainText = (q) => q.Content_Root || q.Content || q.Question || q.DeBai || q.NoiDung || "";
    const getSubText = (q) => q.Content_Sub || q.Content || q.Question || "";
    const getImg = (q) => q.Image || q.Image_URL || q.HinhAnh || null;
    const getID = (q) => q.QuestionID || q.id || String(Math.random()).substr(2, 9);

    // Phân loại câu hỏi
    const parts = {
        "MULTIPLE_CHOICE": [],
        "TRUE_FALSE": [],
        "SHORT_ANSWER": []
    };
    
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

    // Template Header
    const createHeader = (idx, content, img) => `
        <div class="question-header">
            <div class="q-badge">Câu ${idx}</div>
            <div class="q-content">
                ${content}
                ${img ? `<div style="margin-top:10px"><img src="${img}" alt="Minh họa" class="question-image"></div>` : ''}
            </div>
        </div>
    `;

    // --- RENDER PHẦN 1: TRẮC NGHIỆM ---
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
                        const optVal = q['Option_' + opt] || q[opt] || q['Option' + opt] || ''; 
                        const checked = savedVal === opt ? 'checked' : '';
                        return `
                        <label class="option-item">
                            <input type="radio" name="q_${qID}" value="${opt}" ${checked} 
                                onchange="saveAnswer('${qID}', '${opt}')">
                            <span><b>${opt}.</b> ${optVal}</span>
                        </label>`;
                    }).join('')}
                </div>
            </div>`;
        });
        
        html += `</div>`;
    }

    // --- RENDER PHẦN 2: ĐÚNG/SAI ---
    if (parts["TRUE_FALSE"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["TRUE_FALSE"]}</div>`;
        
        let currentRoot = "###INIT###";
        let globalIdx = parts["MULTIPLE_CHOICE"].length;
        let subIdx = 0;
        let isGroupOpen = false;

        parts["TRUE_FALSE"].forEach((q) => {
            const rootText = q.Content_Root || q.Question_Root || "Đề bài chung";
            const qID = getID(q);
            
            // Xử lý gom nhóm
            if (rootText !== currentRoot) {
                if (isGroupOpen) {
                    html += `</div></div>`;
                    isGroupOpen = false;
                }
                
                currentRoot = rootText;
                globalIdx++;
                subIdx = 0;

                html += `<div class="question-item">
                    ${createHeader(globalIdx, currentRoot, null)}
                    <div class="tf-container" style="margin-top:15px; padding-left:5px;">`;
                isGroupOpen = true;
            }

            // Render ý nhỏ (a, b, c, d)
            const subText = getSubText(q);
            const labelChar = String.fromCharCode(97 + (subIdx % 4));
            subIdx++;
            const sVal = studentAnswers[qID] || "";
            
            html += `
            <div class="tf-row">
                <span style="flex:1; font-size: 1rem; padding-right:10px;">
                    <b>${labelChar})</b> ${subText}
                </span>
                <div class="tf-options">
                    <label class="tf-btn">
                        <input type="radio" name="q_${qID}" value="TRUE" ${sVal==='TRUE'?'checked':''} 
                            onchange="saveAnswer('${qID}', 'TRUE')"> ĐÚNG
                    </label>
                    <label class="tf-btn">
                        <input type="radio" name="q_${qID}" value="FALSE" ${sVal==='FALSE'?'checked':''} 
                            onchange="saveAnswer('${qID}', 'FALSE')"> SAI
                    </label>
                </div>
            </div>`;
        });

        if (isGroupOpen) html += `</div></div>`;
        html += `</div>`;
    }

    // --- RENDER PHẦN 3: TRẢ LỜI NGẮN ---
    if (parts["SHORT_ANSWER"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["SHORT_ANSWER"]}</div>`;
        
        const p1Count = parts["MULTIPLE_CHOICE"].length;
        const p2Count = (new Set(parts["TRUE_FALSE"].map(x => x.Content_Root || x.Question_Root))).size;
        let currentIdx = p1Count + p2Count;

        parts["SHORT_ANSWER"].forEach((q) => {
            currentIdx++;
            const qID = getID(q);
            const sVal = studentAnswers[qID] || "";
            
            html += `<div class="question-item">
                ${createHeader(currentIdx, getMainText(q), getImg(q))}
                <div class="fill-input-container">
                    <input type="text" class="fill-input" placeholder="Nhập đáp án..." value="${sVal}"
                        onchange="saveAnswer('${qID}', this.value)">
                </div>
            </div>`;
        });
        
        html += `</div>`;
    }

    container.innerHTML = html;
    
    // Render công thức toán (nếu có KaTeX)
    if (window.renderMathInElement) {
        try {
            renderMathInElement(container, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "$", right: "$", display: false}
                ]
            });
        } catch(e) {
            console.warn("⚠️ Lỗi render KaTeX:", e);
        }
    }
    
    console.log("✅ Render hoàn tất");
}

// =====================================================
// 3. XỬ LÝ ĐỒNG HỒ ĐẾM NGƯỢC
// =====================================================
function startTimer(minutes) {
    console.log("⏰ Khởi động đồng hồ:", minutes, "phút");
    
    // Xóa interval cũ nếu có
    if (timerInterval) clearInterval(timerInterval);

    // Tính thời gian còn lại
    if (sessionData && sessionData.startToken) {
        const now = Date.now();
        const startTime = parseInt(sessionData.startToken);
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        timeLeft = (minutes * 60) - elapsedSeconds;

        if (timeLeft <= 0) {
            console.warn("⚠️ Token cũ, reset lại thời gian");
            timeLeft = minutes * 60;
            sessionData.startToken = Date.now();
            sessionStorage.setItem('currentExam', JSON.stringify(sessionData));
        }
    } else {
        timeLeft = minutes * 60;
    }

    // Cập nhật hiển thị ngay
    updateTimerDisplay();

    // Đếm ngược mỗi giây
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert('⏰ HẾT GIỜ! Hệ thống sẽ tự động nộp bài.');
            finishExam(true); // Nộp bắt buộc
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;

    if (timeLeft < 0) timeLeft = 0;
    
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    
    timerEl.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
    
    // Đổi màu đỏ khi còn < 5 phút
    if (timeLeft < 300) {
        timerEl.style.color = 'red';
    }
}

// =====================================================
// 4. LƯU ĐÁP ÁN & AUTO SAVE
// =====================================================
window.saveAnswer = function(qIndex, value) {
    studentAnswers[qIndex] = value;
    autoSave();
};

function autoSave() {
    if (submitted || !sessionData) return;
    try {
        localStorage.setItem(`autosave_${sessionData.examId}`, JSON.stringify(studentAnswers));
    } catch(e) {
        console.warn("⚠️ Không thể autosave:", e);
    }
}

// =====================================================
// 5. NỘP BÀI
// =====================================================
window.finishExam = function(forced = false) {
    if (submitted) return;

    // Nếu bị ép (hết giờ) → Nộp ngay
    if (forced) {
        submitFinal();
        return;
    }

    // Nếu tự nguyện → Hiện modal xác nhận
    const totalQ = currentQuestions.length;
    const answeredQ = Object.keys(studentAnswers).length;

    if (confirm(`Bạn đã làm ${answeredQ}/${totalQ} câu.\n\nBạn có chắc chắn muốn nộp bài?`)) {
        submitFinal();
    }
};

window.submitFinal = async function() {
    submitted = true;
    
    // Dừng đồng hồ
    if (timerInterval) clearInterval(timerInterval);
    
    // Cập nhật nút
    const btn = document.querySelector('.btn-submit');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ ĐANG CHẤM BÀI...';
    }

    try {
        console.log("📤 Đang gửi bài lên Server...");

        // Kiểm tra hàm submitExam từ api-connector.js
        if (typeof submitExam !== 'function') {
            throw new Error("Lỗi: Không tìm thấy hàm submitExam (api-connector.js)");
        }

        // Gửi dữ liệu
        const result = await submitExam({
            examId: sessionData.examId,
            studentName: sessionData.studentName,
            studentClass: sessionData.studentClass,
            answers: studentAnswers,
            usedTime: (parseInt(sessionData.duration) * 60) - timeLeft
        });

        if (result.success) {
            console.log("✅ Nộp bài thành công!");
            
            // Xóa autosave
            localStorage.removeItem(`autosave_${sessionData.examId}`);
            
            // Lưu kết quả vào session
            sessionStorage.setItem('examResult', JSON.stringify(result));
            
            // Chuyển trang
            window.location.href = 'result.html';
        } else {
            throw new Error(result.message || 'Server trả về lỗi');
        }

    } catch (e) {
        console.error("❌ Lỗi nộp bài:", e);
        alert('❌ CÓ LỖI XẢY RA:\n' + e.message + '\n\nVui lòng thử lại!');
        
        // Cho phép nộp lại
        submitted = false;
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'NỘP BÀI LẠI';
        }
    }
};

// =====================================================
// 6. KHỞI ĐỘNG KHI TRANG LOAD XONG
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("📄 Trang exam.html đã load xong");
    
    // Lấy dữ liệu từ sessionStorage
    const rawData = sessionStorage.getItem('currentExam');
    
    if (!rawData) {
        alert('❌ Bạn chưa đăng nhập! Vui lòng quay lại trang chủ.');
        window.location.href = 'index.html';
        return;
    }

    try {
        const data = JSON.parse(rawData);
        console.log("📦 Dữ liệu session:", data);
        
        // Khôi phục autosave (nếu có)
        const savedAns = localStorage.getItem(`autosave_${data.examId}`);
        if (savedAns) {
            try {
                studentAnswers = JSON.parse(savedAns);
                console.log("♻️ Đã khôi phục", Object.keys(studentAnswers).length, "đáp án cũ");
            } catch(e) {
                console.warn("⚠️ Lỗi khôi phục autosave:", e);
            }
        }

        // KHỞI ĐỘNG ENGINE
        initExam(data);

    } catch (e) {
        console.error("❌ Lỗi parse dữ liệu:", e);
        alert("Dữ liệu thi bị lỗi. Vui lòng đăng nhập lại.");
        window.location.href = 'index.html';
    }
});

console.log("✅ exam-engine.js đã load thành công");