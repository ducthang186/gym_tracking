import { DEMO } from "../lib/demo";

/** Dải báo "bản demo" ở đầu trang; nút đặt lại xoá dữ liệu demo đã chỉnh trong trình duyệt này. */
export default function DemoBanner() {
  if (!DEMO) return null;

  async function reset() {
    const { resetDemo } = await import("../demo/demoApi.js");
    resetDemo();
    window.location.assign(import.meta.env.BASE_URL);
  }

  return (
    <div className="bg-cyan text-cyan-deep text-xs sm:text-[13px] font-semibold px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center">
      <span>Bản demo: dữ liệu giả, chỉ lưu trong trình duyệt của bạn.</span>
      <button onClick={reset} className="underline underline-offset-2 hover:no-underline">Đặt lại dữ liệu demo</button>
    </div>
  );
}
