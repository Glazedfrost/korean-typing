"use client";

import { useEffect, useState } from "react";
import { supabase, resetPasswordForEmail, updatePassword } from "@/lib/supabase";

type Stage = "request" | "set-password" | "done";

export default function ResetPasswordPage() {
  const [stage, setStage] = useState<Stage>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // When Supabase redirects back with a recovery token, it fires
  // an auth state change with event = "PASSWORD_RECOVERY"
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setStage("set-password");
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    setMessage("");

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await resetPasswordForEmail(email, redirectTo);

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for a password reset link.");
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");

    const { error } = await updatePassword(password);

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStage("done");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Korean Typing Trainer
        </div>

        {stage === "request" && (
          <>
            <h1 className="text-lg font-semibold">Reset Password</h1>
            <p className="text-sm text-slate-400">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleRequestReset} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/60"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              {message && <p className="text-xs text-emerald-400">{message}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50 transition"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        )}

        {stage === "set-password" && (
          <>
            <h1 className="text-lg font-semibold">Set New Password</h1>
            <form onSubmit={handleSetPassword} className="space-y-3">
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/60"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/60"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </>
        )}

        {stage === "done" && (
          <>
            <h1 className="text-lg font-semibold">Password Updated</h1>
            <p className="text-sm text-slate-400">
              Your password has been changed. You can now sign in with your new password.
            </p>
            <a
              href="/"
              className="block w-full rounded-lg bg-sky-600 px-3 py-2 text-center text-sm font-medium hover:bg-sky-500 transition"
            >
              Back to App
            </a>
          </>
        )}

        {stage !== "done" && (
          <a
            href="/"
            className="block text-center text-xs text-slate-500 hover:text-slate-300 transition"
          >
            Back to app
          </a>
        )}
      </div>
    </div>
  );
}
