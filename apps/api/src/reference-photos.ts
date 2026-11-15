import { z } from "zod";
import type { PlantAlternative } from "@plant-tracker/shared";

type Photo = NonNullable<PlantAlternative["photo"]>;
type JsonRequest = (url: URL) => Promise<unknown>;

const taxonSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  rank: z.string(),
  is_active: z.boolean(),
});
const searchSchema = z.object({ results: z.array(taxonSchema) });
const photosSchema = z.object({
  results: z.array(z.object({
    id: z.number().int().positive(),
    name: z.string(),
    taxon_photos: z.array(z.object({ photo: z.unknown() })),
  })),
});
const photoSchema = z.object({
  id: z.number().int().positive(),
  license_code: z.enum(["cc-by", "cc0"]),
  attribution: z.string().min(1),
  medium_url: z.string().url(),
});

export async function findReferencePhoto(name: string, request: JsonRequest): Promise<Photo | undefined> {
  const search = new URL("https://api.inaturalist.org/v1/taxa");
  search.searchParams.set("q", name);
  search.searchParams.set("rank", "species");
  search.searchParams.set("is_active", "true");
  search.searchParams.set("per_page", "30");
  const matches = searchSchema.parse(await request(search)).results.filter(
    (taxon) => taxon.is_active && taxon.rank === "species" && taxon.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (matches.length !== 1) return undefined;
  const detail = new URL(`https://api.inaturalist.org/v1/taxa/${matches[0].id}`);
  const results = photosSchema.parse(await request(detail)).results;
  const taxon = results.find((item) => item.id === matches[0].id && item.name.toLowerCase() === name.trim().toLowerCase());
  for (const entry of taxon?.taxon_photos ?? []) {
    const parsed = photoSchema.safeParse(entry.photo);
    if (!parsed.success) continue;
    const photo = parsed.data;
    const url = new URL(photo.medium_url);
    if (url.protocol !== "https:" || url.hostname !== "inaturalist-open-data.s3.amazonaws.com" ||
        !url.pathname.startsWith(`/photos/${photo.id}/`)) continue;
    return {
      url: url.href,
      attribution: photo.attribution,
      sourceUrl: `https://www.inaturalist.org/photos/${photo.id}`,
      licenseUrl: photo.license_code === "cc-by"
        ? "https://creativecommons.org/licenses/by/4.0/"
        : "https://creativecommons.org/publicdomain/zero/1.0/",
    };
  }
  return undefined;
}

let nextRequestAt = 0;
const cache = new Map<string, { expires: number; photo: Photo | undefined }>();
const inFlight = new Map<string, Promise<Photo | undefined>>();

async function requestJson(url: URL): Promise<unknown> {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  if (wait > 8000) throw new Error("Reference photo lookup busy");
  nextRequestAt = now + wait + 1100;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  const response = await fetch(url, {
    headers: { "User-Agent": "plant-tracker/1.0 (plant identification reference photos)" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Reference photo lookup failed: ${response.status}`);
  return response.json();
}

export function referencePhoto(name: string): Promise<Photo | undefined> {
  const key = name.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.photo);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const lookup = findReferencePhoto(name.trim(), requestJson)
    .then((photo) => {
      if (cache.size >= 500) cache.delete(cache.keys().next().value!);
      cache.set(key, { photo, expires: Date.now() + 12 * 60 * 60 * 1000 });
      return photo;
    })
    .catch(() => undefined)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, lookup);
  return lookup;
}
