"use client";
import { Reveal } from "./reveal";

export function OurStory() {
  return (
    <section id="about" className="relative mx-auto px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Our Story</p>
        <h2 className="mt-3 max-w-2xl font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          Built to close the gap between classroom learning and real-world technology
        </h2>
        <p className="mt-5 max-w-3xl text-slate-500">
          Creaspark started from a simple observation: schools and colleges everywhere wanted to prepare
          students for an AI-driven future, but rarely had the lab equipment, curriculum, or trained teachers
          to actually do it. So instead of selling just a product, we built the whole pipeline — lab setup,
          age-appropriate curriculum, hands-on teacher training, and ongoing support — and packaged it as one
          program an institution can adopt end to end. That same platform now also runs the day-to-day side of
          school administration, so a single system handles both the STEM labs and everything else a campus
          needs to operate.
        </p>
      </Reveal>
    </section>
  );
}
