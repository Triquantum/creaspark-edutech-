import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { TechDomains } from "@/components/landing/tech-domains";
import { CredibilityStrip } from "@/components/landing/credibility-strip";
import { ModulesGrid } from "@/components/landing/modules-grid";
import { WhoWeServe } from "@/components/landing/who-we-serve";
import { CtaBanner, SiteFooter } from "@/components/landing/cta-footer";

export default function Landing() {
  return (
    <div className="relative overflow-x-hidden bg-surface text-ink dark:bg-night dark:text-slate-200">
      <SiteNav />
      <Hero />
      <TechDomains />
      <CredibilityStrip />
      <ModulesGrid />
      <WhoWeServe />
      <CtaBanner />
      <SiteFooter />
    </div>
  );
}
