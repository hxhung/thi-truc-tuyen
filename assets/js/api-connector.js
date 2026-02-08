/**
 * API CONNECTOR - PHIÊN BẢN HOÀN CHỈNH
 * Kết nối với Google Apps Script Backend
 */

const API_URL = "https://script.google.com/macros/s/AKfycbzbs0nKtBDaE1Q4BzkJx3ANFpkp1QzO-K-A6SYT4QMha1OPgJjsBAuVUmxqvtUp7aZTag/exec";

/**
 * Kiểm tra quyền truy cập đề thi
 */
async function checkExamAccess(examId, lateCode = "") {
    const url = `${API_URL}?action=checkAccess&examId=${examId}&lateCode=${encodeURIComponent(lateCode)}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Lỗi checkExamAccess:", error);
        return { 
            success: false, 
            message: "Lỗi kết nối máy chủ. Vui lòng kiểm tra internet." 
        };
    }
}

/**
 * Lấy danh sách câu hỏi của đề thi
 */
async function getQuestions(examId) {
    const url = `${API_URL}?action=getQuestions&examId=${encodeURIComponent(examId)}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Lỗi getQuestions:", error);
        return { 
            success: false, 
            message: "Không thể tải đề thi. Vui lòng thử lại." 
        };
    }
}

/**
 * Nộp bài thi lên server để chấm điểm
 */
async function submitExam(examData) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8' 
            },
            body: JSON.stringify(examData)
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Lỗi submitExam:", error);
        return { 
            success: false, 
            message: "Lỗi khi nộp bài. Vui lòng thử lại." 
        };
    }
}
