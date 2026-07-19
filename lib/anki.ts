// Import/export decks to Anki .apkg format (client-side, sql.js + jszip)
import initSqlJs, { Database } from "sql.js";
import JSZip from "jszip";

export interface ApkgCard {
  front: string;
  back: string;
  tags?: string[];
}

export interface ApkgDeck {
  name: string;
  cards: ApkgCard[];
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;
function loadSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: (f) => `/${f}` });
  }
  return sqlPromise;
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

const FIELD_SEP = String.fromCharCode(31); // Anki field separator (0x1f)

// Basic note type id/model used across the whole export — fixed constants are fine,
// Anki re-keys on import if a collision with the user's existing collection occurs.
const MODEL_ID = 1;
const DECK_ID = 2;

function buildAnkiSchema(db: Database) {
  db.run(`
    CREATE TABLE col (
      id integer primary key, crt integer, mod integer, scm integer, ver integer,
      dty integer, usn integer, ls integer, conf text, models text, decks text,
      dconf text, tags text
    );
    CREATE TABLE notes (
      id integer primary key, guid text, mid integer, mod integer, usn integer,
      tags text, flds text, sfld text, csum integer, flags integer, data text
    );
    CREATE TABLE cards (
      id integer primary key, nid integer, did integer, ord integer, mod integer,
      usn integer, type integer, queue integer, due integer, ivl integer,
      factor integer, reps integer, lapses integer, left integer, odue integer,
      odid integer, flags integer, data text
    );
    CREATE TABLE revlog (
      id integer primary key, cid integer, usn integer, ease integer, ivl integer,
      lastIvl integer, factor integer, time integer, type integer
    );
    CREATE TABLE graves (usn integer, oid integer, type integer);
    CREATE INDEX ix_notes_usn ON notes (usn);
    CREATE INDEX ix_cards_usn ON cards (usn);
    CREATE INDEX ix_revlog_usn ON revlog (usn);
    CREATE INDEX ix_cards_nid ON cards (nid);
    CREATE INDEX ix_cards_sched ON cards (did, queue, due);
    CREATE INDEX ix_revlog_cid ON revlog (cid);
    CREATE INDEX ix_notes_csum ON notes (csum);
  `);
}

function ankiModel(firstDeckId: number) {
  const now = Date.now();
  return {
    [MODEL_ID]: {
      id: MODEL_ID,
      name: "Basic",
      type: 0,
      mod: Math.floor(now / 1000),
      usn: -1,
      sortf: 0,
      did: firstDeckId,
      tmpls: [
        {
          name: "Card 1",
          ord: 0,
          qfmt: "{{Front}}",
          afmt: "{{FrontSide}}<hr id=answer>{{Back}}",
          bqfmt: "",
          bafmt: "",
          did: null,
          bfont: "",
          bsize: 0,
        },
      ],
      flds: [
        { name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20 },
        { name: "Back", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20 },
      ],
      css: ".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
      latexPre: "",
      latexPost: "",
      req: [[0, "any", [0]]],
    },
  };
}

function ankiDecks(decks: { id: number; name: string }[]) {
  const now = Math.floor(Date.now() / 1000);
  const result: Record<string, unknown> = {
    "1": { id: 1, name: "Default", extendRev: 50, usn: -1, collapsed: false, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], conf: 1, desc: "", dyn: 0 },
  };
  for (const d of decks) {
    result[d.id] = { id: d.id, mod: now, name: d.name, usn: -1, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0], collapsed: false, browserCollapsed: false, desc: "", dyn: 0, conf: 1, extendNew: 10, extendRev: 50 };
  }
  return result;
}

function fieldChecksum(): number {
  // Anki uses first 8 hex digits of sha1 of the sort field as unsigned int
  return 0; // csum is only used for duplicate detection; safe to leave 0 on export
}

