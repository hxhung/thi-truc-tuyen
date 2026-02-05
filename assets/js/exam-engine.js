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
    questions.forEach((q, idx) => {
        let qHtml = `<div class="question-card" data-id="${q.id}" data-type="${q.type}">
            <p><strong>Câu ${idx + 1}:</strong> ${q.content}</p>`;
        
        if (q.image) qHtml += `<img src="assets/images/exams/${q.image}" class="img-fluid">`;

        if (q.type === "FILL_IN") {
            qHtml += `<input type="text" class="ans-input" placeholder="Đáp án...">`;
        } else {
            for (let opt in q.options) {
                if (q.options[opt]) {
                    qHtml += `<label><input type="radio" name="q${q.id}" value="${opt}"> ${opt}. ${q.options[opt]}</label><br>`;
                }
            }
        }
        qHtml += `</div><hr>`;
        container.innerHTML += qHtml;
    });

    // Gọi KaTeX render công thức Toán
    renderMathInElement(document.body, { delimiters: [{left: "$", right: "$", display: false}] });
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
