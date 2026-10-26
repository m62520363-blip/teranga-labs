import { Coins, History, TrendingUp } from "lucide-react";
import { cn } from "cn";

export function DashboardStats({
  balance,
  tokensUsed,
  unlocksCount,
}: {
  balance: number;
  tokensUsed: number;
  unlocksCount: number;
}) {
  const stats = [
    {
      icon: Coins,
      label: "Tokens disponibles",
      value: String(balance),
      sub: balance === 0 ? "Commandez pour débloquer" : "Prêts à l'emploi",
      highlight: true,
    },
    {
      icon: History,
      label: "Tokens utilisés",
      value: String(tokensUsed),
      sub: "Depuis votre inscription",
      highlight: false,
    },
    {
      icon: TrendingUp,
      label: "Projets débloqués",
      value: String(unlocksCount),
      sub: unlocksCount === 0 ? "Aucun pour l'instant" : "Contacts accessibles",
      highlight: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
            stat.highlight ? "border-primary/40" : "border-hairline"
          )}
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft">
            <stat.icon className="size-4 text-primary" aria-hidden="true" />
          </span>
          <p className="mt-4 text-2xl font-semibold tracking-tight">
            {stat.value}
          </p>
          <p className="mt-0.5 text-sm font-medium">{stat.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}