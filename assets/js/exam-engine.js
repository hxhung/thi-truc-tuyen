/**
 * EXAM ENGINE - PHIÊN BẢN FINAL
 * Tính năng:
 * 1. Tự động chia 3 phần (I, II, III).
 * 2. Giao diện Đúng/Sai nằm ngang, thẳng hàng.
 * 3. Tự động sinh nhãn a, b, c, d (ẩn nhãn cũ trong data).
 * 4. TRỘN CÂU HỎI THÔNG MINH (Giữ cấu trúc nhóm cho Phần II).
 */

let currentQuestions = [];
let studentAnswers = {};
let examConfig = null;

// --- 1. KHỞI TẠO & LOAD DỮ LIỆU ---

document.addEventListener('DOMContentLoaded', loadExamData);

// Load cấu hình từ config.json
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        examConfig = await response.json();
        return examConfig.api_endpoint;
    } catch (error) {
        console.error('Không thể load config:', error);
        return null;
    }
}

async function loadExamData() {
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    if (!sessionData) { 
        alert('Không tìm thấy thông tin kỳ thi. Vui lòng đăng nhập lại.');
        window.location.href = 'index.html'; 
        return; 
    }

    const API_URL = await loadConfig();
    if (!API_URL) return;

    const examId = sessionData.examId;
    const titleElement = document.getElementById('exam-title');
    if (titleElement) titleElement.innerText = `Đề thi: ${examId}`;

    try {
        const apiUrl = `${API_URL}?action=getQuestions&examId=${examId}`;
        const response = await fetch(apiUrl);
        const res = await response.json();

        if (res.success) {
            currentQuestions = res.data;
            // Kích hoạt trộn và render
            renderQuestions(currentQuestions, examId);
            startTimer(sessionData.remainingMinutes || 60);
        } else {
            document.getElementById('questions').innerHTML = `<p class="error">Lỗi: ${res.message}</p>`;
        }
    } catch (error) {
        console.error(error);
        document.getElementById('questions').innerHTML = `<p class="error">Lỗi kết nối máy chủ.</p>`;
    }
}

// --- 2. LOGIC TRỘN & RENDER ---

