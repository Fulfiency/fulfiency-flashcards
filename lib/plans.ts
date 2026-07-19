export type Plan = "starter" | "pro" | "elite";

export const PRICE_TO_PLAN: Record<string, Plan> = {
  price_1TmFOmDONL32aYDFxyJMStdx: "starter",
  price_1TmFQrDONL32aYDFl9PAt2nU: "pro",
  price_1TmFS7DONL32aYDFHQ801bUd: "elite",
};

export const FLASHCARDS_PLANS: Plan[] = ["pro", "elite"];

export function canAccessFlashcards(plan: Plan | null | undefined) {
  return !!plan && FLASHCARDS_PLANS.includes(plan);
}
