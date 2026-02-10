/**
 * EXAM ENGINE - PHIÊN BẢN ĐÃ FIX LỖI CHẤM BÀI & LOADING
 * - Fix lỗi: Chọn đáp án nhưng không ăn vào biến chấm điểm (studentAnswers)
 * - Fix lỗi: Bấm nộp bài bị treo, không qua trang kết quả
 * - Thêm: Lưu lịch sử cho trang thống kê
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
    console.log("Đang khởi tạo bài thi với dữ liệu:", data);
    if (!data) return;
    sessionData = data;
    
    const allQuestions = data.questions || [];
    
    // 1. Lọc câu hỏi theo mã đề
    let lastContentRoot = "";
    
    currentQuestions = allQuestions.filter(q => {
        const qId = q.ExamID || q.examId || q.MaDe || ""; 
        return String(qId).trim().toLowerCase() === String(sessionData.examId).trim().toLowerCase();
    }).map(q => {
        // Fix lỗi CSV Fill Down
        if (q.Type === "TRUE_FALSE") {
            if (q.Content_Root && q.Content_Root.trim() !== "") {
                lastContentRoot = q.Content_Root;
            } else {
                q.Content_Root = lastContentRoot;
            }
        }
        return q;
    });

    // 2. Thiết lập thời gian (Chống gian lận F5)
    const elapsed = Math.floor((Date.now() - sessionData.startToken) / 1000);
    timeLeft = (sessionData.duration * 60) - elapsed;

    if (timeLeft <= 0) {
        alert("Đã hết giờ làm bài!");
        finishExam();
        return;
    }

    startTimer();
    renderQuestions();
};

// =====================================================
// 2. RENDER GIAO DIỆN CÂU HỎI (ĐÃ FIX LỖI LƯU ĐÁP ÁN)
// =====================================================
function renderQuestions() {
    const container = document.getElementById('exam-container');
    container.innerHTML = '';
    
    // Gom nhóm câu hỏi
    const parts = {
        MULTIPLE_CHOICE: { title: "PHẦN 1: TRẮC NGHIỆM", questions: [] },
        TRUE_FALSE: { title: "PHẦN 2: ĐÚNG / SAI", questions: [] },
        SHORT_ANSWER: { title: "PHẦN 3: TRẢ LỜI NGẮN", questions: [] }
    };

    currentQuestions.forEach((q, index) => {
        if (parts[q.Type]) {
            parts[q.Type].questions.push({ ...q, globalIndex: index });
        }
    });

    // Render từng phần
    for (const [type, part] of Object.entries(parts)) {
        if (part.questions.length === 0) continue;

        const partHtml = document.createElement('div');
        partHtml.className = 'exam-part';
        partHtml.innerHTML = `<div class="part-header">${part.title}</div>`;

        part.questions.forEach(q => {
            const index = q.globalIndex;
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question-card';
            
            // Xử lý nội dung (MathJax)
            let contentDisplay = q.Content || "";
            if (contentDisplay.includes("Could not render")) {
                contentDisplay = `(Lỗi hiển thị ảnh) ${q.Content_Root || ""}`;
            }

            // --- A. TRẮC NGHIỆM ---
            if (type === 'MULTIPLE_CHOICE') {
                let optionsHtml = '<div class="options-grid">';
                ['A', 'B', 'C', 'D'].forEach(opt => {
                    const optionLabel = q[opt] || ""; 
                    if(optionLabel) {
                        // Kiểm tra xem câu này trước đó đã chọn chưa (Autosave)
                        const isChecked = studentAnswers[index] === opt; 
                        
                        // [FIX QUAN TRỌNG] Thêm onchange="handleAnswerChange(...)"
                        optionsHtml += `
                            <label class="option-item">
                                <input type="radio" 
                                       name="q-${index}" 
                                       value="${opt}" 
                                       ${isChecked ? 'checked' : ''}
                                       onchange="handleAnswerChange(${index}, '${opt}')">
                                <span class="opt-label">${opt}</span>
                                <span class="opt-text">${optionLabel}</span>
                            </label>
                        `;
                    }
                });
                optionsHtml += '</div>';

                questionDiv.innerHTML = `
                    <div class="question-content-wrapper">
                        <div class="q-number">Câu ${index + 1}:</div>
                        <div class="q-text">${contentDisplay}</div>
                    </div>
                    ${optionsHtml}
                `;
            } 
            
            // --- B. ĐÚNG / SAI ---
            else if (type === 'TRUE_FALSE') {
                // Gom nhóm các ý a,b,c,d (Logic này phụ thuộc data của bạn, giữ nguyên)
                // Ở đây tôi render đơn giản theo từng dòng câu hỏi
                
                const isTrue = studentAnswers[index] === 'True';
                const isFalse = studentAnswers[index] === 'False';

                // [FIX QUAN TRỌNG] Thêm onchange="handleAnswerChange(...)"
                questionDiv.innerHTML = `
                    <div class="tf-row">
                        <div class="tf-content">
                            <strong>Câu ${index + 1}:</strong> ${contentDisplay}
                        </div>
                        <div class="tf-options">
                            <label class="tf-btn">
                                <input type="radio" name="q-${index}" value="True" 
                                       ${isTrue ? 'checked' : ''}
                                       onchange="handleAnswerChange(${index}, 'True')">
                                <span>ĐÚNG</span>
                            </label>
                            <label class="tf-btn">
                                <input type="radio" name="q-${index}" value="False" 
                                       ${isFalse ? 'checked' : ''}
                                       onchange="handleAnswerChange(${index}, 'False')">
                                <span>SAI</span>
                            </label>
                        </div>
                    </div>
                `;
            }

            // --- C. ĐIỀN KHUYẾT (SHORT_ANSWER) ---
            else if (type === 'SHORT_ANSWER') {
                const val = studentAnswers[index] || "";
                // [FIX QUAN TRỌNG] Thêm oninput="handleAnswerChange(...)"
                questionDiv.innerHTML = `
                    <div class="question-content-wrapper">
                        <div class="q-number">Câu ${index + 1}:</div>
                        <div class="q-text">${contentDisplay}</div>
                    </div>
                    <div class="short-ans-wrapper">
                        <input type="text" class="short-input" 
                               placeholder="Nhập đáp án..." 
                               value="${val}"
                               oninput="handleAnswerChange(${index}, this.value)">
                    </div>
                `;
            }

            partHtml.appendChild(questionDiv);
        });

        container.appendChild(partHtml);
    }

    // Render lại công thức toán
    if (window.renderMathInElement) {
        renderMathInElement(document.body, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ]
        });
    }
}

// =====================================================
// 3. HÀM XỬ LÝ KHI CHỌN ĐÁP ÁN (MỚI THÊM)
// =====================================================
window.handleAnswerChange = function(questionIndex, value) {
    // Lưu vào biến studentAnswers để hàm calculateScore đọc được
    studentAnswers[questionIndex] = value;
    
    // (Tùy chọn) Lưu autosave vào localStorage để lỡ F5 không mất
    if (sessionData && sessionData.examId) {
        localStorage.setItem(`autosave_${sessionData.examId}`, JSON.stringify(studentAnswers));
    }
};

// =====================================================
// 4. LOGIC ĐỒNG HỒ
// =====================================================
function startTimer() {
    const timerEl = document.getElementById('timer');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        timerEl.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        
        // Đổi màu khi sắp hết giờ
        if (timeLeft < 300) timerEl.style.color = '#e74c3c'; // Đỏ (dưới 5p)
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert("Hết giờ! Hệ thống sẽ tự động nộp bài.");
            finishExam();
        }
    }, 1000);
}

// =====================================================
// 5. TÍNH ĐIỂM (GIỮ NGUYÊN LOGIC CŨ)
// =====================================================
window.calculateScore = function() {
    let count = 0;
    let details = [];
    
    currentQuestions.forEach((q, idx) => {
        // Lấy đáp án đúng từ nhiều nguồn có thể
        const correctRaw = q.CorrectAnswer || q.Answer || q.DapAn || q.DA || ""; 
        const correct = String(correctRaw).trim().toUpperCase();
        
        // Lấy đáp án học sinh (ĐÃ ĐƯỢC FIX LỖI NHỜ handleAnswerChange)
        const userVal = String(studentAnswers[idx] || "").trim().toUpperCase();
        
        const isCorrect = (userVal === correct && correct !== "");
        if (isCorrect) count++;

        details.push({
            question: idx + 1,
            user: userVal,
            correct: correct,
            status: isCorrect
        });
    });

    // Điểm số (Thang 10)
    const total = currentQuestions.length;
    const score = total === 0 ? 0 : ((count / total) * 10).toFixed(2);

    return {
        finalScore: score,
        score: score, // Duplicating for compatibility
        correctCount: count,
        totalQuestions: total,
        detail: details
    };
};

// =====================================================
// 6. NỘP BÀI (ĐÃ FIX LỖI TREO & THÊM LOADING)
// =====================================================
window.finishExam = async function () {
    if (submitted) return;
    
    // 1. HIỆN MÀN HÌNH LOADING
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    
    // Ngắt đồng hồ
    if (timerInterval) clearInterval(timerInterval);
    submitted = true;

    try {
        // 2. TÍNH ĐIỂM
        const result = calculateScore();
        console.log("Kết quả thi:", result);

        // 3. LƯU KẾT QUẢ VÀO SESSION (Để trang Result hiển thị)
        sessionStorage.setItem('examResult', JSON.stringify(result));

        // 4. LƯU LỊCH SỬ CHO TRANG THỐNG KÊ (STATISTICS)
        try {
            const historyItem = {
                testName: sessionData.title || ("Mã đề: " + sessionData.examId),
                studentName: sessionData.studentName || "Học sinh",
                score: result.finalScore,
                timestamp: new Date().toISOString(),
                examId: sessionData.examId
            };

            // Lấy lịch sử cũ
            let history = [];
            const rawHist = localStorage.getItem('math_master_history');
            if (rawHist) history = JSON.parse(rawHist);
            
            history.push(historyItem);
            localStorage.setItem('math_master_history', JSON.stringify(history));
        } catch (hErr) {
            console.warn("Lỗi lưu lịch sử:", hErr);
        }

        // 5. GỬI GOOGLE SHEET (Nếu có) - Dùng Try/Catch để không chết luồng
        if (typeof sendResultToSheet === 'function') {
            try {
                await sendResultToSheet({
                    ...sessionData,
                    score: result.finalScore,
                    detail: JSON.stringify(result.detail)
                });
            } catch (sheetErr) {
                console.error("Lỗi gửi Sheet:", sheetErr);
            }
        }

        // 6. CHUYỂN TRANG (Delay 1s cho đẹp)
        setTimeout(() => {
            window.location.href = 'result.html';
        }, 1000);

    } catch (e) {
        // NẾU CÓ LỖI LỚN
        if(overlay) overlay.style.display = 'none'; // Tắt loading để hiện lỗi
        alert('❌ Lỗi nộp bài: ' + e.message);
        console.error(e);
        
        // Vẫn cố chuyển trang để học sinh xem được điểm (dù có thể lỗi phần gửi sheet)
        window.location.href = 'result.html';
    }
};

// =====================================================
// 7. KHỞI CHẠY KHI LOAD TRANG
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    const rawData = sessionStorage.getItem('currentExam');
    
    if (!rawData) {
        alert('Bạn chưa đăng nhập! Vui lòng quay lại trang chủ.');
        window.location.href = 'index.html';
        return;
    }

    try {
        const data = JSON.parse(rawData);
        
        // Khôi phục bài làm nếu lỡ F5 (Autosave)
        const savedAns = localStorage.getItem(`autosave_${data.examId}`);
        if (savedAns) {
            studentAnswers = JSON.parse(savedAns);
        }

        document.getElementById('exam-title').innerText = `Đề: ${data.examId} - ${data.title || ''}`;
        
        // Bắt đầu thi
        initExam(data);

        // Gắn sự kiện cho nút nộp bài
        const btnSubmit = document.querySelector('.btn-submit');
        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => {
                if(confirm('Bạn có chắc chắn muốn nộp bài?')) {
                    finishExam();
                }
            });
        }

    } catch (e) {
        console.error(e);
        alert('Lỗi dữ liệu bài thi!');
    }
});