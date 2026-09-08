"use client";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal, Stagger, staggerItem } from "./reveal";

export interface FeatureGridItem {
  title: string;
  body: string;
  Icon?: LucideIcon;
  n?: string;
}

interface FeatureGridProps {
  eyebrow: string;
  title: string;
  description?: string;
  items: FeatureGridItem[];
  columns?: 2 | 3 | 4;
  variant?: "light" | "dark";
}

const COLUMN_CLASS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function FeatureGrid({ eyebrow, title, description, items, columns = 3, variant = "light" }: FeatureGridProps) {
  const isDark = variant === "dark";

  return (
    <section className={`relative mx-auto px-6 py-20 ${isDark ? "bg-night text-white" : ""}`}>
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h2 className={`mt-3 font-display text-2xl font-semibold md:text-3xl ${isDark ? "text-white" : "text-night dark:text-white"}`}>
          {title}
        </h2>
        {description && (
          <p className={`mt-3 text-sm ${isDark ? "text-slate-300" : "text-slate-500"}`}>{description}</p>
        )}
      </Reveal>

      <Stagger className={`mx-auto mt-10 grid max-w-5xl gap-5 ${COLUMN_CLASS[columns]}`}>
        {items.map(({ title: itemTitle, body, Icon, n }) => (
          <motion.div
            key={itemTitle}
            variants={staggerItem}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className={`rounded-2xl p-5 ${
              isDark ? "border border-white/10 bg-white/5" : "bg-white shadow-card dark:bg-[#16213A]"
            }`}
          >
            {Icon ? (
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${isDark ? "bg-white/10 text-primary" : "bg-primary/10 text-primary"}`}>
                <Icon size={18} />
              </span>
            ) : n ? (
              <span className="font-display text-xl font-semibold text-primary/50">{n}</span>
            ) : null}
            <h3 className={`mt-3 font-display text-sm font-semibold ${isDark ? "text-white" : "text-night dark:text-white"}`}>
              {itemTitle}
            </h3>
            <p className={`mt-1.5 text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>{body}</p>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
