/**
 * =====================================================
 * EXAM ENGINE - Version 2.0
 * =====================================================
 * THAY ĐỔI SO VỚI V1:
 *  [FIX]  Stable ID: dùng q.id ("Q2", "Q3"...) thay vì index mảng
 *         → studentAnswers = { "Q2": "A", "Q7": "TRUE", ... }
 *         → Chấm điểm đúng dù câu hỏi bị trộn
 *  [NEW]  Trộn thứ tự câu hỏi trong từng phần (Fisher-Yates)
 *  [NEW]  Trộn thứ tự đáp án A/B/C/D (Phần 1)
 *         → Lưu originalLetter để gửi lên server đúng
 *  [NEW]  Trộn thứ tự ý a/b/c/d trong từng nhóm (Phần 2)
 * =====================================================
 */

// =====================================================
// BIẾN TOÀN CỤC
// =====================================================
let currentQuestions = [];
let studentAnswers   = {};
let sessionData      = null;
let timerInterval    = null;
let timeLeft         = 0;
let submitted        = false;


// =====================================================
// 1. KHỞI TẠO BÀI THI
// =====================================================
window.initExam = function(data) {
    console.log("🚀 Khởi tạo bài thi:", data);

    if (!data || !data.questions) {
        alert("❌ Lỗi: Không có dữ liệu đề thi!");
        window.location.href = 'index.html';
        return;
    }

    sessionData = data;

    // --- LỌC CÂU HỎI THEO MÃ ĐỀ ---
    const allQuestions = data.questions || [];
    let lastContentRoot = "";

    let filtered = allQuestions.filter(q => {
        const qId = String(q.ExamID || q.examId || q.MaDe || "").trim().toLowerCase();
        return qId === String(sessionData.examId).trim().toLowerCase();
    });

    // --- CHUẨN HÓA TYPE & GÁN STABLE ID ---
    currentQuestions = filtered.map(q => {
        // Chuẩn hóa Type
        if (q.Type === 'FILL_IN' || q.Type === 'TuLuan') q.Type = 'SHORT_ANSWER';
        if (q.Type === 'TN_DUNG_SAI')                    q.Type = 'TRUE_FALSE';

        // Kế thừa Content_Root cho TRUE_FALSE nếu thiếu
        if (q.Type === 'TRUE_FALSE') {
            if (q.Content_Root && String(q.Content_Root).trim() !== '') {
                lastContentRoot = q.Content_Root;
            } else {
                q.Content_Root = lastContentRoot;
            }
        }

        // [FIX] Stable ID: dùng q.id từ Backend (v4.1), KHÔNG dùng index mảng
        // Backend trả về q.id = "Q2", "Q3", ... (số hàng thực trong Sheet)
        if (!q.id) {
            // Fallback an toàn nếu Backend cũ chưa có q.id
            console.warn("⚠️ Câu hỏi thiếu q.id, dùng fallback. Hãy đảm bảo Backend v4.1 đã deploy.");
            q.id = "FALLBACK_" + Math.random().toString(36).slice(2);
        }

        return q;
    });

    console.log("✅ Đã load", currentQuestions.length, "câu hỏi");

    // --- THỜI GIAN ---
    let durationMin = parseInt(data.duration) || parseInt(data.Duration) || 60;
    if (isNaN(durationMin) || durationMin <= 0) durationMin = 60;

    renderQuestions();
    startTimer(durationMin);
};


// =====================================================
// 2. SHUFFLE (FISHER-YATES) — KHÔNG THAY ĐỔI MẢNG GỐC
// =====================================================
function shuffle(arr) {
    const a = [...arr]; // Clone, không mutate mảng gốc
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}


