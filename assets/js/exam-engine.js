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

/**
 * EXAM ENGINE - PHỤC HỒI GIAO DIỆN & NÂNG CẤP TÍNH NĂNG
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
    } catch (e) { console.error(e); }
}

async function loadExamData() {
    sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) { alert('Hết phiên làm việc.'); window.location.href='index.html'; return; }

    const titleEl = document.getElementById('exam-title');
    if (titleEl) titleEl.innerText = sessionData.title || sessionData.examId;

    if (!examConfig) return;

    try {
        const url = `${examConfig.api_endpoint}?action=getQuestions&examId=${sessionData.examId}`;
        const res = await fetch(url).then(r => r.json());
        
        if (res.success) {
            currentQuestions = res.data;
            const processed = processAndShuffle(currentQuestions);
            renderExam(processed);
            renderMath();
            startTimer(sessionData.duration);
        } else { alert(res.message); }
    } catch (e) { alert("Lỗi tải đề thi."); }
}

// --- HÀM RENDER QUAN TRỌNG: SINH HTML KHỚP VỚI CSS GIAO DIỆN CŨ ---

function renderExam(data) {
    const container = document.getElementById('exam-container');
    container.innerHTML = '';
    let globalIndex = 1;

    // Helper tạo ảnh
    const getImg = (q) => q.image ? `<div class="q-image"><img src="assets/images/exams/${sessionData.examId}/${q.image}"></div>` : '';

    // PHẦN I: TRẮC NGHIỆM
    if (data.part1.length > 0) {
        container.innerHTML += `<div class="exam-section">
            <div class="section-header">PHẦN I. TRẮC NGHIỆM</div>
            ${data.part1.map(q => `
                <div class="question-item">
                    <div class="q-content"><b>Câu ${globalIndex++}:</b> ${q.contentSub || q.contentRoot}</div>
                    ${getImg(q)}
                    <div class="options-list">
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

    // PHẦN II: ĐÚNG SAI (Render kiểu list lồng nhau đẹp mắt)
    if (data.part2.length > 0) {
        let html = `<div class="exam-section"><div class="section-header">PHẦN II. ĐÚNG SAI</div>`;
        
        data.part2.forEach(group => {
            // Câu dẫn chung (màu đen, không đậm)
            if (group.root) html += `<div class="root-title"><b>Câu ${globalIndex++}:</b> ${group.root}</div>`;
            
            // Container chứa các ý a,b,c,d
            html += `<div class="question-item" style="padding-top: 5px;">`;
            let subLabel = 97; // 'a'
            group.items.forEach(q => {
                html += `
                <div class="tf-row">
                    <div class="tf-content"><b>${String.fromCharCode(subLabel++)})</b> ${q.contentSub}</div>
                    <div class="tf-options">
                        <label><input type="radio" name="q_${q.id}" value="T" onclick="selectAnswer(${q.id}, 'T')"> Đúng</label>
                        <label><input type="radio" name="q_${q.id}" value="F" onclick="selectAnswer(${q.id}, 'F')"> Sai</label>
                    </div>
                </div>`;
            });
            html += `</div>`; // Đóng question-item
        });
        html += `</div>`; // Đóng exam-section
        container.innerHTML += html;
    }

    // PHẦN III: TRẢ LỜI NGẮN
    if (data.part3.length > 0) {
        container.innerHTML += `<div class="exam-section">
            <div class="section-header">PHẦN III. TRẢ LỜI NGẮN</div>
            ${data.part3.map(q => `
                <div class="question-item">
                    <div class="q-content"><b>Câu ${globalIndex++}:</b> ${q.contentSub || q.contentRoot}</div>
                    ${getImg(q)}
                    <input type="text" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; margin-top:10px;" 
                        placeholder="Nhập đáp án..." onchange="selectAnswer(${q.id}, this.value)">
                </div>
            `).join('')}
        </div>`;
    }
}

// --- LOGIC XỬ LÝ (KHÔNG ĐỔI) ---

function processAndShuffle(questions) {
    let p1 = questions.filter(q => q.type === 'MULTIPLE_CHOICE');
    let p2 = questions.filter(q => q.type === 'TRUE_FALSE');
    let p3 = questions.filter(q => q.type === 'FILL_IN');
    
    // Shuffle P1, P3
    shuffle(p1); shuffle(p3);

    // Group P2
    let groups = {};
    p2.forEach(q => {
        let k = q.contentRoot || "Common";
        if(!groups[k]) groups[k] = { root: q.contentRoot, items: [] };
        groups[k].items.push(q);
    });
    let p2Grouped = Object.values(groups);
    shuffle(p2Grouped);

    return { part1: p1, part2: p2Grouped, part3: p3 };
}

function shuffle(arr) { for(let i=arr.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
window.selectAnswer = (id, val) => { studentAnswers[id] = val; };
function renderMath() { if(window.renderMathInElement) renderMathInElement(document.body, { delimiters: [{left:"$$", right:"$$", display:true}, {left:"$", right:"$", display:false}] }); }

// --- LOGIC NỘP BÀI (MODAL) ---
window.submitExam = async function(force = false) {
    // ... (các đoạn code kiểm tra confirm giữ nguyên) ...

    const overlay = document.getElementById('result-modal-overlay');
    const body = document.getElementById('modal-body');
    overlay.style.display = 'flex';
    body.innerHTML = `<h3>Đang chấm điểm...</h3><div class="spinner"></div>`;

    try {
        // --- SỬA ĐOẠN NÀY ---
        // Thay vì gộp tên, ta gửi 2 trường riêng biệt
        const payload = {
            examId: sessionData.examId,
            studentName: sessionData.studentName,   // Gửi Tên
            studentClass: sessionData.studentClass, // Gửi Lớp riêng
            answers: studentAnswers
        };
        // --------------------

        const res = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            body: JSON.stringify(payload)
        }).then(r => r.json());

        // ... (Phần xử lý hiển thị kết quả giữ nguyên) ...
        if (res.success) {
             body.innerHTML = `
                <h2 style="color:#333; margin:0">KẾT QUẢ</h2>
                <div class="score-gradient">${res.score}</div>
                <p>Số câu đúng: <b>${res.correctCount}</b> / ${res.totalQuestions}</p>
                <div class="btn-group">
                    <button class="btn-retry" onclick="location.reload()">Làm lại</button>
                    <button class="btn-home" onclick="location.href='index.html'">Thoát</button>
                </div>
            `;
            sessionStorage.removeItem('currentExam');
        } else {
            throw new Error(res.message);
        }
    } catch (e) {
        body.innerHTML = `<h3 style="color:red">Lỗi!</h3><p>${e.message}</p><button class="btn-retry" onclick="location.reload()">Thử lại</button>`;
    }
};
function startTimer(m) {
    let s = m * 60;
    const el = document.getElementById('timer');
    const int = setInterval(() => {
        if(s<=0) { clearInterval(int); submitExam(true); return; }
        s--;
        if(s<300) el.style.color = 'red';
        let min=Math.floor(s/60), sec=s%60;
        el.innerText = `${min}:${sec<10?'0':''}${sec}`;
    }, 1000);
}