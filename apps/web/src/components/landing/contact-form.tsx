"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const INQUIRY_TYPES = [
  "STEM Lab Setup (School)",
  "College / University Program",
  "Corporate / Industry Training",
  "Government / CSR Partnership",
  "Teacher Training",
  "Other Inquiry",
];

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary dark:border-white/10 dark:bg-[#16213A] dark:text-white";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-night dark:text-white">
      {label} {required && <span className="text-primary">*</span>}
      {children}
    </label>
  );
}

export function ContactForm() {
  const [inquiry, setInquiry] = useState(INQUIRY_TYPES[0]);
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = [
      `Inquiry type: ${inquiry}`,
      `Name: ${name}`,
      `Organisation: ${org}`,
      `Role: ${role}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      "",
      message,
    ].join("\n");
    window.location.href = `mailto:hello@creaspark.in?subject=${encodeURIComponent(`Website inquiry — ${inquiry}`)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-primary text-white shadow-lift">
      <div className="px-6 pt-6">
        <h2 className="font-display text-lg font-semibold">Send us a message</h2>
        <p className="mt-1 text-sm text-white/80">Fill in the details below and we'll get back to you shortly.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-t-2xl bg-white p-6 text-ink dark:bg-[#0F1B33] dark:text-white">
        <div>
          <p className="text-sm font-medium text-night dark:text-white">Type of inquiry</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INQUIRY_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setInquiry(t)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  inquiry === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 text-slate-500 hover:border-primary/50 dark:border-white/10 dark:text-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" required>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Your name" />
          </Field>
          <Field label="Organisation / Institution" required>
            <input required value={org} onChange={(e) => setOrg(e.target.value)} className={inputCls} placeholder="School, college or company name" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your Role">
            <input value={role} onChange={(e) => setRole(e.target.value)} className={inputCls} placeholder="e.g. Principal, Dean, HR Manager" />
          </Field>
          <Field label="Email Address" required>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
          </Field>
        </div>

        <Field label="Phone Number">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91 00000 00000" />
        </Field>

        <Field label="Message" required>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={inputCls}
            placeholder="Tell us about your institution, the program you're interested in, or any specific requirements..."
          />
        </Field>

        <Button type="submit" className="h-11 w-full gap-2">
          <Send size={16} /> Send Message
        </Button>
      </form>
    </div>
  );
}
