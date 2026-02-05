window.onload = async function() {
    const examData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!examData) { window.location.href = 'index.html'; return; }

    // 1. Chạy đồng hồ đếm ngược
    startTimer(examData.remainingMinutes);

    // 2. Tải và hiển thị câu hỏi
    const res = await getQuestions(examData.examId);
    if (res.success) {
        renderQuestions(res.data);
    }
};

function renderQuestions(questions) {
    const container = document.getElementById('questions');
    if (!container) return;
    container.innerHTML = ''; 

    questions.forEach((q, idx) => {
        let qHtml = `<div class="question-card" data-id="${q.id}" data-type="${q.type}">
            <p><strong>Câu ${idx + 1}:</strong> ${q.content}</p>`;
        
        // Chỉ hiển thị ảnh nếu dữ liệu image có chứa đuôi file ảnh (png, jpg,...)
        if (q.image && q.image.match(/\.(jpeg|jpg|gif|png)$/i)) {
            const imgPath = q.image.startsWith('http') ? q.image : `assets/images/exams/${q.image}`;
            qHtml += `<div class="question-image"><img src="${imgPath}" style="max-width:100%; border-radius:5px;"></div>`;
        }

        qHtml += `<div class="options-grid">`;
        if (q.type === "FILL_IN") {
            qHtml += `<input type="text" class="ans-input" placeholder="Nhập đáp án của bạn...">`;
        } else {
            for (let opt in q.options) {
                if (q.options[opt]) {
                    qHtml += `
                        <label style="display:block; margin: 8px 0; cursor:pointer;">
                            <input type="radio" name="q${q.id}" value="${opt}"> 
                            <strong>${opt}.</strong> ${q.options[opt]}
                        </label>`;
                }
            }
        }
        qHtml += `</div></div><hr style="border: 0.5px solid #eee; margin: 20px 0;">`;
        container.innerHTML += qHtml;
    });

    // Kích hoạt hiển thị công thức Toán (KaTeX)
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.body, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false
        });
    }
}

async function submitExam() {
    const examData = JSON.parse(sessionStorage.getItem('currentExam'));
    const answers = {};
    
    // Thu thập đáp án
    document.querySelectorAll('.question-card').forEach(card => {
        const id = card.getAttribute('data-id');
        const type = card.getAttribute('data-type');
        if (type === "FILL_IN") {
            answers[id] = card.querySelector('.ans-input').value;
        } else {
            const selected = card.querySelector('input[type="radio"]:checked');
            answers[id] = selected ? selected.value : "";
        }
    });

    const res = await submitExamData({
        examId: examData.examId,
        studentName: "Thí sinh tự do", // Bạn có thể thêm ô nhập tên ở index.html
        answers: answers
    });

    if (res.success) {
        alert("Điểm của bạn là: " + res.score);
        window.location.href = 'result.html';
    }
}
