// Hàm gửi yêu cầu kiểm tra quyền vào thi
async function checkExamAccess(examId, lateCode = "") {
    const configResponse = await fetch('config.json');
    const config = await configResponse.json();
    
    const url = `${config.api_endpoint}?action=checkAccess&examId=${examId}&lateCode=${lateCode}`;
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Lỗi kết nối API:", error);
        return { success: false, message: "Không thể kết nối với máy chủ." };
    }
}
