"use client";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";

const PHOTOS = [
  { src: "/media/gallery-students-1.jpg", alt: "Students assembling robotics kits in a STEM lab" },
  { src: "/media/gallery-robotic-kit.jpg", alt: "Robotics kit components used in hands-on labs" },
  { src: "/media/gallery-3d-printers.jpg", alt: "3D printers running in a STEM innovation lab" },
  { src: "/media/gallery-drone-kits.jpg", alt: "Drone technology kits used for student projects" },
  { src: "/media/gallery-lab-interior.jpg", alt: "Interior of a STEM innovation lab" },
  { src: "/media/gallery-students-2.jpg", alt: "Students building robots during a lab session" },
  { src: "/media/gallery-teacher-training.jpg", alt: "Teacher training session in progress" },
  { src: "/media/gallery-ai-event.jpg", alt: "Students at an AI and STEM event" },
  { src: "/media/gallery-lab-wall.jpg", alt: "STEM lab wall with educational displays" },
];

export function Gallery() {
  return (
    <section id="gallery" className="relative mx-auto px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">In the Labs</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          A look inside our STEM innovation labs
        </h2>
      </Reveal>

      <Stagger className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PHOTOS.map(({ src, alt }) => (
          <motion.div
            key={src}
            variants={staggerItem}
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.2 }}
            className="aspect-square overflow-hidden rounded-xl shadow-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
