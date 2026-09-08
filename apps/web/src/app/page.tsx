import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { TechDomains } from "@/components/landing/tech-domains";
import { Gallery } from "@/components/landing/gallery";
import { OurStory } from "@/components/landing/our-story";
import { Leadership } from "@/components/landing/leadership";
import { CredibilityStrip } from "@/components/landing/credibility-strip";
import { ModulesGrid } from "@/components/landing/modules-grid";
import { WhoWeServe } from "@/components/landing/who-we-serve";
import { IndustryCurriculum } from "@/components/landing/industry-curriculum";
import { IndustrySolutions } from "@/components/landing/industry-solutions";
import { WhyCreaspark } from "@/components/landing/why-creaspark";
import { CtaBanner, SiteFooter } from "@/components/landing/cta-footer";

export default function Landing() {
  return (
    <div className="relative bg-surface text-ink dark:bg-night dark:text-slate-200">
      <SiteNav />
      <div className="overflow-x-hidden">
        <Hero />
        <TechDomains />
        <Gallery />
        <CredibilityStrip />
        <OurStory />
        <Leadership />
        <ModulesGrid />
        <WhoWeServe />
        <IndustryCurriculum />
        <IndustrySolutions />
        <WhyCreaspark />
        <CtaBanner />
        <SiteFooter />
      </div>
    </div>
  );
}
