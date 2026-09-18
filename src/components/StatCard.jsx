export default function StatCard({ label, value, unit, icon: Icon, accent = "brand" }) {
  const accentClasses = {
    brand: "bg-brand-50 text-brand-600",
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 ${accentClasses[accent]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-slate-500 leading-tight">{label}</p>
        <p className="text-lg sm:text-xl font-bold text-slate-900">
          {value}
          {unit && <span className="text-xs sm:text-sm font-normal text-slate-400 ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
