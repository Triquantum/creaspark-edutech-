"use client";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";

const FEATURED = "/media/gallery-lab-interior.jpg";
const GRID = [
  "/media/gallery-students-1.jpg",
  "/media/gallery-robotic-kit.jpg",
  "/media/gallery-3d-printers.jpg",
  "/media/gallery-drone-kits.jpg",
  "/media/gallery-students-2.jpg",
  "/media/gallery-teacher-training.jpg",
];

export function LabGallery() {
  return (
    <section className="relative mx-auto px-6 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Our Lab in Action</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          A closer look at a real installation
        </h2>
      </Reveal>

      <div className="mx-auto mt-10 max-w-4xl space-y-3">
        <Reveal>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FEATURED} alt="Creaspark STEM lab interior" className="aspect-[16/9] w-full rounded-2xl object-cover shadow-lift" />
        </Reveal>
        <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {GRID.map((src) => (
            <motion.div key={src} variants={staggerItem} whileHover={{ scale: 1.03 }} className="aspect-square overflow-hidden rounded-xl shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Creaspark STEM lab activity" className="h-full w-full object-cover" loading="lazy" />
            </motion.div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
