"use client";

import * as React from "react";
import { Play, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type TestFile = { file: string; tests: number; passed: number; duration: number };

type QAResults = {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  avgScore: number;
  testFiles: TestFile[];
  summary: string;
};

export function QATestRunner() {
  const [running, setRunning] = React.useState(false);
  const [results, setResults] = React.useState<QAResults | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const runTests = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/qa/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResults(data);
      } else {
        setError(data.message || "Échec de l'exécution.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setRunning(false);
    }
  };

  // Load last results on mount
  React.useEffect(() => {
    fetch("/api/admin/qa/run")
      .then((res) => res.json())
      .then((data) => {
        if (data.timestamp) setResults(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Résultats des tests</h2>
        <Button onClick={runTests} disabled={running} size="sm" className="gap-2">
          {running ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
          {running ? "Tests en cours..." : "Lancer les tests"}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : null}

      {results ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Exécutés le {new Date(results.timestamp).toLocaleString("fr-FR")}
          </p>
          <p className="text-sm font-medium text-foreground">{results.summary}</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-hairline bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-1 text-lg font-bold">{results.totalTests}</p>
            </div>
            <div className="rounded-xl border border-hairline bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Réussis</p>
              <p className="mt-1 text-lg font-bold text-success">{results.passedTests}</p>
            </div>
            <div className="rounded-xl border border-hairline bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Échoués</p>
              <p className="mt-1 text-lg font-bold text-error">{results.failedTests}</p>
            </div>
            <div className="rounded-xl border border-hairline bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="mt-1 text-lg font-bold text-primary">{results.avgScore}/100</p>
            </div>
          </div>
          {results.testFiles.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-muted">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fichier</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tests</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {results.testFiles.map((f) => (
                    <tr key={f.file} className="border-b border-hairline last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{f.file}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          {f.passed}/{f.tests}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{f.duration}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Cliquez sur « Lancer les tests » pour exécuter la suite de tests et voir les résultats réels.
        </p>
      )}
    </div>
  );
}
