"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Cpu, Bot, Wifi, Printer, BrainCircuit, Lightbulb, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const FLOATERS = [
  { Icon: Cpu, label: "AI", top: "8%", left: "4%", delay: 0 },
  { Icon: Bot, label: "Robotics", top: "58%", left: "0%", delay: 0.6 },
  { Icon: Wifi, label: "IoT", top: "14%", left: "88%", delay: 1.2 },
  { Icon: Rocket, label: "Drones", top: "70%", left: "90%", delay: 1.8 },
  { Icon: Printer, label: "3D Printing", top: "84%", left: "18%", delay: 2.4 },
  { Icon: BrainCircuit, label: "ML", top: "4%", left: "48%", delay: 3.0 },
  { Icon: Lightbulb, label: "Design", top: "40%", left: "94%", delay: 3.6 },
];

export function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-24 pt-16 md:pt-24">
      <div className="orb left-[-10%] top-[-10%] h-96 w-96 bg-accent/40" />
      <div className="orb right-[-8%] top-[30%] h-80 w-80 bg-primary/30 [animation-delay:4s]" />
      <div className="orb bottom-[5%] left-[35%] h-64 w-64 bg-warning/25 [animation-delay:8s]" />

      {FLOATERS.map(({ Icon, label, top, left, delay }) => (
        <motion.div
          key={label}
          className="pointer-events-none absolute z-0 hidden lg:block"
          style={{ top, left }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: [0, 1, 1, 0], y: [12, -8, -8, -20] }}
          transition={{ duration: 6, delay, repeat: Infinity, repeatDelay: FLOATERS.length * 0.6, ease: "easeInOut" }}
        >
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-ink shadow-card dark:text-white">
            <Icon size={14} className="text-primary" />
            {label}
          </div>
        </motion.div>
      ))}

      <div className="relative z-10">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-sm font-medium uppercase tracking-[0.2em] text-primary"
        >
          School ERP · LMS · STEM Innovation
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight text-night dark:text-white md:text-6xl"
        >
          Igniting STEM innovation in every institution
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 max-w-xl text-lg text-slate-500"
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
          <Link href="/login"><Button className="h-12 px-8">Book a demo</Button></Link>
          <a href="#domains"><Button variant="ghost" className="h-12 px-8">Explore programs</Button></a>
        </motion.div>
      </div>
    </section>
  );
}
