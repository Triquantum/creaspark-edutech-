"use client";
import { motion } from "framer-motion";
import { Reveal } from "./reveal";

export function OurStory() {
  return (
    <section id="about" className="relative mx-auto px-6 pb-28">
      <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
        <Reveal>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Our Story</p>
          <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
            Built to close the gap between classroom learning and real-world technology
          </h2>
          <p className="mt-5 text-slate-500">
            Creaspark started from a simple observation: schools and colleges everywhere wanted to prepare
            students for an AI-driven future, but rarely had the lab equipment, curriculum, or trained teachers
            to actually do it. So instead of selling just a product, we built the whole pipeline — lab setup,
            age-appropriate curriculum, hands-on teacher training, and ongoing support — and packaged it as one
            program an institution can adopt end to end. That same platform now also runs the day-to-day side of
            school administration, so a single system handles both the STEM labs and everything else a campus
            needs to operate.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="relative mx-auto w-full max-w-sm [perspective:1200px]">
          <div className="absolute -inset-3 -z-10 rounded-[1.75rem] bg-gradient-to-br from-primary/10 to-accent/10" />
          <motion.img
            whileHover={{ rotateX: 6, rotateY: -6, scale: 1.03 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{ transformStyle: "preserve-3d" }}
            src="/media/gallery-lab-interior.jpg"
            alt="Interior of a Creaspark STEM innovation lab"
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lift"
          />
        </Reveal>
      </div>
    </section>
  );
}
