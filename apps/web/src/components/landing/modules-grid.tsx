"use client";
import { motion } from "framer-motion";
import { Users, CalendarCheck, Wallet, ClipboardList, Cpu, Sparkles } from "lucide-react";
import { Reveal, Stagger, staggerItem } from "./reveal";

const MODULES = [
  { Icon: Users, title: "Student Lifecycle", body: "Admissions to alumni — records, documents, promotions and TCs in one flow." },
  { Icon: CalendarCheck, title: "Attendance", body: "Manual, RFID, QR and biometric capture with parent alerts in real time." },
  { Icon: Wallet, title: "Fees & Finance", body: "UPI-first collections, instalments, GST receipts and reconciliation." },
  { Icon: ClipboardList, title: "Examinations", body: "Question banks, online exams, report cards and Bloom-mapped analytics." },
  { Icon: Cpu, title: "LMS & STEM Labs", body: "Courses, robotics kit inventory, ATL projects and competition tracking." },
  { Icon: Sparkles, title: "AI Assistant", body: "Lesson plans, report-card comments and risk detection, built in." },
] as const;

export function ModulesGrid() {
  return (
    <section id="modules" className="relative mx-auto px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Platform</p>
        <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white">Everything an institution runs on</h2>
      </Reveal>
      <Stagger className="mt-10 grid gap-5 [perspective:1200px] sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(({ Icon, title, body }) => (
          <motion.div
            key={title}
            variants={staggerItem}
            whileHover={{ y: -8, rotateX: 6, rotateY: -4, scale: 1.02 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ transformStyle: "preserve-3d" }}
            className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-card dark:bg-[#16213A]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-accent transition-transform duration-300 group-hover:scale-x-100"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
            />
            <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
              <Icon size={20} />
            </span>
            <h3 className="relative mt-4 font-display font-semibold text-night dark:text-white">{title}</h3>
            <p className="relative mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
