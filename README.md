# 📚 HỆ THỐNG THI TRỰC TUYẾN MÔN TOÁN THPT
## Version 2.1 — Stable ID + Image Path Auto-resolve

---

## 📂 CẤU TRÚC THƯ MỤC

```
project/
│
├── index.html              ← Trang đăng nhập / vào phòng thi
├── exam.html               ← Trang làm bài thi
├── result.html             ← Trang hiển thị kết quả
├── bridge.html             ← Cầu nối dữ liệu lịch sử (iframe)
│
├── config.json             ← Cấu hình API endpoint
│
├── css/
│   ├── style.css           ← CSS dùng cho trang đăng nhập
│   └── exam-style.css      ← CSS dùng cho trang làm bài
│
├── assets/
│   ├── js/
│   │   ├── api-connector.js    ← Kết nối Google Apps Script API
│   │   └── exam-engine.js      ← 💡 Core Engine (xử lý toàn bộ logic bài thi)
│   └── images/             ← (không dùng nữa, xem mục Hình ảnh bên dưới)
│
└── images/
    └── [MÃ ĐỀ]/            ← Thư mục ảnh theo từng đề thi
        ├── cau1.png
        ├── cau2.jpg
        └── ...
```

---

## ⚙️ CẤU TRÚC GOOGLE SHEET (Backend)

### Sheet `Config`
| ExamID | Title | Start_Time | Duration | Late_Code | Status | P1_Max | P2_Max | P3_Max |
|--------|-------|-----------|----------|-----------|--------|--------|--------|--------|
| TOAN12 | Kiểm tra HK1 | 14:00 14/02/2026 | 45 | MUON01 | Active | 3 | 4 | 3 |

### Sheet `Question_Bank`
| ExamID | Type | Content_Root | Content_Sub | Option_A | Option_B | Option_C | Option_D | Correct | Image |
|--------|------|-------------|-------------|----------|----------|----------|----------|---------|-------|
| TOAN12 | MULTIPLE_CHOICE | Câu hỏi... | | A | B | C | D | A | cau1.png |
| TOAN12 | TRUE_FALSE | Cho hàm số... | Mệnh đề a | | | | | TRUE | |
| TOAN12 | FILL_IN | Tính giá trị... | | | | | | 3.5 | |

> Sheet `Results` được tự động tạo khi có bài nộp đầu tiên.

---

## 🖼️ QUẢN LÝ HÌNH ẢNH

**Cấu trúc thư mục:**
```
images/
└── TOAN12/
    ├── cau1.png
    ├── cau5.jpg
    └── hinh_phu.png
```

**Trong Google Sheet, cột `Image` chỉ cần ghi tên file:**
```
cau1.png
```
Hệ thống sẽ tự ghép thành `images/TOAN12/cau1.png`.

**Nếu muốn dùng URL ngoài (ảnh host trên server khác):**
```
https://example.com/hinh/cau1.png
```
Hệ thống nhận diện `http` → giữ nguyên URL, không ghép đường dẫn.

---

## 🔐 LOGIC VÀO THI MUỘN

```
Thời gian:     14:00 ────── 14:10 ───────────── 14:45
                 |             |                   |
               START     LATE_THRESHOLD           END

0–10 phút:     Vào tự do (không cần mã)
10–45 phút:    Vào muộn  (cần mã do giám thị cung cấp)
> 45 phút:     Từ chối   (hết thời gian làm bài)
```

- Mã vào muộn không phân biệt hoa/thường
- Thí sinh vào muộn vẫn được làm đủ thời gian còn lại (không bị trừ thêm)
- Ngưỡng 10 phút được cấu hình tại `LATE_THRESHOLD_MINUTES` trong `code.gs`

---

## 🎲 CƠ CHẾ TRỘN ĐỀ

| Đối tượng | Có trộn? |
|-----------|----------|
| Thứ tự câu Phần 1 | ✅ |
| Thứ tự đáp án A/B/C/D | ✅ |
| Thứ tự nhóm Phần 2 | ✅ |
| Thứ tự ý a/b/c/d trong nhóm | ✅ |
| Thứ tự câu Phần 3 | ✅ |

