export default function StatCard({ label, value, unit, icon: Icon }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 bg-cyan/10 text-cyan">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-muted leading-tight">{label}</p>
        <p className="text-lg sm:text-xl font-display font-bold text-ink">
          {value}
          {unit && <span className="text-xs sm:text-sm font-normal text-muted ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
