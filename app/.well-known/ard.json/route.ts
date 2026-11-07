import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", ".well-known", "ard.json");
  const content = fs.readFileSync(filePath, "utf8");
  return new NextResponse(content, {
    headers: { "Content-Type": "application/json" },
  });
}