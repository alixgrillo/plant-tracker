import {
  identifyResultSchema,
  type Feedback,
  type IdentifyResult,
} from "@plant-tracker/shared";
import { supabase } from "./supabase";

async function post(path: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(typeof err?.error === "string" ? err.error : `Request failed (${res.status})`);
  }
  return res;
}

export async function identifyPlant(input: {
  imagePath?: string;
  name?: string;
  quality?: "standard" | "high";
  notThis?: string;
}): Promise<IdentifyResult> {
  const res = await post("/identify", input);
  return identifyResultSchema.parse(await res.json());
}

export async function sendFeedback(feedback: Feedback): Promise<void> {
  await post("/feedback", feedback);
}
