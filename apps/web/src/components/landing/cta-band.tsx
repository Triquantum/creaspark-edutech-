"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal } from "./reveal";
import { Button } from "@/components/ui/button";

interface CtaBandProps {
  title: string;
  subtitle?: string;
  ctaLabel: string;
  ctaHref: string;
}

export function CtaBand({ title, subtitle, ctaLabel, ctaHref }: CtaBandProps) {
  const button = (
    <motion.div whileHover={{ scale: 1.05, rotateX: 8, y: -2 }} style={{ transformStyle: "preserve-3d" }}>
      <Button className="h-11 !bg-white px-8 !text-primary hover:!bg-white/90">{ctaLabel}</Button>
    </motion.div>
  );

  return (
    <section className="relative overflow-hidden bg-primary px-6 py-14 text-center text-white">
      <Reveal className="relative [perspective:800px]">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">{title}</h2>
        {subtitle && <p className="mx-auto mt-2 max-w-xl text-sm text-white/85">{subtitle}</p>}
        <div className="mt-6">{ctaHref.startsWith("/") ? <Link href={ctaHref}>{button}</Link> : <a href={ctaHref}>{button}</a>}</div>
      </Reveal>
    </section>
  );
}
