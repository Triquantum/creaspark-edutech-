"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal } from "./reveal";
import { Button } from "@/components/ui/button";

export function CtaBanner() {
  return (
    <section className="relative mx-auto px-6 pb-28">
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
          <div className="relative mt-8 flex flex-wrap justify-center gap-4 [perspective:800px]">
            <Link href="/login">
              <motion.div whileHover={{ scale: 1.05, rotateX: 8, y: -2 }} style={{ transformStyle: "preserve-3d" }}>
                <Button className="h-12 !bg-white px-8 !text-primary hover:!bg-white/90">Get in touch</Button>
              </motion.div>
            </Link>
            <a href="#domains">
              <motion.div whileHover={{ scale: 1.05, rotateX: 8, y: -2 }} style={{ transformStyle: "preserve-3d" }}>
                <Button variant="ghost" className="h-12 border border-white/40 px-8 text-white hover:bg-white/10">Partner with us</Button>
              </motion.div>
            </a>
          </div>
        </motion.div>
      </Reveal>
    </section>
  );
}

const SERVICES = ["Artificial Intelligence", "Robotics", "IoT Solutions", "Drone Technology", "3D Printing", "Machine Learning", "Design Thinking"];
const AUDIENCES = ["Schools", "Colleges & Universities", "Working Professionals", "Industry Partners"];
const COMPANY_LINKS = [
  { label: "About Us", href: "#about" },
  { label: "STEM Innovation Labs", href: "#domains" },
  { label: "Industry Solutions", href: "#industry-solutions" },
  { label: "Contact", href: "#contact" },
];

export function SiteFooter() {
  return (
    <footer id="contact" className="bg-night py-16 text-slate-300">
      <div className="mx-auto px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <span className="flex items-center gap-2 font-display text-base font-semibold text-white">
              <img src="/creaspark-logo.png" alt="Creaspark logo" className="h-8 w-8 rounded-lg object-cover" />
              Creaspark<span className="align-super text-xs text-primary">™</span>
            </span>
            <p className="mt-3 max-w-xs text-sm text-slate-400">
              Igniting STEM innovation in schools, colleges and industries worldwide through hands-on
              future-skills education.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-400">
              <li>hello@creaspark.in</li>
              <li>+91 90375 89945</li>
              <li>creaspark.in</li>
              <li>Global Operations</li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Our Services</p>
            <ul className="mt-3 space-y-2 text-sm">
              {SERVICES.map((s) => <li key={s}><a href="#domains" className="inline-block transition-transform duration-200 hover:translate-x-1 hover:text-primary">{s}</a></li>)}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Who We Serve</p>
            <ul className="mt-3 space-y-2 text-sm">
              {AUDIENCES.map((a) => <li key={a}><a href="#who-we-serve" className="inline-block transition-transform duration-200 hover:translate-x-1 hover:text-primary">{a}</a></li>)}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Company</p>
            <ul className="mt-3 space-y-2 text-sm">
              {COMPANY_LINKS.map((c) => <li key={c.label}><a href={c.href} className="inline-block transition-transform duration-200 hover:translate-x-1 hover:text-primary">{c.label}</a></li>)}
              <li><Link href="/login" className="inline-block transition-transform duration-200 hover:translate-x-1 hover:text-primary">Sign In</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Partner With Us</p>
            <p className="mt-3 text-sm text-slate-400">
              Ready to set up a STEM Innovation Lab or launch a future skills program at your institution?
            </p>
            <a href="#contact" className="mt-4 inline-block"><Button className="h-10">Get in Touch</Button></a>
            <div className="mt-4 flex gap-1.5">
              <span className="h-1 w-8 rounded-full bg-primary" />
              <span className="h-1 w-8 rounded-full bg-warning" />
              <span className="h-1 w-8 rounded-full bg-accent" />
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Creaspark™ · All rights reserved.</p>
          <p>Empowering the next generation of <span className="text-primary">STEM innovators</span></p>
        </div>
      </div>
    </footer>
  );
}
