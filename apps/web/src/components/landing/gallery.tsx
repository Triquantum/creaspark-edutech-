"use client";
import { useEffect, useState } from "react";
import { Reveal, Stagger, staggerItem } from "./reveal";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

const FALLBACK_PHOTOS = [
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

interface HomepageMediaItem { id: string; url: string; title: string | null; type: "PHOTO" | "VIDEO" }

export function Gallery() {
  const [photos, setPhotos] = useState(FALLBACK_PHOTOS);

  useEffect(() => {
    api<HomepageMediaItem[]>("/public/homepage-media?section=GALLERY")
      .then((items) => {
        const uploaded = items
          .filter((i) => i.type === "PHOTO")
          .map((i) => ({ src: i.url, alt: i.title || "Creaspark STEM lab photo" }));
        if (uploaded.length > 0) setPhotos(uploaded);
      })
      .catch(() => {}); // API unreachable or no uploads yet -- keep the static fallback photos
  }, []);

  return (
    <section id="gallery" className="relative mx-auto px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">In the Labs</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
          A look inside our STEM innovation labs
        </h2>
      </Reveal>

      <Stagger className="mt-10 grid grid-cols-2 gap-3 [perspective:1000px] sm:grid-cols-3 lg:grid-cols-5">
        {photos.map(({ src, alt }) => (
          <motion.div
            key={src}
            variants={staggerItem}
            whileHover={{ scale: 1.06, rotateX: 5, rotateY: -5 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ transformStyle: "preserve-3d" }}
            className="group relative aspect-square overflow-hidden rounded-xl shadow-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
