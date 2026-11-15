import type { IdentifyResult } from "@plant-tracker/shared";

export function usdaSummary(usda: IdentifyResult["usda"]): string | null {
  if (!usda) return null;
  switch (usda.status) {
    case "match":
      return "USDA lists this scientific name. This does not confirm the photo identification.";
    case "synonym":
      return `USDA lists this name as a synonym of ${usda.acceptedName}. This does not confirm the photo identification.`;
    case "not_found":
      return "This name was not found in USDA PLANTS; it may still be a valid plant.";
    case "unavailable":
      return "USDA name comparison unavailable.";
  }
}
