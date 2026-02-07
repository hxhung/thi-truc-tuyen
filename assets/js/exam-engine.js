/**
 * =====================================================
 * EXAM ENGINE - FINAL VERSION v3.1
 * =====================================================
 * Cập nhật:
 * - Modal kết quả đẹp với breakdown 3 phần
 * - Hiển thị điểm từng phần với progress bar
 * - Animation mượt mà
 * - Giữ nguyên các nút cũ
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let sessionData = null;
let timerInterval = null;
let autoSaveInterval = null;

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

async function loadExamData() {
    sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    
    if (!sessionData) {
        alert('❌ Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html';
        return;
    }

    const titleEl = document.getElementById('exam-title');
    if (titleEl) {
        titleEl.innerText = sessionData.title || sessionData.examId;
    }

    if (!examConfig) {
        console.warn('⚠️ Config chưa load, đợi...');
        return;
    }

    try {
        if (sessionData.questions && sessionData.questions.length > 0) {
            console.log('✅ Using pre-loaded questions');
            currentQuestions = sessionData.questions;
        } else {
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

        const processedQuestions = processAndShuffle(currentQuestions);
        renderExam(processedQuestions);
        renderMath();
        startTimer(sessionData.duration);
        loadProgress();
        
    } catch (error) {
        console.error('❌ Error loading exam:', error);
        alert('❌ Lỗi tải đề thi: ' + error.message);
    }
}

// =====================================================
// QUESTION PROCESSING & SHUFFLING
// =====================================================

function processAndShuffle(questions) {
    let part1 = questions.filter(q => q.type === 'MULTIPLE_CHOICE');
    let part2 = questions.filter(q => q.type === 'TRUE_FALSE');
    let part3 = questions.filter(q => q.type === 'FILL_IN');
    
    shuffle(part1);
    shuffle(part3);

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
    
    let part2Grouped = Object.values(groups);
    shuffle(part2Grouped);

    return { 
        part1: part1, 
        part2: part2Grouped, 
        part3: part3 
    };
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// =====================================================
// RENDER EXAM UI
// =====================================================

function renderExam(data) {
    const container = document.getElementById('exam-container');
    container.innerHTML = '';
    let globalIndex = 1;

    const getImageHTML = (question) => {
        if (!question.image) return '';
        return `<div class="q-image">
            <img src="assets/images/exams/${sessionData.examId}/${question.image}" 
                 alt="Hình câu hỏi"
                 onerror="this.style.display='none'">
        </div>`;
    };

    // PHẦN I: TRẮC NGHIỆM
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

    // PHẦN II: ĐÚNG SAI
    if (data.part2.length > 0) {
        let part2HTML = `
        <div class="exam-section">
            <div class="section-header">
                <i class="fas fa-list-check"></i> PHẦN II. ĐÚNG SAI
            </div>`;
        
        data.part2.forEach(group => {
            if (group.root) {
                part2HTML += `
                <div class="root-title">
                    <b>Câu ${globalIndex++}:</b> ${group.root}
                </div>`;
            }
            
            part2HTML += `<div class="question-item" style="padding-top: 5px;">`;
            
            let subLabel = 97;
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
            
            part2HTML += `</div>`;
        });
        
        part2HTML += `</div>`;
        container.innerHTML += part2HTML;
    }

    // PHẦN III: TRẢ LỜI NGẮN
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

window.selectAnswer = function(questionId, answer) {
    studentAnswers[questionId] = answer;
    console.log(`✓ Câu ${questionId}: ${answer}`);
    saveProgress();
};

function saveProgress() {
    const progressData = {
        examId: sessionData.examId,
        studentName: sessionData.studentName,
        answers: studentAnswers,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('exam_progress', JSON.stringify(progressData));
}

function loadProgress() {
    const savedProgress = localStorage.getItem('exam_progress');
    
    if (!savedProgress) return;
    
    try {
        const progress = JSON.parse(savedProgress);
        
        if (progress.examId !== sessionData.examId || 
            progress.studentName !== sessionData.studentName) {
            return;
        }
        
        studentAnswers = progress.answers || {};
        
        Object.entries(studentAnswers).forEach(([qId, answer]) => {
            const input = document.querySelector(`input[name="q_${qId}"][value="${answer}"]`);
            if (input) {
                input.checked = true;
            } else {
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

function setupAutoSave() {
    autoSaveInterval = setInterval(() => {
        if (Object.keys(studentAnswers).length > 0) {
            saveProgress();
            console.log('💾 Auto-saved');
        }
    }, 30000);
}

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

function startTimer(minutes) {
    let totalSeconds = minutes * 60;
    const timerElement = document.getElementById('timer');
    
    timerInterval = setInterval(() => {
        if (totalSeconds <= 0) {
            clearInterval(timerInterval);
            submitExam(true);
            return;
        }
        
        totalSeconds--;
        
        if (totalSeconds === 300) {
            alert('⏰ Còn 5 phút! Hãy kiểm tra lại bài làm.');
        }
        
        if (totalSeconds < 300) {
            timerElement.style.color = 'red';
            timerElement.style.fontWeight = 'bold';
        }
        
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        timerElement.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
    }, 1000);
}

// =====================================================
// SUBMIT EXAM - MODAL MỚI ĐẸP HƠN
// =====================================================

// Gán vào window để HTML gọi được
window.submitExam = async function(force = false) {
    if (!force) {
        const total = currentQuestions.length;
        const answered = Object.keys(studentAnswers).length;
        if (answered < total) {
            if (!confirm(`Bạn mới làm ${answered}/${total} câu. Chắc chắn nộp bài?`)) return;
        } else {
            if (!confirm("Bạn có chắc chắn muốn nộp bài?")) return;
        }
    }

    const submitBtn = document.querySelector('button[onclick="submitExam()"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang nộp...';
        submitBtn.disabled = true;
    }

    try {
        const payload = JSON.stringify({
            examId: sessionData.examId,
            studentName: sessionData.studentName || 'Thí sinh tự do',
            studentClass: localStorage.getItem('lastStudentClass') || 'N/A',
            answers: studentAnswers,
            startTime: sessionData.startTime,
            submitTime: new Date().toISOString()
        });

        const response = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload
        });

        const result = await response.json();

        if (result.success) {
            // Xóa dữ liệu tạm
            sessionStorage.removeItem('currentExam');
            localStorage.removeItem('exam_progress');
            
            // --- SỬA ĐÚNG CHỖ NÀY: GỌI MODAL THAY VÌ ALERT ---
            showResultModal(result); 
            
        } else {
            throw new Error(result.message || "Lỗi xử lý từ Server");
        }

    } catch (error) {
        alert("Lỗi nộp bài: " + error.message);
        if (submitBtn) {
            submitBtn.innerHTML = 'NỘP BÀI';
            submitBtn.disabled = false;
        }
    }
};

/**
 * Tạo HTML cho modal kết quả đẹp mắt
 */
