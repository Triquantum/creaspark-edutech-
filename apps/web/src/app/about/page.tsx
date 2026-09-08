import { SiteNav } from "@/components/landing/site-nav";
import { SubHero } from "@/components/landing/sub-hero";
import { StatsStrip } from "@/components/landing/stats-strip";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Leadership } from "@/components/landing/leadership";
import { CtaBand } from "@/components/landing/cta-band";
import { SiteFooter } from "@/components/landing/cta-footer";
import { Reveal } from "@/components/landing/reveal";

const STATS = [
  { value: "50+", label: "Institutions Served" },
  { value: "25,000+", label: "Students Impacted" },
  { value: "7", label: "STEM Programs" },
  { value: "100%", label: "Hands-On Curriculum" },
];

const MISSION_VISION = [
  { title: "Our Mission", body: "To make hands-on, industry-relevant STEM education accessible to every school, college and institution — not just a few well-funded ones." },
  { title: "Our Vision", body: "A future where every student graduates with real, applied experience in the technologies shaping their world, not just theory about them." },
];

const CORE_VALUES = [
  { title: "Curiosity-Driven", body: "We build for students who learn by building, breaking and rebuilding things." },
  { title: "Practical Impact", body: "Every program is judged by what students can actually do afterward, not just what they covered." },
  { title: "Long-Term Partnership", body: "We stay involved after installation — support doesn't end when the lab is set up." },
  { title: "Accessible Innovation", body: "Future-skills education shouldn't be limited to institutions that can already afford it." },
];

const AUDIENCES = ["Schools", "Colleges & Universities", "Industry Partners", "Government & CSR Programs"];

export default function AboutPage() {
  return (
    <div className="relative bg-surface text-ink dark:bg-night dark:text-slate-200">
      <SiteNav />
      <div className="overflow-x-hidden">
        <SubHero
          eyebrow="About Creaspark"
          title="Igniting STEM innovation, one institution at a time"
          description="We build the STEM labs, curriculum and training that turn classroom learning into hands-on, real-world capability — and the platform that keeps a whole institution running alongside it."
          primaryCta={{ label: "Meet the Team", href: "#team" }}
          secondaryCta={{ label: "Talk to Our Team", href: "/contact" }}
        />

        <StatsStrip stats={STATS} />

        <section className="relative mx-auto px-6 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Our Story</p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-night dark:text-white md:text-3xl">
              Born from a belief that every student deserves access to the future
            </h2>
            <p className="mt-4 text-slate-500">
              Schools and colleges everywhere want to prepare students for an AI-driven future, but rarely have
              the lab equipment, curriculum or trained teachers to do it. Creaspark exists to close that gap —
              with a complete pipeline covering lab setup, curriculum, teacher training and ongoing mentorship,
              alongside a platform that runs the rest of the institution too.
            </p>
          </Reveal>
        </section>

        <FeatureGrid eyebrow="What Drives Us" title="Mission & vision" items={MISSION_VISION} columns={2} />

        <FeatureGrid eyebrow="How We Operate" title="Our core values" items={CORE_VALUES} columns={4} variant="dark" />

        <div id="team">
          <Leadership />
        </div>

        <section className="relative mx-auto px-6 pb-20 text-center">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Who We Work With</p>
            <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-3">
              {AUDIENCES.map((a) => (
                <span key={a} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 dark:border-white/10 dark:text-slate-300">
                  {a}
                </span>
              ))}
            </div>
          </Reveal>
        </section>

        <CtaBand
          title="Want to bring Creaspark to your institution?"
          subtitle="Tell us about your school, college or organisation and we'll take it from there."
          ctaLabel="Get in Touch"
          ctaHref="/contact"
        />

        <SiteFooter />
      </div>
    </div>
  );
}