Đáp án được lưu theo `originalLetter` (A/B/C/D thực trong DB), không theo vị trí hiển thị → chấm điểm luôn đúng dù đề bị trộn.

---

## 🆔 STABLE ID (Cơ chế chống lỗi chấm điểm)

Mỗi câu hỏi được gán ID bất biến `"Q{số hàng}"` (ví dụ: `Q2`, `Q15`) ngay từ lúc đọc từ Sheet.

```
studentAnswers = { "Q2": "A", "Q7": "TRUE", "Q15": "3.5" }
```

Backend tra cứu đúng câu theo ID → không bị nhầm dù câu hỏi được trộn thứ tự.

---

## 💯 THANG ĐIỂM

| Phần | Nội dung | Điểm mặc định | Cấu hình tại |
|------|----------|--------------|--------------|
| Phần 1 | Trắc nghiệm A/B/C/D | 3 điểm | Cột `P1_Max` trong Config |
| Phần 2 | Đúng/Sai (lũy tiến) | 4 điểm | Cột `P2_Max` trong Config |
| Phần 3 | Trả lời ngắn | 3 điểm | Cột `P3_Max` trong Config |

**Cách tính điểm Phần 2 (lũy tiến theo BGD):**

| Số ý đúng / nhóm | Điểm / nhóm |
|:-:|:-:|
| 1 / 4 | 0.10 |
| 2 / 4 | 0.25 |
| 3 / 4 | 0.50 |
| 4 / 4 | 1.00 |

---

## 🔄 LUỒNG HOẠT ĐỘNG

```
[index.html]
    │  Nhập tên / lớp / mã đề
    │  checkExamAccess() → GET API
    │  getQuestions()    → GET API
    │  Lưu vào sessionStorage
    ↓
[exam.html + exam-engine.js]
    │  Đọc sessionStorage
    │  Render câu hỏi (có trộn)
    │  Đếm ngược thời gian
    │  Autosave vào localStorage
    │  submitExam()      → POST API
    │  Lưu kết quả vào sessionStorage
    ↓
[result.html]
    │  Đọc sessionStorage
    │  Hiển thị điểm tổng + chi tiết 3 phần
    │  Lưu log vào localStorage
    ↓
[bridge.html]  (tùy chọn)
    └  Cung cấp dữ liệu lịch sử cho trang thống kê ngoài
```

---

## 🛡️ CÁC CƠ CHẾ AN TOÀN

- **Autosave:** Câu trả lời được lưu localStorage sau mỗi lần chọn → không mất dữ liệu khi reload
- **Khóa phiên:** `startToken = Date.now()` ghi nhận thời điểm vào thi → đồng hồ tiếp tục đúng dù F5
- **Chống nộp 2 lần:** Biến `submitted = true` sau lần nộp đầu tiên
- **Hết giờ tự động:** Đếm ngược 3-2-1 rồi nộp bài tự động
- **Chấm điểm server-side:** Client không bao giờ nhận cột `Correct` từ Sheet → không thể gian lận qua DevTools

---

## 📝 GHI CHÚ PHÁT TRIỂN

**Version:** 2.1
**Ngày cập nhật:** 25/02/2026
**Tác giả:** hxhung + Claude AI

### Thay đổi so với v1.7.1
- `[NEW]` Tự động ghép đường dẫn ảnh `images/[examId]/[file]` — Google Sheet chỉ cần ghi tên file
- `[FIX]` Stable ID cho tất cả câu hỏi (`Q2`, `Q3`...) — chấm điểm đúng dù trộn đề
- `[NEW]` Trộn thứ tự đáp án A/B/C/D và lưu `originalLetter`
- `[NEW]` Thang điểm động đọc từ Config (P1_Max / P2_Max / P3_Max)
- `[FIX]` `normalizeAnswer()` dùng type string nhất quán
- `[FIX]` `saveResultToSheet()` field name khớp với dữ liệu frontend gửi lên
