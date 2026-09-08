"use client";
import { motion } from "framer-motion";
import { Bot, Wifi, Rocket, Printer, BrainCircuit, Lightbulb, LineChart } from "lucide-react";
import { Reveal, Stagger, staggerItem } from "./reveal";

const DOMAINS = [
  { Icon: BrainCircuit, title: "Artificial Intelligence", body: "Building intelligent systems and exploring practical AI applications, from chatbots to computer vision." },
  { Icon: Bot, title: "Robotics", body: "Kit-based robotics labs with build, code and compete tracking." },
  { Icon: Wifi, title: "IoT Solutions", body: "Sensor networks and connected-device projects for real-world skills." },
  { Icon: Rocket, title: "Drone Technology", body: "Assembly, flight programming and aerial-data fundamentals." },
  { Icon: Printer, title: "3D Printing", body: "Design-to-print workflows across CAD, slicing and fabrication." },
  { Icon: LineChart, title: "Machine Learning", body: "Data-driven models and predictive analytics applied to real datasets." },
  { Icon: Lightbulb, title: "Design Thinking", body: "Structured ideation and prototyping for real institutional problems." },
];

export function TechDomains() {
  return (
    <section id="domains" className="relative mx-auto px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">STEM Labs</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          Future-skills education, built for hands-on learning
        </h2>
      </Reveal>

      <Stagger className="mt-10 grid gap-5 [perspective:1200px] sm:grid-cols-2 lg:grid-cols-4">
        {DOMAINS.map(({ Icon, title, body }) => (
          <motion.div
            key={title}
            variants={staggerItem}
            whileHover={{ y: -8, rotateX: 6, rotateY: -4, scale: 1.02, transition: { duration: 0.25, ease: "easeOut" } }}
            style={{ transformStyle: "preserve-3d" }}
            className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-card dark:bg-[#16213A]"
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/10 transition-transform duration-300 group-hover:scale-150" />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-accent transition-transform duration-300 group-hover:scale-x-100"
            />
            <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
              <Icon size={20} />
            </span>
            <h3 className="relative mt-4 font-display font-semibold text-night dark:text-white">{title}</h3>
            <p className="relative mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
