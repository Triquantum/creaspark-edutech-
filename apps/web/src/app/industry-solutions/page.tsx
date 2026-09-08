import { SiteNav } from "@/components/landing/site-nav";
import { SubHero } from "@/components/landing/sub-hero";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { CtaBand } from "@/components/landing/cta-band";
import { SiteFooter } from "@/components/landing/cta-footer";

const SERVICES = [
  { title: "AI Ecosystems", body: "End-to-end intelligent systems built around a business's own data and workflows." },
  { title: "Process Automation", body: "Combining ML and IoT to remove repetitive manual steps from day-to-day operations." },
  { title: "Predictive Analytics", body: "Forecasting demand, failures and outcomes from historical operational data." },
  { title: "Custom Data Pipelines", body: "Structured collection and processing of operational data, built around your systems." },
  { title: "Sensor & IoT Integration", body: "Connected-device networks that turn physical operations into live data streams." },
  { title: "Ongoing Optimisation", body: "Monitoring deployed systems and tuning them as usage and data patterns evolve." },
];

const SECTORS = [
  { title: "Manufacturing", body: "Quality checks and predictive maintenance driven by sensor data." },
  { title: "Healthcare", body: "Operational analytics and workflow automation for clinical and administrative teams." },
  { title: "Logistics & Supply Chain", body: "Route and inventory optimisation built on live tracking data." },
  { title: "Agriculture", body: "Field-level monitoring and yield forecasting for smarter planning." },
  { title: "Energy Sector", body: "Usage-pattern analysis to reduce waste and plan capacity better." },
  { title: "Retail & Commerce", body: "Demand forecasting and customer-behaviour analytics." },
  { title: "Smart Infrastructure", body: "Sensor networks for monitoring public and campus infrastructure." },
  { title: "Financial Services", body: "Anomaly detection and process automation for operational teams." },
];

const DELIVERY_PROCESS = [
  { n: "01", title: "Discovery & Assessment", body: "We map your current operations and data sources to scope what's actually achievable." },
  { n: "02", title: "Solution Design", body: "A tailored architecture is proposed, matched to your systems and constraints." },
  { n: "03", title: "Build & Integrate", body: "The solution is built and connected into your existing tools and workflows." },
  { n: "04", title: "Deploy & Support", body: "We deploy, monitor and support the system as usage and requirements evolve." },
];

export default function IndustrySolutionsPage() {
  return (
    <div className="relative bg-surface text-ink dark:bg-night dark:text-slate-200">
      <SiteNav />
      <div className="overflow-x-hidden">
        <SubHero
          eyebrow="Industry Solutions"
          title="AI-powered solutions for every industry"
          description="Beyond education, we build AI ecosystems and custom technology for industry — from intelligent automation to data-driven decision systems."
          primaryCta={{ label: "Explore Services", href: "#services" }}
          secondaryCta={{ label: "Talk to Our Team", href: "/contact" }}
        />

        <div id="services">
          <FeatureGrid
            eyebrow="What We Build"
            title="End-to-end industrial AI services"
            description="From data pipelines to deployed, monitored systems."
            items={SERVICES}
            columns={3}
          />
        </div>

        <FeatureGrid
          eyebrow="Where We Work"
          title="Transforming operations across sectors"
          items={SECTORS}
          columns={4}
          variant="dark"
        />

        <FeatureGrid
          eyebrow="How We Work"
          title="Our delivery process"
          items={DELIVERY_PROCESS}
          columns={4}
        />

        <CtaBand
          title="Ready to make your operations smarter?"
          subtitle="Tell us about your current workflows and data — we'll scope what a custom solution could look like."
          ctaLabel="Get in Touch"
          ctaHref="/contact"
        />

        <SiteFooter />
      </div>
    </div>
  );
}
