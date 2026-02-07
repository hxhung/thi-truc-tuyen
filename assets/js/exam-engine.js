/**
 * =====================================================
 * EXAM ENGINE - FINAL VERSION v3.0
 * =====================================================
 * Tính năng:
 * 1. Tự động chia 3 phần (Trắc nghiệm, Đúng/Sai, Điền khuyết)
 * 2. Xáo trộn thông minh: Giữ cấu trúc nhóm cho Phần II
 * 3. Hỗ trợ hiển thị ảnh và công thức Toán (KaTeX)
 * 4. Giao diện nộp bài dạng Modal với hiệu ứng
 * 5. Tích hợp localStorage để đồng bộ với statistics.html
 * 6. Auto-save progress (phòng tắt máy)
 * 7. Countdown timer với cảnh báo
 * 
 * Author: hxhung
 * Last Updated: 2025-02-07
 * =====================================================
 */

// =====================================================
// GLOBAL VARIABLES
// =====================================================
let currentQuestions = [];      // Danh sách câu hỏi đã xử lý
let studentAnswers = {};        // Đáp án của học sinh {questionId: answer}
let examConfig = null;          // Config từ config.json
let sessionData = null;         // Dữ liệu phiên thi
let timerInterval = null;       // Interval của đồng hồ đếm ngược
let autoSaveInterval = null;    // Interval của auto-save

// =====================================================
// INITIALIZATION
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    loadConfig().then(() => {
        loadExamData();
        setupAutoSave();
        setupBeforeUnload();
    });
});

/**
 * Load cấu hình từ config.json
 */
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
        console.log('✅ Config loaded:', examConfig);
    } catch (error) {
        console.error('❌ Error loading config:', error);
        alert('Không thể tải cấu hình hệ thống.');
    }
}

/**
 * Load dữ liệu đề thi từ sessionStorage
 */
async function loadExamData() {
    // Lấy dữ liệu từ sessionStorage
    sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    
    if (!sessionData) {
        alert('❌ Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html';
        return;
    }

    // Cập nhật tiêu đề trang
    const titleEl = document.getElementById('exam-title');
    if (titleEl) {
        titleEl.innerText = sessionData.title || sessionData.examId;
    }

    // Kiểm tra config đã load chưa
    if (!examConfig) {
        console.warn('⚠️ Config chưa load, đợi...');
        return;
    }

    try {
        // Kiểm tra xem đã có câu hỏi trong sessionStorage chưa
        if (sessionData.questions && sessionData.questions.length > 0) {
            // Đã có sẵn câu hỏi (pre-loaded từ index.html)
            console.log('✅ Using pre-loaded questions');
            currentQuestions = sessionData.questions;
        } else {
            // Chưa có → Tải từ API
            console.log('📥 Fetching questions from API...');
            const url = `${examConfig.api_endpoint}?action=getQuestions&examId=${sessionData.examId}`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                currentQuestions = result.data;
            } else {
                throw new Error(result.message || 'Không thể tải câu hỏi');
            }
        }

        // Xử lý và render đề thi
        const processedQuestions = processAndShuffle(currentQuestions);
        renderExam(processedQuestions);
        renderMath();
        
        // Khởi động timer
        startTimer(sessionData.duration);
        
        // Load progress cũ (nếu có)
        loadProgress();
        
    } catch (error) {
        console.error('❌ Error loading exam:', error);
        alert('❌ Lỗi tải đề thi: ' + error.message);
    }
}

// =====================================================
// QUESTION PROCESSING & SHUFFLING
// =====================================================

/**
 * Xử lý và xáo trộn câu hỏi theo từng phần
 */
function processAndShuffle(questions) {
    // Phân loại câu hỏi theo type
    let part1 = questions.filter(q => q.type === 'MULTIPLE_CHOICE');
    let part2 = questions.filter(q => q.type === 'TRUE_FALSE');
    let part3 = questions.filter(q => q.type === 'FILL_IN');
    
    // Xáo trộn Part 1 và Part 3
    shuffle(part1);
    shuffle(part3);

    // Nhóm Part 2 theo contentRoot (câu dẫn chung)
    let groups = {};
    part2.forEach(q => {
        const key = q.contentRoot || "Common";
        if (!groups[key]) {
            groups[key] = { 
                root: q.contentRoot, 
                items: [] 
            };
        }
        groups[key].items.push(q);
    });
    
    // Xáo trộn thứ tự các nhóm
    let part2Grouped = Object.values(groups);
    shuffle(part2Grouped);

    return { 
        part1: part1, 
        part2: part2Grouped, 
        part3: part3 
    };
}

