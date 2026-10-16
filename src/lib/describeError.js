import { ApiError } from "./api";

const BY_FIELD_CODE = {
  out_of_range: "Giá trị nằm ngoài phạm vi cho phép.",
  future_date: "Không thể chọn ngày trong tương lai.",
  invalid_date: "Ngày không hợp lệ.",
  too_long: "Nội dung quá dài.",
  required: "Vui lòng nhập đủ thông tin.",
  too_many: "Có quá nhiều mục.",
  not_monday: "Tuần phải bắt đầu từ thứ Hai.",
  too_short: "Mật khẩu phải có ít nhất 8 ký tự.",
  invalid_token: "Liên kết không hợp lệ.",
  invalid_phone: "Số điện thoại không hợp lệ.",
  invalid_email: "Email không hợp lệ.",
};

const BY_CODE = {
  network_error: "Không kết nối được máy chủ. Vui lòng thử lại.",
  rate_limited: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  food_not_found: "Món này không còn trong danh sách. Vui lòng chọn món khác.",
  food_exists: "Món này đã có trong thực đơn.",
  entry_not_found: "Mục này không còn tồn tại.",
  metric_not_found: "Mục này không còn tồn tại.",
  set_not_found: "Mục này không còn tồn tại.",
  too_many_sets: "Hôm nay bạn đã ghi quá nhiều hiệp.",
  invalid_image: "Tệp không phải ảnh hợp lệ (chấp nhận JPG, PNG, WebP).",
  file_too_large: "Ảnh quá lớn (tối đa 5 MB).",
  invalid_current_password: "Mật khẩu hiện tại không đúng.",
  same_password: "Mật khẩu mới phải khác mật khẩu hiện tại.",
  too_many_attempts: "Bạn nhập sai quá nhiều lần. Tài khoản tạm khoá, vui lòng thử lại sau ít phút.",
  invalid_or_expired_token: "Liên kết không hợp lệ hoặc đã hết hạn. Hãy nhờ huấn luyện viên cấp liên kết mới.",
  last_admin: "Đây là quản trị viên cuối cùng nên không thể xoá.",
  too_many_photos: "Bạn đã đạt số ảnh tối đa (60). Hãy xoá bớt ảnh cũ.",
  invalid_coach: "Huấn luyện viên được chọn không hợp lệ.",
  cannot_change_self: "Bạn không thể tự thay đổi trạng thái hoặc vai trò của chính mình.",
  email_taken: "Email này đã được đăng ký.",
  phone_taken: "Số điện thoại này đã được đăng ký.",
  user_not_found: "Không tìm thấy người dùng.",
  client_not_found: "Không tìm thấy học viên.",
  photo_not_found: "Không tìm thấy ảnh.",
  checkin_not_found: "Học viên chưa nộp check-in cho tuần này.",
  invalid_range: "Khoảng ngày không hợp lệ.",
  future_date: "Không thể chọn ngày trong tương lai.",
};

/** Chuyển lỗi từ API sang câu tiếng Việt cho người dùng. */
export function describeError(err) {
  if (err instanceof ApiError) {
    if (err.code === "validation_error") {
      const code = err.details?.fields?.[0]?.code;
      return BY_FIELD_CODE[code] ?? "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.";
    }
    if (BY_CODE[err.code]) return BY_CODE[err.code];
  }
  return "Có lỗi xảy ra. Vui lòng thử lại.";
}
