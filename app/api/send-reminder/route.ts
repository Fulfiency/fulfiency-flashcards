import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getResend } from "@/lib/resend";
import webpush from "web-push";

function getWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  return webpush;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  const { data: dueCards } = await supabase
    .from("cards")
    .select("user_id")
    .lte("due", now);

  if (!dueCards || dueCards.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const userCounts = new Map<string, number>();
  for (const c of dueCards) {
    userCounts.set(c.user_id, (userCounts.get(c.user_id) ?? 0) + 1);
  }

  const wp = getWebPush();
  let sent = 0;

  for (const [userId, count] of userCounts) {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email;

    // Push notifications
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    const body = `Tu as ${count} carte${count > 1 ? "s" : ""} à réviser aujourd'hui !`;

    for (const sub of subs ?? []) {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "Fulfiency Flashcards",
            body,
            icon: "/icon-192.png",
            url: "/dashboard",
          })
        );
      } catch {
        // Subscription expired — clean up
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }

    // Email
    if (email) {
      try {
        await getResend().emails.send({
          from: "Fulfiency <noreply@fulfiency.fr>",
          to: email,
          subject: `🃏 Tu as ${count} carte${count > 1 ? "s" : ""} à réviser aujourd'hui — Fulfiency`,
          html: `
            <div style="background:#0d1b2a;color:#f5f0e8;padding:40px;font-family:Arial,sans-serif;border-radius:12px;">
              <h1 style="color:#c9a552;margin:0 0 16px;">Fulfiency Flashcards</h1>
              <p style="font-size:18px;margin:0 0 24px;">
                Tu as <strong style="color:#c9a552;">${count}</strong> carte${count > 1 ? "s" : ""} à réviser aujourd'hui.
              </p>
              <a href="https://fulfiency-flashcards.vercel.app/dashboard"
                 style="display:inline-block;background:linear-gradient(135deg,#c9a552,#eaa93d);color:#0d1b2a;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;">
                Commencer la révision
              </a>
              <p style="margin-top:32px;font-size:12px;color:#a7bcb7;">Pas de génie. Juste de la sueur.</p>
            </div>
          `,
        });
      } catch { /* Resend not configured */ }
    }

    sent++;
  }

  return NextResponse.json({ sent });
}
