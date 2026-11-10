import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { requireRole } from "@/lib/auth/guards";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const execAsync = promisify(exec);
const RESULTS_FILE = join(process.cwd(), ".qa-results.json");

interface TestResult {
  name: string;
  status: "pass" | "fail";
  score: number;
  duration: number;
  details: string;
}

interface QAResults {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  avgScore: number;
  testFiles: { file: string; tests: number; passed: number; duration: number }[];
  summary: string;
}

export async function POST() {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ code: "FORBIDDEN", message: "Accès refusé." }, { status: 403 });
  }

  try {
    const { stdout, stderr } = await execAsync("npm test", {
      cwd: process.cwd(),
      timeout: 110000,
    });

    // Parse vitest output
    const results = parseVitestOutput(stdout + "\n" + stderr);
    writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { code: "TEST_FAILED", message: "Échec de l'exécution des tests.", error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ code: "FORBIDDEN", message: "Accès refusé." }, { status: 403 });
  }

  if (existsSync(RESULTS_FILE)) {
    try {
      const data = readFileSync(RESULTS_FILE, "utf-8");
      return NextResponse.json(JSON.parse(data));
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    timestamp: null,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    avgScore: 0,
    testFiles: [],
    summary: "Aucun test exécuté. Cliquez sur 'Lancer les tests' pour commencer.",
  });
}

function parseVitestOutput(output: string): QAResults {
  const testFiles: { file: string; tests: number; passed: number; duration: number }[] = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // Parse "✓ tests/xxx.test.ts (N tests)" lines
  const fileRegex = /✓\s+(tests\/[\w-]+\.test\.ts)\s+\(\s*(\d+)\s+tests?\s*\)\s+(\d+)ms/g;
  let match;
  while ((match = fileRegex.exec(output)) !== null) {
    const file = match[1];
    const tests = parseInt(match[2], 10);
    const duration = parseInt(match[3], 10);
    testFiles.push({ file, tests, passed: tests, duration });
    totalTests += tests;
    passedTests += tests;
  }

  // Parse "Tests 177 passed" summary
  const summaryMatch = output.match(/Tests\s+(\d+)\s+passed/);
  if (summaryMatch) {
    passedTests = parseInt(summaryMatch[1], 10);
  }

  const failedMatch = output.match(/Tests\s+(\d+)\s+failed/);
  if (failedMatch) {
    failedTests = parseInt(failedMatch[1], 10);
  }

  const totalMatch = output.match(/Tests\s+(\d+)\s+passed.*?(\d+)\s+failed/);
  if (totalMatch) {
    totalTests = parseInt(totalMatch[1], 10) + parseInt(totalMatch[2], 10);
  } else {
    totalTests = passedTests + failedTests;
  }

  const avgScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  return {
    timestamp: new Date().toISOString(),
    totalTests,
    passedTests,
    failedTests,
    avgScore,
    testFiles,
    summary: failedTests > 0
      ? `${failedTests} test(s) échoué(s) sur ${totalTests}.`
      : `Tous les ${passedTests} tests sont passés.`,
  };
}
