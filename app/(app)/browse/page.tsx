"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import RichTextEditor from "@/components/ui/RichTextEditor";
import TagInput from "@/components/ui/TagInput";
import GoldButton from "@/components/ui/GoldButton";
import { playClick, playDelete } from "@/lib/sounds";
import { getSettings } from "@/lib/settings";

interface CardRow {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  state: number;
  due: string;
  tags: string[];
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
  created_at: string;
  last_review: string | null;
}

interface DeckRow {
  id: string;
  name: string;
  color: string;
}

const STATE_LABELS = ["Nouvelle", "Apprentissage", "Révision", "Réapprentissage"];
const STATE_COLORS = ["var(--slate)", "var(--hard)", "var(--sage)", "var(--error)"];

export default function BrowsePage() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [decks, setDecks] = useState<DeckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDeck, setFilterDeck] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<number | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterDue, setFilterDue] = useState<"all" | "due" | "new">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [sortBy, setSortBy] = useState<"created" | "due" | "front">("created");
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [showMoveTo, setShowMoveTo] = useState(false);
  const [colWidths, setColWidths] = useState([250, 250, 100, 110, 90]);
  const [sidebarW, setSidebarW] = useState(210);
  const [detailW, setDetailW] = useState(384);
  const dragRef = useRef<{ col: number; startX: number; startW: number } | null>(null);
  const panelDragRef = useRef<{ panel: "sidebar" | "detail"; startX: number; startW: number } | null>(null);
  const supabase = createClient();

  function s() { return getSettings().soundEnabled; }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: d }, { data: c }] = await Promise.all([
      supabase.from("decks").select("id, name, color").eq("user_id", user.id).order("name"),
      supabase.from("cards").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    setDecks(d ?? []);
    setCards((c ?? []).map((card) => ({ ...card, tags: card.tags ?? [] })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const stripHtml = (str: string) => str.replace(/<[^>]*>/g, "");

  const allTags = useMemo(() => [...new Set(cards.flatMap((c) => c.tags))].sort(), [cards]);

  const deckMap = useMemo(() => new Map(decks.map((d) => [d.id, d])), [decks]);

  const filtered = useMemo(() => {
    let list = cards;

    if (filterDeck) list = list.filter((c) => c.deck_id === filterDeck);
    if (filterState !== null) list = list.filter((c) => c.state === filterState);
    if (filterTag) list = list.filter((c) => c.tags.includes(filterTag));
    if (filterDue === "due") list = list.filter((c) => new Date(c.due) <= new Date());
    if (filterDue === "new") list = list.filter((c) => c.state === 0);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        stripHtml(c.front).toLowerCase().includes(q) ||
        stripHtml(c.back).toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (sortBy === "due") list = [...list].sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
    else if (sortBy === "front") list = [...list].sort((a, b) => stripHtml(a.front).localeCompare(stripHtml(b.front)));

    return list;
  }, [cards, filterDeck, filterState, filterTag, filterDue, search, sortBy]);

  function selectCard(card: CardRow) {
    if (dirty && selectedId) saveCard();
    setSelectedId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditTags(card.tags);
    setDirty(false);
  }

  async function saveCard() {
    if (!selectedId) return;
    const { error } = await supabase.from("cards")
      .update({ front: editFront, back: editBack, tags: editTags })
      .eq("id", selectedId);
    if (error?.message?.includes("tags")) {
      await supabase.from("cards").update({ front: editFront, back: editBack }).eq("id", selectedId);
    }
    setCards((prev) => prev.map((c) =>
      c.id === selectedId ? { ...c, front: editFront, back: editBack, tags: editTags } : c
    ));
    setDirty(false);
    if (s()) playClick();
  }

  async function moveCards(cardIds: string[], targetDeckId: string) {
    await supabase.from("cards").update({ deck_id: targetDeckId }).in("id", cardIds);
    setCards((prev) => prev.map((c) =>
      cardIds.includes(c.id) ? { ...c, deck_id: targetDeckId } : c
    ));
    if (s()) playClick();
  }

  async function deleteCard(id: string) {
    await supabase.from("cards").delete().eq("id", id);
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (s()) playDelete();
  }

  function startResize(col: number, e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { col, startX: e.clientX, startW: colWidths[col] };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.startX;
      const newW = Math.max(50, dragRef.current.startW + delta);
      setColWidths((prev) => {
        const next = [...prev];
        next[dragRef.current!.col] = newW;
        return next;
      });
    }

    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function startPanelResize(panel: "sidebar" | "detail", e: React.MouseEvent) {
    e.preventDefault();
    const startW = panel === "sidebar" ? sidebarW : detailW;
    panelDragRef.current = { panel, startX: e.clientX, startW };

    function onMove(ev: MouseEvent) {
      if (!panelDragRef.current) return;
      const delta = ev.clientX - panelDragRef.current.startX;
      const dir = panelDragRef.current.panel === "sidebar" ? 1 : -1;
      const newW = Math.max(150, Math.min(500, panelDragRef.current.startW + delta * dir));
      if (panelDragRef.current.panel === "sidebar") setSidebarW(newW);
      else setDetailW(newW);
    }

    function onUp() {
      panelDragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const COL_HEADERS = ["Recto", "Verso", "Deck", "État", "Échéance"];

  const selectedCard = cards.find((c) => c.id === selectedId);

  if (loading) return <div className="text-[var(--slate)] text-center py-12">Chargement...</div>;

  return (
    <div className="flex gap-0 h-[calc(100vh-80px)] -mx-4 sm:-mx-8 -my-6">
      {/* Sidebar filters */}
      <div className="shrink-0 border-r border-[var(--navy-mid)] overflow-y-auto bg-[var(--navy)]/50 p-3 hidden lg:block relative" style={{ width: sidebarW }}>
        {/* Resize handle */}
        <div
          onMouseDown={(e) => startPanelResize("sidebar", e)}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--gold)] transition-colors z-20"
        />
        <h2 className="text-[10px] text-[var(--slate)] uppercase tracking-wider mb-2 px-1">Filtres</h2>

        {/* Due filter */}
        <div className="mb-4">
          <h3 className="text-[10px] text-[var(--slate)] uppercase tracking-wider mb-1 px-1">Statut</h3>
          {([
            ["all", "Toutes", null],
            ["due", "À réviser", "var(--gold)"],
            ["new", "Nouvelles", "var(--slate)"],
          ] as const).map(([key, label, color]) => (
            <button
              key={key}
              onClick={() => setFilterDue(key)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                filterDue === key ? "bg-[rgba(201,165,82,0.15)] text-[var(--gold)]" : "text-[var(--slate)] hover:text-[var(--white)]"
              }`}
            >
              {color && <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: color }} />}
              {label}
            </button>
          ))}
        </div>

        {/* State filter */}
        <div className="mb-4">
          <h3 className="text-[10px] text-[var(--slate)] uppercase tracking-wider mb-1 px-1">État</h3>
          <button
            onClick={() => setFilterState(null)}
            className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
              filterState === null ? "bg-[rgba(201,165,82,0.15)] text-[var(--gold)]" : "text-[var(--slate)] hover:text-[var(--white)]"
            }`}
          >
            Tous les états
          </button>
          {STATE_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setFilterState(filterState === i ? null : i)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                filterState === i ? "bg-[rgba(201,165,82,0.15)] text-[var(--gold)]" : "text-[var(--slate)] hover:text-[var(--white)]"
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: STATE_COLORS[i] }} />
              {label}
            </button>
          ))}
        </div>

        {/* Deck filter */}
        <div className="mb-4">
          <h3 className="text-[10px] text-[var(--slate)] uppercase tracking-wider mb-1 px-1">Decks</h3>
          <button
            onClick={() => setFilterDeck(null)}
            className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
              !filterDeck ? "bg-[rgba(201,165,82,0.15)] text-[var(--gold)]" : "text-[var(--slate)] hover:text-[var(--white)]"
            }`}
          >
            Tous les decks
          </button>
          {decks.map((d) => (
            <button
              key={d.id}
              onClick={() => setFilterDeck(filterDeck === d.id ? null : d.id)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors truncate ${
                filterDeck === d.id ? "bg-[rgba(201,165,82,0.15)] text-[var(--gold)]" : "text-[var(--slate)] hover:text-[var(--white)]"
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: d.color }} />
              {d.name}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[10px] text-[var(--slate)] uppercase tracking-wider mb-1 px-1">Tags</h3>
            <button
              onClick={() => setFilterTag(null)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                !filterTag ? "bg-[rgba(201,165,82,0.15)] text-[var(--gold)]" : "text-[var(--slate)] hover:text-[var(--white)]"
              }`}
            >
              Tous les tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors truncate ${
                  filterTag === tag ? "bg-[rgba(201,165,82,0.15)] text-[var(--gold)]" : "text-[var(--slate)] hover:text-[var(--white)]"
                }`}
              >
                🏷 {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card list */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search + sort bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--navy-mid)] bg-[var(--navy)]/30">
          <svg className="w-4 h-4 text-[var(--slate)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" strokeWidth="2" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher (recto, verso, tags)..."
            className="flex-1 bg-transparent text-sm text-[var(--white)] outline-none placeholder-[var(--slate)]"
          />
          <span className="text-[10px] text-[var(--slate)] shrink-0">
            {filtered.length} carte{filtered.length > 1 ? "s" : ""}
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-[var(--navy)] border border-[var(--navy-mid)] rounded px-2 py-1 text-[10px] text-[var(--slate)] outline-none"
          >
            <option value="created">Récentes</option>
            <option value="due">Échéance</option>
            <option value="front">A → Z</option>
          </select>
        </div>

        {/* Multi-select actions */}
        {multiSelected.size > 0 && (
          <div className="px-3 py-2 border-b border-[var(--navy-mid)] bg-[rgba(201,165,82,0.05)] flex items-center gap-3 animate-fade-slide">
            <span className="text-xs"><strong className="text-[var(--gold)]">{multiSelected.size}</strong> sélectionnée{multiSelected.size > 1 ? "s" : ""}</span>
            <div className="relative">
              <button
                onClick={() => setShowMoveTo(!showMoveTo)}
                className="px-2 py-1 text-xs rounded border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(201,165,82,0.1)] transition-colors"
              >
                Déplacer vers...
              </button>
              {showMoveTo && (
                <div className="absolute top-full left-0 mt-1 bg-[var(--navy-light)] border border-[var(--navy-mid)] rounded-lg z-50 shadow-xl min-w-[150px] py-1 animate-fade-slide">
                  {decks.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => { moveCards(Array.from(multiSelected), d.id); setMultiSelected(new Set()); setShowMoveTo(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-[rgba(201,165,82,0.1)] transition-colors flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (confirm(`Supprimer ${multiSelected.size} carte(s) ?`)) {
                  multiSelected.forEach((id) => deleteCard(id));
                  setMultiSelected(new Set());
                }
              }}
              className="px-2 py-1 text-xs rounded border border-[var(--error)] text-[var(--error)] hover:bg-[rgba(224,92,92,0.1)] transition-colors"
            >
              Supprimer
            </button>
            <button onClick={() => setMultiSelected(new Set())} className="text-xs text-[var(--slate)]">Annuler</button>
          </div>
        )}

        {/* Card rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--slate)]">
              {search ? `Aucun résultat pour "${search}"` : "Aucune carte"}
            </div>
          ) : (
            <div className="text-sm">
              {/* Header with resize handles */}
              <div className="sticky top-0 bg-[var(--navy)] z-10 flex border-b border-[var(--navy-mid)]">
                <div className="w-8 shrink-0 flex items-center justify-center py-2">
                  <button
                    onClick={() => {
                      if (multiSelected.size === filtered.length) setMultiSelected(new Set());
                      else setMultiSelected(new Set(filtered.map((c) => c.id)));
                    }}
                    className={`w-3.5 h-3.5 rounded border-2 text-[8px] flex items-center justify-center ${
                      multiSelected.size === filtered.length && filtered.length > 0
                        ? "bg-[var(--gold)] border-[var(--gold)] text-[var(--navy)]"
                        : "border-[var(--slate)]"
                    }`}
                  >{multiSelected.size === filtered.length && filtered.length > 0 ? "✓" : ""}</button>
                </div>
                {COL_HEADERS.map((h, i) => (
                  <div
                    key={h}
                    className={`relative text-left px-3 py-2 text-[10px] text-[var(--slate)] uppercase tracking-wider font-medium shrink-0 ${
                      i > 1 ? "hidden md:block" : i > 0 ? "hidden sm:block" : ""
                    }`}
                    style={{ width: colWidths[i] }}
                  >
                    {h}
                    <div
                      onMouseDown={(e) => startResize(i, e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--gold)] transition-colors z-20"
                    />
                  </div>
                ))}
              </div>

              {/* Rows */}
              {filtered.map((c) => {
                const deck = deckMap.get(c.deck_id);
                const isDue = new Date(c.due) <= new Date();
                return (
                  <div
                    key={c.id}
                    onClick={() => selectCard(c)}
                    className={`flex border-b border-[var(--navy-mid)]/50 cursor-pointer transition-colors ${
                      selectedId === c.id
                        ? "bg-[rgba(201,165,82,0.1)]"
                        : multiSelected.has(c.id)
                          ? "bg-[rgba(201,165,82,0.05)]"
                          : "hover:bg-[rgba(201,165,82,0.03)]"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="w-8 shrink-0 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMultiSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                          return next;
                        });
                      }}
                    >
                      <div className={`w-3.5 h-3.5 rounded border-2 text-[8px] flex items-center justify-center ${
                        multiSelected.has(c.id)
                          ? "bg-[var(--gold)] border-[var(--gold)] text-[var(--navy)]"
                          : "border-[var(--navy-mid)] group-hover:border-[var(--slate)]"
                      }`}>{multiSelected.has(c.id) ? "✓" : ""}</div>
                    </div>
                    {/* Recto */}
                    <div className="px-3 py-2 shrink-0 overflow-hidden" style={{ width: colWidths[0] }}>
                      <div className="truncate" dangerouslySetInnerHTML={{ __html: c.front }} />
                      {c.tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {c.tags.slice(0, 3).map((t) => (
                            <span key={t} className="text-[8px] px-1 py-0.5 rounded-full bg-[rgba(201,165,82,0.12)] text-[var(--gold)]">{t}</span>
                          ))}
                          {c.tags.length > 3 && <span className="text-[8px] text-[var(--slate)]">+{c.tags.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    {/* Verso */}
                    <div className="px-3 py-2 shrink-0 overflow-hidden hidden sm:block" style={{ width: colWidths[1] }}>
                      <div className="truncate text-[var(--slate)]" dangerouslySetInnerHTML={{ __html: c.back }} />
                    </div>
                    {/* Deck */}
                    <div className="px-3 py-2 shrink-0 overflow-hidden hidden md:block" style={{ width: colWidths[2] }}>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: deck?.color ?? "var(--gold)" }} />
                        <span className="text-xs text-[var(--slate)] truncate">{deck?.name ?? "?"}</span>
                      </div>
                    </div>
                    {/* État */}
                    <div className="px-3 py-2 shrink-0 overflow-hidden hidden md:block" style={{ width: colWidths[3] }}>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          color: STATE_COLORS[c.state],
                          background: `${STATE_COLORS[c.state]}15`,
                        }}
                      >
                        {STATE_LABELS[c.state]}
                      </span>
                    </div>
                    {/* Échéance */}
                    <div className="px-3 py-2 shrink-0 overflow-hidden hidden md:block" style={{ width: colWidths[4] }}>
                      <span className={`text-xs ${isDue ? "text-[var(--gold)]" : "text-[var(--slate)]"}`}>
                        {new Date(c.due).toLocaleDateString("fr", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="shrink-0 border-l border-[var(--navy-mid)] overflow-y-auto bg-[var(--navy)]/30 hidden md:block relative" style={{ width: detailW }}>
        {/* Resize handle */}
        <div
          onMouseDown={(e) => startPanelResize("detail", e)}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--gold)] transition-colors z-20"
        />
        {selectedCard ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs text-[var(--slate)] uppercase tracking-wider">Édition</h3>
              <div className="flex gap-2">
                {dirty && (
                  <GoldButton onClick={saveCard} className="text-[10px] py-1 px-3">
                    Sauvegarder
                  </GoldButton>
                )}
                <button
                  onClick={() => { if (confirm("Supprimer cette carte ?")) deleteCard(selectedCard.id); }}
                  className="text-[10px] px-2 py-1 rounded border border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-[var(--navy)] transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-[var(--gold)] mb-1 block uppercase tracking-wider font-semibold">Recto</label>
              <RichTextEditor
                value={editFront}
                onChange={(v) => { setEditFront(v); setDirty(true); }}
                placeholder="Question..."
              />
            </div>

            <div>
              <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">Verso</label>
              <RichTextEditor
                value={editBack}
                onChange={(v) => { setEditBack(v); setDirty(true); }}
                placeholder="Réponse..."
              />
            </div>

            <div>
              <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">Tags</label>
              <TagInput
                tags={editTags}
                onChange={(t) => { setEditTags(t); setDirty(true); }}
                allTags={allTags}
              />
            </div>

            {/* Card info */}
            <div className="border-t border-[var(--navy-mid)] pt-3">
              <h4 className="text-[10px] text-[var(--slate)] uppercase tracking-wider mb-2">Infos</h4>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <span className="text-[var(--slate)]">Deck</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: deckMap.get(selectedCard.deck_id)?.color }} />
                  {deckMap.get(selectedCard.deck_id)?.name}
                </span>

                <span className="text-[var(--slate)]">État</span>
                <span style={{ color: STATE_COLORS[selectedCard.state] }}>
                  {STATE_LABELS[selectedCard.state]}
                </span>

                <span className="text-[var(--slate)]">Échéance</span>
                <span>{new Date(selectedCard.due).toLocaleDateString("fr", { day: "numeric", month: "long", year: "numeric" })}</span>

                <span className="text-[var(--slate)]">Révisions</span>
                <span>{selectedCard.reps}</span>

                <span className="text-[var(--slate)]">Erreurs</span>
                <span>{selectedCard.lapses}</span>

                <span className="text-[var(--slate)]">Stabilité</span>
                <span>{selectedCard.stability?.toFixed(1)}</span>

                <span className="text-[var(--slate)]">Difficulté</span>
                <span>{selectedCard.difficulty?.toFixed(1)}</span>

                <span className="text-[var(--slate)]">Créée</span>
                <span>{new Date(selectedCard.created_at).toLocaleDateString("fr")}</span>

                {selectedCard.last_review && (
                  <>
                    <span className="text-[var(--slate)]">Dernière révision</span>
                    <span>{new Date(selectedCard.last_review).toLocaleDateString("fr")}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[var(--slate)]">
            Sélectionne une carte
          </div>
        )}
      </div>
    </div>
  );
}
