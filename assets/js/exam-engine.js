/**
 * EXAM ENGINE - FINAL VERSION (v2.0)
 * Tính năng:
 * 1. Tự động chia 3 phần (Trắc nghiệm, Đúng/Sai, Điền khuyết).
 * 2. Xáo trộn thông minh: Giữ cấu trúc nhóm cho Phần II.
 * 3. Hỗ trợ hiển thị ảnh và công thức Toán (KaTeX).
 * 4. Giao diện nộp bài dạng Modal, hiệu ứng Loading và Kết quả Gradient.
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let sessionData = null;

// --- 1. KHỞI TẠO & LOAD DỮ LIỆU ---

document.addEventListener('DOMContentLoaded', () => {
    loadConfig().then(() => {
        loadExamData();
    });
});

// Load cấu hình từ config.json
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
    } catch (error) {
        console.error('Lỗi load config:', error);
        alert('Không thể tải tệp cấu hình.');
    }
}

// Hàm chính để tải dữ liệu đề thi
async function loadExamData() {
    // 1. Lấy thông tin từ Session (được lưu từ trang index.html)
    sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    
    if (!sessionData) { 
        alert('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html'; 
        return; 
    }

    // 2. Hiển thị Tiêu đề (Ưu tiên Title từ Config, nếu không có thì dùng ID)
    const titleElement = document.getElementById('exam-title');
    if (titleElement) {
        titleElement.innerText = sessionData.title || `Mã đề: ${sessionData.examId}`;
    }

    // 3. Gọi API lấy câu hỏi
    if (!examConfig || !examConfig.api_endpoint) return;

    try {
        const res = await getQuestionsFromAPI(sessionData.examId);
        
        if (res.success) {
            currentQuestions = res.data; // Dữ liệu thô từ Server
            
            // Xử lý và Xáo trộn câu hỏi
            const processedData = processAndShuffle(currentQuestions);
            
            // Render ra màn hình
            renderExam(processedData);
            
            // Render công thức Toán (KaTeX)
            renderMath();

            // Bắt đầu đếm ngược
            startTimer(sessionData.duration);
        } else {
            alert(res.message || "Không thể tải đề thi.");
        }
    } catch (e) {
        console.error(e);
        alert("Lỗi kết nối đến máy chủ.");
    }
}

// Wrapper gọi API
async function getQuestionsFromAPI(examId) {
    const url = `${examConfig.api_endpoint}?action=getQuestions&examId=${examId}`;
    const response = await fetch(url);
    return await response.json();
}

// --- 2. XỬ LÝ DỮ LIỆU & XÁO TRỘN (LOGIC CỐT LÕI) ---

function processAndShuffle(questions) {
    // Phân loại câu hỏi
    let part1 = questions.filter(q => q.type === 'MULTIPLE_CHOICE');
    let part2 = questions.filter(q => q.type === 'TRUE_FALSE');
    let part3 = questions.filter(q => q.type === 'FILL_IN');

    // Xáo trộn Phần I và III (Ngẫu nhiên hoàn toàn)
    shuffleArray(part1);
    shuffleArray(part3);

    // Xử lý Phần II (Đúng/Sai): Gom nhóm theo ContentRoot để không bị xé lẻ
    let groupedPart2 = groupQuestions(part2);
    shuffleArray(groupedPart2); // Trộn thứ tự các nhóm
    
    // (Tuỳ chọn: Nếu muốn trộn cả thứ tự các ý a,b,c,d trong nhóm thì bỏ comment dòng dưới)
    // groupedPart2.forEach(group => shuffleArray(group.items));

    return { part1, part2: groupedPart2, part3 };
}

// Hàm gom nhóm cho Phần II
function groupQuestions(questions) {
    const groups = {};
    questions.forEach(q => {
        const key = q.contentRoot || "Common"; // Gom theo câu dẫn chung
        if (!groups[key]) groups[key] = { root: q.contentRoot, items: [] };
        groups[key].items.push(q);
    });
    return Object.values(groups);
}

// Thuật toán Fisher-Yates Shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- 3. RENDER GIAO DIỆN (HTML) ---

function renderExam(data) {
    const container = document.getElementById('exam-container');
    container.innerHTML = '';
    let globalIndex = 1;

    // --- PHẦN I: TRẮC NGHIỆM ---
    if (data.part1.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN I. TRẮC NGHIỆM (${data.part1.length} câu)</div>`;
        const section1 = document.createElement('div');
        section1.className = 'exam-section';
        
        data.part1.forEach(q => {
            section1.innerHTML += createMultipleChoiceHTML(q, globalIndex++);
        });
        container.appendChild(section1);
    }

    // --- PHẦN II: ĐÚNG/SAI ---
    if (data.part2.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN II. TRẮC NGHIỆM ĐÚNG SAI</div>`;
        const section2 = document.createElement('div');
        section2.className = 'exam-section';

        data.part2.forEach(group => {
            // Render câu dẫn chung (Root)
            if (group.root) {
                section2.innerHTML += `<div class="root-title"><b>Câu ${globalIndex++}:</b> ${group.root}</div>`;
            }
            // Render các ý con (a, b, c, d)
            let subLabel = 97; // ascii 97 is 'a'
            group.items.forEach(q => {
                const labelChar = String.fromCharCode(subLabel++);
                section2.innerHTML += createTrueFalseHTML(q, labelChar); // Không tăng globalIndex ở ý con
            });
            section2.innerHTML += `<hr style="margin: 20px 0; border:0; border-top:1px dashed #ccc;">`;
        });
        container.appendChild(section2);
    }

    // --- PHẦN III: TRẢ LỜI NGẮN ---
    if (data.part3.length > 0) {
        container.innerHTML += `<div class="section-header">PHẦN III. TRẢ LỜI NGẮN</div>`;
        const section3 = document.createElement('div');
        section3.className = 'exam-section';

        data.part3.forEach(q => {
            section3.innerHTML += createFillInHTML(q, globalIndex++);
        });
        container.appendChild(section3);
    }
}

// HTML cho Trắc nghiệm (A, B, C, D)
function createMultipleChoiceHTML(q, index) {
    const imgHTML = q.image ? `<div class="q-image"><img src="assets/images/exams/${sessionData.examId}/${q.image}" alt="Hình ảnh"></div>` : '';
    
    return `
    <div class="question-item" id="q-${q.id}">
        <div class="q-content"><b>Câu ${index}:</b> ${q.contentSub || q.contentRoot}</div>
        ${imgHTML}
        <div class="options-grid">
            ${['A', 'B', 'C', 'D'].map(opt => `
                <label class="option-label">
                    <input type="radio" name="q_${q.id}" value="${opt}" onclick="selectAnswer(${q.id}, '${opt}')">
                    <span><b>${opt}.</b> ${q.options[opt] || ''}</span>
                </label>
            `).join('')}
        </div>
    </div>`;
}

// HTML cho Đúng/Sai (Nằm ngang)
function createTrueFalseHTML(q, label) {
    return `
    <div class="question-item tf-item" data-type="TRUE_FALSE" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="flex:1;"><b>${label})</b> ${q.contentSub}</div>
        <div style="width:180px; display:flex; gap:20px;">
            <label><input type="radio" name="q_${q.id}" value="T" onclick="selectAnswer(${q.id}, 'T')"> Đúng</label>
            <label><input type="radio" name="q_${q.id}" value="F" onclick="selectAnswer(${q.id}, 'F')"> Sai</label>
        </div>
    </div>`;
}

// HTML cho Điền khuyết
function createFillInHTML(q, index) {
    const imgHTML = q.image ? `<div class="q-image"><img src="assets/images/exams/${sessionData.examId}/${q.image}"></div>` : '';
    return `
    <div class="question-item">
        <div class="q-content"><b>Câu ${index}:</b> ${q.contentSub || q.contentRoot}</div>
        ${imgHTML}
        <div style="margin-top:10px;">
            <input type="text" class="fill-input" placeholder="Nhập đáp án..." 
                   onchange="selectAnswer(${q.id}, this.value)" 
                   style="width:100%; max-width:300px; padding:8px; border:1px solid #ccc; border-radius:4px;">
        </div>
    </div>`;
}

// --- 4. TƯƠNG TÁC & HỖ TRỢ ---

// Lưu đáp án người dùng chọn
window.selectAnswer = function(qId, value) {
    studentAnswers[qId] = value;
};

// Render KaTeX (Toán học)
function renderMath() {
    renderMathInElement(document.body, {
        delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false}
        ],
        throwOnError: false
    });
}

// Đồng hồ đếm ngược
function startTimer(minutes) {
    let sec = minutes * 60;
    const timerElement = document.getElementById('timer');
    
    const countdown = setInterval(() => {
        if (sec <= 0) {
            clearInterval(countdown);
            alert('Hết giờ làm bài! Hệ thống sẽ tự động nộp bài.');
            submitExam(true); // Force submit
            return;
        }
        sec--;
        let m = Math.floor(sec / 60);
        let s = sec % 60;
        
        if (sec < 300) { // Dưới 5 phút đổi màu đỏ
            timerElement.style.color = '#dc3545';
            timerElement.style.borderColor = '#dc3545';
        }
        
        timerElement.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
    }, 1000);
}

// --- 5. NỘP BÀI (LOGIC MỚI - MODAL) ---

window.submitExam = async function(force = false) {
    const totalQuestions = currentQuestions.length;
    const answeredCount = Object.keys(studentAnswers).length;

    // Nếu không phải bắt buộc nộp (hết giờ) thì hỏi xác nhận
    if (!force) {
        if (answeredCount < totalQuestions) {
            const confirmMsg = `Bạn mới hoàn thành ${answeredCount}/${totalQuestions} câu hỏi.\nBạn có chắc chắn muốn nộp bài không?`;
            if (!confirm(confirmMsg)) return;
        } else {
            if (!confirm('Bạn có chắc chắn muốn nộp bài?')) return;
        }
    }

    // 1. Hiển thị Overlay & Spinner
    const overlay = document.getElementById('result-modal-overlay');
    const modalBody = document.getElementById('modal-body');
    
    if (overlay) {
        overlay.style.display = 'flex';
        modalBody.innerHTML = `
            <h3 style="color:#555">Đang chấm điểm...</h3>
            <div class="spinner"></div>
            <p style="color:#888; font-size:14px">Vui lòng giữ nguyên màn hình</p>
        `;
    }

    // 2. Chuẩn bị dữ liệu gửi đi
    // Kết hợp Họ tên và Lớp để gửi vào cột StudentName
    const fullStudentInfo = `${sessionData.studentName} - ${sessionData.studentClass}`;

    try {
        const response = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            body: JSON.stringify({
                examId: sessionData.examId,
                studentName: fullStudentInfo, 
                answers: studentAnswers
            })
        });

        const result = await response.json();

        if (result.success) {
            // 3. Hiển thị Kết quả (Giao diện đẹp)
            modalBody.innerHTML = `
                <h2 style="color: #333; margin-bottom: 5px;">KẾT QUẢ</h2>
                <div class="score-gradient">${result.score}</div>
                
                <div class="result-detail">
                    <p style="margin: 5px 0; font-size: 16px;">Số câu đúng: <b>${result.correctCount}</b> / ${result.totalQuestions}</p>
                </div>

                <div class="btn-group">
                    <button class="btn-retry" onclick="location.reload()">Làm lại</button>
                    <button class="btn-home" onclick="location.href='index.html'">Về trang chủ</button>
                </div>
            `;
            
            // Xóa session để ngăn người dùng quay lại nộp tiếp
            sessionStorage.removeItem('currentExam');
            
        } else {
            throw new Error(result.message);
        }

    } catch (e) {
        modalBody.innerHTML = `
            <h3 style="color: #dc3545;">Có lỗi xảy ra!</h3>
            <p>${e.message || "Không thể gửi bài thi."}</p>
            <button class="btn-retry" onclick="document.getElementById('result-modal-overlay').style.display='none'">Đóng & Thử lại</button>
        `;
    }
};