"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal } from "./reveal";
import { Button } from "@/components/ui/button";

export function CtaBanner() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 pb-28">
      <Reveal>
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent px-8 py-16 text-center shadow-lift"
        >
          <div className="pointer-events-none absolute -left-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative font-display text-2xl font-semibold text-white md:text-3xl">
            Ready to bring future-ready education to your institution?
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-sm text-white/80">
            Partner with Creaspark for STEM labs, teacher training and a full-institution ERP — under your own brand.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/login"><Button className="h-12 bg-white px-8 text-primary hover:bg-white/90">Get in touch</Button></Link>
            <a href="#domains"><Button variant="ghost" className="h-12 border border-white/40 px-8 text-white hover:bg-white/10">Partner with us</Button></a>
          </div>
        </motion.div>
      </Reveal>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-slate-200 bg-white/60 py-12 dark:border-white/10 dark:bg-transparent">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="flex items-center gap-2 font-display text-base font-semibold text-night dark:text-white">
              <img src="/creaspark-logo.png" alt="Creaspark logo" className="h-8 w-8 rounded-lg object-cover" />
              Creaspark<span className="align-super text-xs text-primary">™</span>
            </span>
            <p className="mt-3 text-sm text-slate-500">
              Igniting STEM innovation in schools, colleges and industries through hands-on future-skills education.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Platform</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><a href="#modules" className="hover:text-primary">Modules</a></li>
              <li><a href="#domains" className="hover:text-primary">STEM Labs</a></li>
              <li><Link href="/login" className="hover:text-primary">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Who We Serve</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><a href="#who-we-serve" className="hover:text-primary">Schools</a></li>
              <li><a href="#who-we-serve" className="hover:text-primary">Colleges & Universities</a></li>
              <li><a href="#who-we-serve" className="hover:text-primary">Industry Partners</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li>support@creaspark.in</li>
              <li>Privacy</li>
              <li>Terms</li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-slate-100 pt-6 text-center text-xs text-slate-400 dark:border-white/10">
          © {new Date().getFullYear()} Creaspark™ · All rights reserved.
        </p>
      </div>
    </footer>
  );
}
