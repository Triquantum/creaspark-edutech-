"use client";
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
    <section id="home" className="relative isolate mx-auto flex min-h-[720px] items-center overflow-hidden px-6 py-24 text-white md:min-h-[100vh] md:py-32">
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
          Igniting <span className="text-primary">STEM Innovation</span> in Every Institution
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 max-w-xl text-lg text-slate-200"
        >
          Hands-on future skills education in AI, Robotics, IoT, Drone Technology, 3D Printing, Machine
          Learning and Design Thinking — for schools, colleges and working professionals.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-wrap gap-4"
        >
          <a href="#domains"><Button className="h-12 gap-2 px-8">Explore Programs <ArrowRight size={16} /></Button></a>
          <a href="#contact"><Button className="h-12 !bg-night !text-white px-8 hover:!bg-night/80">Partner With Us</Button></a>
        </motion.div>

        <div className="mt-14 flex flex-wrap gap-5 [perspective:1200px]">
          {STATS.map(({ value, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 30, rotateX: -25 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.7, delay: 0.45 + i * 0.12, ease: "easeOut" }}
              whileHover={{ y: -8, rotateX: 10, rotateY: -8, scale: 1.06 }}
              style={{ transformStyle: "preserve-3d" }}
              className="glass min-w-[150px] rounded-2xl border border-white/10 px-6 py-5 text-center shadow-lift"
            >
              <motion.p
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
                className="font-display text-3xl font-semibold text-white"
              >
                {value}
              </motion.p>
              <p className="mt-1 text-sm text-slate-300">{label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
