/**
 * Journalisation structurée (§52, audit C8).
 *
 * Lignes JSON à destination des collecteurs (Vercel/printf-logger,
 * Datadog, etc.). Chaque ligne porte : date ISO, niveau, action,
 * provider/route, user (si connu), request_id (si fourni) et le
 * message. Rien de plus lourd n'est introduit ici : les actions
 * d'administration restent persistées dans `admin_actions`.
 */

export type LogLevel = "info" | "warn" | "error";

type StructuredLog = {
  ts: string;
  level: LogLevel;
  action: string;
  user?: string;
  request_id?: string;
  provider?: string;
  status?: number;
  message: string;
  [k: string]: unknown;
};

function emit(level: LogLevel, entry: Omit<StructuredLog, "ts" | "level">) {
  const line: StructuredLog = {
    ts: new Date().toISOString(),
    level,
    ...entry,
  } as StructuredLog;
  const output = JSON.stringify(line);
  if (level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const log = {
  info: (entry: Omit<StructuredLog, "ts" | "level">) => emit("info", entry),
  warn: (entry: Omit<StructuredLog, "ts" | "level">) => emit("warn", entry),
  error: (entry: Omit<StructuredLog, "ts" | "level">) => emit("error", entry),
};