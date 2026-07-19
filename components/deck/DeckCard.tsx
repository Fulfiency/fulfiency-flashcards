"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface DeckCardProps {
  id: string;
  name: string;
  dueCount: number;
  totalCount: number;
  color: string;
}

export default function DeckCard({ id, name, dueCount, totalCount, color }: DeckCardProps) {
  const router = useRouter();

  return (
    <div
      className="card-hover p-5 animate-fade-slide cursor-pointer"
      onClick={() => router.push(`/decks/${id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ background: color }} />
          <h3 className="font-[family-name:var(--font-playfair-display)] font-bold text-lg">{name}</h3>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-[var(--slate)] mb-4">
        <span>{totalCount} carte{totalCount > 1 ? "s" : ""}</span>
        {dueCount > 0 && (
          <span className="text-[var(--gold)] font-semibold">{dueCount} à réviser</span>
        )}
      </div>

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        {dueCount > 0 && (
          <Link href={`/review/${id}`} className="btn-gold text-xs py-2 px-4">Réviser</Link>
        )}
        <Link
          href={`/cram/${id}`}
          className="px-4 py-2 text-xs rounded-lg border border-[rgba(201,165,82,0.2)] text-[var(--gold)] hover:bg-[rgba(201,165,82,0.1)] hover:border-[var(--gold)] transition-colors"
        >
          Cram
        </Link>
      </div>
    </div>
  );
}
