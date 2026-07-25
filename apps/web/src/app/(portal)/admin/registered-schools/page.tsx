"use client";
import { useEffect, useState } from "react";
import { School } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { InstitutionsTable } from "@/components/platform/institutions-table";

const ACCESS_ROLES = new Set(["SUPER_ADMIN"]);

interface Me { role: string }

export default function RegisteredSchoolsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null)).finally(() => setChecked(true));
  }, []);

  if (!checked) return null;

  if (!me || !ACCESS_ROLES.has(me.role)) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Registered Schools</h1>
        <Card><p className="text-sm text-slate-500">Your role doesn&apos;t have access to this page.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">School</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Registered Schools</h1>
        <p className="mt-1 text-sm text-slate-500">Every school registered on the platform.</p>
      </div>

      <InstitutionsTable
        title="Registered Schools" icon={School}
        typeFilter={(t) => t === "SCHOOL"}
        emptyMessage="No schools registered yet."
      />
    </div>
  );
}
