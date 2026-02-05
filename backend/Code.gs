/**
 * GOOGLE APPS SCRIPT - HỆ THỐNG THI TRỰC TUYẾN (BẢN ĐẦY ĐỦ)
 */

// 1. XỬ LÝ CÁC YÊU CẦU LẤY DỮ LIỆU (GET)
function doGet(e) {
  const action = e.parameter.action;
  const examId = e.parameter.examId;
  const lateCodeInput = e.parameter.lateCode;
  const now = new Date();

  // Kiểm tra quyền vào thi & mã vào muộn
  if (action === "checkAccess") {
    return checkExamAccess(examId, lateCodeInput, now);
  }
  
  // Lấy danh sách câu hỏi (Giấu đáp án)
  if (action === "getQuestions") {
    return getExamQuestions(examId);
  }
  
  return res({ success: false, message: "Hành động không hợp lệ." });
}

// 2. XỬ LÝ NỘP BÀI VÀ CHẤM ĐIỂM (POST)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const examId = data.examId;
    const studentName = data.studentName;
    const answers = data.answers; // Dạng: { "1": "A", "2": "Đúng", "3": "15" }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Question_Bank");
    const qData = sheet.getDataRange().getValues();
    
    let score = 0;
    let totalQuestions = 0;
    let details = [];

    // Chấm điểm dựa trên Question_Bank
    for (let i = 1; i < qData.length; i++) {
      if (qData[i][0] == examId) {
        totalQuestions++;
        const questionId = i; // ID là số dòng
        const correctAnswer = String(qData[i][7]).trim().toUpperCase();
        const studentAnswer = String(answers[questionId] || "").trim().toUpperCase();

        if (studentAnswer === correctAnswer) {
          score++;
        }
      }
    }

    const finalScore = (score / totalQuestions) * 10;

    // Lưu kết quả vào sheet Results
    const resSheet = ss.getSheetByName("Results") || ss.insertSheet("Results");
    if (resSheet.getLastRow() === 0) {
      resSheet.appendRow(["Thời gian", "Họ tên", "Mã đề", "Số câu đúng", "Tổng câu", "Điểm hệ 10"]);
    }
    resSheet.appendRow([new Date(), studentName, examId, score, totalQuestions, finalScore.toFixed(2)]);

    return res({ 
      success: true, 
      score: finalScore.toFixed(2), 
      message: "Nộp bài thành công!" 
    });

  } catch (error) {
    return res({ success: false, message: "Lỗi xử lý nộp bài: " + error.message });
  }
}

// --- CÁC HÀM BỔ TRỢ ---

function getExamQuestions(examId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Question_Bank");
  const data = sheet.getDataRange().getValues();
  const questions = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == examId) {
      questions.push({
        id: i,
        type: data[i][1],
        content: data[i][2],
        options: { A: data[i][3], B: data[i][4], C: data[i][5], D: data[i][6] },
        image: data[i][8]
      });
    }
  }
  return res({ success: true, data: questions });
}

function checkExamAccess(examId, lateCodeInput, now) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Config");
  const data = sheet.getDataRange().getValues();
  let conf = null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == examId) {
      conf = { start: new Date(data[i][1]), dur: data[i][2], code: data[i][3], status: data[i][4] };
      break;
    }
  }

  if (!conf || conf.status !== "Active") return res({ success: false, message: "Đề không tồn tại." });

  const endTime = new Date(conf.start.getTime() + conf.dur * 60000);
  const graceEnd = new Date(conf.start.getTime() + 5 * 60000);

  if (now < conf.start) return res({ success: false, status: "WAITING", message: "Chưa đến giờ thi." });
  if (now > endTime) return res({ success: false, message: "Kỳ thi đã kết thúc." });

  if (now <= graceEnd || lateCodeInput === conf.code) {
    return res({ 
      success: true, 
      remainingMinutes: Math.floor((endTime - now) / 60000),
      examId: examId 
    });
  }

  return res({ success: false, status: "REQUIRE_CODE", message: "Quá 5 phút, cần mã ưu tiên." });
}

function res(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
