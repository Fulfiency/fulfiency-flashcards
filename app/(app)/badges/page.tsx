"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BADGES, getUnlockedBadges, getNextBadges, type BadgeStats } from "@/lib/badges";
import Card from "@/components/ui/Card";
import BadgeIcon from "@/components/ui/BadgeIcon";

export default function BadgesPage() {
  const [stats, setStats] = useState<BadgeStats | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ count: totalCards }, { count: totalReviews }, { data: decksData }, { data: logs }] = await Promise.all([
        supabase.from("cards").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("review_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("decks").select("id").eq("user_id", user.id),
        supabase.from("review_logs").select("review, rating").eq("user_id", user.id).order("review", { ascending: false }).limit(10000),
      ]);

      // Streak
      const days = new Set((logs ?? []).map((l) => l.review?.slice(0, 10)));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (days.has(d.toISOString().slice(0, 10))) streak++;
        else if (i > 0) break;
      }

      // Perfect sessions (simplified: count days where no rating=1)
      const dayRatings = new Map<string, number[]>();
      for (const l of (logs ?? [])) {
        const ds = l.review?.slice(0, 10);
        if (!ds) continue;
        if (!dayRatings.has(ds)) dayRatings.set(ds, []);
        dayRatings.get(ds)!.push(l.rating);
      }
      let perfectSessions = 0;
      for (const [, ratings] of dayRatings) {
        if (ratings.length > 0 && !ratings.includes(1)) perfectSessions++;
      }

      setStats({
        totalCards: totalCards ?? 0,
        totalReviews: totalReviews ?? 0,
        streak,
        decksCreated: decksData?.length ?? 0,
        perfectSessions,
      });
    }
    load();
  }, []);

  if (!stats) return <div className="text-[var(--slate)] text-center py-12">Chargement...</div>;

  const unlocked = getUnlockedBadges(stats);
  const next = getNextBadges(stats);
  const locked = BADGES.filter((b) => !b.check(stats));

  return (
    <div>
      <h1 className="font-[family-name:var(--font-playfair-display)] text-3xl font-bold mb-6">
        Badges
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="text-center p-3">
          <div className="text-2xl font-bold text-[var(--gold)]">{stats.totalCards}</div>
          <div className="text-[10px] text-[var(--slate)]">Cartes</div>
        </Card>
        <Card className="text-center p-3">
          <div className="text-2xl font-bold text-[var(--sage)]">{stats.totalReviews}</div>
          <div className="text-[10px] text-[var(--slate)]">Révisions</div>
        </Card>
        <Card className="text-center p-3">
          <div className="text-2xl font-bold text-[var(--gold)] streak-fire">{stats.streak}</div>
          <div className="text-[10px] text-[var(--slate)]">Streak</div>
        </Card>
        <Card className="text-center p-3">
          <div className="text-2xl font-bold">{unlocked.length}/{BADGES.length}</div>
          <div className="text-[10px] text-[var(--slate)]">Débloqués</div>
        </Card>
      </div>

      {next.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm text-[var(--slate)] mb-3">Prochains badges</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {next.map((b) => (
              <Card key={b.id} className="flex items-center gap-3 p-4 opacity-60">
                <BadgeIcon type={b.icon} locked/>
                <div>
                  <div className="text-sm font-medium">{b.name}</div>
                  <div className="text-xs text-[var(--slate)]">{b.description}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-sm text-[var(--slate)] mb-3">
        Débloqués ({unlocked.length})
      </h2>
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {unlocked.map((b) => (
          <Card key={b.id} className="flex items-center gap-3 p-4 animate-fade-slide">
            <BadgeIcon type={b.icon}/>
            <div>
              <div className="text-sm font-medium text-[var(--gold)]">{b.name}</div>
              <div className="text-xs text-[var(--slate)]">{b.description}</div>
            </div>
          </Card>
        ))}
      </div>

      {locked.length > 0 && (
        <>
          <h2 className="text-sm text-[var(--slate)] mb-3">Verrouillés ({locked.length})</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {locked.map((b) => (
              <Card key={b.id} className="flex items-center gap-3 p-4 opacity-30">
                <BadgeIcon type={b.icon} locked/>
                <div>
                  <div className="text-sm font-medium">{b.name}</div>
                  <div className="text-xs text-[var(--slate)]">{b.description}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
