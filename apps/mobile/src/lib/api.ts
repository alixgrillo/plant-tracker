import { identifyResultSchema, type IdentifyResult } from "@plant-tracker/shared";
import { supabase } from "./supabase";

export async function identifyPlant(input: { imagePath?: string; name?: string }): Promise<IdentifyResult> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/identify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Identify failed (${res.status})`);
  return identifyResultSchema.parse(await res.json());
}
