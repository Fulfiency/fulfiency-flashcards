"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSettings } from "@/lib/settings";
import { playNav } from "@/lib/sounds";
import { IconDecks, IconBrowse, IconCreate, IconStats, IconBadges, IconSettings, IconMember, IconTimer, IconQuiz } from "@/components/ui/Icons";
import { type ReactNode } from "react";

interface Tab {
  label: string;
  href: string;
  icon: ReactNode;
}

const tabs: Tab[] = [
  { label: "Decks", href: "/dashboard", icon: <IconDecks /> },
  { label: "Parcourir", href: "/browse", icon: <IconBrowse /> },
  { label: "Créer", href: "/create", icon: <IconCreate /> },
  { label: "Stats", href: "/stats", icon: <IconStats /> },
  { label: "Time Log", href: "/timelog", icon: <IconTimer /> },
  { label: "Badges", href: "/badges", icon: <IconBadges /> },
  { label: "Réglages", href: "/settings", icon: <IconSettings /> },
];

const mobileTabs: Tab[] = [
  { label: "Decks", href: "/dashboard", icon: <IconDecks /> },
  { label: "Créer", href: "/create", icon: <IconCreate /> },
  { label: "Parcourir", href: "/browse", icon: <IconBrowse /> },
  { label: "Stats", href: "/stats", icon: <IconStats /> },
  { label: "Time Log", href: "/timelog", icon: <IconTimer /> },
  { label: "Réglages", href: "/settings", icon: <IconSettings /> },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isReview = pathname?.startsWith("/review") || pathname?.startsWith("/cram");

  if (isReview && getSettings().focusMode) return null;

  function onNavClick() {
    if (getSettings().soundEnabled) playNav();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden sm:flex sticky top-0 z-40 items-center h-[52px] px-4 bg-[var(--navy-light)] border-b border-[rgba(201,165,82,0.13)]">
        <Link href="/dashboard" className="flex items-center gap-[7px] mr-3 shrink-0">
          <img
            src="https://fulfiency.fr/wp-content/uploads/2026/06/Logo-Fulfiency.png"
            alt="Fulfiency"
            className="w-6 h-6 rounded-full"
          />
          <span className="text-shimmer font-bold text-xs tracking-[0.5px]" style={{ fontFamily: "Georgia, serif" }}>
            FULFIENCY FLASHCARDS
          </span>
        </Link>
        <div className="w-px h-6 bg-[rgba(201,165,82,0.2)] mr-2 shrink-0" />
        <div className="flex flex-1 overflow-hidden">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={onNavClick}
              className={`relative h-[52px] px-2.5 text-[11px] whitespace-nowrap flex items-center gap-1 shrink-0 transition-colors [&>svg]:w-3.5 [&>svg]:h-3.5 ${
                pathname === t.href ? "text-[var(--gold)] font-bold" : "text-[var(--slate)] font-semibold"
              }`}
            >
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t origin-left transition-transform duration-[350ms] ease-out"
                style={{
                  background: "linear-gradient(90deg, var(--gold), var(--gold-light))",
                  transform: pathname === t.href ? "scaleX(1)" : "scaleX(0)",
                }}
              />
              {t.icon}
              {t.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-[5px] ml-2 shrink-0">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            className="bg-[rgba(201,165,82,0.08)] border border-[rgba(201,165,82,0.27)] rounded-[7px] px-2.5 py-[5px] text-[10px] font-semibold text-[var(--gold)] whitespace-nowrap flex items-center gap-[3px] [&>svg]:w-3 [&>svg]:h-3"
            title="Ctrl+K"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" strokeWidth="2" />
            </svg>
            Rechercher
          </button>
          <a
            href="https://fulfiency-espace-membre.vercel.app"
            className="bg-[rgba(201,165,82,0.08)] border border-[rgba(201,165,82,0.27)] rounded-[7px] px-2.5 py-[5px] text-[10px] font-semibold text-[var(--gold)] whitespace-nowrap flex items-center gap-[3px] [&>svg]:w-3 [&>svg]:h-3"
          >
            <IconMember />
            Espace membre
          </a>
          <a
            href="https://qcm-fulfiency.vercel.app"
            className="bg-[rgba(201,165,82,0.08)] border border-[rgba(201,165,82,0.27)] rounded-[7px] px-2.5 py-[5px] text-[10px] font-semibold text-[var(--gold)] whitespace-nowrap flex items-center gap-[3px] [&>svg]:w-3 [&>svg]:h-3"
          >
            <IconQuiz />
            QCM
          </a>
          <button
            onClick={logout}
            title="Déconnexion"
            className="bg-[rgba(224,92,92,0.08)] border border-[rgba(224,92,92,0.27)] rounded-[7px] px-2.5 py-[5px] text-[10px] font-semibold text-[var(--error)] whitespace-nowrap"
          >
            ⏻
          </button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around py-1.5 bg-[var(--navy)]/95 backdrop-blur-[10px] border-t border-[#c9a84c33]">
        {mobileTabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            onClick={onNavClick}
            className={`flex flex-col items-center gap-1 py-1 text-[9px] transition-colors ${
              pathname === t.href
                ? "text-[var(--gold)]"
                : "text-[var(--slate)]"
            }`}
          >
            {t.icon}
            {t.label}
          </Link>
        ))}
        <a
          href="https://fulfiency-espace-membre.vercel.app"
          className="flex flex-col items-center gap-1 py-1 text-[9px] text-[var(--gold)]"
        >
          <IconMember />
          Membre
        </a>
        <a
          href="https://qcm-fulfiency.vercel.app"
          className="flex flex-col items-center gap-1 py-1 text-[9px] text-[var(--gold)]"
        >
          <IconQuiz />
          QCM
        </a>
      </nav>
    </>
  );
}
