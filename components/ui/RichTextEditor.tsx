"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { getRecentColors, addRecentColor, getColorShortcuts } from "@/lib/recentColors";
import { createClient } from "@/lib/supabase/client";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const COLORS = [
  { v: "#c9a552", l: "Or" },
  { v: "#73866d", l: "Vert" },
  { v: "#e05c5c", l: "Rouge" },
  { v: "#e8832a", l: "Orange" },
  { v: "#4a9eff", l: "Bleu" },
  { v: "#f5f0e8", l: "Blanc" },
];

const HIGHLIGHTS = [
  { v: "#c9a55244", l: "Or" },
  { v: "#73866d44", l: "Vert" },
  { v: "#e05c5c44", l: "Rouge" },
  { v: "#4a9eff44", l: "Bleu" },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  className = "",
  autoFocus = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [showColors, setShowColors] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const colorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setRecentColors(getRecentColors());
  }, []);

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    isInternalChange.current = false;
  }, [value]);

  useEffect(() => {
    if (autoFocus && editorRef.current) editorRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setShowColors(false);
      if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) setShowHighlights(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  function execCmd(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  }

  function applyColor(color: string) {
    execCmd("foreColor", color);
    setRecentColors(addRecentColor(color));
    setShowColors(false);
  }

  function applyHighlight(color: string) {
    execCmd("hiliteColor", color);
    if (color !== "transparent") setRecentColors(addRecentColor(color));
    setShowHighlights(false);
  }

  function doList(tag: "UL" | "OL") {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // Check if already in this type of list
    let node: Node | null = sel.anchorNode;
    while (node && node !== editor) {
      if (node instanceof HTMLElement && node.tagName === tag) {
        // Remove list
        const items = node.querySelectorAll(":scope > li");
        const frag = document.createDocumentFragment();
        items.forEach((li) => {
          const div = document.createElement("div");
          div.innerHTML = li.innerHTML;
          frag.appendChild(div);
        });
        node.replaceWith(frag);
        handleInput();
        return;
      }
      node = node.parentNode;
    }

    const range = sel.getRangeAt(0);
    const selectedText = range.toString();
    const list = document.createElement(tag.toLowerCase());
    list.style.paddingLeft = "20px";
    list.style.margin = "4px 0";

    if (selectedText) {
      const lines = selectedText.split("\n").filter((l) => l.trim());
      lines.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        list.appendChild(li);
      });
      range.deleteContents();
      range.insertNode(list);
    } else {
      const li = document.createElement("li");
      li.innerHTML = "<br>";
      list.appendChild(li);
      range.insertNode(list);
      const newRange = document.createRange();
      newRange.setStart(li, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    handleInput();
  }

  function indentList() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.anchorNode;
    while (node && !(node instanceof HTMLElement && node.tagName === "LI")) {
      node = node.parentNode;
    }
    if (!node || !(node instanceof HTMLElement)) return;
    const li = node;
    const prev = li.previousElementSibling;
    if (!prev) return;

    const parentTag = li.parentElement?.tagName || "UL";
    let subList = prev.querySelector(`:scope > ${parentTag.toLowerCase()}`);
    if (!subList) {
      subList = document.createElement(parentTag.toLowerCase());
      (subList as HTMLElement).style.paddingLeft = "20px";
      (subList as HTMLElement).style.margin = "2px 0";
      prev.appendChild(subList);
    }
    subList.appendChild(li);
    handleInput();
  }

  function outdentList() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.anchorNode;
    while (node && !(node instanceof HTMLElement && node.tagName === "LI")) {
      node = node.parentNode;
    }
    if (!node || !(node instanceof HTMLElement)) return;
    const li = node;
    const parentList = li.parentElement;
    if (!parentList) return;
    const grandparentLi = parentList.parentElement;
    if (!grandparentLi || grandparentLi.tagName !== "LI") return;
    const grandparentList = grandparentLi.parentElement;
    if (!grandparentList) return;

    // Move li after grandparentLi
    if (grandparentLi.nextSibling) {
      grandparentList.insertBefore(li, grandparentLi.nextSibling);
    } else {
      grandparentList.appendChild(li);
    }
    // Clean empty sub-list
    if (parentList.children.length === 0) parentList.remove();
    handleInput();
  }

  async function insertImage(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUploading(false); return; }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (data.url) {
        editorRef.current?.focus();
        document.execCommand("insertHTML", false, `<img src="${data.url}" alt="" style="max-width:100%;border-radius:8px;margin:4px 0;" />`);
        handleInput();
      }
    } catch {}
    setUploading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Tab for indent/outdent in lists
    if (e.key === "Tab") {
      const sel = window.getSelection();
      let inList = false;
      if (sel && sel.anchorNode) {
        let n: Node | null = sel.anchorNode;
        while (n && n !== editorRef.current) {
          if (n instanceof HTMLElement && (n.tagName === "LI")) { inList = true; break; }
          n = n.parentNode;
        }
      }
      if (inList) {
        e.preventDefault();
        if (e.shiftKey) outdentList();
        else indentList();
        return;
      }
    }

    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    // Ctrl+Alt+number → color shortcut
    if (e.altKey && /^[1-9]$/.test(e.key)) {
      const shortcuts = getColorShortcuts();
      const sc = shortcuts.find((s) => s.key === e.key);
      if (sc) {
        e.preventDefault();
        execCmd("foreColor", sc.color);
        setRecentColors(addRecentColor(sc.color));
        return;
      }
    }

    if (e.altKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setShowColors(!showColors);
      setShowHighlights(false);
      return;
    }

    if (e.key.toLowerCase() === "h") {
      e.preventDefault();
      if (e.altKey) {
        setShowHighlights(!showHighlights);
        setShowColors(false);
      } else {
        execCmd("hiliteColor", "#c9a55244");
      }
      return;
    }

    switch (e.key.toLowerCase()) {
      case "b": e.preventDefault(); execCmd("bold"); break;
      case "i": e.preventDefault(); execCmd("italic"); break;
      case "u": e.preventDefault(); execCmd("underline"); break;
      case "d": if (e.altKey) { e.preventDefault(); execCmd("strikeThrough"); } break;
      case "l": if (e.altKey) { e.preventDefault(); doList("UL"); } break;
      case "o": if (e.altKey) { e.preventDefault(); doList("OL"); } break;
      case "e": if (e.altKey) { e.preventDefault(); execCmd("justifyCenter"); } break;
      case "r": if (e.altKey) { e.preventDefault(); execCmd("justifyRight"); } break;
      case "g": if (e.altKey) { e.preventDefault(); execCmd("justifyLeft"); } break;
    }
  }

  function ToolBtn({ onClick, title, children, cls = "" }: {
    onClick: () => void; title: string; children: React.ReactNode; cls?: string;
  }) {
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        title={title}
        className={`w-7 h-7 flex items-center justify-center rounded text-[11px] text-[var(--slate)] hover:text-[var(--white)] hover:bg-[rgba(201,165,82,0.15)] transition-all ${cls}`}
      >
        {children}
      </button>
    );
  }

  const AlignLeftIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="3" x2="13" y2="3" /><line x1="1" y1="6" x2="9" y2="6" />
      <line x1="1" y1="9" x2="13" y2="9" /><line x1="1" y1="12" x2="9" y2="12" />
    </svg>
  );
  const AlignCenterIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="3" x2="13" y2="3" /><line x1="3" y1="6" x2="11" y2="6" />
      <line x1="1" y1="9" x2="13" y2="9" /><line x1="3" y1="12" x2="11" y2="12" />
    </svg>
  );
  const AlignRightIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="3" x2="13" y2="3" /><line x1="5" y1="6" x2="13" y2="6" />
      <line x1="1" y1="9" x2="13" y2="9" /><line x1="5" y1="12" x2="13" y2="12" />
    </svg>
  );

  return (
    <div className={`rounded-lg border border-[var(--navy-mid)] bg-[var(--navy)] overflow-visible focus-within:border-[var(--gold)] focus-within:shadow-[0_0_0_3px_rgba(201,168,76,0.1)] transition-all ${className}`}>
      <div className="flex items-center gap-px p-1 border-b border-[var(--navy-mid)] bg-[rgba(0,0,0,0.15)] flex-wrap">
        <ToolBtn onClick={() => execCmd("bold")} title="Gras (Ctrl+B)"><strong>B</strong></ToolBtn>
        <ToolBtn onClick={() => execCmd("italic")} title="Italique (Ctrl+I)"><em>I</em></ToolBtn>
        <ToolBtn onClick={() => execCmd("underline")} title="Souligner (Ctrl+U)"><span className="underline">U</span></ToolBtn>
        <ToolBtn onClick={() => execCmd("strikeThrough")} title="Barrer (Ctrl+Alt+D)"><span className="line-through">S</span></ToolBtn>

        <div className="w-px h-4 bg-[var(--navy-mid)] mx-0.5" />

        {/* Color picker */}
        <div className="relative" ref={colorRef}>
          <button type="button" onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setShowColors(!showColors); setShowHighlights(false); }}
            title="Couleur du texte (Ctrl+Alt+C)"
            className="w-7 h-7 flex items-center justify-center rounded text-[11px] text-[var(--slate)] hover:text-[var(--white)] hover:bg-[rgba(201,165,82,0.15)] transition-all"
          >
            <span className="relative">A<span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-[var(--gold)] rounded-full" /></span>
          </button>
          {showColors && (
            <div className="absolute top-full left-0 mt-1 flex flex-col gap-0.5 p-2 bg-[var(--navy-light)] border border-[var(--navy-mid)] rounded-lg z-50 shadow-xl min-w-[150px] animate-fade-slide">
              {/* Preset colors */}
              <div className="flex gap-1 mb-1">
                {COLORS.map((c) => (
                  <button key={c.v} type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyColor(c.v)} title={c.l}
                    className="w-5 h-5 rounded-full border border-[rgba(255,255,255,0.15)] hover:scale-125 transition-transform"
                    style={{ background: c.v }}
                  />
                ))}
              </div>
              {/* Recent colors */}
              {recentColors.length > 0 && (
                <>
                  <div className="text-[9px] text-[var(--slate)] uppercase tracking-wider mt-1">Récentes</div>
                  <div className="flex gap-1 flex-wrap">
                    {recentColors.filter((c) => !COLORS.some((p) => p.v === c)).slice(0, 6).map((c) => (
                      <button key={c} type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyColor(c)} title={c}
                        className="w-5 h-5 rounded-full border border-[rgba(255,255,255,0.15)] hover:scale-125 transition-transform"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Shortcut colors */}
              <div className="text-[9px] text-[var(--slate)] uppercase tracking-wider mt-1">Raccourcis (Ctrl+Alt+N°)</div>
              <div className="flex gap-1">
                {getColorShortcuts().map((sc) => (
                  <button key={sc.key} type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyColor(sc.color)} title={`${sc.label} (Ctrl+Alt+${sc.key})`}
                    className="w-5 h-5 rounded-full border border-[rgba(255,255,255,0.15)] hover:scale-125 transition-transform relative"
                    style={{ background: sc.color }}
                  >
                    <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-[7px] text-[var(--slate)]">{sc.key}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--navy-mid)] mt-2 pt-1.5 flex flex-col gap-0.5">
                <button type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => colorInputRef.current?.click()}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[rgba(201,165,82,0.1)] transition-colors text-xs text-[var(--slate)]"
                >
                  <span className="w-3.5 h-3.5 rounded-full border border-dashed border-[var(--slate)]" />
                  Personnalisée...
                </button>
                <input ref={colorInputRef} type="color" className="sr-only"
                  onChange={(e) => applyColor(e.target.value)} />
                <button type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { execCmd("removeFormat"); setShowColors(false); }}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[rgba(201,165,82,0.1)] transition-colors text-xs text-[var(--slate)]"
                >
                  <span className="w-3.5 h-3.5 rounded-full border border-[var(--navy-mid)] flex items-center justify-center text-[8px] text-[var(--error)]">✕</span>
                  Défaut
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Highlight picker */}
        <div className="relative" ref={highlightRef}>
          <button type="button" onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setShowHighlights(!showHighlights); setShowColors(false); }}
            title="Surligner (Ctrl+H rapide, Ctrl+Alt+H menu)"
            className="w-7 h-7 flex items-center justify-center rounded text-[11px] hover:bg-[rgba(201,165,82,0.15)] transition-all"
            style={{ background: "#c9a55222", color: "var(--white)" }}
          >H</button>
          {showHighlights && (
            <div className="absolute top-full left-0 mt-1 flex flex-col gap-0.5 p-2 bg-[var(--navy-light)] border border-[var(--navy-mid)] rounded-lg z-50 shadow-xl min-w-[130px] animate-fade-slide">
              <div className="flex gap-1 mb-1">
                {HIGHLIGHTS.map((c) => (
                  <button key={c.v} type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlight(c.v)} title={c.l}
                    className="w-5 h-5 rounded border border-[rgba(255,255,255,0.15)] hover:scale-125 transition-transform"
                    style={{ background: c.v }}
                  />
                ))}
              </div>
              <div className="border-t border-[var(--navy-mid)] mt-1 pt-1.5 flex flex-col gap-0.5">
                <button type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => highlightInputRef.current?.click()}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[rgba(201,165,82,0.1)] transition-colors text-xs text-[var(--slate)]"
                >
                  <span className="w-3.5 h-3.5 rounded border border-dashed border-[var(--slate)]" />
                  Personnalisée...
                </button>
                <input ref={highlightInputRef} type="color" className="sr-only"
                  onChange={(e) => applyHighlight(e.target.value + "66")} />
                <button type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHighlight("transparent")}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[rgba(201,165,82,0.1)] transition-colors text-xs text-[var(--slate)]"
                >
                  <span className="w-3.5 h-3.5 rounded border border-[var(--navy-mid)] flex items-center justify-center text-[8px] text-[var(--error)]">✕</span>
                  Retirer
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-[var(--navy-mid)] mx-0.5" />

        <ToolBtn onClick={() => execCmd("justifyLeft")} title="Gauche (Ctrl+Alt+G)"><AlignLeftIcon /></ToolBtn>
        <ToolBtn onClick={() => execCmd("justifyCenter")} title="Centrer (Ctrl+Alt+E)"><AlignCenterIcon /></ToolBtn>
        <ToolBtn onClick={() => execCmd("justifyRight")} title="Droite (Ctrl+Alt+R)"><AlignRightIcon /></ToolBtn>

        <div className="w-px h-4 bg-[var(--navy-mid)] mx-0.5" />

        <ToolBtn onClick={() => doList("UL")} title="Liste à puces (Ctrl+Alt+L)">•</ToolBtn>
        <ToolBtn onClick={() => doList("OL")} title="Liste numérotée (Ctrl+Alt+O)">1.</ToolBtn>
        <ToolBtn onClick={indentList} title="Sous-puce (Tab)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="3,4 7,7 3,10" /><line x1="7" y1="7" x2="13" y2="7" />
          </svg>
        </ToolBtn>
        <ToolBtn onClick={outdentList} title="Désindenter (Shift+Tab)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="7,4 3,7 7,10" /><line x1="3" y1="7" x2="13" y2="7" />
          </svg>
        </ToolBtn>

        <div className="w-px h-4 bg-[var(--navy-mid)] mx-0.5" />

        <ToolBtn onClick={() => execCmd("removeFormat")} title="Effacer formatage" cls="text-[var(--error)]">✕</ToolBtn>

        <div className="w-px h-4 bg-[var(--navy-mid)] mx-0.5" />

        <ToolBtn onClick={() => execCmd("undo")} title="Annuler (Ctrl+Z)">↩</ToolBtn>
        <ToolBtn onClick={() => execCmd("redo")} title="Rétablir (Ctrl+Y)">↪</ToolBtn>

        <div className="w-px h-4 bg-[var(--navy-mid)] mx-0.5" />

        <ToolBtn onClick={() => imageInputRef.current?.click()} title="Insérer image" cls={uploading ? "opacity-50" : ""}>
          {uploading ? "..." : "🖼"}
        </ToolBtn>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) insertImage(f);
            e.target.value = "";
          }}
        />
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="min-h-[70px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm text-[var(--white)] outline-none
          [&_ul]:pl-5 [&_ul]:my-1 [&_li]:list-disc
          [&_ol]:pl-5 [&_ol]:my-1 [&_ol>li]:list-decimal
          [&_ul_ul]:pl-4 [&_ul_ul]:my-0 [&_ul_ul>li]:list-[circle]
          [&_ol_ol]:pl-4 [&_ol_ol]:my-0 [&_ol_ol>li]:list-[lower-alpha]
          empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--slate)] empty:before:pointer-events-none"
      />
    </div>
  );
}
