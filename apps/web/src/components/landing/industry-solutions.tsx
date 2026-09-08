"use client";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";
import { Network, Workflow, BarChart3, Wrench, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SOLUTIONS = [
  { Icon: Network, title: "AI Ecosystems", body: "End-to-end intelligent systems built for enterprise use." },
  { Icon: Workflow, title: "Automation", body: "Smart process automation combining ML and IoT." },
  { Icon: BarChart3, title: "Data Solutions", body: "Predictive analytics and data-driven decision support." },
  { Icon: Wrench, title: "Custom Tech", body: "Bespoke technology built around your industry's needs." },
];

export function IndustrySolutions() {
  return (
    <section id="industry-solutions" className="relative mx-4 overflow-hidden rounded-3xl bg-night px-6 py-16 text-white sm:mx-6 lg:mx-10 lg:px-12 lg:py-20 xl:mx-16">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Industry Solutions</p>
          <h2 className="mt-3 font-display text-2xl font-semibold md:text-3xl">
            AI-powered ecosystems for industry
          </h2>
          <p className="mt-3 max-w-md text-slate-300">
            Beyond education, we build AI-based ecosystems and custom technology for industry — from
            intelligent automation to data-driven decision systems.
          </p>
          <a href="#contact" className="mt-6 inline-block">
            <Button className="gap-2">Explore industry solutions <ArrowRight size={16} /></Button>
          </a>
        </Reveal>

        <Stagger className="grid grid-cols-2 gap-4">
          {SOLUTIONS.map(({ Icon, title, body }) => (
            <motion.div key={title} variants={staggerItem} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <Icon size={18} className="text-primary" />
              <p className="mt-3 font-display text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
            </motion.div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
