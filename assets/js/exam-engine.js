let currentQuestions = [];
let studentAnswers = {};

document.addEventListener('DOMContentLoaded', loadExamData);

async function loadExamData() {
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) { window.location.href = 'index.html'; return; }

    // DÙNG LINK API CỦA BẠN (Đã lấy từ hình image_c16625.png)
    const apiUrl = `https://script.google.com/macros/s/AKfycbzbs0nKtBDAE1Q4BzkJx3ANFpkp1Qz0-K-A6SYT4QMha10PgJjsBAuVUmxqvTUp7aZTag/exec?action=getQuestions&examId=$`;

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
        document.getElementById('questions').innerHTML = `<p class="error">Không thể kết nối máy chủ. Vui lòng kiểm tra link API.</p>`;
    }
}

function renderQuestions(questions) {
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
        
        if (q.contentSub) qHtml += `<p>${q.contentSub}</p>`;

        if (isTF) {
            qHtml += `
                <label><input type="radio" name="q${q.id}" value="Đúng" onchange="studentAnswers[${q.id}]='Đúng'"> Đúng</label>
                <label style="margin-left:20px;"><input type="radio" name="q${q.id}" value="Sai" onchange="studentAnswers[${q.id}]='Sai'"> Sai</label>`;
        } else if (q.type === "FILL_IN") {
            qHtml += `<input type="text" class="form-control" style="width:150px; border:1px solid #007bff;" oninput="studentAnswers[${q.id}]=this.value">`;
        } else {
            for (let opt in q.options) {
                if (q.options[opt]) {
                    qHtml += `<label style="display:block; margin:5px 0;"><input type="radio" name="q${q.id}" value="${opt}" onchange="studentAnswers[${q.id}]='${opt}'"> ${opt}. ${q.options[opt]}</label>`;
                }
            }
        }
        qHtml += `</div>`;
        container.innerHTML += qHtml;
    });

    if (window.renderMathInElement) {
        renderMathInElement(document.body, { delimiters: [{left: "$", right: "$", display: false}] });
    }
}

function startTimer(min) {
    let sec = min * 60;
    setInterval(() => {
        if (sec <= 0) return;
        sec--;
        let m = Math.floor(sec/60), s = sec%60;
        document.getElementById('timer').innerText = `${m}:${s<10?'0':''}${s}`;
    }, 1000);
}
