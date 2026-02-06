/**
 * EXAM ENGINE - PHIÊN BẢN FINAL (Đã fix hiển thị & lỗi loading)
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;

// --- 1. KHỞI TẠO & LOAD DỮ LIỆU ---

document.addEventListener('DOMContentLoaded', loadExamData);

// Load cấu hình từ config.json
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
        return examConfig.api_endpoint;
    } catch (error) {
        console.error('Không thể load config:', error);
        return null;
    }
}

async function loadExamData() {
    // Kiểm tra session
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) { 
        alert('Không tìm thấy thông tin kỳ thi. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html'; 
        return; 
    }

    // Load API URL
    const API_URL = await loadConfig();
    if (!API_URL) {
        document.getElementById('questions').innerHTML = `<p class="error">Lỗi: Không thể tải cấu hình hệ thống.</p>`;
        return;
    }

    const examId = sessionData.examId;
    if (!examId) {
        alert('Mã đề thi không hợp lệ. Vui lòng thử lại.');
        window.location.href = 'index.html';
        return;
    }

    // Hiển thị tiêu đề
    const titleElement = document.getElementById('exam-title');
    if (titleElement) {
        titleElement.innerText = `Đề thi: ${examId}`;
    }

    // Gọi API lấy câu hỏi
    try {
        const apiUrl = `${API_URL}?action=getQuestions&examId=${examId}`;
        const response = await fetch(apiUrl);
        const res = await response.json();

        if (res.success) {
            currentQuestions = res.data;
            // Gọi hàm render giao diện
            renderQuestions(currentQuestions, examId);
            // Bắt đầu tính giờ
            startTimer(sessionData.remainingMinutes || 60);
        } else {
            document.getElementById('questions').innerHTML = `<p class="error">Lỗi: ${res.message}</p>`;
        }
    } catch (error) {
        console.error('Chi tiết lỗi:', error);
        document.getElementById('questions').innerHTML = `<p class="error">Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.</p>`;
    }
}

// --- 2. HÀM RENDER GIAO DIỆN (ĐÃ FIX LOGIC HIỂN THỊ) ---

function renderQuestions(questions, examId) {
    const container = document.getElementById('questions');
    container.innerHTML = ''; 

    // Phân loại câu hỏi
    const part1 = questions.filter(q => q.type === "MULTIPLE_CHOICE");
    const part2 = questions.filter(q => q.type === "TRUE_FALSE");
    const part3 = questions.filter(q => q.type === "FILL_IN");

    // Hàm làm sạch nội dung: Xóa "đáp án 1)", "1.", "a)" ở đầu câu để tránh lặp
    const getCleanContent = (content) => {
        if (!content) return "";
        return content.replace(/^(?:đáp án|ý|câu)?\s*(?:\d+|[a-z])\s*[\.\)]\s*/yi, '').trim();
    };

    // Hàm tạo HTML cho từng câu hỏi
    const generateQuestionHtml = (q, indexGlobal, subLabel = null) => {
        let qHtml = `<div class="question-item" data-id="${q.id}" style="border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px;">`;
        
        // --- XỬ LÝ TIÊU ĐỀ & NỘI DUNG ---
        let labelDisplay = "";
        let contentDisplay = q.contentSub || q.content || "";

        if (subLabel) {
            // Dành cho Phần II: hiển thị a), b), c), d)
            labelDisplay = `<strong style="color: #007bff; margin-right: 5px;">${subLabel})</strong>`;
            
            // Xóa prefix thừa trong nội dung gốc (nếu có)
            let cleaned = getCleanContent(contentDisplay);
            if (cleaned !== "") contentDisplay = cleaned; 
        } else {
            // Dành cho Phần I và III: Câu 1, Câu 2...
            labelDisplay = `<strong style="color: #007bff;">Câu ${indexGlobal}:</strong>`;
        }

        qHtml += `<div style="font-size: 16px; line-height: 1.5;">${labelDisplay} ${contentDisplay}</div>`;

        // --- XỬ LÝ ẢNH ---
        if (q.image) {
            qHtml += `<div style="margin:15px 0;">
                <img src="assets/images/exams/${examId}/${q.image}" 
                     style="max-width:100%; border-radius:4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" 
                     onerror="this.style.display='none'">
            </div>`;
        }

        // --- XỬ LÝ ĐÁP ÁN ---
        
        // 1. TRẮC NGHIỆM 4 ĐÁP ÁN
        if (q.type === "MULTIPLE_CHOICE") {
            qHtml += `<div class="options-group" style="margin-top: 10px;">`;
            ['A', 'B', 'C', 'D'].forEach(key => {
                if (q.options[key]) {
                    qHtml += `<label style="display:flex; align-items:center; margin:8px 0; cursor:pointer;">
                        <input type="radio" name="q${q.id}" value="${key}" onchange="studentAnswers[${q.id}]='${key}'" style="margin-right: 10px;"> 
                        <span><strong>${key}.</strong> ${q.options[key]}</span>
                    </label>`;
                }
            });
            qHtml += `</div>`;
        } 
        // 2. ĐÚNG / SAI (FIX: Luôn nằm ngang)
        else if (q.type === "TRUE_FALSE") {
            qHtml += `<div style="display: flex !important; flex-direction: row !important; gap: 40px; margin-top: 10px; margin-left: 25px;">
                <label style="cursor:pointer; display: flex; align-items: center; width: auto !important; margin: 0 !important;">
                    <input type="radio" name="q${q.id}" value="Đúng" onchange="studentAnswers[${q.id}]='Đúng'" style="margin-right: 8px;"> 
                    <span style="font-weight: 500;">Đúng</span>
                </label>
                <label style="cursor:pointer; display: flex; align-items: center; width: auto !important; margin: 0 !important;">
                    <input type="radio" name="q${q.id}" value="Sai" onchange="studentAnswers[${q.id}]='Sai'" style="margin-right: 8px;"> 
                    <span style="font-weight: 500;">Sai</span>
                </label>
            </div>`;
        } 
        // 3. ĐIỀN ĐÁP ÁN
        else if (q.type === "FILL_IN") {
            qHtml += `<div style="margin-top:15px;">
                <input type="text" placeholder="Nhập kết quả..." 
                       style="width:100%; max-width: 300px; padding:10px; border:2px solid #e0e0e0; border-radius:4px;" 
                       oninput="studentAnswers[${q.id}]=this.value.trim()">
            </div>`;
        }

        qHtml += `</div>`;
        return qHtml;
    };

    // --- RENDER TỪNG PHẦN ---

    // PHẦN I
    if (part1.length > 0) {
        let html = `<div class="exam-section" style="background:#fff; margin-bottom:30px;">
            <div class="section-header" style="font-weight:bold; font-size:18px; color:#333; border-bottom:2px solid #007bff; padding-bottom:10px; margin-bottom:20px;">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.</div>`;
        part1.forEach((q, idx) => html += generateQuestionHtml(q, idx + 1, null));
        html += `</div>`;
        container.innerHTML += html;
    }

    // PHẦN II (ĐÚNG/SAI)
    if (part2.length > 0) {
        let html = `<div class="exam-section" style="background:#fff; margin-bottom:30px;">
            <div class="section-header" style="font-weight:bold; font-size:18px; color:#333; border-bottom:2px solid #007bff; padding-bottom:10px; margin-bottom:20px;">PHẦN II. Câu trắc nghiệm đúng sai.</div>`;
        
        let lastRoot = "INITIAL_VALUE"; 
        let rootCount = 0;
        let subLabelIndex = 0;
        const subLabels = ['a', 'b', 'c', 'd', 'e', 'f'];

        part2.forEach((q) => {
            const currentRoot = q.contentRoot ? q.contentRoot.trim() : "";
            
            // Nếu đổi sang nhóm câu hỏi mới
            if (currentRoot !== lastRoot) {
                rootCount++;
                subLabelIndex = 0; // Reset a,b,c,d
                if(currentRoot) {
                     html += `<div class="root-title" style="margin-top:25px; margin-bottom:15px; font-weight:bold; font-size: 17px; color:#0056b3; background:#f8f9fa; padding:10px; border-left:4px solid #0056b3;">Câu ${rootCount}. ${currentRoot}</div>`;
                }
                lastRoot = currentRoot;
            }

            // Lấy nhãn a, b, c, d
            const labelChar = subLabels[subLabelIndex] || '-';
            html += generateQuestionHtml(q, null, labelChar);
            subLabelIndex++;
        });

        html += `</div>`;
        container.innerHTML += html;
    }

    // PHẦN III
    if (part3.length > 0) {
        let html = `<div class="exam-section" style="background:#fff; margin-bottom:30px;">
            <div class="section-header" style="font-weight:bold; font-size:18px; color:#333; border-bottom:2px solid #007bff; padding-bottom:10px; margin-bottom:20px;">PHẦN III. Câu trắc nghiệm trả lời ngắn.</div>`;
        part3.forEach((q, idx) => html += generateQuestionHtml(q, idx + 1, null));
        html += `</div>`;
        container.innerHTML += html;
    }

    // Kích hoạt LaTeX
    if (window.renderMathInElement) { 
        renderMathInElement(document.body, { 
            delimiters: [
                {left: "$$", right: "$$", display: true}, 
                {left: "$", right: "$", display: false}
            ] 
        }); 
    }
}

