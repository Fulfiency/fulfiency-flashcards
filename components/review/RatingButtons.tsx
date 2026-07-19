"use client";

interface RatingOption {
  label: string;
  rating: number;
  color: string;
  interval: string;
}

export default function RatingButtons({
  intervals,
  onRate,
}: {
  intervals: { again: string; hard: string; good: string; easy: string };
  onRate: (rating: number) => void;
}) {
  const options: RatingOption[] = [
    { label: "À revoir", rating: 1, color: "var(--error)", interval: intervals.again },
    { label: "Difficile", rating: 2, color: "var(--hard)", interval: intervals.hard },
    { label: "Bien", rating: 3, color: "var(--sage)", interval: intervals.good },
    { label: "Facile", rating: 4, color: "var(--gold)", interval: intervals.easy },
  ];

  return (
    <div className="flex gap-2 justify-center flex-wrap mt-6">
      {options.map((o) => (
        <button
          key={o.rating}
          onClick={() => onRate(o.rating)}
          className="flex flex-col items-center gap-1 px-4 py-3 rounded-lg font-semibold text-sm transition-all hover:translate-y-[-2px] min-w-[80px]"
          style={{
            background: `${o.color}22`,
            border: `1px solid ${o.color}44`,
            color: o.color,
          }}
        >
          <span>{o.label}</span>
          <span className="text-xs opacity-70">{o.interval}</span>
        </button>
      ))}
    </div>
  );
}
