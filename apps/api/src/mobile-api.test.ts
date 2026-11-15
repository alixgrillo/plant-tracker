import { afterEach, describe, expect, it, vi } from "vitest";
import { identifyPlant, sendFeedback } from "../../mobile/src/lib/api.js";

vi.mock("../../mobile/src/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) },
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("mobile API requests", () => {
  it.each(["https://example.test", "https://example.test/", "https://example.test///"])(
    "joins the API URL %s without duplicate slashes",
    async (baseUrl) => {
      vi.stubEnv("EXPO_PUBLIC_API_URL", baseUrl);
      const fetch = vi.fn(async () => new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetch);
      await sendFeedback({ note: "test" });
      expect(fetch).toHaveBeenCalledWith(
        "https://example.test/feedback",
        expect.objectContaining({ method: "POST" }),
      );
    },
  );

  it("distinguishes a missing endpoint from a missing image", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://example.test");
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "Not Found" }, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ error: "image not found" }, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    await expect(identifyPlant({ name: "plant" })).rejects.toThrow("service endpoint was not found");
    await expect(identifyPlant({ imagePath: "user/photo.jpg" })).rejects.toThrow("image not found");
  });

  it("reports a missing API URL before making a request", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(identifyPlant({ name: "plant" })).rejects.toThrow("API URL is not configured");
    expect(fetch).not.toHaveBeenCalled();
  });
});
