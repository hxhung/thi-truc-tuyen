// Khởi tạo khi trang tải xong
window.onload = function() {
    const examData = JSON.parse(sessionStorage.getItem('currentExam'));
    
    if (!examData) {
        alert("Không tìm thấy dữ liệu phiên làm việc!");
        window.location.href = 'index.html';
        return;
    }

    startTimer(examData.remainingMinutes);
    loadQuestions(examData.examId);
};

function startTimer(minutes) {
    let seconds = minutes * 60;
    const timerDisplay = document.getElementById('timer');

    const countdown = setInterval(function() {
        let min = Math.floor(seconds / 60);
        let sec = seconds % 60;

        timerDisplay.innerText = `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;

        if (seconds <= 0) {
            clearInterval(countdown);
            alert("Hết giờ làm bài! Hệ thống tự động nộp bài.");
            submitExam(); // Tự động thu bài
        }
        seconds--;
    }, 1000);
}

function submitExam() {
    // Logic gửi dữ liệu về Google Sheets (doPost)
    alert("Bài thi của bạn đã được ghi nhận!");
    window.location.href = 'result.html';
}
