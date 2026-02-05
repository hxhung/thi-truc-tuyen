const API_URL = "https://script.google.com/macros/s/AKfycbwO7wkbbtbnxnnN5LOmM_AXBcPpjz3ksSQHDkmQmFu8kM3xzLUflLh7-0-5P4_jadbIEw/exec";

async function checkExamAccess(examId, lateCode = "") {
    const url = `${API_URL}?action=checkAccess&examId=${examId}&lateCode=${lateCode}`;
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error("Lỗi:", error);
        return { success: false, message: "Lỗi kết nối máy chủ." };
    }
}

async function getQuestions(examId) {
    const url = `${API_URL}?action=getQuestions&examId=${examId}`;
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { success: false, message: "Không thể tải đề thi." };
    }
}
