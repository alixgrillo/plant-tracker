import { createClient } from "@supabase/supabase-js";
import { buildApp } from "./app.js";
import { OpenAIIdentifier } from "./ai.js";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const app = await buildApp({
  identifier: new OpenAIIdentifier(env("OPENAI_API_KEY"), model, process.env.OPENAI_MODEL_HIGH ?? "gpt-4o"),
  async verifyToken(token) {
    const { data, error } = await supabase.auth.getUser(token);
    return error ? null : (data.user?.id ?? null);
  },
  async signedImageUrl(_userId, imagePath) {
    const { data, error } = await supabase.storage.from("plant-photos").createSignedUrl(imagePath, 120);
    return error ? null : data.signedUrl;
  },
  async saveFeedback(userId, f) {
    // Only link the plant if it belongs to the caller.
    let plantId: string | null = null;
    if (f.plantId) {
      const { data } = await supabase
        .from("plants")
        .select("id")
        .eq("id", f.plantId)
        .eq("user_id", userId)
        .maybeSingle();
      plantId = data?.id ?? null;
    }
    const { error } = await supabase.from("plant_feedback").insert({
      user_id: userId,
      plant_id: plantId,
      ai_species_common: f.aiSpeciesCommon,
      ai_species_scientific: f.aiSpeciesScientific,
      ai_confidence: f.aiConfidence,
      model_used: f.modelUsed,
      user_suggested_species: f.userSuggestedSpecies,
      note: f.note,
      image_path: f.imagePath,
    });
    if (error) throw error;
  },
  async notifyOwner(userId, f) {
    const key = process.env.RESEND_API_KEY;
    const to = process.env.OWNER_EMAIL;
    if (!key || !to) {
      console.log("Feedback received (email not configured):", { userId, ...f });
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM ?? "Plant Tracker <onboarding@resend.dev>",
        to,
        subject: `Plant feedback: ${f.aiSpeciesCommon ?? "unknown"} reported`,
        text: [
          `User: ${userId}`,
          `AI guess: ${f.aiSpeciesCommon ?? "?"} (${f.aiSpeciesScientific ?? "?"}), confidence ${f.aiConfidence ?? "?"}, model ${f.modelUsed ?? "?"}`,
          `User suggests: ${f.userSuggestedSpecies ?? "-"}`,
          `Note: ${f.note ?? "-"}`,
          `Image: ${f.imagePath ?? "-"}`,
        ].join("\n"),
      }),
    });
    if (!res.ok) throw new Error(`Email failed (${res.status})`);
  },
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
