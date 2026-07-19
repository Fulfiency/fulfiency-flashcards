"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ReviewQuickPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function findDue() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/dashboard"); return; }

      const now = new Date().toISOString();
      const { data } = await supabase
        .from("cards")
        .select("deck_id")
        .eq("user_id", user.id)
        .lte("due", now)
        .limit(1);

      if (data && data.length > 0) {
        router.replace(`/review/${data[0].deck_id}`);
      } else {
        router.replace("/dashboard");
      }
    }
    findDue();
  }, []);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-[var(--slate)]">Recherche des cartes à réviser...</div>
    </div>
  );
}
