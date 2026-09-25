import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatFCFA, formatRelativeTime } from "@/lib/formatting";

describe("formatFCFA", () => {
  it("formatte 0", () => {
    expect(formatFCFA(0)).toBe("0 FCFA");
  });

  it("groupe les milliers avec l'espace fr-FR", () => {
    expect(formatFCFA(150000)).toBe(`150${"\u202f"}000 FCFA`);
    expect(formatFCFA(2500)).toBe(`2${"\u202f"}500 FCFA`);
  });

  it("arrondit les décimales", () => {
    expect(formatFCFA(45000.5)).toBe(`45${"\u202f"}001 FCFA`);
  });
});

describe("formatDate", () => {
  it("formate une date en fr-FR", () => {
    expect(formatDate("2026-09-24T10:00:00Z")).toMatch(/24 sept\.? 2026/);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-09-24T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("renvoie À l'instant pour moins de 1 min", () => {
    expect(formatRelativeTime(ago(30_000))).toBe("À l'instant");
  });

  it("renvoie les minutes au singulier puis au pluriel", () => {
    expect(formatRelativeTime(ago(60_000))).toBe("Il y a 1 min");
    expect(formatRelativeTime(ago(5 * 60_000))).toBe("Il y a 5 min");
  });

  it("renvoie les heures", () => {
    expect(formatRelativeTime(ago(3_600_000))).toBe("Il y a 1 h");
    expect(formatRelativeTime(ago(2 * 3_600_000))).toBe("Il y a 2 h");
  });

  it("renvoie les jours", () => {
    expect(formatRelativeTime(ago(86_400_000))).toBe("Il y a 1 jour");
    expect(formatRelativeTime(ago(2 * 86_400_000))).toBe("Il y a 2 jours");
  });

  it("renvoie les semaines", () => {
    expect(formatRelativeTime(ago(7 * 86_400_000))).toBe("Il y a 1 semaine");
    expect(formatRelativeTime(ago(14 * 86_400_000))).toBe("Il y a 2 semaines");
  });

  it("bascule sur une date complète au-delà de 5 semaines", () => {
    expect(formatRelativeTime(ago(40 * 86_400_000))).toContain("2026");
  });
});