# 📦 HỆ THỐNG THI TRỰC TUYẾN - PACKAGE HOÀN CHỈNH
## Version 1.7.1 - Fixed & Enhanced

---

## 📋 MỤC LỤC

1. [Giới thiệu](#giới-thiệu)
2. [Danh sách file](#danh-sách-file)
3. [Cấu trúc thư mục](#cấu-trúc-thư-mục)
4. [Hướng dẫn cài đặt](#hướng-dẫn-cài-đặt)
5. [Tính năng đã sửa](#tính-năng-đã-sửa)
6. [Tính năng mới](#tính-năng-mới)
7. [Test checklist](#test-checklist)

---

## 🎯 GIỚI THIỆU

Package này chứa **TOÀN BỘ FILE** đã được sửa lỗi và bổ sung tính năng mới cho hệ thống thi trực tuyến môn Toán THPT.

**Các vấn đề đã khắc phục:**
- ✅ Lỗi exam-engine.js thiếu logic render câu hỏi
- ✅ Lỗi không lưu đáp án
- ✅ Lỗi timer không chạy
- ✅ Lỗi hiển thị kết quả sai
- ✅ Lỗi import script trong exam.html
- ✅ Lỗi cấu trúc dữ liệu localStorage

**Tính năng mới:**
- ✅ Logic vào thi muộn hoàn chỉnh
- ✅ Kiểm tra thời gian tự động
- ✅ Yêu cầu mã vào muộn
- ✅ Cho đủ thời gian làm bài (dù vào muộn)

---

## 📁 DANH SÁCH FILE

### 🔴 CORE FILES (Bắt buộc phải thay)

| File | Mô tả | Trạng thái |
|------|-------|-----------|
| **GOOGLE_APPS_SCRIPT_FIXED_WITH_LATE_LOGIC.js** | Backend với logic vào muộn | ⭐ MỚI |
| **api-connector.js** | Kết nối API | ✅ ĐÃ SỬA |
| **exam-engine.js** | Core engine thi | ✅ ĐÃ SỬA |
| **exam.html** | Trang làm bài | ✅ ĐÃ SỬA |
| **result.html** | Trang kết quả | ✅ ĐÃ SỬA |

### 🟢 SUPPORT FILES (Dùng file gốc)

| File | Mô tả | Trạng thái |
|------|-------|-----------|
| **index.html** | Trang đăng nhập | ⚪ GIỮ NGUYÊN |
| **statistics.html** | Trang thống kê | ⚪ GIỮ NGUYÊN |
| **style.css** | CSS chung | ⚪ GIỮ NGUYÊN |
| **config.json** | Cấu hình API | ⚠️ CẬP NHẬT URL |

### 📚 DOCUMENTATION FILES

| File | Mô tả |
|------|-------|
| **README_FULL.md** | File này - Hướng dẫn tổng hợp |
| **HUONG_DAN_KHAC_PHUC.md** | Hướng dẫn khắc phục lỗi cơ bản |
| **HUONG_DAN_TRIEN_KHAI_VAO_MUON.md** | Hướng dẫn triển khai logic vào muộn |
| **LOGIC_TINH_GIO_VAO_MUON.md** | Phân tích 2 phương án tính giờ |
| **PHAN_TICH_LOGIC_VAO_THI_MUON.md** | Phân tích logic vào muộn hiện tại |

---

## 📂 CẤU TRÚC THỨ MỤC

```
your-project/
│
├── index.html              ← Trang đăng nhập (GIỮ NGUYÊN)
├── exam.html               ← Trang làm bài (THAY MỚI)
├── result.html             ← Trang kết quả (THAY MỚI)
├── statistics.html         ← Trang thống kê (GIỮ NGUYÊN)
├── style.css               ← CSS chung (GIỮ NGUYÊN)
├── config.json             ← Cấu hình API (CẬP NHẬT URL)
│
└── assets/
    └── js/
        ├── api-connector.js    ← Kết nối API (THAY MỚI)
        └── exam-engine.js      ← Core engine (THAY MỚI)
```

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT

### BƯỚC 1: Backup dự án cũ

```bash
# Tạo folder backup
mkdir backup_$(date +%Y%m%d)

# Copy toàn bộ file cũ
cp -r your-project/* backup_$(date +%Y%m%d)/
```

### BƯỚC 2: Cập nhật Backend (Google Apps Script)

1. Mở Google Sheets chứa database
2. Vào **Extensions** → **Apps Script**
3. Xóa toàn bộ code cũ
4. Copy code từ `GOOGLE_APPS_SCRIPT_FIXED_WITH_LATE_LOGIC.js`
5. Paste vào Apps Script
6. Nhấn **Ctrl + S** (Save)
7. Nhấn **Deploy** → **Manage deployments**
8. Chọn deployment → **Edit** → **New version** → **Deploy**
9. Copy **Web app URL**


### BƯỚC 5: Kiểm tra sheet Config

Đảm bảo sheet **Config** có đúng 6 cột:

| A: Exam_ID | B: Title | C: Start_Time | D: Duration | E: Late_Code | F: Status |
|------------|----------|---------------|-------------|--------------|-----------|
| TOAN10 | Đề Toán 10 | 2026-02-10 14:00:00 | 45 | ABC123 | Active |

**Quan trọng:**
- Start_Time: `YYYY-MM-DD HH:MM:SS`
- Late_Code: Không được trống, ít nhất 4 ký tự
- Status: `Active` hoặc `Closed`

---

## 🔧 TÍNH NĂNG ĐÃ SỬA

### 1. exam-engine.js ⭐ (Lỗi nghiêm trọng)

**Trước:**
- ❌ Thiếu hàm `renderAllQuestions()`
- ❌ Thiếu hàm `startTimer()`
- ❌ Thiếu hàm `saveAnswer()`
- ❌ Lưu lịch sử sai format

**Sau:**
- ✅ Render đầy đủ 3 phần (Trắc nghiệm, Đúng/Sai, Điền số)
- ✅ Timer đếm ngược chính xác
- ✅ Lưu đáp án real-time
- ✅ Lưu lịch sử đúng format
- ✅ Loading overlay khi nộp bài
- ✅ Hỗ trợ KaTeX render toán

### 2. api-connector.js

**Trước:**
- ❌ Thiếu hàm `submitExam()`

**Sau:**
- ✅ Bổ sung hàm `submitExam()` gửi POST
- ✅ Error handling đầy đủ
- ✅ Encode URL parameters

### 3. exam.html

**Trước:**
- ❌ Import sai `<script src="config.json">`
- ❌ CSS thiếu class

**Sau:**
- ✅ Xóa import config.json
- ✅ Import script đúng thứ tự
- ✅ CSS đầy đủ và responsive

### 4. result.html

**Trước:**
- ❌ Đọc sai cấu trúc JSON
- ❌ Điểm hiển thị 0.0

**Sau:**
- ✅ Đọc đúng `{score, details: {p1, p2, p3}}`
- ✅ Hiển thị tên từ session/localStorage
- ✅ Gradient theo mức điểm
- ✅ Animation mượt

---

## ⭐ TÍNH NĂNG MỚI

### 1. Logic vào thi muộn (Backend)

**Cơ chế:**
```
Thời gian:           14:00 ------- 14:10 -------------- 14:45
                      |             |                      |
                    START      LATE_THRESHOLD            END
                      
0-10 phút:          Vào tự do (không cần mã)
10-45 phút:         Vào muộn (cần mã vào muộn)
> 45 phút:          Từ chối (hết giờ)
```

**Tính năng:**
- ✅ Kiểm tra thời gian tự động
- ✅ Yêu cầu mã vào muộn khi > 10 phút
- ✅ Cho đủ thời gian làm bài (Phương án 1)
- ✅ Không phân biệt hoa/thường mã
- ✅ Log chi tiết trong Apps Script

### 2. UI vào muộn (Frontend)

**Tự động hiện/ẩn:**
- Backend trả `status: "REQUIRE_CODE"` → Hiện ô nhập mã
- Nhập mã đúng → Cho vào thi
- Nhập mã sai → Báo lỗi, yêu cầu nhập lại

---

## ✅ TEST CHECKLIST

### Test cơ bản (Sau khi cài đặt)

- [ ] **Test 1:** Vào index.html → Nhập thông tin → "Bắt đầu thi"
- [ ] **Test 2:** Trang exam.html hiển thị câu hỏi đầy đủ
- [ ] **Test 3:** Timer đếm ngược chạy đúng
- [ ] **Test 4:** Chọn đáp án → Câu hỏi có viền xanh
- [ ] **Test 5:** Nhấn "Nộp bài" → Hiện loading → Chuyển result.html
- [ ] **Test 6:** result.html hiển thị điểm đúng
- [ ] **Test 7:** Vào statistics.html → Biểu đồ hiện đúng

### Test logic vào muộn

**Setup:** Tạo 1 đề thi với:
- Start_Time: Giờ hiện tại + 5 phút
- Duration: 45
- Late_Code: TEST123
- Status: Active

**Test case:**

- [ ] **Case 1:** Vào trước giờ bắt đầu → Báo "Chưa đến giờ thi"
- [ ] **Case 2:** Vào đúng giờ (0-10 phút) → Cho vào không cần mã
- [ ] **Case 3:** Vào muộn (15 phút), không nhập mã → Hiện ô nhập mã
- [ ] **Case 4:** Nhập mã sai → Báo "Mã sai"
- [ ] **Case 5:** Nhập mã đúng → Cho vào, timer = 45 phút
- [ ] **Case 6:** Vào sau khi hết giờ → Báo "Đã hết giờ"

---

## 🐛 XỬ LÝ LỖI

### Lỗi 1: Không hiển thị câu hỏi

**Giải pháp:**
1. F12 → Console → Xem lỗi
2. Kiểm tra `sessionStorage.getItem('currentExam')`
3. Nếu null → Vấn đề ở index.html hoặc API

### Lỗi 2: Timer không chạy

**Giải pháp:**
1. F12 → Console → Tìm lỗi JavaScript
2. Kiểm tra file exam-engine.js đã thay đúng chưa

### Lỗi 3: Điểm hiển thị 0.0

**Giải pháp:**
1. F12 → Console → Gõ:
```javascript
const result = JSON.parse(sessionStorage.getItem('examResult'));
console.log(result);
```
2. Kiểm tra cấu trúc có `score` và `details` không

### Lỗi 4: Không hiện ô nhập mã vào muộn

**Giải pháp:**
1. Kiểm tra Backend đã deploy lại chưa
2. F12 → Network → Xem response có `status: "REQUIRE_CODE"` không

---

## 📊 GIÁM SÁT & DEBUG

### Xem log Backend

1. Mở Apps Script Editor
2. Vào **Executions** (menu trái)
3. Click execution gần nhất
4. Xem logs:

```
=== CHECK ACCESS DEBUG ===
Now: 2026-02-10T07:15:00.000Z
Start: 2026-02-10T07:00:00.000Z
End: 2026-02-10T07:45:00.000Z
Late threshold: 2026-02-10T07:10:00.000Z
✅ LATE ENTRY - Correct code, granted full time
```

### Xem log Frontend

```javascript
// F12 → Console
console.log('Current exam:', JSON.parse(sessionStorage.getItem('currentExam')));
console.log('Answers:', studentAnswers);
console.log('Time left:', timeLeft);
```

---

## 🔄 NÂNG CẤP SAU NÀY

### Đổi sang Phương án 2 (Kết thúc cùng lúc)

Đọc file `LOGIC_TINH_GIO_VAO_MUON.md` → Phần "Phương án 2"

### Thay đổi thời gian cho phép vào tự do

Sửa trong Backend:
```javascript
const LATE_THRESHOLD_MINUTES = 10; // Đổi thành 5, 15, 20...
```

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:

1. **Đọc file tương ứng:**
   - Lỗi cơ bản → `HUONG_DAN_KHAC_PHUC.md`
   - Vào muộn → `HUONG_DAN_TRIEN_KHAI_VAO_MUON.md`
   - Tính giờ → `LOGIC_TINH_GIO_VAO_MUON.md`

2. **Kiểm tra:**
   - Console (F12)
   - Network Tab
   - Apps Script Executions

3. **Test lại từng bước** theo checklist

---

## 📝 NOTES

- **Frontend files** (HTML/JS) tương thích với Backend cũ và mới
- **Không cần** sửa statistics.html, index.html, style.css
- **Phải xóa** localStorage sau khi cài đặt
- **Phải deploy** lại Backend sau khi paste code

---

## ✅ CHECKLIST TRIỂN KHAI

- [ ] Đã backup toàn bộ dự án cũ
- [ ] Đã paste code mới vào Apps Script
- [ ] Đã deploy lại Web App
- [ ] Đã copy Web App URL
- [ ] Đã thay file exam.html
- [ ] Đã thay file result.html
- [ ] Đã thay file api-connector.js
- [ ] Đã thay file exam-engine.js
- [ ] Đã cập nhật config.json
- [ ] Đã kiểm tra sheet Config có đủ 6 cột
- [ ] Đã xóa localStorage
- [ ] Đã test 7 test case cơ bản
- [ ] Đã test 6 test case vào muộn

---

**Version:** 1.7.1 (Fixed & Enhanced)  
**Date:** 09/02/2026  
**Author:** hxhung + Claude AI

**🎉 Chúc bạn triển khai thành công!**
