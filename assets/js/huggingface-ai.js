/**
 * ============================================================
 * HUGGING FACE AI MODULE v1.0
 * Kết nối Hugging Face Inference API từ trình duyệt
 * Dùng cho website Thi Trực Tuyến C3PBChau
 * ============================================================
 */

const HuggingFaceAI = (() => {

    // ----------------------------------------------------------
    // CẤU HÌNH
    // ----------------------------------------------------------

    const HF_API_BASE = "https://api-inference.huggingface.co/v1/chat/completions";

    /**
     * Danh sách model ưu tiên miễn phí công cộng (Free Serverless API)
     * Thử lần lượt nếu model trước không phản hồi hoặc bận
     */
    const MODELS = [
        "Qwen/Qwen2.5-Coder-32B-Instruct",
        "Qwen/Qwen2.5-7B-Instruct",
        "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
        "HuggingFaceH4/zephyr-7b-beta",
        "mistralai/Mistral-7B-Instruct-v0.2"
    ];

    /**
     * Token Hugging Face dự phòng (Đã được chuyển ra file cấu hình hf_config.json ngoài luồng git)
     */
    let DEFAULT_TOKEN = "";

    // Tự động tải token cấu hình nếu file hf_config.json tồn tại ở root
    fetch('hf_config.json')
        .then(res => res.json())
        .then(cfg => {
            if (cfg && cfg.hf_token) {
                DEFAULT_TOKEN = cfg.hf_token;
                console.log("[HF-AI] Đã nạp cấu hình token từ file hf_config.json");
            }
        })
        .catch(() => {
            // Không tìm thấy cấu hình ngoài, dùng token trong localStorage hoặc người dùng tự nhập
        });

    const SYSTEM_PROMPT = `Bạn là trợ lý AI thông minh hỗ trợ học sinh trung học phổ thông môn Toán.
Khi học sinh hỏi về bài thi, hãy:
- Giải thích rõ ràng, dễ hiểu bằng tiếng Việt
- Hướng dẫn từng bước cụ thể
- Khuyến khích học sinh và đề xuất cách cải thiện
- Khi viết công thức Toán, dùng ký hiệu rõ ràng (không cần LaTeX)
Luôn trả lời bằng tiếng Việt, thân thiện và tích cực.`;

    // ----------------------------------------------------------
    // TRẠNG THÁI NỘI BỘ
    // ----------------------------------------------------------

    let _token = null;
    let _model = MODELS[0];
    let _history = [];
    let _initialized = false;

    // ----------------------------------------------------------
    // ĐỌC TOKEN
    // ----------------------------------------------------------

    /**
     * Lấy HF Token theo thứ tự:
     * 1. localStorage (người dùng đã lưu trước đó)
     * 2. Nhúng trực tiếp trong config (nếu có)
     */
    function loadToken() {
        // 1. Ưu tiên từ localStorage
        const saved = localStorage.getItem("hf_token");
        if (saved && saved.startsWith("hf_")) {
            _token = saved;
            return true;
        }
        // 2. Nhúng trực tiếp trong cấu hình (Token dự phòng của hệ thống/trường học)
        if (typeof DEFAULT_TOKEN !== "undefined" && DEFAULT_TOKEN && DEFAULT_TOKEN.startsWith("hf_")) {
            _token = DEFAULT_TOKEN;
            return true;
        }
        return false;
    }

    function saveToken(token) {
        _token = token.trim();
        localStorage.setItem("hf_token", _token);
    }

    function clearToken() {
        _token = null;
        localStorage.removeItem("hf_token");
    }

    function hasToken() {
        return !!_token;
    }

    // ----------------------------------------------------------
    // KIỂM TRA MODEL
    // ----------------------------------------------------------

    async function testModel(model) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(HF_API_BASE, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: "Hi" }],
                    max_tokens: 5
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            // res.ok hoặc 503 (model đang khởi động) đều chấp nhận token hợp lệ
            return res.ok || res.status === 503;
        } catch {
            return false;
        }
    }

    async function chooseModel() {
        for (const model of MODELS) {
            const ok = await testModel(model);
            if (ok) {
                _model = model;
                console.log(`[HF-AI] Sử dụng model: ${model}`);
                return true;
            }
        }
        // Dự phòng mặc định model đầu tiên nếu các request test bị timeout/CORS
        _model = MODELS[0];
        console.log(`[HF-AI] Sử dụng model dự phòng mặc định: ${_model}`);
        return true;
    }

    // ----------------------------------------------------------
    // KHỞI TẠO
    // ----------------------------------------------------------

    /**
     * Khởi tạo AI với token
     * @param {string} token - HF Token (hf_...)
     * @returns {Promise<{success: boolean, model?: string, error?: string}>}
     */
    async function init(token) {
        if (token) saveToken(token);
        if (!_token) loadToken();

        if (!_token) {
            return { success: false, error: "Chưa có Token" };
        }

        // Kiểm tra model
        const modelOk = await chooseModel();
        if (!modelOk) {
            return { success: false, error: "Token không hợp lệ hoặc không thể kết nối" };
        }

        resetHistory();
        _initialized = true;
        return { success: true, model: _model };
    }

    // ----------------------------------------------------------
    // QUẢN LÝ LỊCH SỬ
    // ----------------------------------------------------------

    function resetHistory(context = "") {
        const systemContent = context
            ? `${SYSTEM_PROMPT}\n\nNGỮ CẢNH BÀI THI:\n${context}`
            : SYSTEM_PROMPT;

        _history = [
            { role: "system", content: systemContent }
        ];
    }

    function getHistory() {
        return [..._history];
    }

    function getMessageCount() {
        // Không tính system message
        return _history.filter(m => m.role !== "system").length;
    }

    // ----------------------------------------------------------
    // GỬI TIN NHẮN (có streaming)
    // ----------------------------------------------------------

    /**
     * Gửi câu hỏi đến AI và nhận phản hồi dạng stream
     * @param {string} question - Câu hỏi của người dùng
     * @param {function} onChunk - Callback nhận từng đoạn text (streaming)
     * @param {function} onDone  - Callback khi hoàn tất (nhận toàn bộ answer)
     * @param {function} onError - Callback khi lỗi
     */
    async function askStream(question, onChunk, onDone, onError) {
        if (!_initialized) {
            onError && onError("AI chưa được khởi tạo. Vui lòng kết nối trước.");
            return;
        }

        // Thêm câu hỏi vào history
        _history.push({ role: "user", content: question });

        try {
            const res = await fetch(HF_API_BASE, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: _model,
                    messages: _history,
                    max_tokens: 1024,
                    stream: true
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }

            // Đọc stream
            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullAnswer = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop(); // Giữ lại dòng chưa hoàn chỉnh

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === "data: [DONE]") continue;
                    if (!trimmed.startsWith("data: ")) continue;

                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const delta = json.choices?.[0]?.delta?.content || "";
                        if (delta) {
                            fullAnswer += delta;
                            onChunk && onChunk(delta, fullAnswer);
                        }
                    } catch {
                        // Bỏ qua dòng lỗi parse
                    }
                }
            }

            // Lưu vào history
            _history.push({ role: "assistant", content: fullAnswer });
            onDone && onDone(fullAnswer);

        } catch (err) {
            // Nếu stream thất bại → thử model dự phòng khác trong danh sách
            console.warn("[HF-AI] Stream thất bại với model:", _model, err.message);
            const currentIdx = MODELS.indexOf(_model);
            if (currentIdx !== -1 && currentIdx < MODELS.length - 1) {
                _model = MODELS[currentIdx + 1];
                console.log("[HF-AI] Thử lại với model dự phòng tiếp theo:", _model);
                _history.pop(); // Xóa tin nhắn user vừa thêm để thử lại
                return askStream(question, onChunk, onDone, onError);
            }
            await askNonStream(question, onChunk, onDone, onError);
        }
    }

    /**
     * Gửi câu hỏi (không stream) - fallback
     */
    async function askNonStream(question, onChunk, onDone, onError) {
        // Kiểm tra xem tin nhắn user cuối cùng đã trùng với câu hỏi chưa, nếu trùng thì không push tiếp
        const lastMsg = _history[_history.length - 1];
        if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== question) {
            _history.push({ role: "user", content: question });
        }

        try {
            const res = await fetch(HF_API_BASE, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: _model,
                    messages: _history,
                    max_tokens: 1024
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }

            const data = await res.json();
            const answer = data.choices?.[0]?.message?.content || "(Không có phản hồi)";

            _history.push({ role: "assistant", content: answer });

            onChunk && onChunk(answer, answer);
            onDone && onDone(answer);

        } catch (err) {
            // Xóa user message bị lỗi khỏi history
            if (_history[_history.length - 1]?.role === "user") {
                _history.pop();
            }
            onError && onError(err.message || "Lỗi không xác định");
        }
    }

    /**
     * Gửi câu hỏi không stream (Promise-based)
     * @returns {Promise<string>} Câu trả lời
     */
    function ask(question) {
        return new Promise((resolve, reject) => {
            askStream(question, null, resolve, reject);
        });
    }

    // ----------------------------------------------------------
    // THÔNG TIN
    // ----------------------------------------------------------

    function getModelName() {
        return _model;
    }

    function isReady() {
        return _initialized;
    }

    // ----------------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------------

    return {
        init,
        ask,
        askStream,
        resetHistory,
        getHistory,
        getMessageCount,
        getModelName,
        isReady,
        hasToken,
        loadToken,
        saveToken,
        clearToken
    };

})();

// Export cho môi trường module (nếu cần)
if (typeof module !== "undefined" && module.exports) {
    module.exports = HuggingFaceAI;
}
