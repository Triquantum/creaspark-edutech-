"use client";
import { motion } from "framer-motion";
import { Reveal, Stagger, staggerItem } from "./reveal";

const MODULES = [
  ["Student Lifecycle", "Admissions to alumni — records, documents, promotions and TCs in one flow."],
  ["Attendance", "Manual, RFID, QR and biometric capture with parent alerts in real time."],
  ["Fees & Finance", "UPI-first collections, instalments, GST receipts and reconciliation."],
  ["Examinations", "Question banks, online exams, report cards and Bloom-mapped analytics."],
  ["LMS & STEM Labs", "Courses, robotics kit inventory, ATL projects and competition tracking."],
  ["AI Assistant", "Lesson plans, report-card comments and risk detection, built in."],
] as const;

export function ModulesGrid() {
  return (
    <section id="modules" className="relative mx-auto max-w-6xl px-6 pb-28">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold text-night dark:text-white">Everything an institution runs on</h2>
      </Reveal>
      <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(([title, body]) => (
          <motion.div
            key={title}
            variants={staggerItem}
            whileHover={{ y: -6, boxShadow: "0 12px 40px -12px rgba(47,111,184,0.30)" }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl bg-white p-6 shadow-card dark:bg-[#16213A]"
          >
            <h3 className="font-display font-semibold text-night dark:text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
