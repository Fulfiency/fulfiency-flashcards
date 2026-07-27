import { describe, it, expect } from "vitest";
import { extractJson, isValidCard, extractNewCompleteObjects } from "./route";

describe("extractJson", () => {
  it("extracts a JSON array preceded by reasoning text", () => {
    const raw = `1. keyword list\n2. no dupes\n3. cards\n4. final answer:\n[{"front":"Q1","back":"A1"},{"front":"Q2","back":"A2"}]`;
    expect(extractJson(raw)).toEqual([
      { front: "Q1", back: "A1" },
      { front: "Q2", back: "A2" },
    ]);
  });

  it("returns null when there is no array", () => {
    expect(extractJson("no json here")).toBeNull();
  });

  it("returns null on malformed JSON between brackets", () => {
    expect(extractJson("blah [not valid json] blah")).toBeNull();
  });

  it("uses the last bracket pair, ignoring stray brackets in reasoning", () => {
    const raw = `Some text mentioning [not the array] then the real one:\n[{"front":"Q","back":"A"}]`;
    expect(extractJson(raw)).toEqual([{ front: "Q", back: "A" }]);
  });
});

describe("isValidCard", () => {
  it("accepts a well-formed card", () => {
    expect(isValidCard({ front: "Q", back: "A" })).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(isValidCard({ front: "Q" })).toBe(false);
    expect(isValidCard(null)).toBe(false);
    expect(isValidCard("not an object")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isValidCard({ front: "  ", back: "A" })).toBe(false);
  });

  it("rejects cards exceeding length limits", () => {
    expect(isValidCard({ front: "a".repeat(221), back: "A" })).toBe(false);
    expect(isValidCard({ front: "Q", back: "a".repeat(401) })).toBe(false);
  });
});

describe("extractNewCompleteObjects", () => {
  it("extracts objects incrementally as the array text grows (streaming simulation)", () => {
    const full = `[{"front":"Q1","back":"A1"},{"front":"Q2","back":"A2"},{"front":"Q3","back":"A3"}]`;
    let consumedUpto = 0;
    const seen: unknown[] = [];
    // Simule un flux token par token
    for (let i = 1; i <= full.length; i++) {
      const { objects, consumedUpto: next } = extractNewCompleteObjects(full.slice(0, i), consumedUpto);
      seen.push(...objects);
      consumedUpto = next;
    }
    expect(seen).toEqual([
      { front: "Q1", back: "A1" },
      { front: "Q2", back: "A2" },
      { front: "Q3", back: "A3" },
    ]);
  });

  it("does not re-emit already consumed objects", () => {
    const arrayText = `[{"front":"Q1","back":"A1"}`;
    const first = extractNewCompleteObjects(arrayText, 0);
    expect(first.objects).toEqual([{ front: "Q1", back: "A1" }]);

    const grown = arrayText + `,{"front":"Q2","back":"A2"}]`;
    const second = extractNewCompleteObjects(grown, first.consumedUpto);
    expect(second.objects).toEqual([{ front: "Q2", back: "A2" }]);
  });

  it("handles braces and brackets inside string values without miscounting depth", () => {
    const arrayText = `[{"front":"What is {x}? And [y]?","back":"A \\"quoted\\" value with }brace"}]`;
    const { objects } = extractNewCompleteObjects(arrayText, 0);
    expect(objects).toEqual([
      { front: "What is {x}? And [y]?", back: 'A "quoted" value with }brace' },
    ]);
  });
});
