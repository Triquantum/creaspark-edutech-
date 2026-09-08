import Link from "next/link";
import { Mail, Phone, Globe, MapPin, Clock, School, Building2, Landmark } from "lucide-react";
import { SiteNav } from "@/components/landing/site-nav";
import { SubHero } from "@/components/landing/sub-hero";
import { ContactForm } from "@/components/landing/contact-form";
import { SiteFooter } from "@/components/landing/cta-footer";
import { Reveal } from "@/components/landing/reveal";

const AUDIENCE_CARDS = [
  { Icon: School, title: "Schools & Colleges", body: "Setting up STEM Innovation Labs or curriculum-integrated programs.", tint: "bg-primary/10 text-primary" },
  { Icon: Building2, title: "Industry & Corporate", body: "AI integration, automation and custom tech solutions for your team.", tint: "bg-warning/10 text-warning" },
  { Icon: Landmark, title: "Government & CSR", body: "Scale STEM education across districts through partnerships and grants.", tint: "bg-emerald-500/10 text-emerald-600" },
];

const QUICK_LINKS = [
  { label: "STEM Innovation Labs", href: "/stem-labs" },
  { label: "Training & Programs", href: "/training-programs" },
  { label: "Industry Solutions", href: "/industry-solutions" },
  { label: "About Creaspark", href: "/about" },
];

export default function ContactPage() {
  return (
    <div className="relative bg-surface text-ink dark:bg-night dark:text-slate-200">
      <SiteNav />
      <div className="overflow-x-hidden">
        <SubHero
          eyebrow="Contact Us"
          title="Let's build something remarkable together"
          description="Whether you're a school principal, college dean, CSR head or industry leader — we'd love to hear from you."
        />

        <section className="relative mx-auto px-6 pt-14">
          <Reveal>
            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
              {AUDIENCE_CARDS.map(({ Icon, title, body, tint }) => (
                <div key={title} className="rounded-2xl bg-white p-5 shadow-card dark:bg-[#16213A]">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-3 font-display text-sm font-semibold text-night dark:text-white">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="relative mx-auto px-6 py-16">
          <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_1.3fr]">
            <Reveal className="space-y-6">
              <div className="rounded-2xl bg-white p-6 shadow-card dark:bg-[#16213A]">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Reach Us Directly</p>
                <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2"><Mail size={16} className="text-primary" /> hello@creaspark.in</li>
                  <li className="flex items-center gap-2"><Phone size={16} className="text-primary" /> +91 90375 89945</li>
                  <li className="flex items-center gap-2"><Globe size={16} className="text-primary" /> creaspark.in</li>
                  <li className="flex items-center gap-2"><MapPin size={16} className="text-primary" /> Global Operations</li>
                  <li className="flex items-center gap-2"><Clock size={16} className="text-primary" /> We typically respond within 24 hours</li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-card dark:bg-[#16213A]">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Explore Our Programs</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {QUICK_LINKS.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-slate-600 hover:text-primary dark:text-slate-300">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <ContactForm />
            </Reveal>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
