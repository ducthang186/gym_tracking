import { ApiError } from "./api";
import { normalizePhone } from "./phone";

// Ánh xạ mã lỗi ổn định của server sang tiếng Việt.

const FIELD_MESSAGES = {
  email: {
    required: "Vui lòng nhập email.",
    invalid_email: "Email không hợp lệ.",
    too_long: "Email quá dài.",
    taken: "Email này đã được đăng ký.",
  },
  fullName: {
    required: "Vui lòng nhập họ tên.",
    too_short: "Họ tên phải có ít nhất 2 ký tự.",
    too_long: "Họ tên tối đa 80 ký tự.",
    invalid_name: "Họ tên chỉ gồm chữ cái, dấu cách, dấu chấm, dấu nháy và gạch nối.",
  },
  phone: {
    required: "Vui lòng nhập số điện thoại.",
    invalid_phone: "Số điện thoại di động Việt Nam không hợp lệ (ví dụ 0912 345 678).",
    too_long: "Số điện thoại quá dài.",
    taken: "Số điện thoại này đã được đăng ký.",
  },
  password: {
    required: "Vui lòng nhập mật khẩu.",
    too_short: "Mật khẩu phải có ít nhất 8 ký tự.",
    too_long: "Mật khẩu tối đa 128 ký tự.",
  },
  identifier: {
    required: "Vui lòng nhập email hoặc số điện thoại.",
    too_long: "Giá trị quá dài.",
  },
};

const GENERAL_MESSAGES = {
  invalid_credentials: "Email/số điện thoại hoặc mật khẩu không đúng.",
  rate_limited: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
  account_pending: "Tài khoản của bạn đang chờ huấn luyện viên duyệt. Vui lòng liên hệ huấn luyện viên.",
  account_suspended: "Tài khoản đã bị tạm khoá. Vui lòng liên hệ huấn luyện viên.",
  network_error: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
  internal_error: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
  bad_origin: "Yêu cầu bị từ chối vì không đến từ trang web này.",
};

/** Biến lỗi từ API thành { message, fields } để hiển thị. */
export function describeError(err) {
  if (!(err instanceof ApiError)) return { message: "Đã xảy ra lỗi không mong muốn.", fields: {} };

  if (err.code === "validation_error") {
    const fields = {};
    for (const { field, code } of err.details?.fields ?? []) {
      fields[field] = FIELD_MESSAGES[field]?.[code] ?? "Giá trị không hợp lệ.";
    }
    return { message: "", fields };
  }

  if (err.code === "email_taken" || err.code === "phone_taken") {
    const fields = {};
    for (const field of err.details?.fields ?? []) fields[field] = FIELD_MESSAGES[field]?.taken;
    return { message: "", fields };
  }

  if (err.code === "too_many_attempts") {
    const minutes = Math.max(1, Math.ceil((err.details?.retryAfterSeconds ?? 60) / 60));
    return { message: `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau khoảng ${minutes} phút.`, fields: {} };
  }

  return { message: GENERAL_MESSAGES[err.code] ?? "Đã xảy ra lỗi. Vui lòng thử lại.", fields: {} };
}

/** Kiểm tra form đăng ký ở client để báo lỗi sớm (server vẫn kiểm tra lại toàn bộ). */
export function validateRegister(form) {
  const errors = {};
  const email = form.email.trim();
  const name = form.fullName.normalize("NFC").trim().replace(/\s+/g, " ");

  if (!email) errors.email = FIELD_MESSAGES.email.required;
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = FIELD_MESSAGES.email.invalid_email;

  if (!name) errors.fullName = FIELD_MESSAGES.fullName.required;
  else if (name.length < 2) errors.fullName = FIELD_MESSAGES.fullName.too_short;
  else if (name.length > 80) errors.fullName = FIELD_MESSAGES.fullName.too_long;
  else if (!/^[\p{L}\p{M}][\p{L}\p{M}' .’-]*$/u.test(name)) errors.fullName = FIELD_MESSAGES.fullName.invalid_name;

  if (!form.phone.trim()) errors.phone = FIELD_MESSAGES.phone.required;
  else if (!normalizePhone(form.phone)) errors.phone = FIELD_MESSAGES.phone.invalid_phone;

  if (!form.password) errors.password = FIELD_MESSAGES.password.required;
  else if (form.password.length < 8) errors.password = FIELD_MESSAGES.password.too_short;
  else if (form.password.length > 128) errors.password = FIELD_MESSAGES.password.too_long;

  if (!errors.password && form.password !== form.passwordConfirm) {
    errors.passwordConfirm = "Hai mật khẩu không khớp.";
  }
  return errors;
}
