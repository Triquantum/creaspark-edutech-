"use client";
import { ShieldCheck, Award, Landmark, BookCheck } from "lucide-react";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";

const BADGES = [
  { Icon: ShieldCheck, label: "STEM.org Aligned" },
  { Icon: Landmark, label: "NITI Aayog ATL Partner" },
  { Icon: BookCheck, label: "CBSE Curriculum Compatible" },
  { Icon: Award, label: "DPIIT Recognised" },
];

export function CredibilityStrip() {
  return (
    <section className="relative border-y border-slate-100 bg-white/60 py-12 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Aligned with national and industry standards
          </p>
        </Reveal>
        <Stagger className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {BADGES.map(({ Icon, label }) => (
            <motion.div key={label} variants={staggerItem} className="flex items-center gap-2 text-sm text-ink/70 dark:text-slate-300">
              <Icon size={16} className="text-primary" />
              {label}
            </motion.div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
