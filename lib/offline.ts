// Cache local (localStorage) pour permettre la révision hors-ligne : la queue de cartes dues
// est mise en cache à chaque chargement réussi, et les notations faites hors-ligne sont mises
// en file d'attente puis synchronisées au retour de connexion.

const DECK_CACHE_PREFIX = "fulfiency_offline_deck_";
const QUEUE_KEY = "fulfiency_offline_queue";

export interface PendingRating {
  cardId: string;
  update: Record<string, unknown>;
  reviewLog: Record<string, unknown>;
}

export function cacheDeckQueue(deckId: string, cards: unknown[]) {
  try {
    localStorage.setItem(DECK_CACHE_PREFIX + deckId, JSON.stringify(cards));
  } catch {
    // quota dépassé ou storage indisponible : dégrade silencieusement, pas critique
  }
}

export function getCachedDeckQueue<T = unknown>(deckId: string): T[] | null {
  try {
    const raw = localStorage.getItem(DECK_CACHE_PREFIX + deckId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function queuePendingRating(entry: PendingRating) {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const queue: PendingRating[] = raw ? JSON.parse(raw) : [];
    queue.push(entry);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // si le stockage échoue, la notation reste seulement appliquée localement à l'écran
  }
}

export function getPendingRatings(): PendingRating[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearPendingRatings() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    // rien à faire
  }
}
