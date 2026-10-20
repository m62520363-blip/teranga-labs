import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const APP = join(ROOT, "app");

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

const pages = listFiles(APP).filter(
  (f) => /page\.tsx$/.test(f) || /route\.ts$/.test(f)
);

describe("gardes de route centralisées (audit C7)", () => {
  it("aucune page n'utilise redirect(\"/login\") en dur", () => {
    const offenders = pages
      .map((f) => ({
        file: f.replace(`${ROOT}\\`, ""),
        lines: readFileSync(f, "utf8")
          .split("\n")
          .map((l, i) => ({ l, i }))
          .filter(({ l }) => l.includes('redirect("/login")')),
      }))
      .filter(({ lines }) => lines.length > 0);

    expect(offenders, `pages à migrer vers requireUser/requireRole :\n${offenders
      .map((o) => o.file + o.lines.map((x) => `:${x.i + 1}`).join(","))
      .join("\n")}`).toEqual([]);
  });

  it("aucune route API n'appelle getCurrentUser directement", () => {
    const offenders = pages
      .filter((f) => /route\.ts$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("getCurrentUser"));

    expect(
      offenders.map((f) => f.replace(`${ROOT}\\`, "")),
      "routes à migrer vers apiRequireUser/apiRequireRole"
    ).toEqual([]);
  });

  it("les routes API protégées passent par une garde centralisée", () => {
    const API = join(APP, "api");
    const protectedRoutes = [
      join(API, "briefs", "publish", "route.ts"),
      join(API, "otp", "request", "route.ts"),
      join(API, "otp", "verify", "route.ts"),
      join(API, "payments", "checkout", "route.ts"),
      join(API, "payments", "mission-checkout", "route.ts"),
      join(API, "payments", "status", "route.ts"),
      join(API, "verification", "checkout", "route.ts"),
      join(API, "favorites", "toggle", "route.ts"),
      join(API, "admin", "leaderboard", "settle", "route.ts"),
    ];

    for (const file of protectedRoutes) {
      const src = readFileSync(file, "utf8");
      expect(
        src,
        `${file.replace(`${ROOT}\\`, "")} doit utiliser apiRequireUser/apiRequireRole`
      ).toMatch(/apiRequire(?:User|Role)\(/);
    }
  });
});