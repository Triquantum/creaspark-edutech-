"use client";
import { Quote } from "lucide-react";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";

// Placeholder copy — swap in real quotes from partner schools before treating this as live testimonial content.
const QUOTES = [
  {
    quote: "Placeholder quote — add feedback from a partner school here once the lab has been running for a term.",
    role: "Program Coordinator, Partner School",
  },
  {
    quote: "Placeholder quote — add feedback from a teacher or lab mentor about the training and ongoing support.",
    role: "STEM Lab Mentor, Partner School",
  },
  {
    quote: "Placeholder quote — add feedback from a student or parent about a project built in the lab.",
    role: "Student, Partner School",
  },
];

export function Testimonials() {
  return (
    <section className="relative mx-auto px-6 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">What They Say</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          Feedback from institutions running the lab
        </h2>
      </Reveal>

      <Stagger className="mx-auto mt-10 grid max-w-5xl gap-5 [perspective:1200px] sm:grid-cols-2 lg:grid-cols-3">
        {QUOTES.map(({ quote, role }) => (
          <motion.div
            key={role}
            variants={staggerItem}
            whileHover={{ y: -8, rotateX: 6, rotateY: -4, scale: 1.02 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ transformStyle: "preserve-3d" }}
            className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-card dark:bg-[#16213A]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-accent transition-transform duration-300 group-hover:scale-x-100"
            />
            <Quote size={20} className="relative text-primary/40 transition-transform duration-300 group-hover:scale-110" />
            <p className="relative mt-3 text-sm leading-relaxed text-slate-500">{quote}</p>
            <p className="relative mt-4 text-xs font-semibold uppercase tracking-wide text-primary">{role}</p>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
