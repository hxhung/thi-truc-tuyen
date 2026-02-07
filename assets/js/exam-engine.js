/**
 * EXAM ENGINE - PHIÊN BẢN FIX TOÀN DIỆN (UI + DATA + HISTORY)
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let sessionData = null;
let timerInterval = null;

// --- 1. KHỞI TẠO ---
document.addEventListener('DOMContentLoaded', () => {
    loadConfig().then(() => {
        loadExamData();
        injectLoadingStyles(); // Tự động thêm CSS cho màn hình chờ
    });
});

async function loadConfig() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
    } catch (error) {
        alert('Lỗi tải cấu hình!');
    }
}

async function loadExamData() {
    sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) {
        window.location.href = 'index.html';
        return;
    }
    // Render câu hỏi và timer ở đây (giữ nguyên logic render cũ của bạn nếu có)
    // ...
    
    // Khôi phục tên thí sinh từ LocalStorage nếu Session bị mất
    if (!sessionData.studentName) {
        sessionData.studentName = localStorage.getItem('lastStudentName') || "Học sinh";
    }
}

// --- 2. HÀM TẠO CSS CHO LOADING (Không cần sửa file .css) ---
function injectLoadingStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        #loading-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255, 255, 255, 0.95);
            z-index: 99999; display: flex; flex-direction: column;
            justify-content: center; align-items: center;
        }
        .spinner {
            width: 60px; height: 60px;
            border: 6px solid #f3f3f3; border-top: 6px solid #007bff;
            border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;
        }
        .loading-msg { font-size: 18px; font-weight: bold; color: #333; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
}

// --- 3. HÀM NỘP BÀI CHUẨN ---
window.submitExam = async function(force = false) {
    // 1. Hỏi xác nhận
    if (!force) {
        if (!confirm('Bạn có chắc chắn muốn nộp bài?')) return;
    }

    // 2. HIỆN MÀN HÌNH CHỜ (Loading Overlay)
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-msg">Đang chấm điểm... Vui lòng đợi!</div>
    `;
    document.body.appendChild(overlay);

    try {
        // 3. Chuẩn bị dữ liệu
        // Lấy thông tin mới nhất từ localStorage để đảm bảo không bị null
        const sName = sessionData.studentName || localStorage.getItem('lastStudentName') || "Thí sinh";
        const sClass = localStorage.getItem('lastStudentClass') || "";

        const payload = JSON.stringify({
            examId: sessionData.examId,
            studentName: sName,
            studentClass: sClass, // Gửi lớp lên Server
            answers: studentAnswers,
            startTime: sessionData.startTime,
            submitTime: new Date().toISOString()
        });

        // 4. Gửi request
        const response = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload
        });

        const result = await response.json();

        // 5. Xử lý thành công
        if (result.success) {
            // A. Lưu lịch sử (Sửa lỗi ngày giờ cho statistics.html)
            saveToHistory({
                testName: sessionData.title || result.examId,
                examId: result.examId,
                studentName: sName,
                score: result.score,
                date: new Date().toISOString() // Lưu định dạng chuẩn ISO
            });

            // B. Lưu kết quả để hiển thị trang result
            // Gán lại tên/lớp vào result để trang sau đọc được
            result.studentName = sName;
            result.studentClass = sClass;
            sessionStorage.setItem('examResult', JSON.stringify(result));

            // C. Dọn dẹp và Chuyển trang
            sessionStorage.removeItem('currentExam');
            localStorage.removeItem('exam_progress');
            window.location.href = 'result.html'; 
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        // Nếu lỗi thì tắt màn hình chờ để báo lỗi
        if(document.getElementById('loading-overlay')) {
            document.getElementById('loading-overlay').remove();
        }
        alert("Lỗi nộp bài: " + error.message);
    }
};

// Hàm lưu lịch sử vào LocalStorage
function saveToHistory(record) {
    try {
        const oldData = JSON.parse(localStorage.getItem('exam_results') || '[]');
        oldData.push(record);
        localStorage.setItem('exam_results', JSON.stringify(oldData));
    } catch (e) { console.error(e); }
}
