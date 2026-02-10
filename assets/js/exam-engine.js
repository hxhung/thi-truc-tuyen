/**
 * EXAM ENGINE - PHIÊN BẢN FIX LOADING & TIMER
 * Đã bổ sung EventListener để kích hoạt chạy
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


// 2. RENDER GIAO DIỆN (PHIÊN BẢN V4 - FIX TOÀN DIỆN)
// =====================================================
function renderQuestions() {
    const container = document.getElementById('exam-container');
    if (!container) return;

    // Cập nhật tiêu đề
    const titleEl = document.getElementById('exam-title');
    if (titleEl && sessionData) titleEl.innerText = `ĐỀ: ${sessionData.title || sessionData.examId}`;
    
    // --- KHU VỰC AN TOÀN DỮ LIỆU (QUAN TRỌNG) ---
    // Hàm này giúp tìm nội dung ở mọi biến có thể, tránh việc hiện trắng trơn
    const getText = (q) => {
        if (!q) return "";
        return q.Content || q.Question || q.DeBai || q.NoiDung || q.Content_Root || ""; 
    };
    const getImg = (q) => q.Image || q.Image_URL || q.HinhAnh || null;
    const getID = (q) => q.QuestionID || q.id || q.ExamID || Math.random().toString(36).substr(2, 9);

    // 1. Phân loại câu hỏi vào 3 nhóm
    const parts = { "MULTIPLE_CHOICE": [], "TRUE_FALSE": [], "SHORT_ANSWER": [] };
    const partTitles = {
        "MULTIPLE_CHOICE": "PHẦN 1: TRẮC NGHIỆM KHÁCH QUAN",
        "TRUE_FALSE": "PHẦN 2: TRẮC NGHIỆM ĐÚNG SAI",
        "SHORT_ANSWER": "PHẦN 3: TRẢ LỜI NGẮN"
    };

    // Duyệt qua dữ liệu gốc để chia nhóm
    currentQuestions.forEach(q => {
        let type = q.Type || "MULTIPLE_CHOICE"; 
        // Fix lỗi sai tên loại câu hỏi trong database
        if(type === 'FILL_IN' || type === 'TuLuan') type = 'SHORT_ANSWER';
        if(type === 'TN_DUNG_SAI') type = 'TRUE_FALSE';
        
        if (parts[type]) parts[type].push(q);
    });

    let html = '';

    // Helper tạo header: Câu X + Nội dung (Đảm bảo thẳng hàng)
    const createHeader = (idx, content, img) => `
        <div class="question-header">
            <div class="q-badge">Câu ${idx}</div>
            <div class="q-content">
                ${content}
                ${img ? `<div style="margin-top:10px"><img src="${img}" alt="Minh họa" style="max-width:100%; border-radius:8px; border:1px solid #ddd"></div>` : ''}
            </div>
        </div>
    `;

    // --- RENDER PHẦN 1: TRẮC NGHIỆM (A,B,C,D) ---
    if (parts["MULTIPLE_CHOICE"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["MULTIPLE_CHOICE"]}</div>`;
        parts["MULTIPLE_CHOICE"].forEach((q, i) => {
            const realIdx = i + 1;
            const qID = getID(q);
            const savedVal = studentAnswers[qID] || "";
            
            html += `<div class="question-item">
                ${createHeader(realIdx, getText(q), getImg(q))}
                <div class="options-grid">
                    ${['A','B','C','D'].map(opt => {
                        // Tìm nội dung đáp án ở nhiều biến khác nhau (Option_A, A, OptionA...)
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

    // --- RENDER PHẦN 2: ĐÚNG SAI (Logic Gom Nhóm - Đã Fix Lỗi Thẻ Đóng) ---
    if (parts["TRUE_FALSE"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["TRUE_FALSE"]}</div>`;
        
        let currentRoot = "###INIT###"; // Giá trị khởi tạo đặc biệt
        let globalIdx = parts["MULTIPLE_CHOICE"].length; 
        let subIdx = 0; 
        let isGroupOpen = false; 

        parts["TRUE_FALSE"].forEach((q) => {
            const rootText = q.Content_Root || q.Question_Root || "Đề bài chung";
            const qID = getID(q);
            
            // Nếu gặp đề bài gốc mới -> Đóng nhóm cũ -> Mở nhóm mới
            if (rootText !== currentRoot) {
                if (isGroupOpen) { 
                    html += `</div></div>`; // Đóng div nhóm trước
                    isGroupOpen = false;
                }
                
                currentRoot = rootText;
                globalIdx++;
                subIdx = 0;

                // Mở nhóm mới
                html += `<div class="question-item">
                            ${createHeader(globalIdx, `<b>${currentRoot}</b>`, null)}
                            <div class="tf-container" style="margin-top:15px; padding-left:5px;">`;
                isGroupOpen = true;
            }

            // Render từng dòng a, b, c, d
            const labelChar = String.fromCharCode(97 + (subIdx % 4)); // a, b, c, d
            subIdx++;
            const sVal = studentAnswers[qID] || "";
            const qText = getText(q); 

            html += `
            <div class="tf-row">
                <span style="flex:1; font-size: 1rem; padding-right:10px;"><b>${labelChar})</b> ${qText}</span>
                <div class="tf-options">
                    <label class="tf-btn"><input type="radio" name="q_${qID}" value="TRUE" ${sVal==='TRUE'?'checked':''} onchange="saveAnswer('${qID}', 'TRUE')"> ĐÚNG</label>
                    <label class="tf-btn"><input type="radio" name="q_${qID}" value="FALSE" ${sVal==='FALSE'?'checked':''} onchange="saveAnswer('${qID}', 'FALSE')"> SAI</label>
                </div>
            </div>`;
        });

        if (isGroupOpen) html += `</div></div>`; // Đóng nhóm cuối cùng
        html += `</div>`; // Đóng Card Phần 2
    }

    // --- RENDER PHẦN 3: TRẢ LỜI NGẮN ---
    if (parts["SHORT_ANSWER"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["SHORT_ANSWER"]}</div>`;
        
        // Tính số câu bắt đầu cho phần 3
        const p1Count = parts["MULTIPLE_CHOICE"].length;
        // Đếm số nhóm (số câu cha) của phần 2
        const p2Count = (new Set(parts["TRUE_FALSE"].map(x => x.Content_Root || x.Question_Root))).size; 
        
        let currentIdx = p1Count + p2Count;

        parts["SHORT_ANSWER"].forEach((q, i) => {
            currentIdx++;
            const qID = getID(q);
            const sVal = studentAnswers[qID] || "";
            
            html += `<div class="question-item">
                ${createHeader(currentIdx, getText(q), getImg(q))}
                <div class="fill-input-container">
                    <input type="text" class="fill-input" placeholder="Nhập đáp án..." value="${sVal}"
                        onchange="saveAnswer('${qID}', this.value)">
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
    
    // Render công thức toán
    if (window.renderMathInElement) {
        try { renderMathInElement(container, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] }); } catch(e){}
    }
}
// --- KẾT THÚC ĐOẠN CODE SỬA LỖI ---
// --- KẾT THÚC ĐOẠN CODE renderQuestions ---

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
// 4. NỘP BÀI
// =====================================================
window.finishExam = async function() {
    if (submitted) return;
    if (timeLeft > 0 && !confirm('Bạn có chắc chắn muốn nộp bài?')) return;

    submitted = true;
    if (timerInterval) clearInterval(timerInterval);
    
    const btn = document.querySelector('.btn-submit');
    if(btn) { btn.disabled = true; btn.innerText = 'Đang nộp...'; }

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
            alert('❌ Lỗi server: ' + (result.message || 'Không xác định'));
            submitted = false;
            if(btn) { btn.disabled = false; btn.innerText = 'Nộp bài'; }
        }
    } catch (e) {
        alert('❌ Lỗi kết nối: ' + e.message);
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
// --- LOGIC NỘP BÀI MỚI (CÓ MODAL) ---

// 1. Hàm được gọi khi bấm nút "NỘP BÀI" ở Footer
window.finishExam = function(force = false) {
    if (submitted) return;

    // Nếu bị cưỡng ép (hết giờ) -> Nộp ngay lập tức
    if (force) {
        submitFinal();
    } else {
        // Nếu chưa hết giờ -> Hiện Modal xác nhận
        // (Code HTML Modal đã thêm ở Bước 1 trong exam.html)
        const modal = document.getElementById('confirm-modal');
        if (modal) modal.classList.remove('hidden');
        else {
            // Fallback: Nếu quên thêm HTML Modal thì dùng confirm thường
            if(confirm("Bạn có chắc chắn muốn nộp bài không?")) submitFinal();
        }
    }
};

// 2. Hàm đóng Modal (khi bấm Hủy/Làm tiếp)
window.closeModal = function() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
};

// 3. Hàm Xử lý Nộp bài Thật (Logic cũ được bọc vào đây)
window.submitFinal = async function() {
    submitted = true;
    if (timerInterval) clearInterval(timerInterval); // Dừng đồng hồ

    // Ẩn modal xác nhận, Hiện modal đang chấm
    const confirmModal = document.getElementById('confirm-modal');
    const processingModal = document.getElementById('processing-modal');
    if (confirmModal) confirmModal.classList.add('hidden');
    if (processingModal) processingModal.classList.remove('hidden');

    // Vô hiệu hóa nút nộp (đề phòng)
    const btn = document.querySelector('.btn-submit');
    if(btn) { btn.disabled = true; btn.innerText = 'ĐANG CHẤM...'; }

    try {
        // --- ĐÂY LÀ ĐOẠN GỌI API TỪ FILE GỐC CỦA BẠN ---
        // Tôi giữ nguyên cấu trúc gọi submitExam như trong snippet bạn gửi
        const result = await submitExam({
            examId: sessionData.examId,
            studentName: sessionData.studentName,
            studentClass: sessionData.studentClass,
            answers: studentAnswers,
            usedTime: (parseInt(sessionData.duration) * 60) - timeLeft
        });

        if (result.success) {
            // Xóa autosave
            localStorage.removeItem(`autosave_${sessionData.examId}`);
            // Lưu kết quả để trang result hiển thị
            sessionStorage.setItem('examResult', JSON.stringify(result));
            window.location.href = 'result.html';
        } else {
            throw new Error(result.message || 'Lỗi server');
        }
    } catch (e) {
        alert('❌ Lỗi nộp bài: ' + e.message);
        // Nếu lỗi, cho phép nộp lại
        submitted = false;
        if(processingModal) processingModal.classList.add('hidden');
        if(btn) { btn.disabled = false; btn.innerText = 'NỘP BÀI'; }
    }
};

// =====================================================
// RENDER GIAO DIỆN (PHIÊN BẢN V5 - FIX NỘI DUNG & FORMAT)
// =====================================================
window.renderQuestions = function() {
    console.log("Đang chạy renderQuestions V5 (Fix lỗi hiển thị Part 2)"); 
    const container = document.getElementById('exam-container');
    if (!container) return;

    // Cập nhật tiêu đề
    const titleEl = document.getElementById('exam-title');
    if (titleEl && sessionData) titleEl.innerText = `ĐỀ: ${sessionData.title || sessionData.examId}`;
    
    // --- HÀM TRỢ GIÚP LẤY DỮ LIỆU ---
    // 1. Lấy nội dung cho câu hỏi thường (Part 1, 3)
    const getGeneralText = (q) => {
        return q.Content || q.Question || q.DeBai || q.NoiDung || q.Content_Root || ""; 
    };
    
    // 2. Lấy hình ảnh
    const getImg = (q) => q.Image || q.Image_URL || q.HinhAnh || null;
    
    // 3. Lấy ID an toàn
    const getID = (q) => q.QuestionID || q.id || q.ExamID || Math.random().toString(36).substr(2, 9);

    // Phân loại câu hỏi
    const parts = { "MULTIPLE_CHOICE": [], "TRUE_FALSE": [], "SHORT_ANSWER": [] };
    const partTitles = {
        "MULTIPLE_CHOICE": "PHẦN 1: TRẮC NGHIỆM KHÁCH QUAN",
        "TRUE_FALSE": "PHẦN 2: TRẮC NGHIỆM ĐÚNG SAI",
        "SHORT_ANSWER": "PHẦN 3: TRẢ LỜI NGẮN"
    };

    currentQuestions.forEach(q => {
        let type = q.Type || "MULTIPLE_CHOICE"; 
        if(type === 'FILL_IN' || type === 'TuLuan') type = 'SHORT_ANSWER';
        if(type === 'TN_DUNG_SAI') type = 'TRUE_FALSE';
        if (parts[type]) parts[type].push(q);
    });

    let html = '';

    // Template tạo Header câu hỏi (Đã bỏ in đậm theo yêu cầu)
    const createHeader = (idx, content, img) => `
        <div class="question-header">
            <div class="q-badge">Câu ${idx}</div>
            <div class="q-content">
                ${content} 
                ${img ? `<div style="margin-top:10px"><img src="${img}" alt="Minh họa" style="max-width:100%; border-radius:8px; border:1px solid #ddd"></div>` : ''}
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
                ${createHeader(realIdx, getGeneralText(q), getImg(q))}
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

    // --- RENDER PHẦN 2: ĐÚNG SAI (ĐÃ FIX LỖI HIỂN THỊ) ---
    if (parts["TRUE_FALSE"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["TRUE_FALSE"]}</div>`;
        
        let currentRoot = "###INIT###";
        let globalIdx = parts["MULTIPLE_CHOICE"].length; 
        let subIdx = 0; 
        let isGroupOpen = false; 

        parts["TRUE_FALSE"].forEach((q) => {
            const rootText = q.Content_Root || q.Question_Root || "Đề bài chung";
            const qID = getID(q);
            
            // Xử lý gom nhóm câu hỏi cha
            if (rootText !== currentRoot) {
                if (isGroupOpen) { html += `</div></div>`; isGroupOpen = false; }
                
                currentRoot = rootText;
                globalIdx++;
                subIdx = 0;

                // FIX: Đã bỏ thẻ <b> ở biến currentRoot để không in đậm đề bài
                html += `<div class="question-item">
                            ${createHeader(globalIdx, currentRoot, null)}
                            <div class="tf-container" style="margin-top:15px; padding-left:5px;">`;
                isGroupOpen = true;
            }

            // Xử lý nội dung ý nhỏ (a, b, c, d)
            // FIX: Chỉ lấy đúng trường nội dung con, KHÔNG fallback về Content_Root
            let subText = q.Content || q.NoiDung || q.DeBai || "";
            
            // Nếu vẫn rỗng, thử tìm ở Question nhưng phải khác Đề bài gốc
            if (!subText && q.Question && q.Question !== rootText) {
                subText = q.Question;
            }
            
            const labelChar = String.fromCharCode(97 + (subIdx % 4)); // a, b, c, d
            subIdx++;
            const sVal = studentAnswers[qID] || "";
            
            html += `
            <div class="tf-row">
                <span style="flex:1; font-size: 1rem; padding-right:10px;"><b>${labelChar})</b> ${subText}</span>
                <div class="tf-options">
                    <label class="tf-btn"><input type="radio" name="q_${qID}" value="TRUE" ${sVal==='TRUE'?'checked':''} onchange="saveAnswer('${qID}', 'TRUE')"> ĐÚNG</label>
                    <label class="tf-btn"><input type="radio" name="q_${qID}" value="FALSE" ${sVal==='FALSE'?'checked':''} onchange="saveAnswer('${qID}', 'FALSE')"> SAI</label>
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
                ${createHeader(currentIdx, getGeneralText(q), getImg(q))}
                <div class="fill-input-container">
                    <input type="text" class="fill-input" placeholder="Nhập đáp án..." value="${sVal}"
                        onchange="saveAnswer('${qID}', this.value)">
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
    
    // Render Toán học (nếu có)
    if (window.renderMathInElement) {
        try { renderMathInElement(container, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] }); } catch(e){}
    }
};
// =====================================================
// RENDER GIAO DIỆN V6 (BẢN FIX CHUẨN DỮ LIỆU)
// =====================================================
window.renderQuestions = function() {
    console.log("Đang chạy renderQuestions V6 (Fix dữ liệu Content_Root/Sub)");
    const container = document.getElementById('exam-container');
    if (!container) return;

    // Cập nhật tiêu đề
    const titleEl = document.getElementById('exam-title');
    if (titleEl && sessionData) titleEl.innerText = `ĐỀ: ${sessionData.title || sessionData.examId}`;
    
    // --- HÀM TRỢ GIÚP LẤY DỮ LIỆU (QUAN TRỌNG) ---
    // 1. Lấy nội dung cho câu hỏi đơn (Phần 1, 3): Ưu tiên Content_Root
    const getMainText = (q) => {
        return q.Content_Root || q.Content || q.Question || q.DeBai || q.NoiDung || ""; 
    };

    // 2. Lấy nội dung cho ý nhỏ (Phần 2): Ưu tiên Content_Sub
    const getSubText = (q) => {
        return q.Content_Sub || q.Content || q.Question || ""; 
    };
    
    const getImg = (q) => q.Image || q.Image_URL || q.HinhAnh || null;
    const getID = (q) => q.QuestionID || q.id || q.ExamID || Math.random().toString(36).substr(2, 9);

    // Phân loại câu hỏi
    const parts = { "MULTIPLE_CHOICE": [], "TRUE_FALSE": [], "SHORT_ANSWER": [] };
    const partTitles = {
        "MULTIPLE_CHOICE": "PHẦN 1: TRẮC NGHIỆM KHÁCH QUAN",
        "TRUE_FALSE": "PHẦN 2: TRẮC NGHIỆM ĐÚNG SAI",
        "SHORT_ANSWER": "PHẦN 3: TRẢ LỜI NGẮN"
    };

    currentQuestions.forEach(q => {
        let type = q.Type || "MULTIPLE_CHOICE"; 
        if(type === 'FILL_IN' || type === 'TuLuan') type = 'SHORT_ANSWER';
        if(type === 'TN_DUNG_SAI') type = 'TRUE_FALSE';
        if (parts[type]) parts[type].push(q);
    });

    let html = '';

    // Template Header (Không in đậm theo yêu cầu)
    const createHeader = (idx, content, img) => `
        <div class="question-header">
            <div class="q-badge">Câu ${idx}</div>
            <div class="q-content">
                ${content}
                ${img ? `<div style="margin-top:10px"><img src="${img}" alt="Minh họa" style="max-width:100%; border-radius:8px; border:1px solid #ddd"></div>` : ''}
            </div>
        </div>
    `;

    // --- RENDER PHẦN 1 ---
    if (parts["MULTIPLE_CHOICE"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["MULTIPLE_CHOICE"]}</div>`;
        parts["MULTIPLE_CHOICE"].forEach((q, i) => {
            const realIdx = i + 1;
            const qID = getID(q);
            const savedVal = studentAnswers[qID] || "";
            
            // Dùng getMainText (Lấy Content_Root)
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

    // --- RENDER PHẦN 2 ---
    if (parts["TRUE_FALSE"].length > 0) {
        html += `<div class="exam-part-card"><div class="part-title">${partTitles["TRUE_FALSE"]}</div>`;
        
        let currentRoot = "###INIT###";
        let globalIdx = parts["MULTIPLE_CHOICE"].length; 
        let subIdx = 0; 
        let isGroupOpen = false; 

        parts["TRUE_FALSE"].forEach((q) => {
            // Header chung lấy từ Content_Root
            const rootText = q.Content_Root || q.Question_Root || "Đề bài chung";
            const qID = getID(q);
            
            if (rootText !== currentRoot) {
                if (isGroupOpen) { html += `</div></div>`; isGroupOpen = false; }
                
                currentRoot = rootText;
                globalIdx++;
                subIdx = 0;

                html += `<div class="question-item">
                            ${createHeader(globalIdx, currentRoot, null)}
                            <div class="tf-container" style="margin-top:15px; padding-left:5px;">`;
                isGroupOpen = true;
            }

            // Ý nhỏ lấy từ Content_Sub
            let subText = getSubText(q);
            
            const labelChar = String.fromCharCode(97 + (subIdx % 4)); 
            subIdx++;
            const sVal = studentAnswers[qID] || "";
            
            html += `
            <div class="tf-row">
                <span style="flex:1; font-size: 1rem; padding-right:10px;"><b>${labelChar})</b> ${subText}</span>
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
        
        const p1Count = parts["MULTIPLE_CHOICE"].length;
        const p2Count = (new Set(parts["TRUE_FALSE"].map(x => x.Content_Root || x.Question_Root))).size; 
        let currentIdx = p1Count + p2Count;

        parts["SHORT_ANSWER"].forEach((q) => {
            currentIdx++;
            const qID = getID(q);
            const sVal = studentAnswers[qID] || "";
            
            // Dùng getMainText (Lấy Content_Root)
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
    
    if (window.renderMathInElement) {
        try { renderMathInElement(container, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] }); } catch(e){}
    }
};