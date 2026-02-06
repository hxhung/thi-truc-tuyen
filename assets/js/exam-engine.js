/**
 * EXAM ENGINE - FINAL VERSION (v2.0)
 * Tính năng:
 * 1. Tự động chia 3 phần (Trắc nghiệm, Đúng/Sai, Điền khuyết).
 * 2. Xáo trộn thông minh: Giữ cấu trúc nhóm cho Phần II.
 * 3. Hỗ trợ hiển thị ảnh và công thức Toán (KaTeX).
 * 4. Giao diện nộp bài dạng Modal, hiệu ứng Loading và Kết quả Gradient.
 */

/**
 * EXAM ENGINE - FIXED UI VERSION
 * Đã sửa lại cấu trúc HTML sinh ra để khớp với CSS thẩm mỹ.
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;
let sessionData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadConfig().then(() => loadExamData());
});

async function loadConfig() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
    } catch (error) {
        console.error('Config error:', error);
    }
}

async function loadExamData() {
    sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) { 
        alert('Phiên làm việc hết hạn.'); window.location.href = 'index.html'; return; 
    }

    // Set Title
    const titleEl = document.getElementById('exam-title');
    if (titleEl) titleEl.innerText = sessionData.title || `Mã đề: ${sessionData.examId}`;

    if (!examConfig) return;

    try {
        // Fetch Questions
        const url = `${examConfig.api_endpoint}?action=getQuestions&examId=${sessionData.examId}`;
        const response = await fetch(url);
        const res = await response.json();
        
        if (res.success) {
            currentQuestions = res.data;
            const processed = processAndShuffle(currentQuestions);
            renderExam(processed); // Render với cấu trúc HTML chuẩn đẹp
            renderMath();
            startTimer(sessionData.duration);
        } else {
            alert(res.message);
        }
    } catch (e) {
        alert("Lỗi tải đề thi.");
    }
}

// --- LOGIC XỬ LÝ HTML (PHẦN QUAN TRỌNG NHẤT) ---

function renderExam(data) {
    const container = document.getElementById('exam-container');
    container.innerHTML = '';
    let globalIndex = 1;

    // Helper: Tạo ảnh nếu có
    const getImgHTML = (q) => q.image ? 
        `<div class="q-image"><img src="assets/images/exams/${sessionData.examId}/${q.image}" alt="Hình minh họa"></div>` : '';

    // 1. PHẦN TRẮC NGHIỆM
    if (data.part1.length > 0) {
        container.innerHTML += `<div class="exam-section">
            <div class="section-header">PHẦN I: TRẮC NGHIỆM KHÁCH QUAN</div>
            ${data.part1.map(q => `
                <div class="question-item" id="q-${q.id}">
                    <div class="q-content">
                        <b>Câu ${globalIndex++}:</b> ${q.contentSub || q.contentRoot}
                    </div>
                    ${getImgHTML(q)}
                    <div class="options-grid">
                        ${['A','B','C','D'].map(opt => `
                            <label class="option-label">
                                <input type="radio" name="q_${q.id}" value="${opt}" onclick="selectAnswer(${q.id}, '${opt}')">
                                <span><b>${opt}.</b> ${q.options[opt]}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>`;
    }

    // 2. PHẦN ĐÚNG SAI (Render kiểu danh sách dọc đẹp mắt)
    if (data.part2.length > 0) {
        let p2HTML = `<div class="exam-section">
            <div class="section-header">PHẦN II: TRẮC NGHIỆM ĐÚNG SAI</div>`;
        
        data.part2.forEach(group => {
            // Câu dẫn chung
            if (group.root) {
                p2HTML += `<div class="root-title"><b>Câu ${globalIndex++}:</b> ${group.root}</div>`;
            }
            
            // Các ý con
            let subLabel = 97; // 'a'
            group.items.forEach(q => {
                p2HTML += `
                <div class="question-item" style="padding: 10px 20px;">
                    <div class="tf-row">
                        <div class="tf-content">
                            <b>${String.fromCharCode(subLabel++)})</b> ${q.contentSub}
                        </div>
                        <div class="tf-options">
                            <label><input type="radio" name="q_${q.id}" value="T" onclick="selectAnswer(${q.id}, 'T')"> Đúng</label>
                            <label><input type="radio" name="q_${q.id}" value="F" onclick="selectAnswer(${q.id}, 'F')"> Sai</label>
                        </div>
                    </div>
                </div>`;
            });
        });
        p2HTML += `</div>`;
        container.innerHTML += p2HTML;
    }

    // 3. PHẦN TRẢ LỜI NGẮN
    if (data.part3.length > 0) {
        container.innerHTML += `<div class="exam-section">
            <div class="section-header">PHẦN III: TRẢ LỜI NGẮN</div>
            ${data.part3.map(q => `
                <div class="question-item">
                    <div class="q-content">
                        <b>Câu ${globalIndex++}:</b> ${q.contentSub || q.contentRoot}
                    </div>
                    ${getImgHTML(q)}
                    <div style="margin-top: 15px;">
                        <input type="text" class="fill-input" placeholder="Nhập đáp án của bạn..." 
                               onchange="selectAnswer(${q.id}, this.value)">
                    </div>
                </div>
            `).join('')}
        </div>`;
    }
}

// --- CÁC HÀM LOGIC KHÁC (GIỮ NGUYÊN) ---

function processAndShuffle(questions) {
    let part1 = questions.filter(q => q.type === 'MULTIPLE_CHOICE');
    let part2 = questions.filter(q => q.type === 'TRUE_FALSE');
    let part3 = questions.filter(q => q.type === 'FILL_IN');

    shuffleArray(part1);
    shuffleArray(part3);

    const groups = {};
    part2.forEach(q => {
        const key = q.contentRoot || "Common";
        if (!groups[key]) groups[key] = { root: q.contentRoot, items: [] };
        groups[key].items.push(q);
    });
    let groupedPart2 = Object.values(groups);
    shuffleArray(groupedPart2);

    return { part1, part2: groupedPart2, part3 };
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

window.selectAnswer = function(qId, val) { studentAnswers[qId] = val; };

function renderMath() {
    if (window.renderMathInElement) {
        renderMathInElement(document.body, {
            delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}]
        });
    }
}

function startTimer(mins) {
    let sec = mins * 60;
    const timerEl = document.getElementById('timer');
    const interval = setInterval(() => {
        if (sec <= 0) { clearInterval(interval); submitExam(true); return; }
        sec--;
        if (sec < 300) timerEl.style.color = 'red';
        let m = Math.floor(sec/60), s = sec%60;
        timerEl.innerText = `${m}:${s<10?'0':''}${s}`;
    }, 1000);
}

// --- LOGIC NỘP BÀI (MODAL ĐẸP) ---

window.submitExam = async function(force = false) {
    if (!force && !confirm('Bạn có chắc chắn muốn nộp bài?')) return;

    // Show Modal
    const overlay = document.getElementById('result-modal-overlay');
    const body = document.getElementById('modal-body');
    overlay.style.display = 'flex';
    body.innerHTML = `<h3>Đang chấm điểm...</h3><div class="spinner"></div>`;

    try {
        const payload = {
            examId: sessionData.examId,
            studentName: `${sessionData.studentName} - ${sessionData.studentClass}`,
            answers: studentAnswers
        };
        
        const res = await fetch(examConfig.api_endpoint, {
            method: 'POST', body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success) {
            body.innerHTML = `
                <h2 style="color:#333; margin:0">KẾT QUẢ</h2>
                <div class="score-gradient">${result.score}</div>
                <p>Số câu đúng: <b>${result.correctCount}</b> / ${result.totalQuestions}</p>
                <div class="btn-group">
                    <button class="btn-retry" onclick="location.reload()">Làm lại</button>
                    <button class="btn-home" onclick="location.href='index.html'">Thoát</button>
                </div>
            `;
            sessionStorage.removeItem('currentExam');
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        body.innerHTML = `<h3 style="color:red">Lỗi!</h3><p>${e.message}</p><button class="btn-retry" onclick="location.reload()">Thử lại</button>`;
    }
};