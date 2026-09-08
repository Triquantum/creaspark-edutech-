import { SiteNav } from "@/components/landing/site-nav";
import { SubHero } from "@/components/landing/sub-hero";
import { TechDomains } from "@/components/landing/tech-domains";
import { FaqAccordion } from "@/components/landing/faq-accordion";
import { CtaBand } from "@/components/landing/cta-band";
import { SiteFooter } from "@/components/landing/cta-footer";

const FAQS = [
  { question: "What grade levels or age groups do your programs support?", answer: "Curriculum tracks are built for middle school through college, and a separate fast-track version exists for working professionals." },
  { question: "Do you provide the equipment or does the institution buy it?", answer: "We supply and set up the lab equipment as part of the program — institutions don't need to source hardware separately." },
  { question: "Is your program aligned with school or college curricula?", answer: "Yes — programs are designed to sit alongside institutional curricula rather than compete with existing academic schedules." },
  { question: "How long does a typical training program run?", answer: "Programs range from short workshop formats to full-term courses, depending on the track and institution's schedule." },
  { question: "Who leads the training sessions?", answer: "Sessions are led by our in-house trainers, who combine technical depth with classroom teaching experience." },
  { question: "Do you provide ongoing support after the initial setup?", answer: "Yes — every program includes mentorship and support after installation, not just a one-time setup." },
  { question: "How large a group can a single program support?", answer: "Group sizes are flexible and typically planned around your existing class or cohort sizes during onboarding." },
];

export default function TrainingProgramsPage() {
  return (
    <div className="relative bg-surface text-ink dark:bg-night dark:text-slate-200">
      <SiteNav />
      <div className="overflow-x-hidden">
        <SubHero
          eyebrow="Training & Programs"
          title="Future-ready skills training for schools, colleges and professionals"
          description="Structured, hands-on STEM and future-skills training — designed to fit into the academic calendar of a school or college, or run as a fast-track course for working professionals."
          primaryCta={{ label: "Explore Programs", href: "#programs" }}
          secondaryCta={{ label: "Talk to Our Team", href: "/contact" }}
        />

        <div id="programs">
          <TechDomains />
        </div>

        <FaqAccordion items={FAQS} />

        <CtaBand
          title="Ready to launch a program at your institution?"
          subtitle="We'll walk you through curriculum options, scheduling and setup for your school, college or team."
          ctaLabel="Get in Touch"
          ctaHref="/contact"
        />

        <SiteFooter />
      </div>
    </div>
  );
}
