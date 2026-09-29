#!/usr/bin/env node
/**
 * Runner des tests SQL pgtap de Teranga Labs.
 *
 *   node scripts/db-test.mjs                      # tous les fichiers de supabase/tests
 *   node scripts/db-test.mjs supabase/tests/x.sql # un fichier précis
 *
 * Deux modes :
 *   1. `supabase test db` / psql  → base locale (Docker) ou DATABASE_URL ;
 *      le runner délègue à psql si la variable SUPABASE_DB_URL est définie.
 *   2. API Management Supabase     → base liée au projet, pratique en local
 *      pour valider les migrations avant déploiement.
 *
 * Variables d'environnement :
 *   SUPABASE_DB_URL          postgres://…            (prioritaire, mode psql)
 *   SUPABASE_ACCESS_TOKEN    sbp_…                   (mode API Management)
 *   SUPABASE_PROJECT_REF     virihuuksoepswccxsne   (mode API Management)
 *
 * Les fichiers de test sont eux-mêmes encadrés par BEGIN/ROLLBACK : le runner
 * vérifie malgré tout qu'aucune fixture ne subsiste après exécution.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TESTS_DIR = join(ROOT, "supabase", "tests");

const RESIDUE_CHECK = `
  select
    (select count(*)::int from auth.users where email like 'pgtap-%@example.com') as users,
    (select count(*)::int from public.user_roles where user_id::text like '11111111-%'
       or user_id::text like '22222222-%' or user_id::text like '33333333-%') as roles,
    (select count(*)::int from public.developers where id::text like '33333333-%') as developers,
    (select count(*)::int from public.requests where id::text like '44444444-%') as requests,
    (select count(*)::int from public.conversations where request_id::text like '44444444-%') as conversations,
    (select count(*)::int from public.reviews where request_id::text like '44444444-%') as reviews;
`;

function listTests() {
  if (!existsSync(TESTS_DIR)) {
    console.error(`[db-test] dossier introuvable : ${TESTS_DIR}`);
    process.exit(2);
  }
  const args = process.argv.slice(2);
  if (args.length > 0) return args.map((a) => resolve(process.cwd(), a));
  return readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(TESTS_DIR, f));
}

function makeManagementClient() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) return null;
  const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

  return async function query(sql) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Réponse HTTP ${res.status} non JSON : ${text.slice(0, 400)}`);
    }
    if (!res.ok) {
      const detail = body.message ?? body.error ?? text;
      throw new Error(`HTTP ${res.status} — ${detail}`);
    }
    return body;
  };
}

/**
 * L'API Management ne renvoie que le dernier jeu de résultats non vide. Chaque
 * fichier de test se termine donc par une ligne `db_test_verdict` calculée avec
 * pgtap.num_failed() ; `select * from finish()` renvoie une ligne uniquement
 * lorsqu'il y a un écart ou un échec, et sert de filet de sécurité.
 */
function interpret(result) {
  const rows = Array.isArray(result) ? result : [];
  const last = rows[rows.length - 1];

  if (last && typeof last.db_test_verdict === "string") {
    return last.db_test_verdict === "PASS"
      ? { ok: true, detail: "tous les tests passent" }
      : { ok: false, detail: last.db_test_verdict };
  }

  if (last && typeof last.finish === "string") {
    return { ok: false, detail: last.finish };
  }

  if (rows.length === 0) {
    return { ok: false, detail: "aucun verdict renvoyé (le fichier contient-il un test ?) " };
  }

  return { ok: false, detail: `verdict inattendu : ${JSON.stringify(last)}` };
}

function runWithPsql(dbUrl, file) {
  const psql = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", file], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  return {
    code: psql.status ?? 1,
    out: (psql.stdout ?? "").toString(),
    err: (psql.stderr ?? "").toString(),
  };
}

async function main() {
  const files = listTests();
  if (files.length === 0) {
    console.error("[db-test] aucun fichier .sql dans supabase/tests");
    process.exit(2);
  }

  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  const query = dbUrl ? null : makeManagementClient();

  if (!dbUrl && !query) {
    console.error(
      "[db-test] configuration manquante : définissez SUPABASE_DB_URL (psql)\n" +
        "            ou SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (API Management).",
    );
    process.exit(2);
  }

  const mode = dbUrl ? `psql → ${dbUrl.replace(/:[^:@/]*@/, ":***@")}` : "API Management Supabase";
  console.log(`[db-test] mode : ${mode}`);
  console.log(`[db-test] ${files.length} fichier(s) de test\n`);

  let failures = 0;

  for (const file of files) {
    const name = file.replace(`${ROOT}\\`, "").replace(`${ROOT}/`, "");
    const started = Date.now();

    if (dbUrl) {
      const r = runWithPsql(dbUrl, file);
      if (r.out.trim()) console.log(r.out.trim());
      if (r.code !== 0) {
        failures += 1;
        console.error(`[db-test] ✗ ${name} — échec (psql, code ${r.code})`);
        if (r.err.trim()) console.error(r.err.trim());
      } else {
        console.log(`[db-test] ✓ ${name} (${Date.now() - started} ms)`);
      }
      continue;
    }

    let result;
    try {
      result = await query(readFileSync(file, "utf8"));
    } catch (err) {
      failures += 1;
      console.error(`[db-test] ✗ ${name} — ${err.message}`);
      continue;
    }

    const { ok, detail } = interpret(result);
    if (ok) {
      console.log(`[db-test] ✓ ${name} (${Date.now() - started} ms)`);
    } else {
      failures += 1;
      console.error(`[db-test] ✗ ${name} — ${detail}`);
    }

    // Défense en profondeur : le fichier annule sa transaction, on le vérifie.
    try {
      const residue = await query(RESIDUE_CHECK);
      const row = Array.isArray(residue) ? residue[residue.length - 1] : residue;
      const leaked = Object.entries(row ?? {}).filter(([, v]) => Number(v) > 0);
      if (leaked.length > 0) {
        failures += 1;
        console.error(`[db-test] ✗ ${name} — fixtures non annulées : ${leaked.map(([k, v]) => `${k}=${v}`).join(", ")}`);
      }
    } catch (err) {
      failures += 1;
      console.error(`[db-test] ✗ ${name} — contrôle post-exécution impossible : ${err.message}`);
    }
  }

  console.log("");
  if (failures > 0) {
    console.error(`[db-test] ${failures} fichier(s) en échec sur ${files.length}`);
    process.exit(1);
  }
  console.log(`[db-test] ${files.length}/${files.length} fichier(s) au vert`);
}

main();
