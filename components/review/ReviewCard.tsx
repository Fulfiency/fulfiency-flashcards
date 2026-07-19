"use client";

import { useState } from "react";

export default function ReviewCard({
  front,
  back,
  tags,
  onFlip,
}: {
  front: string;
  back: string;
  tags?: string[];
  onFlip: (flipped: boolean) => void;
}) {
  const [flipped, setFlipped] = useState(false);

  function handleFlip() {
    if (!flipped) {
      setFlipped(true);
      onFlip(true);
    }
  }

  const isHtml = (s: string) => /<[a-z][\s\S]*>/i.test(s);
  const hasTags = tags && tags.length > 0;

  return (
    <div
      className="flip-container w-full max-w-xl mx-auto cursor-pointer select-none"
      onClick={handleFlip}
    >
      <div className={`flip-card relative w-full min-h-[280px] ${flipped ? "flipped" : ""}`}>
        <div className="flip-front absolute inset-0 card-hover p-8 flex flex-col items-center justify-center border-[rgba(201,165,82,0.3)]">
          {hasTags && (
            <div className="flex gap-1 flex-wrap justify-center mb-4">
              {tags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,165,82,0.15)] text-[var(--gold)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {isHtml(front) ? (
            <div className="text-xl text-center font-medium" dangerouslySetInnerHTML={{ __html: front }} />
          ) : (
            <p className="text-xl text-center font-medium">{front}</p>
          )}
        </div>
        <div className="flip-back absolute inset-0 rounded-xl p-8 flex flex-col items-center justify-center bg-[var(--navy-light)] border border-[rgba(201,165,82,0.2)]">
          {hasTags && (
            <div className="flex gap-1 flex-wrap justify-center mb-4">
              {tags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,165,82,0.1)] text-[var(--slate)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {isHtml(back) ? (
            <div className="text-xl text-center" dangerouslySetInnerHTML={{ __html: back }} />
          ) : (
            <p className="text-xl text-center">{back}</p>
          )}
        </div>
      </div>
    </div>
  );
}