// =====================================================
// 3. RENDER GIAO DIỆN CÂU HỎI
// =====================================================
function renderQuestions() {
    const container = document.getElementById('exam-container');
    if (!container) return;

    // Cập nhật tiêu đề
    const titleEl = document.getElementById('exam-title');
    if (titleEl && sessionData) {
        titleEl.innerText = `ĐỀ: ${sessionData.title || sessionData.examId}`;
    }

    // --- PHÂN LOẠI 3 PHẦN ---
    const part1 = currentQuestions.filter(q => q.Type === 'MULTIPLE_CHOICE');
    const part2 = currentQuestions.filter(q => q.Type === 'TRUE_FALSE');
    const part3 = currentQuestions.filter(q => q.Type === 'SHORT_ANSWER');

    // [NEW] Trộn thứ tự câu trong từng phần
    const shuffledPart1 = shuffle(part1);
    const shuffledPart3 = shuffle(part3);

    // [NEW] Trộn nhóm Phần 2, rồi trộn ý trong từng nhóm
    const part2Groups = groupByRoot(part2);
    const shuffledGroups = shuffle(part2Groups).map(group => ({
        root:  group.root,
        items: shuffle(group.items)  // Trộn a/b/c/d trong nhóm
    }));

    let html = '';
    const partTitles = {
        1: "PHẦN 1: TRẮC NGHIỆM KHÁCH QUAN",
        2: "PHẦN 2: TRẮC NGHIỆM ĐÚNG SAI",
        3: "PHẦN 3: TRẢ LỜI NGẮN"
    };

    // --- RENDER PHẦN 1 ---
    if (shuffledPart1.length > 0) {
        html += `<div class="exam-part-card">
                    <div class="part-title">${partTitles[1]}</div>`;

        shuffledPart1.forEach((q, i) => {
            // [NEW] Trộn đáp án A/B/C/D, giữ originalLetter để lưu đúng
            const rawOptions = ['A', 'B', 'C', 'D']
                .map(letter => ({
                    originalLetter: letter,
                    text: q['Option_' + letter] || ''
                }))
                .filter(opt => opt.text.trim() !== '');

            const shuffledOptions = shuffle(rawOptions);
            const savedVal = studentAnswers[q.id] || "";

            html += `<div class="question-item">
                ${buildHeader(i + 1, getMainText(q), getImg(q))}
                <div class="options-grid">
                    ${shuffledOptions.map(opt => {
                        const checked = savedVal === opt.originalLetter ? 'checked' : '';
                        // [FIX] Lưu originalLetter (A/B/C/D thực trong DB), không lưu vị trí hiển thị
                        return `<label class="option-item">
                            <input type="radio"
                                   name="q_${q.id}"
                                   value="${opt.originalLetter}"
                                   ${checked}
                                   onchange="saveAnswer('${q.id}', '${opt.originalLetter}')">
                            <span>${opt.text}</span>
                        </label>`;
                    }).join('')}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    // --- RENDER PHẦN 2 ---
    if (shuffledGroups.length > 0) {
        html += `<div class="exam-part-card">
                    <div class="part-title">${partTitles[2]}</div>`;

        shuffledGroups.forEach((group, groupIdx) => {
            html += `<div class="question-item">
                ${buildHeader(
                    shuffledPart1.length + groupIdx + 1,
                    group.root,
                    null
                )}
                <div class="tf-container" style="margin-top:15px; padding-left:5px;">`;

            group.items.forEach((q, subIdx) => {
                const labelChar = String.fromCharCode(97 + subIdx); // a, b, c, d
                const savedVal  = studentAnswers[q.id] || "";

                html += `<div class="tf-row">
                    <span style="flex:1; font-size:1rem; padding-right:10px;">
                        <b>${labelChar})</b> ${getSubText(q)}
                    </span>
                    <div class="tf-options">
                        <label class="tf-btn">
                            <input type="radio"
                                   name="q_${q.id}"
                                   value="TRUE"
                                   ${savedVal === 'TRUE' ? 'checked' : ''}
                                   onchange="saveAnswer('${q.id}', 'TRUE')">
                            ĐÚNG
                        </label>
                        <label class="tf-btn">
                            <input type="radio"
                                   name="q_${q.id}"
                                   value="FALSE"
                                   ${savedVal === 'FALSE' ? 'checked' : ''}
                                   onchange="saveAnswer('${q.id}', 'FALSE')">
                            SAI
                        </label>
                    </div>
                </div>`;
            });

            html += `</div></div>`;
        });

        html += `</div>`;
    }

    // --- RENDER PHẦN 3 ---
    if (shuffledPart3.length > 0) {
        html += `<div class="exam-part-card">
                    <div class="part-title">${partTitles[3]}</div>`;

        const p3StartIdx = shuffledPart1.length + shuffledGroups.length;

        shuffledPart3.forEach((q, i) => {
            const savedVal = studentAnswers[q.id] || "";

            html += `<div class="question-item">
                ${buildHeader(p3StartIdx + i + 1, getMainText(q), getImg(q))}
                <div class="fill-input-container">
                    <input type="text"
                           class="fill-input"
                           placeholder="Nhập đáp án..."
                           value="${savedVal}"
                           onchange="saveAnswer('${q.id}', this.value)">
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    container.innerHTML = html;

    // Render KaTeX
    if (window.renderMathInElement) {
        try {
            renderMathInElement(container, {
                delimiters: [
                    { left: "$$", right: "$$", display: true  },
                    { left: "$",  right: "$",  display: false }
                ]
            });
        } catch(e) { console.warn("KaTeX error:", e); }
    }
}


// =====================================================
// 4. HELPER — GOM NHÓM TRUE_FALSE THEO CONTENT_ROOT
// =====================================================
function groupByRoot(tfQuestions) {
    const map = new Map(); // Dùng Map để giữ thứ tự chèn

    tfQuestions.forEach(q => {
        const root = String(q.Content_Root || "Nhóm_" + q.id).trim();
        if (!map.has(root)) map.set(root, []);
        map.get(root).push(q);
    });

    return Array.from(map.entries()).map(([root, items]) => ({ root, items }));
}


// =====================================================
// 5. HELPER — LẤY TEXT VÀ ẢNH TỪ OBJECT CÂU HỎI
// =====================================================
function getMainText(q) {
    return q.Content_Root || q.Content || q.Question || q.DeBai || q.NoiDung || "";
}

function getSubText(q) {
    return q.Content_Sub || q.Content || q.Question || "";
}

function getImg(q) {
    return q.Image || q.Image_URL || q.HinhAnh || null;
}

function buildHeader(idx, content, img) {
    return `<div class="question-header">
        <div class="q-badge">Câu ${idx}</div>
        <div class="q-content">
            ${content}
            ${img ? `<div style="margin-top:10px">
                        <img src="${img}" alt="Minh họa" class="question-image">
                     </div>` : ''}
        </div>
    </div>`;
}


// =====================================================
// 6. ĐỒNG HỒ ĐẾM NGƯỢC
// =====================================================
function startTimer(minutes) {
    if (timerInterval) clearInterval(timerInterval);

    // Tính thời gian còn lại (trừ đi thời gian đã trôi qua từ lúc đăng nhập)
    if (sessionData && sessionData.startToken) {
        const elapsed = Math.floor((Date.now() - parseInt(sessionData.startToken)) / 1000);
        timeLeft = (minutes * 60) - elapsed;
    } else {
        timeLeft = minutes * 60;
    }

    if (timeLeft <= 0) {
        submitFinal();
        return;
    }

    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            onTimeUp();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.getElementById('timer');
    if (!el) return;
    if (timeLeft < 0) timeLeft = 0;
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    el.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
    el.style.color = timeLeft < 300 ? 'red' : '';
}

function onTimeUp() {
    // Khóa thao tác
    const container = document.getElementById('exam-container');
    if (container) {
        container.style.pointerEvents = 'none';
        container.style.opacity = '0.5';
    }

    // Modal đếm ngược 3-2-1
    document.body.insertAdjacentHTML('beforeend', `
        <div id="timeout-modal" class="modal-overlay">
            <div class="modal-box">
                <h2 style="color:#e53e3e;">⏰ HẾT GIỜ!</h2>
                <p>Hệ thống đang thu bài...</p>
                <div id="cd-sync" class="countdown-number">3</div>
            </div>
        </div>`);

    let count = 3;
    const cd = setInterval(() => {
        count--;
        const el = document.getElementById('cd-sync');
        if (el) el.innerText = count;
        if (count <= 0) { clearInterval(cd); submitFinal(); }
    }, 1000);
}


// =====================================================
// 7. LƯU & NỘP BÀI
// =====================================================
window.saveAnswer = function(qId, value) {
    // [FIX] Key là q.id ("Q2", "Q7"...) — Stable ID, không phải vị trí hiển thị
    studentAnswers[qId] = value;
    if (!submitted && sessionData) {
        localStorage.setItem(
            `autosave_${sessionData.examId}`,
            JSON.stringify(studentAnswers)
        );
    }
};

window.finishExam = function() {
    if (submitted) return;

    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        if (confirm("Nộp bài ngay?")) submitFinal();
    }
};

window.closeModal = function() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
};

