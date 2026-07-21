import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ModuleScaffold({ params }: { params: Promise<{ module: string[] }> }) {
  const { module } = await params;
  const title = module[module.length - 1]
    .split("-")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
  const group = module.length > 1
    ? module[0].split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ")
    : null;

  return (
    <div className="space-y-6">
      <div>
        {group && <p className="text-xs font-medium uppercase tracking-widest text-slate-400">{group}</p>}
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">{title}</h1>
      </div>
      <Card>
        <p className="text-sm leading-relaxed text-slate-500">
          The <span className="font-medium text-night dark:text-white">{title}</span> module is scaffolded
          and routed — its data model, API endpoints and table/form views are the next build step
          (see <code className="rounded bg-surface px-1.5 py-0.5 text-xs dark:bg-white/10">docs/roadmap.md</code> for
          its phase). The pattern is identical to Students: Prisma models → Nest module with role
          guards → this page becomes a list view built from the shared UI kit.
        </p>
        <div className="mt-5 flex gap-3">
          <Button className="h-10">Add {title.toLowerCase()}</Button>
          <Button variant="ghost" className="h-10">Import CSV</Button>
        </div>
      </Card>
    </div>
  );
}
