import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { identifyRequestSchema } from "@plant-tracker/shared";
import type { PlantIdentifier } from "./ai.js";

export interface Deps {
  identifier: PlantIdentifier;
  // Returns the user id for a valid bearer token, otherwise null.
  verifyToken(token: string): Promise<string | null>;
  // Returns a short-lived URL for an image owned by the user, otherwise null.
  signedImageUrl(userId: string, imagePath: string): Promise<string | null>;
}

export async function buildApp(deps: Deps) {
  const app = Fastify({ logger: true });
  await app.register(rateLimit, { global: false });

  app.post(
    "/identify",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const token = req.headers.authorization?.replace(/^Bearer /i, "");
      const userId = token ? await deps.verifyToken(token) : null;
      if (!userId) return reply.code(401).send({ error: "unauthorized" });

      const parsed = identifyRequestSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      let imageUrl: string | undefined;
      if (parsed.data.imagePath) {
        // Only paths inside the caller's own folder are allowed.
        if (!parsed.data.imagePath.startsWith(`${userId}/`) || parsed.data.imagePath.includes("..")) {
          return reply.code(403).send({ error: "forbidden" });
        }
        imageUrl = (await deps.signedImageUrl(userId, parsed.data.imagePath)) ?? undefined;
        if (!imageUrl) return reply.code(404).send({ error: "image not found" });
      }

      try {
        return await deps.identifier.identify({ imageUrl, name: parsed.data.name });
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

  app.get("/health", async () => ({ ok: true }));
  return app;
}
