// Lớp gọi API.
//  - access token giữ trong BIẾN (bộ nhớ), không bao giờ trong localStorage/sessionStorage
//  - refresh token nằm trong cookie httpOnly: JavaScript không đọc được, trình duyệt tự gửi kèm
//  - khi gặp 401, tự refresh MỘT lần rồi gửi lại request

const API = "/api/v1";

let accessToken = null;
let onSessionLost = () => {};

export class ApiError extends Error {
  constructor(status, code, details) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const setAccessToken = (token) => {
  accessToken = token;
};

/** Gọi khi không thể khôi phục phiên (refresh thất bại) để UI chuyển về trạng thái chưa đăng nhập. */
export const setSessionLostHandler = (fn) => {
  onSessionLost = fn;
};

async function request(path, { method = "GET", body, token, responseType } = {}) {
  const headers = {};
  // Chỉ đặt Content-Type khi thật sự có body (server từ chối body rỗng kèm content-type JSON).
  // FormData (upload ảnh): để trình duyệt tự đặt multipart + boundary.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "network_error");
  }

  if (res.status === 204) return null;
  if (res.ok && responseType === "blob") return res.blob();

  let data = null;
  try {
    data = await res.json();
  } catch {
    // phản hồi không phải JSON (vd proxy lỗi)
  }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "unknown_error", data?.details);
  return data;
}

/** Endpoint công khai (đăng nhập, đăng ký): không gắn token. */
export const apiPublic = (path, opts) => request(path, opts);

// ---- refresh: gom các lời gọi đồng thời thành MỘT, và khoá giữa các tab ----

let refreshing = null;

// Refresh token được xoay vòng, nên hai tab refresh cùng lúc bằng cùng một cookie sẽ làm tab chậm bị coi
// là "dùng lại token". Web Locks cho từng tab đợi đến lượt, và tab sau sẽ dùng cookie đã được cập nhật.
const withLock = (fn) =>
  typeof navigator !== "undefined" && navigator.locks?.request
    ? navigator.locks.request("latis-refresh", fn)
    : fn();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function doRefresh() {
  try {
    return await request("/auth/refresh", { method: "POST" });
  } catch (err) {
    // `refresh_conflict`: một tab khác vừa xoay vòng xong. Chờ chút rồi thử lại bằng cookie mới.
    if (err instanceof ApiError && err.code === "refresh_conflict") {
      await sleep(300);
      return request("/auth/refresh", { method: "POST" });
    }
    throw err;
  }
}

/** Trả về { user, accessToken, expiresIn }. Ném ApiError nếu không còn phiên hợp lệ. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = withLock(async () => {
      const data = await doRefresh();
      accessToken = data.accessToken;
      return data;
    }).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function logoutRequest() {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    // dù server lỗi, phía client vẫn coi như đã đăng xuất
  }
  accessToken = null;
}

/** Gọi API cần đăng nhập. Tự refresh một lần khi gặp 401. */
export async function api(path, opts = {}) {
  try {
    return await request(path, { ...opts, token: accessToken });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    try {
      await refreshSession();
    } catch {
      accessToken = null;
      onSessionLost();
      throw err;
    }
    return request(path, { ...opts, token: accessToken });
  }
}