export async function exportApkgMulti(decks: ApkgDeck[]): Promise<Blob> {
  const SQL = await loadSql();
  const db = new SQL.Database();
  buildAnkiSchema(db);

  const now = Math.floor(Date.now() / 1000);
  const deckIds = decks.map((_, i) => DECK_ID + i);
  const conf = JSON.stringify({ nextPos: 1, estTimes: true, activeDecks: [1], sortType: "noteFld", timeLim: 0, sortBackwards: false, addToCur: true, curDeck: deckIds[0] ?? 1, newBury: true, newSpread: 0, dueCounts: true, collapseTime: 1200 });
  const dconf = JSON.stringify({ 1: { id: 1, mod: now, name: "Default", new: { perDay: 20, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, bury: false }, rev: { perDay: 200, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, bury: false, minSpace: 1 }, lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 0 }, maxTaken: 60, timer: 0, autoplay: true, replayq: true, usn: 0 } });

  db.run("INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [
    1, now, now * 1000, now * 1000, 11, 0, 0, 0,
    conf, JSON.stringify(ankiModel(deckIds[0] ?? 1)),
    JSON.stringify(ankiDecks(decks.map((d, i) => ({ id: deckIds[i], name: d.name })))),
    dconf, "{}",
  ]);

  let noteId = now * 1000;
  let cardId = now * 1000 + 1;
  decks.forEach((deck, i) => {
    const did = deckIds[i];
    for (const card of deck.cards) {
      const flds = card.front + FIELD_SEP + card.back;
      const sfld = stripHtml(card.front);
      const tags = card.tags && card.tags.length ? ` ${card.tags.join(" ")} ` : "";
      const guid = Math.random().toString(36).slice(2, 12);

      db.run("INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
        noteId, guid, MODEL_ID, now, -1, tags, flds, sfld, fieldChecksum(), 0, "",
      ]);
      db.run("INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
        cardId, noteId, did, 0, now, -1, 0, 0, cardId, 0, 0, 0, 0, 0, 0, 0, 0, "",
      ]);
      noteId++;
      cardId++;
    }
  });

  const data = db.export();
  db.close();

  const zip = new JSZip();
  zip.file("collection.anki2", data);
  zip.file("media", "{}");
  return zip.generateAsync({ type: "blob" });
}

export async function exportApkg(deckName: string, cards: ApkgCard[]): Promise<Blob> {
  return exportApkgMulti([{ name: deckName, cards }]);
}

export async function importApkg(file: File): Promise<{ deckName: string; cards: ApkgCard[] }[]> {
  const SQL = await loadSql();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Anki 2.1.50+ writes the real data as a zstd-compressed schema-18 DB
  // (collection.anki21b); collection.anki2/anki21 are legacy fallbacks
  // (anki2 is often just an "upgrade your client" stub in modern exports).
  const modernFile = zip.file("collection.anki21b");
  const legacyFile = zip.file("collection.anki21") ?? zip.file("collection.anki2");

  let dbBuf: Uint8Array;
  let modern = false;
  if (modernFile) {
    const { decompress } = await import("fzstd");
    dbBuf = decompress(await modernFile.async("uint8array"));
    modern = true;
  } else if (legacyFile) {
    dbBuf = await legacyFile.async("uint8array");
  } else {
    throw new Error("Fichier .apkg invalide : collection introuvable");
  }

  const db = new SQL.Database(dbBuf);
  const deckNames: Record<string, string> = {};

  if (modern) {
    const decksRes = db.exec("SELECT id, name FROM decks");
    for (const row of decksRes[0]?.values ?? []) {
      deckNames[String(row[0])] = row[1] as string;
    }
  } else {
    const decksRow = db.exec("SELECT decks FROM col LIMIT 1");
    const decksJson = JSON.parse(decksRow[0].values[0][0] as string);
    for (const id of Object.keys(decksJson)) deckNames[id] = decksJson[id].name;
  }

  const res = db.exec(`
    SELECT notes.flds, cards.did, notes.tags
    FROM cards JOIN notes ON cards.nid = notes.id
    WHERE cards.ord = 0
  `);
  db.close();

  const byDeck = new Map<string, ApkgCard[]>();
  if (res.length) {
    for (const row of res[0].values) {
      const flds = row[0] as string;
      const did = String(row[1]);
      const tagsStr = (row[2] as string) || "";
      const parts = flds.split(FIELD_SEP);
      const front = parts[0] ?? "";
      const back = parts[1] ?? "";
      const tags = tagsStr.trim().split(/\s+/).filter(Boolean);
      const deckName = deckNames[did] ?? "Import";
      if (!byDeck.has(deckName)) byDeck.set(deckName, []);
      byDeck.get(deckName)!.push({ front, back, tags });
    }
  }

  return Array.from(byDeck.entries()).map(([deckName, cards]) => ({ deckName, cards }));
}
