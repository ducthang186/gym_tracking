// Nội dung hiển thị tức thì trong lúc chờ server (và khi server không trả lời). Bản gốc nằm trong database,
// do admin chỉnh ở /admin/content — giữ hai nơi khớp nhau chỉ để trang chủ không bị trống.
export const defaultAbout = {
  name: "Trung Phạm",
  title: "Founder & Head Coach",
  bio:
    "Tôi xây dựng LATIS sau nhiều năm huấn luyện trực tiếp và nhận ra một vấn đề lặp lại: học viên tiến bộ chậm không phải vì thiếu nỗ lực, mà vì thiếu dữ liệu để biết khi nào cần điều chỉnh. LATIS là hệ thống tôi dùng để coaching từng học viên — tập luyện, dinh dưỡng và tiến độ đều được theo dõi bằng số liệu thật, không đoán mò.",
  quote: "Không cần đoán bạn đang tiến bộ hay không — dữ liệu sẽ nói cho bạn biết.",
  badge: { title: "HLV tiêu biểu", subtitle: "Fitness Summit 2024" },
  stats: [
    { value: "200+", label: "Học viên đã huấn luyện" },
    { value: "7 năm", label: "Kinh nghiệm coaching" },
    { value: "1,200+", label: "Buổi coaching 1:1" },
    { value: "94%", label: "Tỷ lệ đạt mục tiêu" },
  ],
  achievements: [
    { title: "Chứng chỉ PT Quốc tế (ACE)", desc: "Được công nhận chuyên môn huấn luyện cá nhân theo chuẩn quốc tế." },
    { title: "Chuyên gia dinh dưỡng thể hình", desc: "Xây dựng meal plan khoa học, cá nhân hóa theo mục tiêu từng học viên." },
    { title: "Huấn luyện viên tiêu biểu 2024", desc: "Được vinh danh tại sự kiện Fitness Summit nhờ kết quả học viên nổi bật." },
    { title: "200+ học viên thành công", desc: "Đồng hành cùng học viên từ người mới bắt đầu đến vận động viên thi đấu." },
  ],
  photoVersion: null,
};
