"use client";

import { useEffect, useRef } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="backdrop:bg-black/60 bg-[var(--navy-light)] text-[var(--white)] border border-[rgba(201,165,82,0.2)] rounded-xl p-0 max-w-lg w-full"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[family-name:var(--font-playfair-display)] text-xl font-bold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--slate)] hover:text-[var(--white)] text-xl leading-none"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
