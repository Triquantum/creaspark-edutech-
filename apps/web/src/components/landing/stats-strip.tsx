"use client";
import { motion } from "framer-motion";

interface Stat {
  value: string;
  label: string;
}

export function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <section className="bg-primary py-8 text-white">
      <div className="mx-auto flex flex-wrap justify-center gap-x-14 gap-y-6 px-6">
        {stats.map(({ value, label }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="text-center"
          >
            <p className="font-display text-2xl font-semibold md:text-3xl">{value}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-white/80">{label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
