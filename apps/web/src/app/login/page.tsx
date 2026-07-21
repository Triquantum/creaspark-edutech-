"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api";
import { Button } from "@/components/ui/button";

const fieldCls = "h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

function label(htmlFor: string, text: string) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">{text}</label>;
}

function SignInForm() {
  const router = useRouter();
  const [schoolCode, setSchoolCode] = useState(
    typeof window !== "undefined" ? localStorage.getItem("tenant") ?? "demo" : "demo",
  );
  const [email, setEmail] = useState("admin@demo.educore.in");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      localStorage.setItem("tenant", schoolCode.trim().toLowerCase());
      const res = await auth.login(email, password);
      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        {label("school-code", "School code")}
        <input id="school-code" required value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} className={fieldCls} />
      </div>
      <div>
        {label("email", "Email")}
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
      </div>
      <div>
        {label("password", "Password")}
        <input id="password" type="password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)} className={fieldCls} />
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">{loading ? "Signing in…" : "Sign in"}</Button>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-primary" /> Remember me
        </label>
        <a href="/forgot-password" className="text-primary hover:underline">Forgot password?</a>
      </div>

      <p className="text-center text-xs text-slate-400">Demo login: school code &quot;demo&quot;, admin@demo.educore.in / Educore@123</p>
    </form>
  );
}

function RegisterSchoolForm() {
  const router = useRouter();
  const [form, setForm] = useState({ schoolName: "", schoolCode: "", adminFullName: "", adminEmail: "", adminPassword: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.adminPassword !== form.confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await auth.registerSchool({
        schoolName: form.schoolName.trim(),
        schoolCode: form.schoolCode.trim(),
        adminFullName: form.adminFullName.trim(),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        adminPassword: form.adminPassword,
      });
      localStorage.setItem("tenant", res.tenant.slug);
      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register school");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        {label("sc-name", "School name")}
        <input id="sc-name" required value={form.schoolName} onChange={set("schoolName")} className={fieldCls} />
      </div>
      <div>
        {label("sc-code", "School code")}
        <input id="sc-code" required value={form.schoolCode} onChange={set("schoolCode")}
          placeholder="e.g. sunrise-public" className={fieldCls} />
        <p className="mt-1 text-xs text-slate-400">Letters, numbers and dashes — this is what you and your staff will sign in with.</p>
      </div>
      <div>
        {label("sc-admin-name", "Your name")}
        <input id="sc-admin-name" required value={form.adminFullName} onChange={set("adminFullName")} className={fieldCls} />
      </div>
      <div>
        {label("sc-admin-email", "Your email")}
        <input id="sc-admin-email" type="email" required value={form.adminEmail} onChange={set("adminEmail")} className={fieldCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          {label("sc-pw", "Password")}
          <input id="sc-pw" type="password" required minLength={8} value={form.adminPassword} onChange={set("adminPassword")} className={fieldCls} />
        </div>
        <div>
          {label("sc-pw2", "Confirm password")}
          <input id="sc-pw2" type="password" required minLength={8} value={form.confirm} onChange={set("confirm")} className={fieldCls} />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating school…" : "Register school"}</Button>
      <p className="text-center text-xs text-slate-400">
        You&apos;ll be signed in as the school admin immediately — you can register teachers, parents and students from there.
      </p>
    </form>
  );
}

export default function LoginPage() {
  const [tab, setTab] = useState<"signin" | "register">("signin");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#12263F] to-[#255C99] px-4 py-10">
      <div className="orb left-[8%] top-[12%] h-72 w-72 bg-accent/50" />
      <div className="orb bottom-[6%] right-[10%] h-96 w-96 bg-primary/60 [animation-delay:5s]" />
      <div className="orb left-[45%] top-[60%] h-52 w-52 bg-success/30 [animation-delay:9s]" />
      <div className="orb right-[30%] top-[8%] h-40 w-40 bg-warning/35 [animation-delay:12s]" />

      <div className="glass relative w-full max-w-md rounded-3xl p-8 shadow-lift">
        <div className="mb-6 text-center">
          <img src="/creaspark-logo.png" alt="Creaspark logo"
            className="mx-auto block h-16 w-16 rounded-2xl bg-white object-cover shadow-card" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-night dark:text-white">
            {tab === "signin" ? "Welcome back" : "Register your school"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tab === "signin" ? "Sign in to Creaspark" : "Every school gets its own students, staff and logins"}
          </p>
        </div>

        <div role="tablist" aria-label="Sign in or register" className="mb-6 grid grid-cols-2 rounded-xl bg-black/5 p-1 text-sm font-medium">
          <button role="tab" aria-selected={tab === "signin"} onClick={() => setTab("signin")}
            className={`rounded-lg py-2 transition-colors ${tab === "signin" ? "bg-white text-night shadow-card" : "text-slate-500"}`}>
            Sign in
          </button>
          <button role="tab" aria-selected={tab === "register"} onClick={() => setTab("register")}
            className={`rounded-lg py-2 transition-colors ${tab === "register" ? "bg-white text-night shadow-card" : "text-slate-500"}`}>
            Register school
          </button>
        </div>

        {tab === "signin" ? <SignInForm /> : <RegisterSchoolForm />}
      </div>
    </main>
  );
}
