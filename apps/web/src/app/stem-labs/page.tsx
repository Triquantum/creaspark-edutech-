import { SiteNav } from "@/components/landing/site-nav";
import { SubHero } from "@/components/landing/sub-hero";
import { WhyCreaspark } from "@/components/landing/why-creaspark";
import { TechDomains } from "@/components/landing/tech-domains";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Testimonials } from "@/components/landing/testimonials";
import { LabGallery } from "@/components/landing/lab-gallery";
import { CtaBand } from "@/components/landing/cta-band";
import { SiteFooter } from "@/components/landing/cta-footer";

const LEARNING_MODEL = [
  { n: "01", title: "Curriculum Exploration", body: "Students start with guided concepts before touching any hardware, so the theory behind each build makes sense." },
  { n: "02", title: "Hands-On Building", body: "Kits and tools are used to construct a working prototype, one module at a time." },
  { n: "03", title: "Iteration & Testing", body: "Builds are tested, debugged and refined — failure is treated as part of the process, not the end of it." },
  { n: "04", title: "Peer Collaboration", body: "Students work in small teams, dividing tasks the way a real project team would." },
  { n: "05", title: "Real Project Outcomes", body: "Every module ends with a working project the student can demo, not just a worksheet." },
  { n: "06", title: "Reflection & Assessment", body: "A short review ties the build back to the underlying concept and tracks individual progress." },
];

const STUDENT_PROJECTS = [
  { title: "Line-Following Robot", body: "A robot that senses and follows a path using basic sensors and motor control." },
  { title: "Smart Irrigation Model", body: "A soil-moisture-triggered watering system built around simple IoT logic." },
  { title: "Home Automation Panel", body: "App-controlled lights and switches wired to a microcontroller." },
  { title: "Weather Monitoring Station", body: "Temperature, humidity and air-quality logging with live readouts." },
  { title: "Obstacle-Avoiding Bot", body: "A robot that reroutes itself in real time using distance sensors." },
  { title: "3D-Printed Prototype", body: "A functional part designed in CAD and produced end to end on a 3D printer." },
  { title: "Air Quality Sensor Network", body: "Multiple sensor nodes reporting readings back to a shared dashboard." },
  { title: "AI Chatbot Assistant", body: "A simple rules-and-ML based assistant trained on a small custom dataset." },
];

const REAL_WORLD_TECH = [
  { title: "Traffic Management", body: "Sensor-based models for monitoring flow and reducing congestion." },
  { title: "Agriculture Monitoring", body: "Soil, moisture and crop-health tracking for smarter farming decisions." },
  { title: "Waste Management", body: "Fill-level sensing and route optimisation for collection systems." },
  { title: "Water Management", body: "Usage tracking and leak detection across a connected network." },
  { title: "Campus Safety", body: "Access and environment monitoring built around simple IoT sensors." },
  { title: "Energy Optimisation", body: "Usage-pattern analysis to cut waste across a building or campus." },
];

export default function StemLabsPage() {
  return (
    <div className="relative bg-surface text-ink dark:bg-night dark:text-slate-200">
      <SiteNav />
      <div className="overflow-x-hidden">
        <SubHero
          eyebrow="STEM Innovation Labs"
          title="A model for future-ready education, built for any institution"
          description="A complete STEM lab program — equipment, curriculum, trained educators and ongoing mentorship — packaged so a school or college can adopt it end to end."
          primaryCta={{ label: "See What's Inside", href: "#inside-the-lab" }}
          secondaryCta={{ label: "Talk to Our Team", href: "/contact" }}
        />

        <WhyCreaspark />

        <div id="inside-the-lab">
          <TechDomains />
        </div>

        <FeatureGrid
          eyebrow="How It Works"
          title="A practical-first learning model"
          description="Every module moves from concept to a working build, not the other way around."
          items={LEARNING_MODEL}
          columns={3}
        />

        <FeatureGrid
          eyebrow="Student Work"
          title="What students build in the lab"
          description="A sample of the kinds of projects students take on as they move through the curriculum."
          items={STUDENT_PROJECTS}
          columns={4}
          variant="dark"
        />

        <FeatureGrid
          eyebrow="Applied Learning"
          title="Technology for real-world challenges"
          description="Lab skills applied to problems institutions and communities actually face."
          items={REAL_WORLD_TECH}
          columns={3}
        />

        <Testimonials />
        <LabGallery />

        <CtaBand
          title="Set up a STEM Innovation Lab at your institution"
          subtitle="Tell us a little about your school or college and we'll walk you through setup, curriculum and support."
          ctaLabel="Get in Touch"
          ctaHref="/contact"
        />

        <SiteFooter />
      </div>
    </div>
  );
}
