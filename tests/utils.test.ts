import { afterEach, describe, expect, it } from "vitest";
import { absoluteUrl } from "@/lib/utils";

const original = process.env.NEXT_PUBLIC_SITE_URL;
const originalVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = original;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercel;
});

describe("absoluteUrl", () => {
  it("utilise NEXT_PUBLIC_SITE_URL quand défini", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://devmarket.sn";
    expect(absoluteUrl("/briefs").toString()).toBe("https://devmarket.sn/briefs");
  });

  it("utilise l'URL de production Vercel en fallback", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "devmarket.vercel.app";
    expect(absoluteUrl("/").toString()).toBe("https://devmarket.vercel.app/");
  });

  it("retombe sur localhost", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(absoluteUrl("/tokens").toString()).toBe("http://localhost:3000/tokens");
  });

  it("retourne un objet URL (metadataBase attend un URL)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://devmarket.sn";
    expect(absoluteUrl("/")).toBeInstanceOf(URL);
  });
});