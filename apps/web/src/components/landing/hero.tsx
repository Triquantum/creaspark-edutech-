"use client";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATS = [
  { value: "50+", label: "Institutions Served" },
  { value: "25,000+", label: "Students Impacted" },
  { value: "7", label: "STEM Programs" },
];

const HEADLINE = [
  { text: "Igniting", primary: false },
  { text: "STEM", primary: true },
  { text: "Innovation", primary: true },
  { text: "in", primary: false },
  { text: "Every", primary: false },
  { text: "Institution", primary: false },
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
          animate={{ opacity: 1, y: [0, -4, 0] }}
          transition={{ opacity: { duration: 0.6 }, y: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
          className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white"
        >
          <motion.span
            animate={{ rotate: [0, 15, 0, -15, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles size={14} className="text-primary" />
          </motion.span>
          STEM Innovation Labs &amp; Future Skills
        </motion.div>

        <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-tight text-white md:text-6xl [perspective:1000px]">
          <span className="flex flex-wrap gap-x-3">
            {HEADLINE.map((word, i) => (
              <motion.span
                key={word.text}
                initial={{ opacity: 0, y: 60, rotateX: -100 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  rotateX: 0,
                  ...(word.primary && { scale: [1, 1.06, 1] }),
                }}
                transition={{
                  opacity: { duration: 0.9, delay: 0.3 + i * 0.18, ease: "easeOut" },
                  y: { duration: 0.9, delay: 0.3 + i * 0.18, ease: "backOut" },
                  rotateX: { duration: 0.9, delay: 0.3 + i * 0.18, ease: "backOut" },
                  scale: { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 2 },
                }}
                style={{ transformStyle: "preserve-3d", display: "inline-block" }}
                className={word.primary ? "text-primary" : undefined}
              >
                {word.text}
              </motion.span>
            ))}
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.4 }}
          className="mt-6 max-w-xl text-lg text-slate-200"
        >
          Hands-on future skills education in AI, Robotics, IoT, Drone Technology, 3D Printing, Machine
          Learning and Design Thinking — for schools, colleges and working professionals.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.55 }}
          className="mt-10 flex flex-wrap gap-4 [perspective:800px]"
        >
          <motion.a href="#domains" whileHover={{ scale: 1.05, rotateX: 8, y: -2 }} style={{ transformStyle: "preserve-3d" }}>
            <Button className="h-12 gap-2 px-8">Explore Programs <ArrowRight size={16} /></Button>
          </motion.a>
          <motion.a href="#contact" whileHover={{ scale: 1.05, rotateX: 8, y: -2 }} style={{ transformStyle: "preserve-3d" }}>
            <Button className="h-12 !bg-night !text-white px-8 hover:!bg-night/80">Partner With Us</Button>
          </motion.a>
        </motion.div>

        <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 [perspective:1200px]">
          {STATS.map(({ value, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 24, rotateX: -30 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.6, delay: 1.7 + i * 0.12, ease: "easeOut" }}
              whileHover={{ y: -4, scale: 1.05 }}
              style={{ transformStyle: "preserve-3d" }}
            >
              <motion.p
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: "easeInOut", delay: 1.4 + i * 0.2 }}
                className="font-display text-3xl font-semibold text-white"
              >
                {value}
              </motion.p>
              <p className="text-sm text-slate-300">{label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
