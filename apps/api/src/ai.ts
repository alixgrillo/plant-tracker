import OpenAI from "openai";
import { identifyResultSchema, type IdentifyResult } from "@plant-tracker/shared";

export interface PlantIdentifier {
  identify(input: { imageUrl?: string; name?: string }): Promise<IdentifyResult>;
}

const SYSTEM_PROMPT =
  "You are a houseplant expert. Identify the plant from the photo and/or name and return care " +
  "guidance for an indoor setting as JSON with keys: commonName, scientificName, confidence " +
  "(low|medium|high), care { description, light, waterMinDays, waterMaxDays (integer days between " +
  "waterings), waterNotes, waterHow, healthSigns }. waterHow is 1-3 plain sentences on technique (e.g. soak until water drains from the pot, empty the saucer after 15 minutes, let the top inch of soil dry first, avoid wetting leaves). If unsure, use low confidence.";

export class OpenAIIdentifier implements PlantIdentifier {
  private client: OpenAI;
  constructor(apiKey: string, private model: string) {
    this.client = new OpenAI({ apiKey });
  }

  async identify({ imageUrl, name }: { imageUrl?: string; name?: string }) {
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: "text", text: name ? `The user calls this plant: ${name}` : "Identify this plant." },
    ];
    if (imageUrl) content.push({ type: "image_url", image_url: { url: imageUrl } });

    const res = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "{}";
    return identifyResultSchema.parse(JSON.parse(raw));
  }
}

