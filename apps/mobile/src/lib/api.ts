import {
  identifyResultSchema,
  type Feedback,
  type IdentifyResult,
} from "@plant-tracker/shared";
import { supabase } from "./supabase";

async function post(path: string, body: unknown): Promise<Response> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (!baseUrl) throw new Error("The app's API URL is not configured.");
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    if (res.status === 404 && err?.error === "Not Found") {
      throw new Error("The app's service endpoint was not found. Check its API configuration.");
    }
    throw new Error(typeof err?.error === "string" ? err.error : `Request failed (${res.status})`);
  }
  return res;
}

export async function identifyPlant(input: {
  imagePath?: string;
  name?: string;
  quality?: "standard" | "high";
  notThis?: string;
  selectedScientificName?: string;
}): Promise<IdentifyResult> {
  const res = await post("/identify", input);
  return identifyResultSchema.parse(await res.json());
}

export async function sendFeedback(feedback: Feedback): Promise<void> {
  await post("/feedback", feedback);
}
