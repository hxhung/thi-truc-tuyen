let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;

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

document.addEventListener('DOMContentLoaded', loadExamData);

async function loadExamData() {
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) { 
        alert('Không tìm thấy thông tin kỳ thi. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html'; 
        return; 
    }

    // Load API URL từ config
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

    const apiUrl = `${API_URL}?action=getQuestions&examId=${examId}`;
    
    // Hiển thị thông tin đề thi
    const titleElement = document.getElementById('exam-title');
    if (titleElement) {
        titleElement.innerText = `Đề thi: ${examId}`;
    }

    try {
        const response = await fetch(apiUrl);
        const res = await response.json();

        if (res.success) {
            currentQuestions = res.data;
            
            // KHÔNG randomize để giữ nguyên thứ tự
            // (Có thể bật lại nếu cần: currentQuestions = shuffleArray(currentQuestions))
            
            renderQuestions(currentQuestions, examId);
            startTimer(sessionData.remainingMinutes || 60);
        } else {
            document.getElementById('questions').innerHTML = `<p class="error">Lỗi: ${res.message}</p>`;
        }
    } catch (error) {
        console.error('Chi tiết lỗi:', error);
        document.getElementById('questions').innerHTML = `<p class="error">Không thể kết nối máy chủ. Vui lòng kiểm tra link API hoặc kết nối mạng.</p>`;
    }
}

// Hàm xáo trộn mảng (tắt mặc định)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function renderQuestions(questions, examId) {
    const container = document.getElementById('questions');
    container.innerHTML = ''; 

    // 1. Phân loại câu hỏi theo Type
    const part1 = questions.filter(q => q.type === "MULTIPLE_CHOICE");
    const part2 = questions.filter(q => q.type === "TRUE_FALSE");
    const part3 = questions.filter(q => q.type === "FILL_IN");

    // 2. Hàm hỗ trợ tạo HTML cho từng câu (giữ nguyên logic gốc của bạn)
    const generateQuestionHtml = (q, index, isPart2 = false) => {
        let qHtml = `<div class="question-item" data-type="${q.type}">`;
        
        // Hiển thị nội dung câu hỏi
        let label = isPart2 ? `<strong>${q.contentSub.split(')')[0]})</strong>` : `<strong>Câu ${index}:</strong>`;
        let content = q.contentSub || q.content || "(Đề trống)";
        qHtml += `<p>${label} ${content.replace(/^[a-z]\)\s*/, '')}</p>`;

        // Hình ảnh
        if (q.image) {
            qHtml += `<div style="margin:10px 0;"><img src="assets/images/exams/${examId}/${q.image}" style="max-width:100%;" onerror="this.style.display='none'"></div>`;
        }

        // Đáp án dựa theo loại
        if (q.type === "MULTIPLE_CHOICE") {
            qHtml += `<div style="margin-top:10px;">`;
            ['A', 'B', 'C', 'D'].forEach(key => {
                if (q.options[key]) {
                    qHtml += `<label style="display:block; margin:8px 0;"><input type="radio" name="q${q.id}" value="${key}" onchange="studentAnswers[${q.id}]='${key}'"> <strong>${key}.</strong> ${q.options[key]}</label>`;
                }
            });
            qHtml += `</div>`;
        } 
        else if (q.type === "TRUE_FALSE") {
            qHtml += `<div class="tf-options">
                <label><input type="radio" name="q${q.id}" value="Đúng" onchange="studentAnswers[${q.id}]='Đúng'"> Đúng</label>
                <label><input type="radio" name="q${q.id}" value="Sai" onchange="studentAnswers[${q.id}]='Sai'"> Sai</label>
            </div>`;
        } 
        else if (q.type === "FILL_IN") {
            qHtml += `<div style="margin-top:10px;"><input type="text" placeholder="Nhập đáp án..." style="width:200px; padding:8px; border:1px solid #007bff; border-radius:4px;" oninput="studentAnswers[${q.id}]=this.value.trim()"></div>`;
        }

        qHtml += `</div>`;
        return qHtml;
    };

    // 3. Render PHẦN I
    if (part1.length > 0) {
        let html = `<div class="exam-section">
            <div class="section-header">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Mỗi câu hỏi thí sinh chỉ chọn một phương án.</div>`;
        part1.forEach((q, idx) => html += generateQuestionHtml(q, idx + 1));
        html += `</div>`;
        container.innerHTML += html;
    }

    // 4. Render PHẦN II (Đúng/Sai)
    if (part2.length > 0) {
        let html = `<div class="exam-section">
            <div class="section-header">PHẦN II. Câu trắc nghiệm đúng sai. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</div>`;
        
        let lastRoot = "";
        let rootCount = 0;
        part2.forEach((q) => {
            if (q.contentRoot !== lastRoot) {
                rootCount++;
                html += `<div class="root-title" style="margin-bottom:10px;"><strong>Câu ${rootCount}:</strong> ${q.contentRoot}</div>`;
                lastRoot = q.contentRoot;
            }
            html += generateQuestionHtml(q, null, true);
        });
        html += `</div>`;
        container.innerHTML += html;
    }

    // 5. Render PHẦN III
    if (part3.length > 0) {
        let html = `<div class="exam-section">
            <div class="section-header">PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời kết quả của câu hỏi.</div>`;
        part3.forEach((q, idx) => html += generateQuestionHtml(q, idx + 1));
        html += `</div>`;
        container.innerHTML += html;
    }

    // Render LaTeX
    if (window.renderMathInElement) { renderMathInElement(document.body, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] }); }
}
function startTimer(min) {
    let sec = min * 60;
    const timerElement = document.getElementById('timer');
    
    if (!timerElement) {
        console.error('Không tìm thấy element #timer');
        return;
    }
    
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
        
        // Đổi màu cảnh báo khi còn < 5 phút
        if (sec < 300) {
            timerElement.style.backgroundColor = '#ff0000';
        }
        
        timerElement.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
    }, 1000);
}

// Hàm nộp bài
async function submitExam() {
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    const studentName = sessionData.studentName || prompt('Nhập họ tên của bạn:') || 'Ẩn danh';
    const examId = sessionData.examId;
    
    // Kiểm tra số câu đã trả lời
    const answeredCount = Object.keys(studentAnswers).length;
    const totalQuestions = currentQuestions.length;
    
    if (answeredCount < totalQuestions) {
        const confirm = window.confirm(`Bạn mới trả lời ${answeredCount}/${totalQuestions} câu. Bạn có chắc muốn nộp bài?`);
        if (!confirm) return;
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
            alert(`Nộp bài thành công!\n\nĐiểm: ${result.score}/10\nSố câu đúng: ${result.correctCount || 0}/${result.totalQuestions || totalQuestions}`);
            sessionStorage.setItem('examResult', JSON.stringify(result));
            // window.location.href = 'result.html';
        } else {
            alert('Lỗi nộp bài: ' + result.message);
        }
    } catch (error) {
        alert('Không thể nộp bài. Vui lòng kiểm tra kết nối mạng.');
        console.error(error);
    }
}

// Event listener cho nút nộp bài
document.addEventListener('DOMContentLoaded', function() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitExam);
    }
});
