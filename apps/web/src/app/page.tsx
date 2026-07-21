import Link from "next/link";
import { Button } from "@/components/ui/button";

const modules = [
  ["Student Lifecycle", "Admissions to alumni — records, documents, promotions and TCs in one flow."],
  ["Attendance", "Manual, RFID, QR and biometric capture with parent alerts in real time."],
  ["Fees & Finance", "UPI-first collections, instalments, GST receipts and reconciliation."],
  ["Examinations", "Question banks, online exams, report cards and Bloom-mapped analytics."],
  ["LMS & STEM Labs", "Courses, robotics kit inventory, ATL projects and competition tracking."],
  ["AI Assistant", "Lesson plans, report-card comments and risk detection, built in."],
] as const;

export default function Landing() {
  return (
    <div className="relative overflow-hidden bg-surface text-ink">
      {/* ambient orbs */}
      <div className="orb left-[-10%] top-[-10%] h-96 w-96 bg-accent/40" />
      <div className="orb right-[-8%] top-[30%] h-80 w-80 bg-primary/30 [animation-delay:4s]" />
      <div className="orb bottom-[5%] left-[35%] h-64 w-64 bg-warning/25 [animation-delay:8s]" />

      <header className="relative mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <span className="flex items-center gap-2.5 font-display text-lg font-semibold text-night">
          <img src="/creaspark-logo.png" alt="Creaspark logo" className="h-9 w-9 rounded-xl object-cover" />
          Creaspark<span className="align-super text-xs text-primary">™</span>
        </span>
        <nav className="hidden gap-8 text-sm md:flex" aria-label="Site">
          <Link href="#modules" className="hover:text-primary">Solutions</Link>
          <Link href="#pricing" className="hover:text-primary">Pricing</Link>
          <Link href="#contact" className="hover:text-primary">Contact</Link>
        </nav>
        <Link href="/login"><Button className="h-10">Sign in</Button></Link>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-24">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
          School ERP · LMS · STEM
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight text-night md:text-6xl">
          Empowering future-ready education
        </h1>
        <p className="mt-6 max-w-xl text-lg text-slate-500">
          One platform for schools, trusts and STEM academies across India — admissions,
          attendance, fees, exams, transport and AI-assisted learning, under your own brand.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/login"><Button className="h-12 px-8">Book a demo</Button></Link>
          <Link href="#modules"><Button variant="ghost" className="h-12 px-8">Explore modules</Button></Link>
        </div>
      </section>

      <section id="modules" className="relative mx-auto max-w-6xl px-6 pb-28">
        <h2 className="font-display text-2xl font-semibold text-night">Everything a school runs on</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(([title, body]) => (
            <div key={title} className="rounded-2xl bg-white p-6 shadow-card transition-transform duration-200 hover:-translate-y-1 hover:shadow-lift">
              <h3 className="font-display font-semibold text-night">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="contact" className="border-t border-slate-200 bg-white/60 py-10 text-center text-sm text-slate-500">
        © 2026 Creaspark™ · Privacy · Terms · support@creaspark.in
      </footer>
    </div>
  );
}