function createResultModal(result) {
    const breakdown = result.breakdown || {};
    const part1Score = breakdown.part1 || 0;
    const part2Score = breakdown.part2 || 0;
    const part3Score = breakdown.part3 || 0;
    
    // Tính phần trăm
    const part1Percent = (part1Score / 3) * 100;
    const part2Percent = (part2Score / 4) * 100;
    const part3Percent = (part3Score / 3) * 100;
    
    // Màu sắc theo điểm
    const getScoreColor = (score, max) => {
        const percent = (score / max) * 100;
        if (percent >= 80) return '#28a745'; // Xanh
        if (percent >= 65) return '#17a2b8'; // Xanh dương
        if (percent >= 50) return '#ffc107'; // Vàng
        return '#dc3545'; // Đỏ
    };
    
    return `
        <div class="result-container">
            <!-- Header -->
            <div class="result-header">
                <h2 style="margin: 0; color: #333; font-size: 24px;">
                    🎉 KẾT QUẢ BÀI THI
                </h2>
                <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">
                    ${sessionData.studentName} - ${sessionData.studentClass}
                </p>
            </div>

            <!-- Điểm tổng -->
            <div class="total-score-section">
                <div class="score-circle">
                    <div class="score-value">${result.score}</div>
                    <div class="score-label">/ 10 điểm</div>
                </div>
            </div>

            <!-- Breakdown từng phần -->
            <div class="breakdown-section">
                <h3 style="font-size: 16px; color: #555; margin: 0 0 15px 0; text-align: center;">
                    📊 Chi tiết từng phần
                </h3>
                
                <!-- Phần I -->
                <div class="score-part">
                    <div class="part-header">
                        <span class="part-name">Phần I - Trắc nghiệm</span>
                        <span class="part-score" style="color: ${getScoreColor(part1Score, 3)}">
                            ${part1Score.toFixed(2)} / 3
                        </span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${part1Percent}%; background: ${getScoreColor(part1Score, 3)}"></div>
                    </div>
                </div>

                <!-- Phần II -->
                <div class="score-part">
                    <div class="part-header">
                        <span class="part-name">Phần II - Đúng/Sai</span>
                        <span class="part-score" style="color: ${getScoreColor(part2Score, 4)}">
                            ${part2Score.toFixed(2)} / 4
                        </span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${part2Percent}%; background: ${getScoreColor(part2Score, 4)}"></div>
                    </div>
                </div>

                <!-- Phần III -->
                <div class="score-part">
                    <div class="part-header">
                        <span class="part-name">Phần III - Điền khuyết</span>
                        <span class="part-score" style="color: ${getScoreColor(part3Score, 3)}">
                            ${part3Score.toFixed(2)} / 3
                        </span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${part3Percent}%; background: ${getScoreColor(part3Score, 3)}"></div>
                    </div>
                </div>
            </div>

            <!-- Thống kê -->
            <div class="stats-section">
                <div class="stat-item">
                    <span class="stat-icon">✅</span>
                    <span class="stat-text">${result.correctCount} câu đúng</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">📝</span>
                    <span class="stat-text">${result.totalQuestions} câu hỏi</span>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons">
                <button class="btn-retry" onclick="location.reload()">
                    🔄 Làm lại
                </button>
                <button class="btn-home" onclick="location.href='index.html'">
                    🏠 Trang chủ
                </button>
            </div>
        </div>

        <style>
            .result-container {
                width: 100%;
                max-width: 500px;
            }

            .result-header {
                text-align: center;
                padding-bottom: 20px;
                border-bottom: 2px solid #f0f0f0;
            }

            .total-score-section {
                padding: 30px 0;
                text-align: center;
            }

            .score-circle {
                display: inline-block;
                width: 140px;
                height: 140px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
                animation: scaleIn 0.5s ease-out;
            }

            @keyframes scaleIn {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }

            .score-value {
                font-size: 48px;
                font-weight: 800;
                color: white;
                line-height: 1;
            }

            .score-label {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.9);
                margin-top: 5px;
            }

            .breakdown-section {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 12px;
                margin: 20px 0;
            }

            .score-part {
                margin-bottom: 15px;
            }

            .score-part:last-child {
                margin-bottom: 0;
            }

            .part-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
            }

            .part-name {
                font-size: 14px;
                color: #555;
                font-weight: 500;
            }

            .part-score {
                font-size: 15px;
                font-weight: 700;
            }

            .progress-bar {
                height: 10px;
                background: #e0e0e0;
                border-radius: 10px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                background: #667eea;
                transition: width 0.8s ease-out;
                animation: fillProgress 0.8s ease-out;
            }

            @keyframes fillProgress {
                from { width: 0; }
            }

            .stats-section {
                display: flex;
                justify-content: center;
                gap: 30px;
                padding: 15px 0;
                border-top: 1px solid #e0e0e0;
                border-bottom: 1px solid #e0e0e0;
            }

            .stat-item {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .stat-icon {
                font-size: 20px;
            }

            .stat-text {
                font-size: 14px;
                color: #666;
                font-weight: 500;
            }

            .action-buttons {
                display: flex;
                gap: 10px;
                margin-top: 25px;
            }

            .btn-retry, .btn-home {
                flex: 1;
                padding: 12px 20px;
                border: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            }

            .btn-retry {
                background: #f8f9fa;
                color: #333;
                border: 2px solid #dee2e6;
            }

            .btn-retry:hover {
                background: #e9ecef;
                transform: translateY(-2px);
            }

            .btn-home {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }

            .btn-home:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
            }

            @media (max-width: 480px) {
                .score-circle {
                    width: 120px;
                    height: 120px;
                }

                .score-value {
                    font-size: 40px;
                }

                .action-buttons {
                    flex-direction: column;
                }

                .stats-section {
                    flex-direction: column;
                    gap: 10px;
                }
            }
        </style>
    `;
}

