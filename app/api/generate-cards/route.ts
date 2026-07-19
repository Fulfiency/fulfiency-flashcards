import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_CHARS = 40000; // garde-fou input tokens
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 Mo (Next.js plafonne le body des route handlers à 10 Mo)
const MAX_EXISTING_FRONTS_CHARS = 4000; // garde-fou tokens pour la liste d'exclusion

// Rate limit en mémoire (anti-rafale) — remis à zéro à chaque redémarrage, suffisant pour limiter l'abus au coup par coup.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const rateLimitHits = new Map<string, number[]>();

// Limite mensuelle persistée en base (table ai_generation_log), résiste aux redémarrages/redéploiements.
const MONTHLY_LIMIT = 50;

// Comptes exemptés des limites (tests internes), ex: "moi@exemple.com,autre@exemple.com"
const UNLIMITED_EMAILS = (process.env.UNLIMITED_AI_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isUnlimited(email: string | undefined | null): boolean {
  return !!email && UNLIMITED_EMAILS.includes(email.toLowerCase());
}

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateLimitHits.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    rateLimitHits.set(userId, hits);
    return true;
  }
  hits.push(now);
  rateLimitHits.set(userId, hits);
  return false;
}

function buildPrompt(count: number, text: string, existingFronts: string[]) {
  let exclusionList = existingFronts;
  let charBudget = MAX_EXISTING_FRONTS_CHARS;
  exclusionList = exclusionList.filter((f) => {
    charBudget -= f.length;
    return charBudget > 0;
  });

  const exclusion = exclusionList.length
    ? `\nCartes déjà existantes dans ce deck, à ne pas reproduire ni reformuler (n'aborde pas les mêmes notions) :\n${exclusionList.map((f) => `- ${f}`).join("\n")}\n`
    : "";

  return `Voici un extrait de cours. Génère ${count} flashcards recto/verso pour réviser ce contenu, dans la même langue que le cours.

Consignes de qualité :
- Varie les formats de question : définition, cause/conséquence, comparaison, application pratique, "pourquoi/comment". Évite que toutes les cartes suivent le même moule.
- Interdit les questions fermées oui/non ou vrai/faux ("Est-ce que...", "X fait-il...") : reformule-les pour qu'elles appellent une vraie réponse (ex. "Pourquoi X ?", "Que se passe-t-il si X ?").
- Chaque carte teste une notion différente et non triviale (pas de simple copier-coller d'une phrase du texte en question).
- Le recto est une question courte et sans ambiguïté (une seule phrase).
- Le verso est une réponse concise : une phrase, 25 mots maximum, sans réexpliquer la question et sans liste à puces.
- Interdiction stricte de consacrer plusieurs cartes au même évènement, fait ou paragraphe, même sous des angles différents (cause, symbole, conséquence, importance...) : une carte = un fait distinct.
- Découpe mentalement le texte en ${count} portions à peu près égales (début, milieu, fin) et prends un fait dans chaque portion : ne t'arrête pas sur les premières phrases, même si elles sont riches en contenu. Si le texte est chronologique ou énumère plusieurs éléments, chaque carte doit correspondre à un élément différent de la liste ou de la chronologie, répartis sur toute sa longueur.
- Exception : si le texte est vraiment trop court ou pauvre pour fournir ${count} notions distinctes (par exemple une seule phrase sur un seul fait), génère moins de cartes plutôt que d'inventer ou de répéter — mais dans un texte de la longueur d'un cours normal, vise toujours exactement ${count} cartes.
${exclusion}
Voici un exemple isolé illustrant uniquement le FORMAT attendu (question courte + réponse d'une phrase), pas la quantité à produire — ignore son sujet et son nombre :
{"front": "Pourquoi le fer rouille-t-il au contact de l'eau et de l'oxygène ?", "back": "L'oxygène et l'eau réagissent avec le fer pour former de l'oxyde de fer hydraté, un processus d'oxydoréduction."}

Méthode à suivre, dans cet ordre :
1. Relis tout le texte et liste, en 3-4 mots-clés chacun (pas de phrase complète), les ${count} faits ou notions les plus importants et les plus distincts, dans l'ordre où ils apparaissent dans le texte (du début à la fin, pas seulement le premier paragraphe).
2. Vérifie que ta liste ne contient aucun doublon ni variation d'un même fait.
3. Rédige ensuite une carte par fait de la liste, dans le même ordre.
4. Termine ta réponse par le JSON final (et uniquement lui à la toute fin), un tableau de ${count} objets {"front": "...", "back": "..."}.

Cours :
"""
${text}
"""`;
}

function currentMonthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (isUnlimited(user.email)) {
    return NextResponse.json({ used: 0, limit: null });
  }

  const { count } = await supabase
    .from("ai_generation_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", currentMonthStart().toISOString());

  return NextResponse.json({ used: count ?? 0, limit: MONTHLY_LIMIT });
}

function extractJson(raw: string): unknown {
  const start = raw.lastIndexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const count = Math.min(Math.max(Number(formData.get("count")) || 10, 1), 30);
  const existingFronts: string[] = (() => {
    try {
      const raw = formData.get("existingFronts");
      const parsed = raw ? JSON.parse(String(raw)) : [];
      return Array.isArray(parsed) ? parsed.filter((f) => typeof f === "string").slice(0, 200) : [];
    } catch {
      return [];
    }
  })();

  if (!file) {
    return NextResponse.json({ error: "Fichier PDF manquant" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Le fichier dépasse la taille maximale autorisée (8 Mo)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "Ce fichier n'est pas un PDF valide" }, { status: 400 });
  }

  let text: string;
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    text = result.text;
  } catch (e) {
    console.error("PDF parse error:", e);
    return NextResponse.json({ error: "Impossible de lire ce PDF (scanné ou corrompu ?)" }, { status: 422 });
  }

  text = text.trim();
  if (text.length < 50) {
    return NextResponse.json({ error: "Pas assez de texte extrait de ce PDF" }, { status: 422 });
  }
  const truncated = text.length > MAX_CHARS;
  if (truncated) {
    text = text.slice(0, MAX_CHARS);
  }

  const unlimited = isUnlimited(user.email);

  if (!unlimited && isRateLimited(user.id)) {
    return NextResponse.json(
      { error: `Limite de ${RATE_LIMIT_MAX} générations toutes les 10 minutes atteinte, réessaie plus tard.` },
      { status: 429 }
    );
  }

  if (!unlimited) {
    const { count: monthlyCount } = await supabase
      .from("ai_generation_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", currentMonthStart().toISOString());

    if ((monthlyCount ?? 0) >= MONTHLY_LIMIT) {
      return NextResponse.json(
        { error: `Limite de ${MONTHLY_LIMIT} générations par mois atteinte. Réessaie le mois prochain.` },
        { status: 429 }
      );
    }
  }

  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt(count, text, existingFronts);

  async function callModel(messages: Anthropic.MessageParam[]) {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      temperature: 0.3,
      messages,
    });
    const block = msg.content[0];
    return block.type === "text" ? block.text : "";
  }

  let raw: string;
  try {
    raw = await callModel([{ role: "user", content: prompt }]);
  } catch (e) {
    console.error("Anthropic call error:", e);
    return NextResponse.json({ error: "Erreur lors de la génération IA" }, { status: 502 });
  }

  let parsed = extractJson(raw);
  if (!parsed) {
    // Une seule relance : on force une sortie JSON pure, sans raisonnement.
    try {
      raw = await callModel([
        { role: "user", content: prompt },
        { role: "assistant", content: raw },
        { role: "user", content: 'Ta réponse ne contient pas de JSON valide. Réponds UNIQUEMENT avec le tableau JSON demandé, sans aucun texte, raisonnement ou balise de code autour.' },
      ]);
    } catch (e) {
      console.error("Anthropic retry error:", e);
      return NextResponse.json({ error: "Erreur lors de la génération IA" }, { status: 502 });
    }
    parsed = extractJson(raw);
  }

  if (!parsed || !Array.isArray(parsed)) {
    return NextResponse.json({ error: "Réponse IA invalide" }, { status: 502 });
  }

  const cards = (parsed as { front: string; back: string }[]).filter(
    (c) =>
      c &&
      typeof c.front === "string" &&
      typeof c.back === "string" &&
      c.front.trim().length > 0 &&
      c.back.trim().length > 0 &&
      c.front.length <= 220 &&
      c.back.length <= 400
  );

  if (cards.length > 0) {
    await supabase.from("ai_generation_log").insert({ user_id: user.id });
  }

  return NextResponse.json({ cards, truncated });
}
