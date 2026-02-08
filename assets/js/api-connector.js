/**
 * API CONNECTOR - FIXED
 * Kết nối Google Apps Script Backend
 */

const API_URL = "https://script.google.com/macros/s/AKfycbzbs0nKtBDaE1Q4BzkJx3ANFpkp1QzO-K-A6SYT4QMha1OPgJjsBAuVUmxqvtUp7aZTag/exec";

/**
 * Kiểm tra quyền truy cập đề thi
 */
async function checkExamAccess(examId, lateCode = "") {
    const url = `${API_URL}?action=checkAccess&examId=${examId}&lateCode=${encodeURIComponent(lateCode)}`;
    try {
        const res = await fetch(url);
        return await res.json();
    } catch {
        return { success: false, message: "Lỗi kết nối máy chủ." };
    }
}

/**
 * Lấy câu hỏi
 */
async function getQuestions(examId) {
    const url = `${API_URL}?action=getQuestions&examId=${encodeURIComponent(examId)}`;
    try {
        const res = await fetch(url);
        return await res.json();
    } catch {
        return { success: false, message: "Không tải được đề thi." };
    }
}

/**
 * NỘP BÀI – API (đổi tên)
 */
async function submitExamAPI(payload) {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch {
        return { success: false, message: "Lỗi khi nộp bài." };
    }
}