// Hàm xáo trộn mảng (Fisher-Yates Shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function renderQuestions(questions, examId) {
    const container = document.getElementById('questions');
    container.innerHTML = ''; 

    // 1. Phân loại câu hỏi
    // Lưu ý: Dùng let để có thể gán lại sau khi trộn
    let part1 = questions.filter(q => q.type === "MULTIPLE_CHOICE");
    let part2 = questions.filter(q => q.type === "TRUE_FALSE");
    let part3 = questions.filter(q => q.type === "FILL_IN");

    // 2. THỰC HIỆN TRỘN CÂU HỎI
    
    // Phần I và III: Trộn ngẫu nhiên hoàn toàn
    shuffleArray(part1);
    shuffleArray(part3);

    // Phần II: Trộn thông minh (Giữ nhóm Root)
    if (part2.length > 0) {
        // Bước 2.1: Gom nhóm các câu hỏi cùng ContentRoot
        const groups = {};
        part2.forEach(q => {
            // Nếu không có root thì dùng key tạm
            const rootKey = q.contentRoot ? q.contentRoot.trim() : "___NO_ROOT___";
            if (!groups[rootKey]) groups[rootKey] = [];
            groups[rootKey].push(q);
        });

        // Bước 2.2: Chuyển object thành mảng các nhóm
        const groupList = Object.values(groups);

        // Bước 2.3: Trộn thứ tự các nhóm (Câu 1 có thể đảo vị trí cho Câu 2)
        shuffleArray(groupList);

        // Bước 2.4: Trộn thứ tự ý a,b,c,d TRONG mỗi nhóm (Tùy chọn)
        groupList.forEach(group => shuffleArray(group));

        // Bước 2.5: Làm phẳng lại thành danh sách để render
        part2 = groupList.flat();
    }

    // 3. HÀM RENDER CHI TIẾT
    const getCleanContent = (content) => {
        if (!content) return "";
        return content.replace(/^(?:đáp án|ý|câu)?\s*(?:\d+|[a-z])\s*[\.\)]\s*/yi, '').trim();
    };

    const generateQuestionHtml = (q, indexGlobal, subLabel = null) => {
        let qHtml = `<div class="question-item" data-id="${q.id}" style="border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px;">`;
        
        let labelDisplay = "";
        let contentDisplay = q.contentSub || q.content || "";

        if (subLabel) {
            // Phần II: Hiển thị a, b, c, d
            labelDisplay = `<strong style="color: #007bff; margin-right: 5px;">${subLabel})</strong>`;
            let cleaned = getCleanContent(contentDisplay);
            if (cleaned !== "") contentDisplay = cleaned; 
        } else {
            // Phần I, III: Hiển thị Câu 1, Câu 2...
            labelDisplay = `<strong style="color: #007bff;">Câu ${indexGlobal}:</strong>`;
        }

        qHtml += `<div style="font-size: 16px; line-height: 1.5;">${labelDisplay} ${contentDisplay}</div>`;

        if (q.image) {
            qHtml += `<div style="margin:15px 0;"><img src="assets/images/exams/${examId}/${q.image}" style="max-width:100%; border-radius:4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.style.display='none'"></div>`;
        }

        // Render Input
        if (q.type === "MULTIPLE_CHOICE") {
            qHtml += `<div class="options-group" style="margin-top: 10px;">`;
            ['A', 'B', 'C', 'D'].forEach(key => {
                if (q.options[key]) {
                    qHtml += `<label style="display:flex; align-items:center; margin:8px 0; cursor:pointer;">
                        <input type="radio" name="q${q.id}" value="${key}" onchange="studentAnswers[${q.id}]='${key}'" style="margin-right: 10px;"> 
                        <span><strong>${key}.</strong> ${q.options[key]}</span>
                    </label>`;
                }
            });
            qHtml += `</div>`;
        } 
        else if (q.type === "TRUE_FALSE") {
            qHtml += `<div style="display: flex !important; flex-direction: row !important; gap: 40px; margin-top: 10px; margin-left: 25px;">
                <label style="cursor:pointer; display: flex; align-items: center; width: auto !important; margin: 0 !important;">
                    <input type="radio" name="q${q.id}" value="Đúng" onchange="studentAnswers[${q.id}]='Đúng'" style="margin-right: 8px;"> 
                    <span style="font-weight: 500;">Đúng</span>
                </label>
                <label style="cursor:pointer; display: flex; align-items: center; width: auto !important; margin: 0 !important;">
                    <input type="radio" name="q${q.id}" value="Sai" onchange="studentAnswers[${q.id}]='Sai'" style="margin-right: 8px;"> 
                    <span style="font-weight: 500;">Sai</span>
                </label>
            </div>`;
        } 
        else if (q.type === "FILL_IN") {
            qHtml += `<div style="margin-top:15px;">
                <input type="text" placeholder="Nhập kết quả..." style="width:100%; max-width: 300px; padding:10px; border:2px solid #e0e0e0; border-radius:4px;" oninput="studentAnswers[${q.id}]=this.value.trim()">
            </div>`;
        }

        qHtml += `</div>`;
        return qHtml;
    };

    // 4. RENDER GIAO DIỆN CÁC PHẦN

    if (part1.length > 0) {
        let html = `<div class="exam-section" style="background:#fff; margin-bottom:30px;"><div class="section-header" style="font-weight:bold; font-size:18px; color:#333; border-bottom:2px solid #007bff; padding-bottom:10px; margin-bottom:20px;">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.</div>`;
        part1.forEach((q, idx) => html += generateQuestionHtml(q, idx + 1, null));
        html += `</div>`;
        container.innerHTML += html;
    }

    if (part2.length > 0) {
        let html = `<div class="exam-section" style="background:#fff; margin-bottom:30px;"><div class="section-header" style="font-weight:bold; font-size:18px; color:#333; border-bottom:2px solid #007bff; padding-bottom:10px; margin-bottom:20px;">PHẦN II. Câu trắc nghiệm đúng sai.</div>`;
        
        let lastRoot = "INITIAL_VAL"; 
        let rootCount = 0;
        let subLabelIndex = 0;
        const subLabels = ['a', 'b', 'c', 'd', 'e', 'f'];

        part2.forEach((q) => {
            const currentRoot = q.contentRoot ? q.contentRoot.trim() : "";
            // Logic phát hiện câu dẫn mới (do đã được group nên các câu cùng root luôn nằm cạnh nhau)
            if (currentRoot !== lastRoot) {
                rootCount++;
                subLabelIndex = 0; 
                if(currentRoot) {
                     html += `<div class="root-title" style="margin-top:25px; margin-bottom:15px; font-weight:bold; font-size: 17px; color:#0056b3; background:#f8f9fa; padding:10px; border-left:4px solid #0056b3;">Câu ${rootCount}. ${currentRoot}</div>`;
                }
                lastRoot = currentRoot;
            }
            const labelChar = subLabels[subLabelIndex] || '-';
            html += generateQuestionHtml(q, null, labelChar);
            subLabelIndex++;
        });

        html += `</div>`;
        container.innerHTML += html;
    }

    if (part3.length > 0) {
        let html = `<div class="exam-section" style="background:#fff; margin-bottom:30px;"><div class="section-header" style="font-weight:bold; font-size:18px; color:#333; border-bottom:2px solid #007bff; padding-bottom:10px; margin-bottom:20px;">PHẦN III. Câu trắc nghiệm trả lời ngắn.</div>`;
        part3.forEach((q, idx) => html += generateQuestionHtml(q, idx + 1, null));
        html += `</div>`;
        container.innerHTML += html;
    }

    if (window.renderMathInElement) { 
        renderMathInElement(document.body, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] }); 
    }
}

// --- 3. SUBMIT & TIMER ---

function startTimer(min) {
    let sec = min * 60;
    const timerElement = document.getElementById('timer');
    if (!timerElement) return;
    const countdown = setInterval(() => {
        if (sec <= 0) {
            clearInterval(countdown);
            alert('Hết giờ!');
            submitExam();
            return;
        }
        sec--;
        let m = Math.floor(sec/60), s = sec % 60;
        if (sec < 300) timerElement.style.color = 'red';
        timerElement.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
    }, 1000);
}

async function submitExam() {
    const sessionData = JSON.parse(sessionStorage.getItem('currentExam'));
    const total = currentQuestions.length;
    const answered = Object.keys(studentAnswers).length;

    if (answered < total) {
        if (!confirm(`Bạn mới trả lời ${answered}/${total} câu. Nộp bài?`)) return;
    }

    try {
        const response = await fetch(examConfig.api_endpoint, {
            method: 'POST',
            body: JSON.stringify({
                examId: sessionData.examId,
                studentName: sessionData.studentName || 'Học sinh',
                answers: studentAnswers
            })
        });
        const result = await response.json();
        if (result.success) {
            alert(`Điểm: ${result.score}/10`);
            sessionStorage.setItem('examResult', JSON.stringify(result));
        } else {
            alert(result.message);
        }
    } catch (e) { alert('Lỗi nộp bài'); }
}

document.getElementById('submitBtn')?.addEventListener('click', submitExam);
