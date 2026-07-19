export default function ProgressBar({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full h-2 rounded-full bg-[var(--navy-mid)]">
      <div
        className="h-full rounded-full animate-bar-grow"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--gold), var(--gold-light))",
        }}
      />
    </div>
  );
}
