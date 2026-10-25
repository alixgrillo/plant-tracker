import { createClient } from "@supabase/supabase-js";
import { buildApp } from "./app.js";
import { OpenAIIdentifier } from "./ai.js";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

const app = await buildApp({
  identifier: new OpenAIIdentifier(env("OPENAI_API_KEY"), process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
  async verifyToken(token) {
    const { data, error } = await supabase.auth.getUser(token);
    return error ? null : (data.user?.id ?? null);
  },
  async signedImageUrl(_userId, imagePath) {
    const { data, error } = await supabase.storage.from("plant-photos").createSignedUrl(imagePath, 120);
    return error ? null : data.signedUrl;
  },
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
