"use client";

import { useState, useRef, useEffect } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  allTags?: string[];
  placeholder?: string;
}

export default function TagInput({ tags, onChange, allTags = [], placeholder = "Ajouter un tag..." }: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = allTags
    .filter((t) => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 5);

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setInput("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  // Close suggestions on outside click
  useEffect(() => {
    function onClick() { setShowSuggestions(false); }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const TAG_COLORS = [
    "rgba(201,165,82,0.2)",
    "rgba(115,134,109,0.2)",
    "rgba(74,158,255,0.2)",
    "rgba(232,131,42,0.2)",
    "rgba(224,92,92,0.2)",
    "rgba(167,188,183,0.2)",
  ];

  function tagColor(tag: string) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 items-center px-2 py-1.5 bg-[var(--navy)] border border-[var(--navy-mid)] rounded-lg min-h-[36px] focus-within:border-[var(--gold)] focus-within:shadow-[0_0_0_3px_rgba(201,168,76,0.1)] transition-all">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: tagColor(tag), color: "var(--white)" }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:text-[var(--error)] transition-colors text-[10px] ml-0.5"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent text-[var(--white)] text-xs outline-none placeholder-[var(--slate)]"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (input || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--navy-light)] border border-[var(--navy-mid)] rounded-lg z-50 shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {suggestions.map((s) => (
            <button
              key={s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(s)}
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--white)] hover:bg-[rgba(201,165,82,0.1)] transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: tagColor(s) }} />
              {s}
            </button>
          ))}
          {input.trim() && !suggestions.includes(input.trim().toLowerCase()) && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(input)}
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--gold)] hover:bg-[rgba(201,165,82,0.1)] transition-colors"
            >
              + Créer &ldquo;{input.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
