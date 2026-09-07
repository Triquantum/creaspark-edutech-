"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATS = [
  { value: "50+", label: "Institutions Served" },
  { value: "25,000+", label: "Students Impacted" },
  { value: "7", label: "STEM Programs" },
];

export function Hero() {
  return (
    <section className="relative isolate mx-auto flex min-h-[720px] items-center overflow-hidden px-6 py-24 text-white md:min-h-[100vh] md:py-32">
      <video
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        src="/media/stem-lab-hero.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night/95 via-night/80 to-night/50" />

      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white"
        >
          <Sparkles size={14} className="text-primary" />
          STEM Innovation Labs &amp; Future Skills
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-tight text-white md:text-6xl"
        >
          Igniting <span className="text-primary">STEM innovation</span> in every institution
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 max-w-xl text-lg text-slate-200"
        >
          One platform for schools, colleges and STEM academies — admissions, attendance, fees, exams,
          transport and AI-assisted learning, alongside hands-on AI, Robotics, IoT and Design Thinking labs.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-wrap gap-4"
        >
          <a href="#domains"><Button className="h-12 gap-2 px-8">Explore programs <ArrowRight size={16} /></Button></a>
          <Link href="/login"><Button className="h-12 !bg-night !text-white px-8 hover:!bg-night/80">Book a demo</Button></Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-12 flex flex-wrap gap-x-10 gap-y-4"
        >
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p className="font-display text-3xl font-semibold text-white">{value}</p>
              <p className="text-sm text-slate-300">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
