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
    
    let lastRoot = ""; 
    let rootQuestionNumber = 0;  // Số thứ tự câu dẫn (Câu 1, Câu 2...)
    let subQuestionLetter = '';  // Chữ cái cho câu con (a, b, c, d...)

    questions.forEach((q, idx) => {
        let qHtml = "";
        
        // Kiểm tra xem có phải câu dẫn MỚI không
        const hasNewRoot = q.contentRoot && q.contentRoot.trim() !== "" && q.contentRoot !== lastRoot;
        
        if (hasNewRoot) {
            // Câu dẫn mới → Tăng số thứ tự câu
            rootQuestionNumber++;
            subQuestionLetter = '';  // Reset chữ cái
            
            qHtml += `<div class="root-title">
                <strong>Câu ${rootQuestionNumber}:</strong> ${q.contentRoot}
            </div>`;
            lastRoot = q.contentRoot;
        }
        
        const isTF = (q.type === "TRUE_FALSE");
        
        // Nếu là TRUE_FALSE và có câu con → Đánh số a, b, c, d
        if (isTF && q.contentSub && q.contentSub.trim() !== "") {
            // Tăng chữ cái: a, b, c, d...
            const subIndex = q.contentSub.match(/^([a-z])\)/); // Lấy "a)", "b)"...
            if (subIndex) {
                subQuestionLetter = subIndex[1];
            } else {
                // Nếu không có sẵn, tự động đánh
                const letterCode = 97 + (questions.filter((item, i) => 
                    i < idx && 
                    item.contentRoot === q.contentRoot && 
                    item.type === "TRUE_FALSE"
                ).length);
                subQuestionLetter = String.fromCharCode(letterCode);
            }
            
            qHtml += `<div class="question-item sub-question">
                <strong>${subQuestionLetter})</strong> ${q.contentSub.replace(/^[a-z]\)\s*/, '')}
            `;
        } else {
            // Câu MULTIPLE_CHOICE hoặc FILL_IN → Nếu chưa có Root thì tăng số
            if (!hasNewRoot && !lastRoot) {
                rootQuestionNumber++;
            }
            
            qHtml += `<div class="question-item">`;
            
            // Nếu có contentSub → Hiển thị
            if (q.contentSub && q.contentSub.trim() !== "") {
                qHtml += `<strong>Câu ${rootQuestionNumber}:</strong> ${q.contentSub}`;
            } 
            // Nếu KHÔNG có contentSub nhưng có content (fallback)
            else if (q.content && q.content.trim() !== "") {
                qHtml += `<strong>Câu ${rootQuestionNumber}:</strong> ${q.content}`;
            }
            // Nếu KHÔNG có gì cả (chỉ có Root)
            else if (!hasNewRoot) {
                qHtml += `<strong>Câu ${rootQuestionNumber}:</strong> (Đề trống)`;
            }
        }

        // Hiển thị hình ảnh nếu có
        if (q.image && q.image.trim() !== "") {
            qHtml += `<div style="margin:15px 0;">
                <img src="assets/images/exams/${examId}/${q.image}" 
                     alt="Hình minh họa" 
                     style="max-width:100%; height:auto; border:1px solid #ddd; border-radius:4px; padding:5px;" 
                     onerror="this.style.display='none'">
            </div>`;
        }

        // Render các đáp án
        if (isTF) {
            qHtml += `<div style="margin-left:20px; margin-top:5px;">
                <label style="margin-right:20px;">
                    <input type="radio" name="q${q.id}" value="Đúng" onchange="studentAnswers[${q.id}]='Đúng'"> Đúng
                </label>
                <label>
                    <input type="radio" name="q${q.id}" value="Sai" onchange="studentAnswers[${q.id}]='Sai'"> Sai
                </label>
            </div>`;
        } else if (q.type === "FILL_IN") {
            qHtml += `<div style="margin-top:10px;">
                <input type="text" 
                       class="form-control" 
                       placeholder="Nhập đáp án..." 
                       style="width:200px; padding:8px; border:1px solid #007bff; border-radius:4px;" 
                       oninput="studentAnswers[${q.id}]=this.value.trim()">
            </div>`;
        } else {
            // MULTIPLE_CHOICE - KHÔNG XÁO TRỘN, giữ nguyên thứ tự A, B, C, D
            qHtml += `<div style="margin-top:10px;">`;
            
            // Hiển thị theo thứ tự A → B → C → D
            const optionOrder = ['A', 'B', 'C', 'D'];
            optionOrder.forEach(key => {
                if (q.options[key] && q.options[key].trim() !== "") {
                    qHtml += `<label style="display:block; margin:8px 0; cursor:pointer;">
                        <input type="radio" name="q${q.id}" value="${key}" onchange="studentAnswers[${q.id}]='${key}'"> 
                        <strong>${key}.</strong> ${q.options[key]}
                    </label>`;
                }
            });
            
            qHtml += `</div>`;
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
