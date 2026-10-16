#!/usr/bin/env node
/**
 * Contrôle statique : chaque RPC appelée par les fronts (site + console admin)
 * doit posséder un CREATE FUNCTION correspondant dans supabase/migrations/.
 *
 *   node scripts/check-rpc-names.mjs
 *
 * Pourquoi : une RPC inexistante n'échoue qu'à l'exécution (404 PGRST202),
 * souvent après déploiement — c'est le défaut qui a imposé ce script, les
 * appels admin n'étant jamais couverts par la suite E2E (anonyme).
 *
 * Sortie : 0 si tout match, 1 avec la liste des écarts.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");
// La console admin est un dépôt voisin ; absente → contrôle limité au site.
const ADMIN = resolve(ROOT, "..", "teranga-labs-admin");

const SKIP_DIRS = new Set(["node_modules", ".next", "test-results", "playwright-report", "dist", ".git"]);
const SOURCE_EXT = /\.(ts|tsx|mts|js|mjs)$/;

const RPC_RE = /\.rpc\(\s*[`'"]([a-z_0-9]+)[`'"]/g;
const FN_RE = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)/gi;

function definedFunctions() {
  if (!existsSync(MIGRATIONS)) {
    console.error(`[check-rpc] dossier migrations introuvable : ${MIGRATIONS}`);
    process.exit(2);
  }
  const names = new Set();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");
    for (const m of sql.matchAll(FN_RE)) names.add(m[1]);
  }
  return names;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

function collectCalls(dir) {
  const calls = [];
  for (const file of walk(dir)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(RPC_RE)) calls.push({ name: m[1], file });
  }
  return calls;
}

const fns = definedFunctions();
const targets = [{ label: "site", dir: ROOT }];
if (existsSync(ADMIN)) targets.push({ label: "admin", dir: ADMIN });
else console.log(`[check-rpc] console admin absente (${ADMIN}) — contrôle du site seul`);

let total = 0;
const missing = [];

for (const { label, dir } of targets) {
  const calls = collectCalls(dir);
  total += calls.length;
  for (const { name, file } of calls) {
    if (!fns.has(name)) {
      const rel = file.replace(resolve(ROOT, ".."), "").replace(/\\/g, "/").replace(/^\//, "");
      missing.push(`${label}: ${name} ← ${rel}`);
    }
  }
  console.log(`[check-rpc] ${label} : ${calls.length} appel(s) .rpc() analysé(s)`);
}
console.log(`[check-rpc] migrations : ${fns.size} fonction(s) définie(s)`);

if (missing.length > 0) {
  console.error(`\n[check-rpc] ${missing.length} RPC(s) sans CREATE FUNCTION :`);
  for (const line of [...new Set(missing)].sort()) console.error(`  - ${line}`);
  process.exit(1);
}

console.log(`[check-rpc] ✓ ${total} appel(s) RPC, tous matches par les migrations`);
