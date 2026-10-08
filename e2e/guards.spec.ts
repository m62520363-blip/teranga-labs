import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function envValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync(join(process.cwd(), ".env.local"), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const hasSupabase = Boolean(envValue("NEXT_PUBLIC_SUPABASE_URL") && envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"));

test.describe("gardes de routes (nécessite Supabase)", () => {
  test.skip(!hasSupabase, "variables NEXT_PUBLIC_SUPABASE_* absentes");

  test("la page d'accueil se charge et affiche le site", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status(), "accueil répond 200").toBe(200);
    await expect(page.locator("header").first()).toBeVisible();
  });

  test("sans session, /dashboard redirige vers /login", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
  });

  test("sans session, /client redirige vers /login", async ({ page }) => {
    await page.goto("/client", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
  });
});