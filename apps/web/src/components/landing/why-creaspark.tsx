"use client";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";

const POINTS = [
  { n: "01", title: "Hands-On Learning", body: "Every program is built around doing rather than watching — students build, test and iterate with real equipment and real challenges." },
  { n: "02", title: "Curriculum Integration", body: "Programs are designed to fit alongside institutional curricula, not compete with them, so STEM stays part of the academic flow." },
  { n: "03", title: "Expert Trainers", body: "Sessions are led by practitioners and educators who combine technical depth with the ability to actually teach it." },
  { n: "04", title: "End-to-End Support", body: "From lab setup and equipment through to ongoing mentorship and student project guidance — support doesn't stop at installation." },
];

export function WhyCreaspark() {
  return (
    <section className="relative mx-auto px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Why Creaspark</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          The Creaspark difference
        </h2>
      </Reveal>

      <Stagger className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {POINTS.map(({ n, title, body }) => (
          <motion.div key={n} variants={staggerItem} className="flex gap-4">
            <span className="font-display text-2xl font-semibold text-primary/30">{n}</span>
            <div>
              <h3 className="font-display font-semibold text-night dark:text-white">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
            </div>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
