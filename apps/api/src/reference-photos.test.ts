import { describe, expect, it, vi } from "vitest";
import { findReferencePhoto } from "./reference-photos.js";

const search = { results: [{ id: 42, name: "Scindapsus pictus", rank: "species", is_active: true }] };
const photo = (overrides: object = {}) => ({
  id: 123, license_code: "cc-by", attribution: "Photo by Example (CC BY)",
  medium_url: "https://inaturalist-open-data.s3.amazonaws.com/photos/123/medium.jpg",
  ...overrides,
});
const detail = (photos: unknown[]) => ({
  results: [{ id: 42, name: "Scindapsus pictus", taxon_photos: photos.map((p) => ({ photo: p })) }],
});

describe("reference photos", () => {
  it("finds an exact taxon and returns a licensed photo with credit and license", async () => {
    const request = vi.fn().mockResolvedValueOnce(search).mockResolvedValueOnce(detail([
      photo({ license_code: null }), photo({ license_code: "cc-by-nc" }), photo(),
    ]));
    const result = await findReferencePhoto("Scindapsus pictus", request);
    expect(result).toEqual({
      url: "https://inaturalist-open-data.s3.amazonaws.com/photos/123/medium.jpg",
      attribution: "Photo by Example (CC BY)",
      sourceUrl: "https://www.inaturalist.org/photos/123",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    });
    expect(String(request.mock.calls[0][0])).toContain("q=Scindapsus+pictus");
  });

  it("does not use fuzzy or ambiguous taxon matches", async () => {
    const request = vi.fn().mockResolvedValueOnce(search);
    expect(await findReferencePhoto("Scindapsus aureus", request)).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not use copyrighted, non-commercial, uncredited, or untrusted images", async () => {
    const request = vi.fn().mockResolvedValueOnce(search).mockResolvedValueOnce(detail([
      photo({ license_code: null }), photo({ license_code: "cc-by-nc" }),
      photo({ attribution: "" }), photo({ medium_url: "https://example.com/photos/123/medium.jpg" }),
    ]));
    expect(await findReferencePhoto("Scindapsus pictus", request)).toBeUndefined();
  });
});