// --- 3. CÁC HÀM TIỆN ÍCH KHÁC (TIMER, SUBMIT) ---

function startTimer(min) {
    let sec = min * 60;
    const timerElement = document.getElementById('timer');
    if (!timerElement) return;
    
    const countdown = setInterval(() => {
        if (sec <= 0) {
            clearInterval(countdown);
            alert('Hết giờ! Bài thi sẽ được nộp tự động.');
            submitExam();
            return;
        }
        sec--;
        let m = Math.floor(sec/60);
        let s = sec % 60;
        if (sec < 300) timerElement.style.backgroundColor = '#ff0000';
        timerElement.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
    }, 1000);
}

async function submitExam() {
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    const studentName = sessionData.studentName || 'Ẩn danh';
    const examId = sessionData.examId;
    
    // Kiểm tra số câu đã trả lời
    const answeredCount = Object.keys(studentAnswers).length;
    const totalQuestions = currentQuestions.length;
    
    if (answeredCount < totalQuestions) {
        if (!confirm(`Bạn mới trả lời ${answeredCount}/${totalQuestions} câu. Chắc chắn nộp?`)) return;
    }
    
    try {
        const response = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                examId: examId,
                studentName: studentName,
                answers: studentAnswers
            })
        });
        
        const result = await response.json();
        if (result.success) {
            alert(`Nộp bài thành công!\nĐiểm: ${result.score}/10`);
            sessionStorage.setItem('examResult', JSON.stringify(result));
            // window.location.href = 'result.html'; // Bỏ comment nếu muốn chuyển trang
        } else {
            alert('Lỗi nộp bài: ' + result.message);
        }
    } catch (error) {
        alert('Lỗi kết nối khi nộp bài.');
        console.error(error);
    }
}

// Gán sự kiện cho nút nộp bài
document.getElementById('submitBtn')?.addEventListener('click', submitExam);