window.submitFinal = async function() {
    if (submitted) return;
    submitted = true;

    if (timerInterval) clearInterval(timerInterval);

    // Ẩn modal xác nhận, hiện modal đang chấm
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) confirmModal.classList.add('hidden');

    const procModal = document.getElementById('processing-modal');
    if (procModal) procModal.classList.remove('hidden');

    try {
        const result = await submitExam({
            examId:       sessionData.examId,
            studentName:  sessionData.studentName,
            studentClass: sessionData.studentClass,
            // [FIX] studentAnswers giờ là { "Q2": "A", "Q7": "TRUE", ... }
            // Backend v4.1 tra cứu answers[q.id] → khớp hoàn toàn
            answers:      studentAnswers,
            usedTime:     (parseInt(sessionData.duration) * 60) - timeLeft
        });

        if (result.success) {
            // Lưu log
            try {
                const logs = JSON.parse(localStorage.getItem('online_exam_logs') || '[]');
                logs.push({
                    timestamp: new Date().toISOString(),
                    session:   sessionData,
                    result:    result
                });
                localStorage.setItem('online_exam_logs', JSON.stringify(logs));
            } catch(e) { console.error("Log error:", e); }

            localStorage.removeItem(`autosave_${sessionData.examId}`);
            sessionStorage.setItem('examResult', JSON.stringify(result));
            window.location.href = 'result.html';
        } else {
            throw new Error(result.message || 'Lỗi server');
        }

    } catch(e) {
        console.error("Lỗi nộp bài:", e);
        if (procModal) procModal.classList.add('hidden');
        alert('❌ Lỗi: ' + e.message + '\nẤn OK để thử nộp lại.');
        submitted = false;
        document.body.style.overflow = 'auto';
    }
};


// =====================================================
// 8. KHỞI ĐỘNG
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    const rawData = sessionStorage.getItem('currentExam');
    if (!rawData) {
        alert('❌ Chưa đăng nhập!');
        window.location.href = 'index.html';
        return;
    }

    try {
        const data = JSON.parse(rawData);

        // Khôi phục autosave nếu có
        const saved = localStorage.getItem(`autosave_${data.examId}`);
        if (saved) {
            studentAnswers = JSON.parse(saved);
            console.log("♻️ Khôi phục autosave:", Object.keys(studentAnswers).length, "câu");
        }

        initExam(data);
    } catch(e) {
        console.error(e);
        window.location.href = 'index.html';
    }
});