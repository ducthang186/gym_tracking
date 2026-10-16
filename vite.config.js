import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Production phục vụ ở gốc tên miền. Đặt VITE_BASE=/duong-dan/ chỉ khi cần chạy dưới một thư mục con.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Dev cũng chạy "một origin": trình duyệt gọi /api trên cổng 5173, Vite chuyển tiếp sang API.
    // Nhờ đó cookie refresh token (SameSite=Lax) và kiểm tra Origin hoạt động y hệt production.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
