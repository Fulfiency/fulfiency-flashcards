import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  // Try Supabase Storage first
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    try {
      const supabase = createClient(url, key);
      const userId = formData.get("userId") as string;
      const ext = file.name.split(".").pop();
      const path = `${userId || "anon"}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("card-images")
        .upload(path, file, { contentType: file.type });

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("card-images")
          .getPublicUrl(path);
        return NextResponse.json({ url: urlData.publicUrl });
      }
    } catch {}
  }

  // Fallback: base64 data URL
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;
  return NextResponse.json({ url: dataUrl });
}
