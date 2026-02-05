/**
 * Hệ thống điều khiển thi trực tuyến - Chuẩn GDPT 2018
 * Hỗ trợ: Trắc nghiệm 4 đáp án, Đúng/Sai (Gom nhóm), Điền số
 */

let currentQuestions = [];
let studentAnswers = {};

document.addEventListener('DOMContentLoaded', function() {
    loadExamData();
});

// 1. Tải dữ liệu từ Google Apps Script API
async function loadExamData() {
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData || !sessionData.examId) {
        alert("Không tìm thấy thông tin đề thi!");
        window.location.href = 'index.html';
        return;
    }

    const apiUrl = `YOUR_APPS_SCRIPT_URL?action=getQuestions&examId=${sessionData.examId}`;

    try {
        const response = await fetch(apiUrl);
        const res = await response.json();

        if (res.success) {
            currentQuestions = res.data;
            renderQuestions(currentQuestions);
            startTimer(sessionData.remainingMinutes || 60);
        } else {
            document.getElementById('questions').innerHTML = `<p class="error">Lỗi: ${res.message}</p>`;
        }
    } catch (error) {
        console.error("Lỗi kết nối API:", error);
        document.getElementById('questions').innerHTML = `<p class="error">Không thể kết nối máy chủ.</p>`;
    }
}

// 2. Hiển thị câu hỏi ra giao diện
function renderQuestions(questions) {
    const container = document.getElementById('questions');
    container.innerHTML = ''; 
    let lastRoot = ""; // Theo dõi câu dẫn để gom nhóm

    questions.forEach((q, idx) => {
        let qHtml = "";

        // XỬ LÝ CÂU DẪN (Content_Root) - Dùng cho Dạng 2 hoặc nội dung chính Dạng 1, 3
        if (q.contentRoot && q.contentRoot.trim() !== "" && q.contentRoot !== lastRoot) {
            qHtml += `
                <div class="root-content" style="background:#f8f9fa; padding:15px; font-weight:bold; margin-top:25px; border-left:5px solid #007bff; border-radius:4px;">
                    ${q.contentRoot}
                </div>`;
            
            // Nếu có ảnh đi kèm câu dẫn chính
            if (q.image && q.image.toString().includes('.')) {
                let imgPath = q.image.startsWith('http') ? q.image : `assets/images/exams/${q.image}`;
                qHtml += `<div class="text-center my-2"><img src="${imgPath}" style="max-width:100%; border-radius:8px;"></div>`;
            }
            lastRoot = q.contentRoot;
        }

        // THÂN CÂU HỎI / Ý HỎI (Content_Sub)
        const isSubQuestion = (q.type === "TRUE_FALSE");
        qHtml += `
            <div class="question-card" data-id="${q.id}" data-type="${q.type}" 
                 style="padding:15px; border-bottom:1px solid #eee; ${isSubQuestion ? 'margin-left:30px; border-left:1px dashed #ccc;' : ''}">
                <p>${q.contentSub ? '<strong>' + q.contentSub + '</strong>' : (!isSubQuestion ? '<strong>Câu ' + (idx + 1) + ':</strong> ' : '')}</p>`;

        // CÁC LỰA CHỌN ĐÁP ÁN
        qHtml += `<div class="options-container" style="margin-top:10px;">`;
        
        if (q.type === "TRUE_FALSE") {
            // Dạng 2: Đúng/Sai
            qHtml += `
                <label style="margin-right:25px; cursor:pointer;"><input type="radio" name="q${q.id}" value="Đúng" onchange="saveAnswer(${q.id}, 'Đúng')"> Đúng</label>
                <label style="cursor:pointer;"><input type="radio" name="q${q.id}" value="Sai" onchange="saveAnswer(${q.id}, 'Sai')"> Sai</label>`;
        } 
        else if (q.type === "FILL_IN") {
            // Dạng 3: Điền đáp số
            qHtml += `<input type="text" class="form-control" style="width:200px; border:1px solid #007bff;" 
                        placeholder="Nhập đáp số..." oninput="saveAnswer(${q.id}, this.value)">`;
        } 
        else {
            // Dạng 1: Trắc nghiệm 4 đáp án (A, B, C, D)
            for (let opt in q.options) {
                if (q.options[opt]) {
                    qHtml += `
                        <label style="display:block; margin-bottom:8px; cursor:pointer;">
                            <input type="radio" name="q${q.id}" value="${opt}" onchange="saveAnswer(${q.id}, '${opt}')"> 
                            <strong>${opt}.</strong> ${q.options[opt]}
                        </label>`;
                }
            }
        }

        qHtml += `</div></div>`;
        container.innerHTML += qHtml;
    });

    // Gọi KaTeX để vẽ công thức Toán
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.body, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ],
            throwOnError: false
        });
    }
}

// 3. Lưu tạm đáp án khi học sinh chọn
function saveAnswer(questionId, value) {
    studentAnswers[questionId] = value.trim();
    console.log("Answers updated:", studentAnswers);
}

// 4. Đồng hồ đếm ngược
function startTimer(minutes) {
    let seconds = minutes * 60;
    const timerDisplay = document.getElementById('timer');

    const countdown = setInterval(function() {
        let min = Math.floor(seconds / 60);
        let sec = seconds % 60;
        timerDisplay.innerText = `${min}:${sec < 10 ? '0' : ''}${sec}`;

        if (seconds <= 0) {
            clearInterval(countdown);
            alert("Hết giờ làm bài!");
            submitExam();
        }
        seconds--;
    }, 1000);
}

// 5. Nộp bài
async function submitExam() {
    if (!confirm("Bạn chắc chắn muốn nộp bài?")) return;

    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    const payload = {
        action: 'submitExam',
        examId: sessionData.examId,
        answers: studentAnswers
    };

    // Hiển thị trạng thái đang nộp
    document.getElementById('questions').innerHTML = "<h3>Đang chấm điểm...</h3>";

    try {
        const response = await fetch('YOUR_APPS_SCRIPT_URL', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.success) {
            alert(`Nộp bài thành công! Điểm của bạn: ${result.score}`);
            window.location.href = `result.html?score=${result.score}`;
        }
    } catch (error) {
        alert("Lỗi khi nộp bài. Vui lòng thử lại.");
        console.error(error);
    }
}
