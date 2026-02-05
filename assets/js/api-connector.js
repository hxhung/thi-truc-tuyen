const API_URL = "https://script.google.com/macros/s/AKfycbzbs0nKtBDaE1Q4BzkJx3ANFpkp1QzO-K-A6SYT4QMha1OPgJjsBAuVUmxqvtUp7aZTag/exec";

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
