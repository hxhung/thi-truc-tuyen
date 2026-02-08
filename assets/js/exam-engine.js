/**
 * EXAM ENGINE - PHIÊN BẢN HOÀN CHỈNH & ĐÃ SỬA LỖI
 * Quản lý hiển thị câu hỏi, đếm giờ, lưu đáp án, nộp bài
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let sessionData = null;
let timerInterval = null;
let examStartTime = null;
let timeLeft = 0; // Thời gian còn lại (giây)

// ===== 1. KHỞI TẠO KHI TRANG LOAD =====
document.addEventListener('DOMContentLoaded', () => {
    loadConfigAndStart();
});

async function loadConfigAndStart() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
        console.log("✅ Config loaded:", examConfig);
    } catch (error) {
        console.error("❌ Lỗi tải config:", error);
        alert('Lỗi tải cấu hình hệ thống!');
        return;
    }

    // Tải dữ liệu đề thi từ sessionStorage
    sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    
    if (!sessionData || !sessionData.questions) {
        alert('Không tìm thấy dữ liệu đề thi. Vui lòng quay lại trang chủ.');
        window.location.href = 'index.html';
        return;
    }

    // Khởi tạo dữ liệu
    currentQuestions = sessionData.questions;
    examStartTime = new Date();
    timeLeft = (sessionData.duration || 45) * 60; // Chuyển phút sang giây
	studentAnswers = JSON.parse(localStorage.getItem('draft_answers') || '{}')

    // Hiển thị giao diện
    renderExamHeader();
    renderAllQuestions();
    startTimer();
}

// ===== 2. HIỂN THỊ HEADER & TIMER =====
function renderExamHeader() {
    document.getElementById('exam-title').textContent = sessionData.title || 'BÀI THI TRỰC TUYẾN';
}

function startTimer() {
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            timeLeft = 0;
            updateTimerDisplay();
            clearInterval(timerInterval);
            submitExam(true);
            return;
        }

        timeLeft--;
        updateTimerDisplay();

        if (timeLeft === 300) {
            alert('⚠️ Còn 5 phút!');
        }
    }, 1000);
}


function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('timer').textContent = display;

    // Đổi màu khi còn dưới 5 phút
    if (timeLeft < 300) {
        document.getElementById('timer').style.color = '#dc3545';
        document.getElementById('timer').style.animation = 'blink 1s infinite';
    }
}

// ===== 3. RENDER CÂU HỎI =====
function renderAllQuestions() {
    const container = document.getElementById('exam-container');
    container.innerHTML = ''; // Xóa nội dung cũ

    // Phân loại câu hỏi theo type
    const part1 = currentQuestions.filter(q => q.type === 'MULTIPLE_CHOICE');
    const part2 = currentQuestions.filter(q => q.type === 'TRUE_FALSE');
    const part3 = currentQuestions.filter(q => q.type === 'FILL_IN');

    // Render từng phần
    if (part1.length > 0) {
        container.innerHTML += renderPart1(part1);
    }
    if (part2.length > 0) {
        container.innerHTML += renderPart2(part2);
    }
    if (part3.length > 0) {
        container.innerHTML += renderPart3(part3);
    }

    // Render KaTeX sau khi DOM đã được tạo
    if (window.renderMathInElement) {
        renderMathInElement(document.body, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ]
        });
    }
	restoreDraftAnswers(); // PATCH 5: khôi phục đáp án nháp
}

// ===== PHẦN I: TRẮC NGHIỆM ABCD =====
function renderPart1(questions) {
    let html = '<div class="section-header">PHẦN I: TRẮC NGHIỆM (3 điểm)</div>';
    
    questions.forEach((q, index) => {
        html += `
        <div class="question-card" data-id="${q.id}">
            <div class="question-text">
                <strong>Câu ${index + 1}:</strong> ${q.contentSub || q.contentRoot}
            </div>
            ${q.image ? `<img src="${q.image}" class="question-image" alt="Hình câu ${index+1}">` : ''}
            <div class="options-grid">
                ${renderOptions(q.id, q.options)}
            </div>
        </div>`;
    });
    
    return html;
}

function renderOptions(questionId, options) {
    let html = '';
    ['A', 'B', 'C', 'D'].forEach(key => {
        if (options[key]) {
            html += `
            <label class="option-item">
                <input type="radio" name="q${questionId}" value="${key}" 
                       onchange="saveAnswer(${questionId}, '${key}', 'MULTIPLE_CHOICE')">
                <span><strong>${key}.</strong> ${options[key]}</span>
            </label>`;
        }
    });
    return html;
}

// ===== PHẦN II: ĐÚNG/SAI =====
function renderPart2(questions) {
    let html = '<div class="section-header">PHẦN II: ĐÚNG/SAI (4 điểm)</div>';

    const groups = groupByContentRoot(questions);

    groups.forEach(group => {
        html += `<div class="question-card">`;

        if (group.root) {
            html += `<div class="root-title">${group.root}</div>`;
        }

        // FIX: giữ thứ tự a,b,c,d
        group.items.sort((a, b) => a.id - b.id);

        group.items.forEach((q, i) => {
            const label = String.fromCharCode(97 + i);
            html += `
            <div class="tf-row" data-id="${q.id}">
                <div class="tf-content">
                    <strong>${label})</strong> ${q.contentSub}
                </div>
                <div class="tf-options">
                    <label>
                        <input type="radio" name="q${q.id}" value="TRUE"
                               onchange="saveAnswer(${q.id}, 'TRUE', 'TRUE_FALSE')"> Đúng
                    </label>
                    <label>
                        <input type="radio" name="q${q.id}" value="FALSE"
                               onchange="saveAnswer(${q.id}, 'FALSE', 'TRUE_FALSE')"> Sai
                    </label>
                </div>
            </div>`;
        });

        html += `</div>`;
    });

    return html;
}

        
        
function groupByContentRoot(questions) {
    const grouped = {};
    questions.forEach(q => {
        const key = q.contentRoot || 'default';
        if (!grouped[key]) {
            grouped[key] = { root: q.contentRoot, items: [] };
        }
        grouped[key].items.push(q);
    });
    return Object.values(grouped);
}

// ===== PHẦN III: ĐIỀN SỐ =====
function renderPart3(questions) {
    let html = '<div class="section-header">PHẦN III: ĐIỀN KHUYẾT (3 điểm)</div>';

    questions.forEach((q, index) => {
        html += `
        <div class="question-card" data-id="${q.id}">
            <div class="question-text">
                <strong>Câu ${index + 1}:</strong> ${q.contentSub || q.contentRoot}
            </div>
            ${q.image ? `<img src="${q.image}" class="question-image">` : ''}
            <input type="text"
                   class="fill-input"
                   placeholder="Nhập đáp án"
                   oninput="saveAnswer(${q.id}, this.value.trim(), 'FILL_IN')">
        </div>`;
    });

    return html;
}


// ===== 4. LƯU ĐÁP ÁN =====
window.saveAnswer = function(questionId, answer) {
    studentAnswers[questionId] = answer;

    // Đánh dấu câu đã làm
    const card = document.querySelector(`[data-id="${questionId}"]`);
    if (card) card.classList.add('answered');

    // PATCH 5: lưu nháp realtime
    localStorage.setItem('draft_answers', JSON.stringify(studentAnswers));
};



// ===== 5. NỘP BÀI =====
window.submitExam = async function(force = false) {
    // Xác nhận
    if (!force) {
        const confirmed = confirm('Bạn có chắc chắn muốn nộp bài?');
        if (!confirmed) return;
    }

    // Dừng đồng hồ
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    // Hiển thị màn hình chờ
    showLoadingOverlay();

    try {
        // Lấy thông tin thí sinh
        const studentName = sessionData.studentName || localStorage.getItem('lastStudentName') || 'Học sinh';
        const studentClass = sessionData.studentClass || localStorage.getItem('lastStudentClass') || '';

        // Chuẩn bị dữ liệu
        const payload = {
            examId: sessionData.examId,
            studentName: studentName,
            studentClass: studentClass,
            answers: studentAnswers
        };

        console.log("📤 Đang gửi:", payload);

        // Gọi API
        const result = await submitExamAPI(payload);
        console.log("📥 Nhận về:", result);

        if (result.success) {
            // Lưu lịch sử
            saveToHistory({
                timestamp: new Date().toISOString(),
                testName: sessionData.title || sessionData.examId,
                examId: result.examId,
                studentName: studentName,
                score: parseFloat(result.score),
                correctAnswers: 0 // Backend không trả về, tạm để 0
            });

            // Lưu kết quả để hiển thị trang result.html
            const resultData = {
                success: true,
                examId: result.examId,
                studentName: studentName,
                studentClass: studentClass,
                score: result.score,
                details: result.details || { p1: 0, p2: 0, p3: 0 }
            };

            sessionStorage.setItem('examResult', JSON.stringify(resultData));
			// PATCH 5: dọn nháp
			localStorage.removeItem('draft_answers');

            // Dọn dẹp
            sessionStorage.removeItem('currentExam');

            // Chuyển trang
            window.location.href = 'result.html';
        } else {
            throw new Error(result.message || 'Lỗi không xác định');
        }

    } catch (error) {
        hideLoadingOverlay();
        alert('❌ Lỗi nộp bài: ' + error.message);
        console.error(error);
    }
};

// ===== 6. LOADING OVERLAY =====
function showLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-msg">Đang chấm điểm... Vui lòng đợi!</div>
    `;
    document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// ===== 7. LƯU LỊCH SỬ =====
function saveToHistory(record) {
    try {
        const oldData = JSON.parse(localStorage.getItem('exam_results') || '[]');
        oldData.push(record);
        localStorage.setItem('exam_results', JSON.stringify(oldData));
        console.log('✅ Đã lưu lịch sử:', record);
    } catch (e) {
        console.error('❌ Lỗi lưu lịch sử:', e);
    }
}

// ===== 8. XỬ LÝ KHI RỜI KHỎI TRANG =====
window.addEventListener('beforeunload', (e) => {
    if (timerInterval) {
        e.preventDefault();
        e.returnValue = 'Bạn chưa nộp bài. Rời khỏi trang sẽ mất dữ liệu!';
    }
});
