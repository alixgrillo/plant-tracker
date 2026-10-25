import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { feedbackSchema, identifyRequestSchema, type Feedback } from "@plant-tracker/shared";
import type { PlantIdentifier } from "./ai.js";

export interface Deps {
  identifier: PlantIdentifier;
  // Returns the user id for a valid bearer token, otherwise null.
  verifyToken(token: string): Promise<string | null>;
  // Returns a short-lived URL for an image owned by the user, otherwise null.
  signedImageUrl(userId: string, imagePath: string): Promise<string | null>;
  saveFeedback(userId: string, feedback: Feedback): Promise<void>;
  // Best effort; must not throw for delivery problems.
  notifyOwner(userId: string, feedback: Feedback): Promise<void>;
  highQualityDailyCap?: number;
}

export async function buildApp(deps: Deps) {
  const app = Fastify({ logger: true });
  await app.register(rateLimit, { global: false });

  const cap = deps.highQualityDailyCap ?? 3;
  const highUsage = new Map<string, { day: string; count: number }>();
  const takeHighQualityRun = (userId: string) => {
    const day = new Date().toISOString().slice(0, 10);
    const cur = highUsage.get(userId);
    const entry = cur && cur.day === day ? cur : { day, count: 0 };
    if (entry.count >= cap) return false;
    entry.count += 1;
    highUsage.set(userId, entry);
    return true;
  };

  const authenticate = async (header: string | undefined) => {
    const token = header?.replace(/^Bearer /i, "");
    return token ? await deps.verifyToken(token) : null;
  };

  const ownsPath = (userId: string, p: string) => p.startsWith(`${userId}/`) && !p.includes("..");

  app.post(
    "/identify",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const userId = await authenticate(req.headers.authorization);
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const parsed = identifyRequestSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      let imageUrl: string | undefined;
      if (parsed.data.imagePath) {
        if (!ownsPath(userId, parsed.data.imagePath)) {
          return reply.code(403).send({ error: "forbidden" });
        }
        imageUrl = (await deps.signedImageUrl(userId, parsed.data.imagePath)) ?? undefined;
        if (!imageUrl) return reply.code(404).send({ error: "image not found" });
      }

      if (parsed.data.quality === "high" && !takeHighQualityRun(userId)) {
        return reply
          .code(429)
          .send({ error: "Daily limit for smarter checks reached. Please try again tomorrow." });
      }

      try {
        return await deps.identifier.identify({
          imageUrl,
          name: parsed.data.name,
          quality: parsed.data.quality,
          notThis: parsed.data.notThis,
        });
      } catch (err) {
        req.log.error(err);
        const status = (err as { status?: number }).status;
        const message =
          status === 429
            ? "AI service is out of credits or rate limited. Please try again later."
            : status === 401
              ? "AI service is misconfigured."
              : "Identification failed. Please try again.";
        return reply.code(502).send({ error: message });
      }
    },
  );

  app.post(
    "/feedback",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const userId = await authenticate(req.headers.authorization);
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const parsed = feedbackSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      if (parsed.data.imagePath && !ownsPath(userId, parsed.data.imagePath)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      try {
        await deps.saveFeedback(userId, parsed.data);
      } catch (err) {
        req.log.error(err);
        return reply.code(500).send({ error: "Could not save feedback." });
      }
      deps.notifyOwner(userId, parsed.data).catch((err) => req.log.error(err));
      return { ok: true };
    },
  );

  app.get("/health", async () => ({ ok: true }));
  return app;
}
