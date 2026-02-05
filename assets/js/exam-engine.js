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

    // LẤY examId TỪ SESSION (không hardcode)
    const examId = sessionData.examId;
    if (!examId) {
        alert('Mã đề thi không hợp lệ. Vui lòng thử lại.');
        window.location.href = 'index.html';
        return;
    }

    const apiUrl = `${API_URL}?action=getQuestions&examId=${examId}`;
    
    // Hiển thị thông tin đề thi
    document.getElementById('exam-title').innerText = `Đề thi: ${examId}`;

    try {
        const response = await fetch(apiUrl);
        const res = await response.json();

        if (res.success) {
            currentQuestions = res.data;
            
            // Randomize thứ tự câu hỏi nếu được bật
            if (sessionData.randomize !== false) {
                currentQuestions = shuffleArray(currentQuestions);
            }
            
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

// Hàm xáo trộn mảng (Fisher-Yates Shuffle)
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
    let lastRoot = ""; 

    questions.forEach((q, idx) => {
        let qHtml = "";
        
        // Nếu câu dẫn (Root) khác câu trước -> Hiển thị câu dẫn mới
        if (q.contentRoot && q.contentRoot.trim() !== "" && q.contentRoot !== lastRoot) {
            qHtml += `<div class="root-title" style="background:#f1f8ff; padding:15px; font-weight:bold; margin-top:20px; border-left:5px solid #007bff; border-radius:4px;">${q.contentRoot}</div>`;
            lastRoot = q.contentRoot;
        }

        // Thân câu hỏi (Sub)
        const isTF = (q.type === "TRUE_FALSE");
        qHtml += `<div class="question-item" style="padding:15px; border-bottom:1px solid #eee; ${isTF ? 'margin-left:30px; border-left:1px dashed #ccc;' : ''}">`;
        
        // Tiêu đề câu hỏi
        qHtml += `<strong>Câu ${idx + 1}:</strong> `;
        
        if (q.contentSub) {
            qHtml += `<p style="margin:10px 0;">${q.contentSub}</p>`;
        } else if (q.content) {
            // Fallback nếu backend chưa cập nhật contentSub
            qHtml += `<p style="margin:10px 0;">${q.content}</p>`;
        }

        // Hiển thị hình ảnh nếu có
        if (q.image && q.image.trim() !== "") {
            qHtml += `<div style="margin:15px 0;"><img src="assets/images/exams/${examId}/${q.image}" alt="Hình minh họa câu ${idx + 1}" style="max-width:100%; height:auto; border:1px solid #ddd; border-radius:4px; padding:5px;" onerror="this.style.display='none'"></div>`;
        }

        // Render các đáp án
        if (isTF) {
            qHtml += `
                <label><input type="radio" name="q${q.id}" value="Đúng" onchange="studentAnswers[${q.id}]='Đúng'"> Đúng</label>
                <label style="margin-left:20px;"><input type="radio" name="q${q.id}" value="Sai" onchange="studentAnswers[${q.id}]='Sai'"> Sai</label>`;
        } else if (q.type === "FILL_IN") {
            qHtml += `<input type="text" class="form-control" placeholder="Nhập đáp án..." style="width:200px; padding:8px; border:1px solid #007bff; border-radius:4px;" oninput="studentAnswers[${q.id}]=this.value.trim()">`;
        } else {
            // MULTIPLE_CHOICE - Randomize thứ tự đáp án
            let optionsArray = [];
            for (let opt in q.options) {
                if (q.options[opt] && q.options[opt].trim() !== "") {
                    optionsArray.push({ key: opt, value: q.options[opt] });
                }
            }
            
            // Xáo trộn đáp án
            optionsArray = shuffleArray(optionsArray);
            
            optionsArray.forEach(option => {
                qHtml += `<label style="display:block; margin:8px 0; cursor:pointer;">
                    <input type="radio" name="q${q.id}" value="${option.key}" onchange="studentAnswers[${q.id}]='${option.key}'"> 
                    <strong>${option.key}.</strong> ${option.value}
                </label>`;
            });
        }
        
        qHtml += `</div>`;
        container.innerHTML += qHtml;
    });

    // Render công thức LaTeX
    if (window.renderMathInElement) {
        renderMathInElement(document.body, { 
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ] 
        });
    }
}

function startTimer(min) {
    let sec = min * 60;
    const timerElement = document.getElementById('timer');
    
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
            timerElement.style.color = 'red';
            timerElement.style.fontWeight = 'bold';
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
            sessionStorage.setItem('examResult', JSON.stringify(result));
            window.location.href = 'result.html';
        } else {
            alert('Lỗi nộp bài: ' + result.message);
        }
    } catch (error) {
        alert('Không thể nộp bài. Vui lòng kiểm tra kết nối mạng.');
        console.error(error);
    }
}

// Thêm event listener cho nút nộp bài
document.addEventListener('DOMContentLoaded', function() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitExam);
    }
});
