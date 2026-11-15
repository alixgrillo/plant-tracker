import OpenAI from "openai";
import { alternativeSchema, identifyResultSchema, type IdentifyResult } from "@plant-tracker/shared";

export interface IdentifyInput {
  imageUrl?: string;
  name?: string;
  quality?: "standard" | "high";
  notThis?: string;
  selectedScientificName?: string;
}

export interface PlantIdentifier {
  identify(input: IdentifyInput): Promise<IdentifyResult>;
}

const SYSTEM_PROMPT =
  "You are a houseplant expert. Identify the plant from the photo and/or name and return care " +
  "guidance for an indoor setting as JSON with keys: commonName, scientificName, confidence " +
  "(low|medium|high), care { description, light, waterMinDays, waterMaxDays (integer days between " +
  "waterings), waterNotes, waterHow, fertilizerEveryDays (integer days between feedings, or null " +
  "if regular fertilizing is not recommended), fertilizerType (short product type to buy, e.g. " +
  "'Balanced liquid houseplant fertilizer' or 'Cactus/succulent fertilizer'; empty string if none), " +
  "fertilizerNotes, selfWateringPotRecommendation " +
  "(recommended|not_recommended|depends), selfWateringPotNotes, healthSigns }. Assess whether a " +
  "self-watering pot suits this plant's moisture needs and root-rot sensitivity; use depends when " +
  "the answer relies on setup or growing conditions, and briefly explain the verdict in " +
  "selfWateringPotNotes. fertilizerNotes " +
  "For low or medium confidence, include alternatives: an array of up to three distinct plausible " +
  "lookalikes, each with commonName and scientificName. Do not include the primary guess again, " +
  "and do not invent alternatives when there are no plausible ones. For high confidence use an empty array. " +
  "Never provide image URLs. fertilizerNotes should give practical fertilizer type/dilution and seasonal guidance, including when to pause; " +
  "do not invent a schedule if unsure. waterHow is 1-3 plain sentences on technique " +
  "(e.g. soak until water drains from the pot, empty the saucer after 15 minutes, let the top inch " +
  "of soil dry first, avoid wetting leaves). If unsure, use low confidence.";

export class OpenAIIdentifier implements PlantIdentifier {
  private client: OpenAI;
  constructor(
    apiKey: string,
    private model: string,
    private highModel: string = model,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async identify({ imageUrl, name, quality = "standard", notThis, selectedScientificName }: IdentifyInput) {
    const model = quality === "high" ? this.highModel : this.model;
    let text = selectedScientificName
      ? `The user selected this scientific name: ${selectedScientificName}. Provide care for that exact species. Return the exact selected scientificName, confidence low, and no alternatives. This is a user choice, not a confirmed photo identification.`
      : name ? `The user says this plant is: ${name}` : "Identify this plant.";
    if (notThis) {
      text += ` A previous guess of "${notThis}" was reported as wrong, so do not answer that species. Look carefully at leaf shape, growth habit and markings.`;
    }
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: "text", text }];
    if (imageUrl) content.push({ type: "image_url", image_url: { url: imageUrl } });

    const res = await this.client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw);
    const result = identifyResultSchema.parse({ ...data, alternatives: undefined, usda: undefined });
    if (selectedScientificName && result.scientificName.trim().toLowerCase() !== selectedScientificName.trim().toLowerCase()) {
      throw new Error("AI did not return the selected species");
    }
    const seen = new Set([result.scientificName.trim().toLowerCase()]);
    const proposed = Array.isArray(data.alternatives) ? data.alternatives : [];
    const alternatives = result.confidence === "high" || selectedScientificName ? [] :
      proposed.flatMap((candidate: unknown) => {
        const parsed = alternativeSchema.pick({ commonName: true, scientificName: true }).safeParse(candidate);
        return parsed.success ? [parsed.data] : [];
      }).filter((alternative: { scientificName: string }) => {
        const key = alternative.scientificName.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 3);
    return { ...result, confidence: selectedScientificName ? "low" as const : result.confidence, alternatives, model };
  }
}