/**
 * Thuật toán Fisher-Yates để xáo trộn mảng
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// =====================================================
// RENDER EXAM UI
// =====================================================

/**
 * Render toàn bộ đề thi lên giao diện
 */
function renderExam(data) {
    const container = document.getElementById('exam-container');
    container.innerHTML = '';
    let globalIndex = 1; // Số thứ tự câu hỏi toàn cục

    // Helper: Tạo HTML cho hình ảnh
    const getImageHTML = (question) => {
        if (!question.image) return '';
        return `<div class="q-image">
            <img src="assets/images/exams/${sessionData.examId}/${question.image}" 
                 alt="Hình câu hỏi"
                 onerror="this.style.display='none'">
        </div>`;
    };

    // ===== PHẦN I: TRẮC NGHIỆM ABCD =====
    if (data.part1.length > 0) {
        container.innerHTML += `
        <div class="exam-section">
            <div class="section-header">
                <i class="fas fa-check-circle"></i> PHẦN I. TRẮC NGHIỆM
            </div>
            ${data.part1.map(q => {
                const questionHTML = `
                <div class="question-item">
                    <div class="q-content">
                        <b>Câu ${globalIndex++}:</b> ${q.contentSub || q.contentRoot}
                    </div>
                    ${getImageHTML(q)}
                    <div class="options-list">
                        ${['A','B','C','D'].map(opt => `
                            <label class="option-label">
                                <input 
                                    type="radio" 
                                    name="q_${q.id}" 
                                    value="${opt}" 
                                    onclick="selectAnswer(${q.id}, '${opt}')"
                                >
                                <span><b>${opt}.</b> ${q.options[opt]}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>`;
                return questionHTML;
            }).join('')}
        </div>`;
    }

    // ===== PHẦN II: ĐÚNG SAI =====
    if (data.part2.length > 0) {
        let part2HTML = `
        <div class="exam-section">
            <div class="section-header">
                <i class="fas fa-list-check"></i> PHẦN II. ĐÚNG SAI
            </div>`;
        
        data.part2.forEach(group => {
            // Câu dẫn chung (root)
            if (group.root) {
                part2HTML += `
                <div class="root-title">
                    <b>Câu ${globalIndex++}:</b> ${group.root}
                </div>`;
            }
            
            // Container cho các ý a, b, c, d
            part2HTML += `<div class="question-item" style="padding-top: 5px;">`;
            
            let subLabel = 97; // Mã ASCII của 'a'
            group.items.forEach(q => {
                part2HTML += `
                <div class="tf-row">
                    <div class="tf-content">
                        <b>${String.fromCharCode(subLabel++)})</b> ${q.contentSub}
                    </div>
                    <div class="tf-options">
                        <label>
                            <input 
                                type="radio" 
                                name="q_${q.id}" 
                                value="T" 
                                onclick="selectAnswer(${q.id}, 'T')"
                            > Đúng
                        </label>
                        <label>
                            <input 
                                type="radio" 
                                name="q_${q.id}" 
                                value="F" 
                                onclick="selectAnswer(${q.id}, 'F')"
                            > Sai
                        </label>
                    </div>
                </div>`;
            });
            
            part2HTML += `</div>`; // Đóng question-item
        });
        
        part2HTML += `</div>`; // Đóng exam-section
        container.innerHTML += part2HTML;
    }

    // ===== PHẦN III: TRẢ LỜI NGẮN =====
    if (data.part3.length > 0) {
        container.innerHTML += `
        <div class="exam-section">
            <div class="section-header">
                <i class="fas fa-pen"></i> PHẦN III. TRẢ LỜI NGẮN
            </div>
            ${data.part3.map(q => `
                <div class="question-item">
                    <div class="q-content">
                        <b>Câu ${globalIndex++}:</b> ${q.contentSub || q.contentRoot}
                    </div>
                    ${getImageHTML(q)}
                    <input 
                        type="text" 
                        class="fill-in-input"
                        placeholder="Nhập đáp án..."
                        onchange="selectAnswer(${q.id}, this.value)"
                    >
                </div>
            `).join('')}
        </div>`;
    }
}

/**
 * Render công thức toán học bằng KaTeX
 */
function renderMath() {
    if (window.renderMathInElement) {
        renderMathInElement(document.body, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ],
            throwOnError: false
        });
    }
}

// =====================================================
// ANSWER SELECTION & STORAGE
// =====================================================

/**
 * Lưu đáp án khi học sinh chọn/nhập
 */
window.selectAnswer = function(questionId, answer) {
    studentAnswers[questionId] = answer;
    
    // Visual feedback
    console.log(`✓ Câu ${questionId}: ${answer}`);
    
    // Save progress
    saveProgress();
};

/**
 * Lưu tiến trình làm bài vào localStorage (auto-save)
 */
function saveProgress() {
    const progressData = {
        examId: sessionData.examId,
        studentName: sessionData.studentName,
        answers: studentAnswers,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('exam_progress', JSON.stringify(progressData));
}

/**
 * Load tiến trình làm bài cũ (nếu có)
 */
function loadProgress() {
    const savedProgress = localStorage.getItem('exam_progress');
    
    if (!savedProgress) return;
    
    try {
        const progress = JSON.parse(savedProgress);
        
        // Kiểm tra xem có phải cùng bài thi không
        if (progress.examId !== sessionData.examId || 
            progress.studentName !== sessionData.studentName) {
            return;
        }
        
        // Restore answers
        studentAnswers = progress.answers || {};
        
        // Fill UI with saved answers
        Object.entries(studentAnswers).forEach(([qId, answer]) => {
            const input = document.querySelector(`input[name="q_${qId}"][value="${answer}"]`);
            if (input) {
                input.checked = true;
            } else {
                // Fill-in question
                const textInput = document.querySelector(`input[onchange*="selectAnswer(${qId}"]`);
                if (textInput) {
                    textInput.value = answer;
                }
            }
        });
        
        console.log('✅ Restored progress:', Object.keys(studentAnswers).length, 'answers');
        
    } catch (error) {
        console.error('❌ Error loading progress:', error);
    }
}

/**
 * Setup auto-save mỗi 30 giây
 */
function setupAutoSave() {
    autoSaveInterval = setInterval(() => {
        if (Object.keys(studentAnswers).length > 0) {
            saveProgress();
            console.log('💾 Auto-saved');
        }
    }, 30000); // 30 seconds
}

/**
 * Cảnh báo khi tắt trang (có câu trả lời chưa nộp)
 */
function setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
        if (Object.keys(studentAnswers).length > 0) {
            e.preventDefault();
            e.returnValue = 'Bạn có câu trả lời chưa nộp. Bạn có chắc muốn thoát?';
            return e.returnValue;
        }
    });
}

// =====================================================
// TIMER COUNTDOWN
// =====================================================

/**
 * Khởi động đồng hồ đếm ngược
 */
function startTimer(minutes) {
    let totalSeconds = minutes * 60;
    const timerElement = document.getElementById('timer');
    
    timerInterval = setInterval(() => {
        if (totalSeconds <= 0) {
            clearInterval(timerInterval);
            submitExam(true); // Auto-submit khi hết giờ
            return;
        }
        
        totalSeconds--;
        
        // Cảnh báo khi còn 5 phút
        if (totalSeconds === 300) {
            alert('⏰ Còn 5 phút! Hãy kiểm tra lại bài làm.');
        }
        
        // Đổi màu khi còn dưới 5 phút
        if (totalSeconds < 300) {
            timerElement.style.color = 'red';
            timerElement.style.fontWeight = 'bold';
        }
        
        // Cập nhật UI
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        timerElement.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
    }, 1000);
}

// =====================================================
// SUBMIT EXAM
// =====================================================

/**
 * Nộp bài thi
 * @param {boolean} force - Tự động nộp (không confirm)
 */
window.submitExam = async function(force = false) {
    // Confirm trước khi nộp (trừ khi auto-submit)
    if (!force) {
        const answeredCount = Object.keys(studentAnswers).length;
        const totalCount = currentQuestions.length;
        
        if (answeredCount < totalCount) {
            const unanswered = totalCount - answeredCount;
            if (!confirm(`⚠️ Bạn còn ${unanswered} câu chưa trả lời.\n\nBạn có chắc muốn nộp bài?`)) {
                return;
            }
        } else {
            if (!confirm('✅ Bạn đã hoàn thành tất cả câu hỏi.\n\nNộp bài ngay?')) {
                return;
            }
        }
    }

    // Hiển thị modal loading
    const overlay = document.getElementById('result-modal-overlay');
    const modalBody = document.getElementById('modal-body');
    overlay.style.display = 'flex';
    modalBody.innerHTML = `
        <h3>Đang chấm điểm...</h3>
        <div class="spinner"></div>
        <p style="color: #666; font-size: 14px; margin-top: 10px;">
            Vui lòng đợi trong giây lát
        </p>
    `;

    // Dừng timer và auto-save
    if (timerInterval) clearInterval(timerInterval);
    if (autoSaveInterval) clearInterval(autoSaveInterval);

    try {
        // Chuẩn bị payload
        const payload = {
            examId: sessionData.examId,
            studentName: sessionData.studentName,
            studentClass: sessionData.studentClass,
            answers: studentAnswers
        };

        // Gửi request POST
        const response = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            // ===== TÍCH HỢP LOCALSTORAGE - QUAN TRỌNG! =====
            saveToLocalStorage({
                timestamp: new Date().toISOString(),
                testName: sessionData.title,
                studentName: sessionData.studentName,
                score: result.score,
                correctAnswers: result.correctCount,
                totalQuestions: result.totalQuestions
            });

            // Hiển thị kết quả
            modalBody.innerHTML = `
                <h2 style="color:#333; margin:0">🎉 KẾT QUẢ</h2>
                <div class="score-gradient">${result.score}</div>
                <p style="font-size: 16px; color: #666;">
                    Số câu đúng: <b>${result.correctCount}</b> / ${result.totalQuestions}
                </p>
                <div style="margin-top: 20px;">
                    <button class="btn-retry" onclick="location.reload()">
                        🔄 Làm lại
                    </button>
                    <button class="btn-home" onclick="location.href='index.html'">
                        🏠 Thoát
                    </button>
                </div>
            `;

            // Xóa progress và session
            localStorage.removeItem('exam_progress');
            sessionStorage.removeItem('currentExam');

        } else {
            throw new Error(result.message || 'Lỗi không xác định');
        }

    } catch (error) {
        console.error('❌ Submit error:', error);
        modalBody.innerHTML = `
            <h3 style="color:red">❌ Lỗi!</h3>
            <p>${error.message}</p>
            <button class="btn-retry" onclick="location.reload()">
                🔄 Thử lại
            </button>
        `;
    }
};

// =====================================================
// LOCALSTORAGE INTEGRATION (Để đồng bộ với statistics.html)
// =====================================================

/**
 * Lưu kết quả vào localStorage để statistics.html đọc được
 */
function saveToLocalStorage(resultData) {
    try {
        // Lấy danh sách kết quả cũ
        const existingResults = JSON.parse(localStorage.getItem('exam_results') || '[]');
        
        // Thêm kết quả mới
        existingResults.push(resultData);
        
        // Lưu lại
        localStorage.setItem('exam_results', JSON.stringify(existingResults));
        
        console.log('✅ Saved to localStorage for statistics');
    } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
    }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Kiểm tra trạng thái làm bài
 */
window.getExamStatus = function() {
    const total = currentQuestions.length;
    const answered = Object.keys(studentAnswers).length;
    const percentage = ((answered / total) * 100).toFixed(0);
    
    return {
        total: total,
        answered: answered,
        unanswered: total - answered,
        percentage: percentage
    };
};

/**
 * Debug: Hiển thị tất cả đáp án đã chọn
 */
window.showAnswers = function() {
    console.table(studentAnswers);
    return studentAnswers;
};

/**
 * Debug: Clear progress
 */
window.clearProgress = function() {
    localStorage.removeItem('exam_progress');
    console.log('✅ Progress cleared');
};