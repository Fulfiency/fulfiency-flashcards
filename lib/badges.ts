"use client";

export type BadgeIconType = "card" | "check" | "flame" | "grid" | "star";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: BadgeIconType;
  check: (stats: BadgeStats) => boolean;
}

export interface BadgeStats {
  totalCards: number;
  totalReviews: number;
  streak: number;
  decksCreated: number;
  perfectSessions: number;
}

export const BADGES: Badge[] = [
  { id: "first-card", name: "Première carte", description: "Crée ta première carte", icon: "card", check: (s) => s.totalCards >= 1 },
  { id: "10-cards", name: "Collectionneur", description: "10 cartes créées", icon: "card", check: (s) => s.totalCards >= 10 },
  { id: "50-cards", name: "Bibliothèque", description: "50 cartes créées", icon: "card", check: (s) => s.totalCards >= 50 },
  { id: "100-cards", name: "Encyclopédie", description: "100 cartes créées", icon: "card", check: (s) => s.totalCards >= 100 },
  { id: "500-cards", name: "Archiviste", description: "500 cartes créées", icon: "card", check: (s) => s.totalCards >= 500 },
  { id: "first-review", name: "Premier pas", description: "Première révision", icon: "check", check: (s) => s.totalReviews >= 1 },
  { id: "100-reviews", name: "Régulier", description: "100 révisions", icon: "check", check: (s) => s.totalReviews >= 100 },
  { id: "500-reviews", name: "Assidu", description: "500 révisions", icon: "check", check: (s) => s.totalReviews >= 500 },
  { id: "1000-reviews", name: "Machine", description: "1000 révisions", icon: "check", check: (s) => s.totalReviews >= 1000 },
  { id: "5000-reviews", name: "Légende", description: "5000 révisions", icon: "check", check: (s) => s.totalReviews >= 5000 },
  { id: "3-streak", name: "Habitude", description: "3 jours de suite", icon: "flame", check: (s) => s.streak >= 3 },
  { id: "7-streak", name: "Semaine parfaite", description: "7 jours de suite", icon: "flame", check: (s) => s.streak >= 7 },
  { id: "30-streak", name: "Mois de fer", description: "30 jours de suite", icon: "flame", check: (s) => s.streak >= 30 },
  { id: "100-streak", name: "Incassable", description: "100 jours de suite", icon: "flame", check: (s) => s.streak >= 100 },
  { id: "first-deck", name: "Organisé", description: "Crée ton premier deck", icon: "grid", check: (s) => s.decksCreated >= 1 },
  { id: "5-decks", name: "Multi-sujet", description: "5 decks créés", icon: "grid", check: (s) => s.decksCreated >= 5 },
  { id: "perfect-1", name: "Sans faute", description: "Session parfaite", icon: "star", check: (s) => s.perfectSessions >= 1 },
  { id: "perfect-10", name: "Perfectionniste", description: "10 sessions parfaites", icon: "star", check: (s) => s.perfectSessions >= 10 },
];

export function getUnlockedBadges(stats: BadgeStats): Badge[] {
  return BADGES.filter((b) => b.check(stats));
}

export function getNextBadges(stats: BadgeStats): Badge[] {
  return BADGES.filter((b) => !b.check(stats)).slice(0, 3);
}
