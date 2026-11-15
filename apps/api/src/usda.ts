import { z } from "zod";
import type { IdentifyResult } from "@plant-tracker/shared";
import type { PlantIdentifier, IdentifyInput } from "./ai.js";
import { referencePhoto } from "./reference-photos.js";

type UsdaResult = NonNullable<IdentifyResult["usda"]>;

const searchSchema = z.array(z.object({
  Plant: z.object({ ScientificName: z.string(), Symbol: z.string().regex(/^[A-Za-z0-9]+$/) }),
}));
const profileSchema = z.object({ ScientificName: z.string() });
const baseUrl = "https://plantsservices.sc.egov.usda.gov/api";

function binomial(name: string): string | undefined {
  const clean = name.trim().replace(/\s+/g, " ");
  return /^[A-Z][a-z]+ [a-z]+$/.test(clean) ? clean : undefined;
}

function usdaBinomial(html: string): string | undefined {
  const match = /^<i>([A-Z][a-z]+ [a-z]+)<\/i>(?:\s|$)/.exec(html);
  if (!match || html.slice(match[0].length).includes("<i>")) return undefined;
  return match[1];
}

export async function lookupUsda(scientificName: string): Promise<UsdaResult> {
  const name = binomial(scientificName);
  if (!name) return { status: "unavailable" };

  try {
    const searchUrl = new URL(`${baseUrl}/PlantSearch`);
    searchUrl.searchParams.set("searchText", name);
    const search = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    if (!search.ok) return { status: "unavailable" };
    const results = searchSchema.parse(await search.json());
    const matching = results.filter(({ Plant }) => usdaBinomial(Plant.ScientificName) === name);
    if (!matching.length) {
      return { status: results.some(({ Plant }) => !usdaBinomial(Plant.ScientificName)) ? "unavailable" : "not_found" };
    }
    if (matching.length !== 1) return { status: "unavailable" };

    const profileUrl = new URL(`${baseUrl}/PlantProfile`);
    profileUrl.searchParams.set("symbol", matching[0].Plant.Symbol);
    const profile = await fetch(profileUrl, { signal: AbortSignal.timeout(5000) });
    if (!profile.ok) return { status: "unavailable" };
    const acceptedName = usdaBinomial(profileSchema.parse(await profile.json()).ScientificName);
    if (!acceptedName) return { status: "unavailable" };
    return acceptedName === name
      ? { status: "match", acceptedName }
      : { status: "synonym", acceptedName };
  } catch {
    return { status: "unavailable" };
  }
}

export class UsdaCheckedIdentifier implements PlantIdentifier {
  constructor(private identifier: PlantIdentifier) {}

  async identify(input: IdentifyInput): Promise<IdentifyResult> {
    const result = await this.identifier.identify(input);
    const [usda, alternatives] = await Promise.all([
      lookupUsda(result.scientificName),
      Promise.all((result.confidence === "high" ? [] : result.alternatives ?? []).map(async (alternative) => {
        const photo = await referencePhoto(alternative.scientificName);
        const { commonName, scientificName } = alternative;
        return photo ? { commonName, scientificName, photo } : { commonName, scientificName };
      })),
    ]);
    return { ...result, usda, ...(result.alternatives === undefined ? {} : { alternatives }) };
  }
}
