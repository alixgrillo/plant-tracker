import type { IdentifyResult, PlantAlternative } from "@plant-tracker/shared";
import { identifyPlant } from "./api";

export async function chooseAlternative(current: IdentifyResult, choice: PlantAlternative): Promise<IdentifyResult> {
  const updated = await identifyPlant({ selectedScientificName: choice.scientificName });
  const candidates = [
    { commonName: current.commonName, scientificName: current.scientificName },
    ...(current.alternatives ?? []),
  ];
  return {
    ...updated,
    alternatives: candidates
      .filter((candidate) => candidate.scientificName.toLowerCase() !== choice.scientificName.toLowerCase())
      .slice(0, 3),
  };
}
