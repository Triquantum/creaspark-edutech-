"use client";
import { use, useState } from "react";
import { auth } from "@/lib/api";
import { Button } from "@/components/ui/button";

const fieldCls = "h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = use(searchParams);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (!token) { setError("Missing or invalid reset link"); return; }
    setLoading(true);
    try {
      await auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#12263F] to-[#255C99] px-4">
      <div className="glass relative w-full max-w-md rounded-3xl p-8 shadow-lift">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Set a new password</h1>
        </div>

        {!token && !done && (
          <p className="text-sm text-danger">This reset link is missing its token. Request a new one from the sign-in page.</p>
        )}

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600">Password updated. You can sign in now.</p>
            <a href="/login"><Button className="w-full">Go to sign in</Button></a>
          </div>
        ) : (
          token && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="rp-pw" className="mb-1.5 block text-sm font-medium">New password</label>
                <input id="rp-pw" type="password" required minLength={8} value={password}
                  onChange={(e) => setPassword(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label htmlFor="rp-pw2" className="mb-1.5 block text-sm font-medium">Confirm password</label>
                <input id="rp-pw2" type="password" required minLength={8} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} className={fieldCls} />
              </div>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">{loading ? "Updating…" : "Update password"}</Button>
            </form>
          )
        )}
      </div>
    </main>
  );
}
