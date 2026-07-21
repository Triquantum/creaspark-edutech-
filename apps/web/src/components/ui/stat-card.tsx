import { Card } from "./card";

export function StatCard({
  label, value, delta, tone = "neutral",
}: { label: string; value: string; delta?: string; tone?: "up" | "down" | "neutral" }) {
  const deltaColor = tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-slate-400";
  return (
    <Card className="transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="font-display text-3xl font-semibold text-night dark:text-white">{value}</span>
        {delta && <span className={`text-sm font-medium ${deltaColor}`}>{delta}</span>}
      </div>
    </Card>
  );
}
