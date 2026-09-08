"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface SubHeroCta {
  label: string;
  href: string;
}

interface SubHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta?: SubHeroCta;
  secondaryCta?: SubHeroCta;
}

function CtaLink({ cta, className }: { cta: SubHeroCta; className: string }) {
  const button = <Button className={className}>{cta.label}</Button>;
  return cta.href.startsWith("/") ? (
    <Link href={cta.href}>{button}</Link>
  ) : (
    <a href={cta.href}>{button}</a>
  );
}

export function SubHero({ eyebrow, title, description, primaryCta, secondaryCta }: SubHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-night px-6 py-20 text-center text-white md:py-28">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-accent/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto max-w-3xl"
      >
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white md:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">{description}</p>

        {(primaryCta || secondaryCta) && (
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {primaryCta && <CtaLink cta={primaryCta} className="h-11 px-7" />}
            {secondaryCta && (
              <CtaLink cta={secondaryCta} className="h-11 !bg-white/10 px-7 !text-white hover:!bg-white/20" />
            )}
          </div>
        )}
      </motion.div>
    </section>
  );
}
