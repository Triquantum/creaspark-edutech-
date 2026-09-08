"use client";
import { ShieldCheck, Award, Landmark, BookCheck, Trophy, BrainCog } from "lucide-react";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";

const PARTNERS = [
  { Icon: ShieldCheck, name: "STEM.org", body: "STEM Accredited", tag: "Accredited", tagClass: "bg-primary/10 text-primary" },
  { Icon: BrainCog, name: "AAAI", body: "Association for the Advancement of Artificial Intelligence", tag: "AI Body", tagClass: "bg-accent/10 text-accent" },
  { Icon: Trophy, name: "Best STEM", body: "Best STEM School Award", tag: "Award", tagClass: "bg-warning/10 text-warning" },
  { Icon: Landmark, name: "NITI Aayog", body: "NITI Aayog — Atal Innovation", tag: "Innovation", tagClass: "bg-emerald-500/10 text-emerald-600" },
  { Icon: BookCheck, name: "CBSE", body: "CBSE Aligned Curriculum", tag: "Curriculum", tagClass: "bg-rose-500/10 text-rose-500" },
  { Icon: Award, name: "Startup India", body: "DPIIT Recognised Startup", tag: "DPIIT", tagClass: "bg-primary/10 text-primary" },
];

const TICKER = [
  "STEM Accredited Programs", "AAAI Aligned AI Curriculum", "NITI Aayog Innovation Partner",
  "CBSE Compatible", "DPIIT Recognised Startup", "Best STEM School Award",
  "Govt. of Kerala Partner", "Future Skills Framework",
];

export function CredibilityStrip() {
  return (
    <section className="relative overflow-hidden border-y border-slate-100 bg-white/60 py-16 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      <div className="mx-auto px-6">
        <Reveal className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Recognised & Affiliated By</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">Our Partner Ecosystem</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Creaspark's programs align with recognised STEM accreditation bodies, government initiatives and
            innovation frameworks.
          </p>
        </Reveal>

        <Stagger className="mt-10 grid gap-4 [perspective:1200px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {PARTNERS.map(({ Icon, name, body, tag, tagClass }) => (
            <motion.div
              key={name}
              variants={staggerItem}
              whileHover={{ y: -8, rotateX: 6, rotateY: -4, scale: 1.03 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ transformStyle: "preserve-3d" }}
              className="group relative overflow-hidden rounded-2xl bg-white p-5 text-center shadow-card dark:bg-[#16213A]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-accent transition-transform duration-300 group-hover:scale-x-100"
              />
              <span className="relative mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                <Icon size={18} />
              </span>
              <p className="relative mt-3 font-display text-sm font-semibold text-night dark:text-white">{name}</p>
              <p className="relative mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
              <span className={`relative mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tagClass}`}>{tag}</span>
            </motion.div>
          ))}
        </Stagger>
      </div>

      <div className="relative mt-10 flex overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <motion.div
          className="flex shrink-0 gap-3 pr-3"
          animate={{ x: ["0%", "-100%"] }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        >
          {[...TICKER, ...TICKER].map((label, i) => (
            <span key={i} className="whitespace-nowrap rounded-full bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              {label}
            </span>
          ))}
        </motion.div>
        <motion.div
          aria-hidden
          className="flex shrink-0 gap-3 pr-3"
          animate={{ x: ["0%", "-100%"] }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        >
          {[...TICKER, ...TICKER].map((label, i) => (
            <span key={i} className="whitespace-nowrap rounded-full bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
