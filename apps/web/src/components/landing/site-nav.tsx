"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "#domains", label: "STEM Labs" },
  { href: "#modules", label: "Platform" },
  { href: "#who-we-serve", label: "Who We Serve" },
  { href: "#contact", label: "Contact" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={`sticky top-0 z-30 transition-all duration-300 ${
        scrolled ? "glass shadow-card" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-semibold text-night dark:text-white">
          <img src="/creaspark-logo.png" alt="Creaspark logo" className="h-9 w-9 rounded-xl object-cover" />
          Creaspark<span className="align-super text-xs text-primary">™</span>
        </Link>

        <nav className="hidden gap-8 text-sm md:flex" aria-label="Site">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-ink/80 transition-colors hover:text-primary dark:text-slate-300">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href="/login"><Button className="h-10">Sign in</Button></Link>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid h-10 w-10 place-items-center rounded-xl text-ink hover:bg-black/5 dark:text-white dark:hover:bg-white/10 md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden md:hidden"
          >
            <nav className="glass flex flex-col gap-1 px-6 pb-6 pt-2" aria-label="Site mobile">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5">
                  {l.label}
                </a>
              ))}
              <Link href="/login" onClick={() => setOpen(false)}><Button className="mt-2 h-10 w-full">Sign in</Button></Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
