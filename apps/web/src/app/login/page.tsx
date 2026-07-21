"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

const fieldCls = "h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

function label(htmlFor: string, text: string) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">{text}</label>;
}

export default function LoginPage() {
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
      </div>
    </main>
  );
}
