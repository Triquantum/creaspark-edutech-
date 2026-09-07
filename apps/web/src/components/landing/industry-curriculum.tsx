"use client";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";
import { Database, ShieldAlert, BrainCircuit, Cpu } from "lucide-react";

const SUBJECTS = [
  { Icon: Database, title: "Data Science", body: "Statistics, Python, data wrangling and visualization through to predictive modelling." },
  { Icon: ShieldAlert, title: "Cyber Security", body: "Network security, ethical hacking and threat analysis for modern systems." },
  { Icon: BrainCircuit, title: "Machine Learning", body: "Supervised and unsupervised learning, model evaluation and deployment on real data." },
  { Icon: Cpu, title: "Artificial Intelligence", body: "Neural networks, NLP and computer vision — building intelligent systems from the ground up." },
];

export function IndustryCurriculum() {
  return (
    <section className="relative mx-auto px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">College & Professional Programs</p>
        <h2 className="mt-3 max-w-2xl font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          Industry-ready curriculum for the digital age
        </h2>
        <p className="mt-3 max-w-2xl text-slate-500">
          The same four subject areas, structured two ways — a full college curriculum, and fast-track
          courses for working professionals looking to reskill.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Reveal delay={0.05}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-night dark:text-white">College Curriculum</h3>
          <Stagger className="space-y-3">
            {SUBJECTS.map(({ Icon, title, body }) => (
              <motion.div key={title} variants={staggerItem} className="flex gap-3 rounded-xl bg-white p-4 shadow-card dark:bg-[#16213A]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={16} /></span>
                <div>
                  <p className="font-display text-sm font-semibold text-night dark:text-white">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{body}</p>
                </div>
              </motion.div>
            ))}
          </Stagger>
        </Reveal>

        <Reveal delay={0.1}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-night dark:text-white">Professional Courses</h3>
          <Stagger className="space-y-3">
            {SUBJECTS.map(({ Icon, title }) => (
              <motion.div key={title} variants={staggerItem} className="flex gap-3 rounded-xl bg-white p-4 shadow-card dark:bg-[#16213A]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Icon size={16} /></span>
                <div>
                  <p className="font-display text-sm font-semibold text-night dark:text-white">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Applied, fast-track version for working professionals reskilling on the job.</p>
                </div>
              </motion.div>
            ))}
          </Stagger>
        </Reveal>
      </div>
    </section>
  );
}
