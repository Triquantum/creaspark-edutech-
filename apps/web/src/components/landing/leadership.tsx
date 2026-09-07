"use client";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";

const TEAM = [
  { name: "Rilesh TP", role: "CEO & Co-Founder", body: "Sets the direction for Creaspark's programs and leads partnerships with schools, colleges and industry.", photo: "/media/team-rilesh-tp-ceo.jpg" },
  { name: "Shimja TA", role: "Co-Founder & COO", initials: "ST", body: "Runs day-to-day operations across every school, college and corporate program Creaspark delivers." },
  { name: "Arjun Purushothaman", role: "Operations Manager", initials: "AP", body: "Coordinates lab installations and keeps training programs and institutional rollouts on schedule." },
  { name: "Curriculum Team", role: "Academic Design", initials: "CT", body: "Designs age-appropriate STEM and AI curriculum, from beginner robotics through advanced ML." },
  { name: "Lab & Training Team", role: "Implementation & Mentoring", initials: "LT", body: "Sets up labs on the ground and mentors teachers and students through their first projects." },
  { name: "Industry Solutions Team", role: "Corporate & Industrial", initials: "IS", body: "Builds AI, automation and analytics solutions for manufacturing and enterprise partners." },
];

export function Leadership() {
  return (
    <section className="relative mx-auto px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Leadership</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          The people behind Creaspark
        </h2>
      </Reveal>

      <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM.map(({ name, role, body, photo, initials }) => (
          <motion.div
            key={name}
            variants={staggerItem}
            className="rounded-2xl bg-white p-6 shadow-card dark:bg-[#16213A]"
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
                {initials}
              </span>
            )}
            <h3 className="mt-4 font-display font-semibold text-night dark:text-white">{name}</h3>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">{role}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
