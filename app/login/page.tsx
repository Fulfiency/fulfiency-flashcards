"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ParticlesCanvas from "@/components/ui/ParticlesCanvas";
import GoldButton from "@/components/ui/GoldButton";

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (tab === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <ParticlesCanvas />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + title */}
        <div className="text-center mb-8">
          <img
            src="https://fulfiency.fr/wp-content/uploads/2026/06/Logo-Fulfiency.png"
            alt="Fulfiency"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-shimmer font-[family-name:var(--font-playfair-display)] text-4xl font-bold mb-2">
            FULFIENCY
          </h1>
          <p className="font-[family-name:var(--font-dancing-script)] text-[var(--slate)] text-lg">
            Pas de génie. Juste de la sueur.
          </p>
        </div>

        {/* Auth card */}
        <div className="card-hover p-6 border-[rgba(201,165,82,0.3)] shadow-[0_0_30px_rgba(201,165,82,0.05)]">
          {/* Tabs */}
          <div className="flex mb-6 gap-1 bg-[var(--navy)] rounded-lg p-1">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-[var(--navy-light)] text-[var(--gold)]"
                    : "text-[var(--slate)] hover:text-[var(--white)]"
                }`}
              >
                {t === "login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[var(--navy)] border border-[var(--navy-mid)] rounded-lg text-[var(--white)] text-sm placeholder-[var(--slate)]"
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-[var(--navy)] border border-[var(--navy-mid)] rounded-lg text-[var(--white)] text-sm placeholder-[var(--slate)]"
            />

            {error && (
              <p className="text-[var(--error)] text-sm">{error}</p>
            )}

            <GoldButton type="submit" fullWidth disabled={loading}>
              {loading
                ? "Chargement..."
                : tab === "login"
                  ? "Se connecter"
                  : "Créer un compte"}
            </GoldButton>
          </form>
        </div>
      </div>
    </div>
  );
}
