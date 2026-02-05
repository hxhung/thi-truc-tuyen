// Đường dẫn API duy nhất từ Google Apps Script của bạn
const API_URL = "https://script.google.com/macros/s/AKfycbwq1ehhQY2rC8jF9UpEVrZGI1zSlk4SQRGUfwOeZYs4ptPDnZXbtdZpPufcW5S5hnXppA/exec";

// Hàm kiểm tra quyền vào thi (Dùng cho index.html)
async function checkExamAccess(examId, lateCode = "") {
    const url = `${API_URL}?action=checkAccess&examId=${examId}&lateCode=${lateCode}`;
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error("Lỗi kết nối API:", error);
        return { success: false, message: "Lỗi kết nối máy chủ." };
    }
}

// Hàm lấy danh sách câu hỏi (Dùng cho exam.html)
async function getQuestions(examId) {
    const url = `${API_URL}?action=getQuestions&examId=${examId}`;
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error("Lỗi lấy đề thi:", error);
        return { success: false, message: "Không thể tải đề thi." };
    }
}

// Hàm nộp bài (Dùng cho exam.html - gửi dữ liệu dạng POST)
async function submitExamData(payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error("Lỗi nộp bài:", error);
        return { success: false, message: "Nộp bài thất bại." };
    }
}
