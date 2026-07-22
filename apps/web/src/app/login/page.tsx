"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const fieldCls = "h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

function label(htmlFor: string, text: string) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">{text}</label>;
}

interface AdmissionAccount { label: string; token: string }

function EmailLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);
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
    </form>
  );
}

function AdmissionLoginForm() {
  const router = useRouter();
  const [admissionNo, setAdmissionNo] = useState("");
  const [accounts, setAccounts] = useState<AdmissionAccount[] | null>(null);
  const [selectedToken, setSelectedToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ accounts: AdmissionAccount[] }>(`/auth/lookup-admission/${encodeURIComponent(admissionNo.trim())}`);
      if (res.accounts.length === 0) {
        setError("No account found for that admission number.");
        return;
      }
      setAccounts(res.accounts);
      setSelectedToken(res.accounts[0].token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look up that admission number");
    } finally {
      setLoading(false);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ access_token: string; refresh_token: string }>("/auth/login-with-token", {
        method: "POST",
        body: JSON.stringify({ token: selectedToken, password }),
        skipAuthRedirect: true,
      });
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: res.access_token, refresh_token: res.refresh_token,
      });
      if (sessionError) throw new Error(sessionError.message);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  if (!accounts) {
    return (
      <form onSubmit={lookup} className="space-y-4">
        <div>
          {label("admissionNo", "Admission number")}
          <input id="admissionNo" required value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)}
            placeholder="ADM-1041" className={fieldCls} />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">{loading ? "Looking up…" : "Continue"}</Button>
      </form>
    );
  }

  return (
    <form onSubmit={signIn} className="space-y-4">
      {accounts.length > 1 && (
        <div>
          {label("account", "Sign in as")}
          <select id="account" value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} className={fieldCls}>
            {accounts.map((a) => <option key={a.token} value={a.token}>{a.label}</option>)}
          </select>
        </div>
      )}
      {accounts.length === 1 && (
        <p className="text-sm text-slate-600">Signing in as <span className="font-medium">{accounts[0].label}</span></p>
      )}
      <div>
        {label("admPassword", "Password")}
        <input id="admPassword" type="password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)} className={fieldCls} autoFocus />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Signing in…" : "Sign in"}</Button>
      <button type="button" onClick={() => { setAccounts(null); setPassword(""); setError(null); }}
        className="text-sm text-slate-500 hover:underline">
        Use a different admission number
      </button>
    </form>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"email" | "admission">("email");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#12263F] to-[#255C99] px-4">
      <div className="orb left-[8%] top-[12%] h-72 w-72 bg-accent/50" />
      <div className="orb bottom-[6%] right-[10%] h-96 w-96 bg-primary/60 [animation-delay:5s]" />
      <div className="orb left-[45%] top-[60%] h-52 w-52 bg-success/30 [animation-delay:9s]" />
      <div className="orb right-[30%] top-[8%] h-40 w-40 bg-warning/35 [animation-delay:12s]" />

      <div className="glass relative w-full max-w-md rounded-3xl p-8 shadow-lift">
        <div className="mb-8 text-center">
          <img src="/creaspark-logo.png" alt="Creaspark logo"
            className="mx-auto block h-16 w-16 rounded-2xl bg-white object-cover shadow-card" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-night dark:text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to Creaspark</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => setMode("email")}
            className={`rounded-lg py-2 text-sm font-medium transition-colors ${mode === "email" ? "bg-white text-night shadow-sm" : "text-slate-500"}`}>
            Email
          </button>
          <button type="button" onClick={() => setMode("admission")}
            className={`rounded-lg py-2 text-sm font-medium transition-colors ${mode === "admission" ? "bg-white text-night shadow-sm" : "text-slate-500"}`}>
            Admission No.
          </button>
        </div>

        {mode === "email" ? <EmailLoginForm /> : <AdmissionLoginForm />}
      </div>
    </main>
  );
}