// =====================================================
// LOCALSTORAGE INTEGRATION
// =====================================================

function saveToLocalStorage(resultData) {
    try {
        const existingResults = JSON.parse(localStorage.getItem('exam_results') || '[]');
        existingResults.push(resultData);
        localStorage.setItem('exam_results', JSON.stringify(existingResults));
        console.log('✅ Saved to localStorage for statistics');
    } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
    }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

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

window.showAnswers = function() {
    console.table(studentAnswers);
    return studentAnswers;
};

window.clearProgress = function() {
    localStorage.removeItem('exam_progress');
    console.log('✅ Progress cleared');
};
function showResultModal(data) {
    // Nếu backend chưa trả về details thì để mặc định là 0
    const p1 = data.details ? data.details.p1 : 0;
    const p2 = data.details ? data.details.p2 : 0;
    const p3 = data.details ? data.details.p3 : 0;

    const modalHtml = `
        <div class="modal-overlay">
            <div class="result-card">
                <h2 style="margin:0; color:#333;">KẾT QUẢ BÀI THI</h2>
                <div class="score-big">${data.score}</div>
                <div style="color:#666; margin-bottom:15px;">Tổng điểm (Thang 10)</div>
                
                <div class="score-details">
                    <div class="detail-row"><span>Phần I (Trắc nghiệm):</span><strong>${p1} đ</strong></div>
                    <div class="detail-row"><span>Phần II (Đúng/Sai):</span><strong>${p2} đ</strong></div>
                    <div class="detail-row" style="border:none;"><span>Phần III (Điền số):</span><strong>${p3} đ</strong></div>
                </div>

                <button class="btn-finish" onclick="window.location.href='index.html'">VỀ TRANG CHỦ</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
