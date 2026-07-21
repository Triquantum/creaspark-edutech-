"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

const fieldCls = "h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw new Error(resetError.message);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#12263F] to-[#255C99] px-4">
      <div className="glass relative w-full max-w-md rounded-3xl p-8 shadow-lift">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">We&apos;ll email you a reset link.</p>
        </div>

        {!sent ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="fp-email" className="mb-1.5 block text-sm font-medium">Email</label>
              <input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">{loading ? "Sending…" : "Send reset link"}</Button>
            <p className="text-center text-sm text-slate-500">
              <a href="/login" className="text-primary hover:underline">Back to sign in</a>
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              If an account exists for {email}, a reset link is on its way — check your inbox.
            </p>
            <p className="text-center text-sm text-slate-500">
              <a href="/login" className="text-primary hover:underline">Back to sign in</a>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
