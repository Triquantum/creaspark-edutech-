"use client";
import { motion } from "framer-motion";
import { School, GraduationCap, Briefcase, Building2 } from "lucide-react";
import { Reveal, Stagger, staggerItem } from "./reveal";

const AUDIENCES = [
  { Icon: School, title: "Schools", body: "Lab setup, curriculum integration and teacher training, end to end." },
  { Icon: GraduationCap, title: "Colleges & Universities", body: "Data science, cybersecurity, ML and AI tracks for higher education." },
  { Icon: Briefcase, title: "Working Professionals", body: "Career-focused, cohort-based courses for upskilling in future tech." },
  { Icon: Building2, title: "Industry Partners", body: "Custom AI ecosystems, automation and data solutions co-built with you." },
];

export function WhoWeServe() {
  return (
    <section id="who-we-serve" className="relative mx-auto max-w-6xl px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Who We Serve</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          Built for every stage of the learning journey
        </h2>
      </Reveal>

      <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCES.map(({ Icon, title, body }) => (
          <motion.div
            key={title}
            variants={staggerItem}
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-slate-100 bg-white/60 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
              <Icon size={20} />
            </span>
            <h3 className="mt-4 font-display font-semibold text-night dark:text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
