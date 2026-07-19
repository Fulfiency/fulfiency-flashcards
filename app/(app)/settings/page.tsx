"use client";

import { useState, useRef, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import GoldButton from "@/components/ui/GoldButton";
import { playClick, playSuccess } from "@/lib/sounds";
import { getColorShortcuts, saveColorShortcuts, type ColorShortcut } from "@/lib/recentColors";
import { subscribeToPush, unsubscribeFromPush, getNotificationStatus } from "@/lib/push";
import { exportApkgMulti, importApkg } from "@/lib/anki";

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const [colorShortcuts, setColorShortcuts] = useState<ColorShortcut[]>([]);
  const [importing, setImporting] = useState(false);
  const [importingApkg, setImportingApkg] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [exportApkgMsg, setExportApkgMsg] = useState("");
  const apkgFileInputRef = useRef<HTMLInputElement>(null);
  const [notifStatus, setNotifStatus] = useState<"unsupported" | "denied" | "granted" | "default">("default");
  const [notifLoading, setNotifLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    setColorShortcuts(getColorShortcuts());
    getNotificationStatus().then(setNotifStatus);
  }, []);

  async function toggleNotifications() {
    setNotifLoading(true);
    if (notifStatus === "granted") {
      await unsubscribeFromPush();
      setNotifStatus("default");
    } else {
      const ok = await subscribeToPush();
      setNotifStatus(ok ? "granted" : "denied");
    }
    setNotifLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function updateShortcutColor(key: string, color: string) {
    const updated = colorShortcuts.map((s) => (s.key === key ? { ...s, color } : s));
    setColorShortcuts(updated);
    saveColorShortcuts(updated);
  }

  function updateShortcutLabel(key: string, label: string) {
    const updated = colorShortcuts.map((s) => (s.key === key ? { ...s, label } : s));
    setColorShortcuts(updated);
    saveColorShortcuts(updated);
  }

  // Export all decks as JSON
  async function exportDecks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: decks } = await supabase
      .from("decks")
      .select("*")
      .eq("user_id", user.id);

    if (!decks || decks.length === 0) {
      setExportMsg("Aucun deck à exporter");
      return;
    }

    const { data: cards } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", user.id);

    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      decks: decks.map((d) => ({
        name: d.name,
        description: d.description,
        color: d.color,
        cards: (cards ?? [])
          .filter((c) => c.deck_id === d.id)
          .map((c) => ({
            front: c.front,
            back: c.back,
            tags: c.tags ?? [],
            state: c.state,
            stability: c.stability,
            difficulty: c.difficulty,
            reps: c.reps,
            lapses: c.lapses,
            due: c.due,
            elapsed_days: c.elapsed_days,
            scheduled_days: c.scheduled_days,
            last_review: c.last_review,
          })),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fulfiency-flashcards-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportMsg(`${decks.length} deck(s) exporté(s)`);
    if (settings.soundEnabled) playSuccess();
    setTimeout(() => setExportMsg(""), 3000);
  }

  // Import decks from JSON
  async function importDecks(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.decks || !Array.isArray(data.decks)) {
        alert("Format de fichier invalide");
        setImporting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let importedDecks = 0;
      let importedCards = 0;

      for (const deck of data.decks) {
        const { data: newDeck } = await supabase
          .from("decks")
          .insert({
            name: deck.name || "Deck importé",
            description: deck.description || null,
            color: deck.color || "#c9a552",
            user_id: user.id,
          })
          .select("id")
          .single();

        if (!newDeck) continue;
        importedDecks++;

        if (deck.cards && Array.isArray(deck.cards)) {
          const cardRows = deck.cards.map((c: any) => ({
            deck_id: newDeck.id,
            user_id: user.id,
            front: c.front || "",
            back: c.back || "",
            tags: c.tags || [],
            state: c.state ?? 0,
            stability: c.stability ?? 0,
            difficulty: c.difficulty ?? 0,
            reps: c.reps ?? 0,
            lapses: c.lapses ?? 0,
            due: c.due || new Date().toISOString(),
            elapsed_days: c.elapsed_days ?? 0,
            scheduled_days: c.scheduled_days ?? 0,
            last_review: c.last_review || null,
          }));

          const { data: inserted } = await supabase.from("cards").insert(cardRows).select("id");
          importedCards += inserted?.length ?? 0;
        }
      }

      alert(`Importé : ${importedDecks} deck(s), ${importedCards} carte(s)`);
      if (settings.soundEnabled) playSuccess();
    } catch {
      alert("Erreur lors de l'import. Vérifiez le format du fichier.");
    }
    setImporting(false);
  }

  async function exportApkgAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: decks } = await supabase.from("decks").select("*").eq("user_id", user.id);
    if (!decks || decks.length === 0) {
      setExportApkgMsg("Aucun deck à exporter");
      return;
    }
    const { data: cards } = await supabase.from("cards").select("*").eq("user_id", user.id);

    const blob = await exportApkgMulti(
      decks.map((d) => ({
        name: d.name,
        cards: (cards ?? [])
          .filter((c) => c.deck_id === d.id)
          .map((c) => ({ front: c.front, back: c.back, tags: c.tags ?? [] })),
      }))
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fulfiency-flashcards-${new Date().toISOString().slice(0, 10)}.apkg`;
    a.click();
    URL.revokeObjectURL(url);

    setExportApkgMsg(`${decks.length} deck(s) exporté(s)`);
    if (settings.soundEnabled) playSuccess();
    setTimeout(() => setExportApkgMsg(""), 3000);
  }

  async function importApkgFile(file: File) {
    setImportingApkg(true);
    try {
      const decksFound = await importApkg(file);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let importedDecks = 0;
      let importedCards = 0;

      for (const deck of decksFound) {
        const { data: newDeck } = await supabase
          .from("decks")
          .insert({ name: deck.deckName, user_id: user.id, color: "#c9a552" })
          .select("id")
          .single();
        if (!newDeck) continue;
        importedDecks++;

        if (deck.cards.length) {
          const { data: inserted } = await supabase
            .from("cards")
            .insert(
              deck.cards.map((c) => ({
                deck_id: newDeck.id,
                user_id: user.id,
                front: c.front,
                back: c.back,
                tags: c.tags ?? [],
              }))
            )
            .select("id");
          importedCards += inserted?.length ?? 0;
        }
      }

      alert(`Importé : ${importedDecks} deck(s), ${importedCards} carte(s)`);
      if (settings.soundEnabled) playSuccess();
    } catch (e) {
      alert(`Import échoué : ${e instanceof Error ? e.message : e}`);
    }
    setImportingApkg(false);
  }

  function Toggle({
    checked,
    onChange: onToggle,
    label,
    description,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description?: string;
  }) {
    return (
      <div className="flex items-center justify-between py-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          {description && <div className="text-xs text-[var(--slate)]">{description}</div>}
        </div>
        <button
          onClick={() => {
            onToggle(!checked);
            if (settings.soundEnabled) playClick();
          }}
          className={`w-11 h-6 rounded-full transition-colors relative ${
            checked ? "bg-[var(--gold)]" : "bg-[var(--navy-mid)]"
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              checked ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="font-[family-name:var(--font-playfair-display)] text-3xl font-bold mb-6">
        Paramètres
      </h1>

      <div className="space-y-6">
        {/* Audio */}
        <Card>
          <h2 className="font-[family-name:var(--font-playfair-display)] text-lg font-bold mb-2">Audio</h2>
          <Toggle
            checked={settings.soundEnabled}
            onChange={(v) => update({ soundEnabled: v })}
            label="Effets sonores"
            description="Sons lors du flip, notation et actions"
          />
        </Card>

        {/* Visual */}
        <Card>
          <h2 className="font-[family-name:var(--font-playfair-display)] text-lg font-bold mb-2">Apparence</h2>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium">Thème</div>
              <div className="text-xs text-[var(--slate)]">Sombre ou clair</div>
            </div>
            <div className="flex gap-1 bg-[var(--navy)] rounded-lg p-1">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => update({ theme: t })}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    settings.theme === t ? "bg-[var(--gold)] text-[var(--navy)]" : "text-[var(--slate)]"
                  }`}
                >
                  {t === "dark" ? "Sombre" : "Clair"}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={settings.particlesEnabled}
            onChange={(v) => update({ particlesEnabled: v })}
            label="Particules dorées"
            description="Particules flottantes en arrière-plan"
          />
          <Toggle
            checked={settings.showIntervals}
            onChange={(v) => update({ showIntervals: v })}
            label="Afficher les intervalles"
            description="Prochaine date sous chaque bouton de notation"
          />
        </Card>

        {/* Review */}
        <Card>
          <h2 className="font-[family-name:var(--font-playfair-display)] text-lg font-bold mb-2">Révision</h2>
          <Toggle
            checked={settings.focusMode}
            onChange={(v) => update({ focusMode: v })}
            label="Mode focus"
            description="Cache la navbar pendant les révisions"
          />
          <div className="py-3">
            <label className="text-sm font-medium block mb-2">Objectif quotidien</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={5} max={100} step={5}
                value={settings.dailyGoal}
                onChange={(e) => update({ dailyGoal: parseInt(e.target.value) })}
                className="flex-1 accent-[var(--gold)]"
              />
              <span className="text-sm text-[var(--gold)] font-bold w-10 text-right">
                {settings.dailyGoal}
              </span>
            </div>
          </div>
          <div className="py-3">
            <label className="text-sm font-medium block mb-2">Cartes par session (max)</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={10} max={200} step={10}
                value={settings.cardsPerSession}
                onChange={(e) => update({ cardsPerSession: parseInt(e.target.value) })}
                className="flex-1 accent-[var(--gold)]"
              />
              <span className="text-sm text-[var(--gold)] font-bold w-10 text-right">
                {settings.cardsPerSession}
              </span>
            </div>
          </div>
        </Card>

        {/* Color shortcuts */}
        <Card>
          <h2 className="font-[family-name:var(--font-playfair-display)] text-lg font-bold mb-3">
            Raccourcis couleurs
          </h2>
          <p className="text-xs text-[var(--slate)] mb-3">
            Ctrl+Alt+N° dans l'éditeur pour appliquer la couleur
          </p>
          <div className="space-y-2">
            {colorShortcuts.map((sc) => (
              <div key={sc.key} className="flex items-center gap-3">
                <kbd className="px-2 py-0.5 rounded bg-[var(--navy)] text-[var(--gold)] text-xs font-mono w-8 text-center">
                  {sc.key}
                </kbd>
                <input
                  type="color"
                  value={sc.color}
                  onChange={(e) => updateShortcutColor(sc.key, e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border border-[var(--navy-mid)] bg-transparent"
                />
                <input
                  value={sc.label}
                  onChange={(e) => updateShortcutLabel(sc.key, e.target.value)}
                  className="flex-1 px-2 py-1 bg-[var(--navy)] border border-[var(--navy-mid)] rounded text-xs text-[var(--white)]"
                />
                <span className="w-4 h-4 rounded-full" style={{ background: sc.color }} />
              </div>
            ))}
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <h2 className="font-[family-name:var(--font-playfair-display)] text-lg font-bold mb-2">Notifications</h2>
          {notifStatus === "unsupported" ? (
            <p className="text-xs text-[var(--slate)]">Notifications non supportées sur ce navigateur.</p>
          ) : notifStatus === "denied" ? (
            <p className="text-xs text-[var(--error)]">
              Notifications bloquées. Autorise-les dans les paramètres du navigateur, puis reviens ici.
            </p>
          ) : (
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-sm font-medium">Rappels quotidiens</div>
                <div className="text-xs text-[var(--slate)]">Notification chaque matin si des cartes sont à réviser</div>
              </div>
              <button
                onClick={toggleNotifications}
                disabled={notifLoading}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                  notifStatus === "granted" ? "bg-[var(--gold)]" : "bg-[var(--navy-mid)]"
                } ${notifLoading ? "opacity-50" : ""}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  notifStatus === "granted" ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </button>
            </div>
          )}
        </Card>

        {/* Import/Export */}
        <Card>
          <h2 className="font-[family-name:var(--font-playfair-display)] text-lg font-bold mb-3">
            Import / Export
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[var(--slate)] mb-2">
                Exporte tous tes decks et cartes en JSON (avec progression FSRS et tags).
              </p>
              <GoldButton onClick={exportDecks} fullWidth className="text-xs py-2">
                Exporter tous les decks
              </GoldButton>
              {exportMsg && (
                <p className="text-xs text-[var(--sage)] mt-2">{exportMsg}</p>
              )}
            </div>

            <div className="border-t border-[var(--navy-mid)] pt-3">
              <p className="text-xs text-[var(--slate)] mb-2">
                Importe des decks depuis un fichier JSON Fulfiency.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="w-full py-3 rounded-lg border border-dashed border-[rgba(201,165,82,0.3)] text-[var(--gold)] text-sm font-medium hover:bg-[rgba(201,165,82,0.05)] transition-colors"
              >
                {importing ? "Import en cours..." : "Choisir un fichier JSON"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importDecks(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="border-t border-[var(--navy-mid)] pt-3">
              <p className="text-xs text-[var(--slate)] mb-2">
                Exporte tous tes decks en .apkg (compatible Anki).
              </p>
              <GoldButton onClick={exportApkgAll} fullWidth className="text-xs py-2">
                Exporter en .apkg
              </GoldButton>
              {exportApkgMsg && (
                <p className="text-xs text-[var(--sage)] mt-2">{exportApkgMsg}</p>
              )}
            </div>

            <div className="border-t border-[var(--navy-mid)] pt-3">
              <p className="text-xs text-[var(--slate)] mb-2">
                Importe un ou plusieurs decks depuis un fichier .apkg Anki.
              </p>
              <button
                onClick={() => apkgFileInputRef.current?.click()}
                disabled={importingApkg}
                className="w-full py-3 rounded-lg border border-dashed border-[rgba(201,165,82,0.3)] text-[var(--gold)] text-sm font-medium hover:bg-[rgba(201,165,82,0.05)] transition-colors"
              >
                {importingApkg ? "Import en cours..." : "Choisir un fichier .apkg"}
              </button>
              <input
                ref={apkgFileInputRef}
                type="file"
                accept=".apkg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importApkgFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </Card>

        {/* Keyboard shortcuts */}
        <Card>
          <h2 className="font-[family-name:var(--font-playfair-display)] text-lg font-bold mb-3">
            Raccourcis clavier
          </h2>
          <div className="space-y-2 text-sm">
            <h3 className="text-xs text-[var(--slate)] uppercase tracking-wider mt-2">Révision</h3>
            {[
              ["Espace / Entrée", "Retourner la carte"],
              ["1", "À revoir (Again)"],
              ["2", "Difficile (Hard)"],
              ["3", "Bien (Good)"],
              ["4", "Facile (Easy)"],
            ].map(([key, desc]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-[var(--slate)]">{desc}</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--navy)] text-[var(--gold)] text-xs font-mono">{key}</kbd>
              </div>
            ))}

            <h3 className="text-xs text-[var(--slate)] uppercase tracking-wider mt-4">Éditeur de cartes</h3>
            {[
              ["Ctrl+B", "Gras"],
              ["Ctrl+I", "Italique"],
              ["Ctrl+U", "Souligner"],
              ["Ctrl+Alt+D", "Barrer"],
              ["Ctrl+H", "Surligner rapide (or)"],
              ["Ctrl+Alt+C", "Menu couleurs texte"],
              ["Ctrl+Alt+H", "Menu surlignage"],
              ["Ctrl+Alt+1-6", "Couleur rapide (personnalisable)"],
              ["Ctrl+Alt+G", "Aligner à gauche"],
              ["Ctrl+Alt+E", "Centrer"],
              ["Ctrl+Alt+R", "Aligner à droite"],
              ["Ctrl+Alt+L", "Liste à puces"],
              ["Ctrl+Alt+O", "Liste numérotée"],
              ["Tab", "Sous-puce (indenter)"],
              ["Shift+Tab", "Désindenter"],
              ["Ctrl+Shift+N", "Nouvelle carte"],
              ["Ctrl+Enter", "Sauvegarder le deck"],
            ].map(([key, desc]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-[var(--slate)]">{desc}</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--navy)] text-[var(--gold)] text-xs font-mono">{key}</kbd>
              </div>
            ))}

            <h3 className="text-xs text-[var(--slate)] uppercase tracking-wider mt-4">Tags</h3>
            {[
              ["Entrée / Virgule / Tab", "Ajouter un tag"],
              ["Backspace", "Supprimer le dernier tag"],
            ].map(([key, desc]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-[var(--slate)]">{desc}</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--navy)] text-[var(--gold)] text-xs font-mono">{key}</kbd>
              </div>
            ))}
          </div>
        </Card>

        {/* Account */}
        <Card>
          <h2 className="font-[family-name:var(--font-playfair-display)] text-lg font-bold mb-3">Compte</h2>
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-lg border border-[var(--error)] text-[var(--error)] text-sm font-medium hover:bg-[var(--error)] hover:text-[var(--navy)] transition-colors"
          >
            Se déconnecter
          </button>
        </Card>
      </div>
    </div>
  );
}
