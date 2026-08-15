"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Missing or invalid reset link.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#3ec170] p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-xl text-center">
          <p className="text-red-600">This reset link is invalid. Please request a new one.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#3ec170] p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-[#133527]">Set a new password</h1>

        {success ? (
          <p className="text-sm text-[#1a4d33] bg-[#1a4d33]/10 rounded-lg p-3 mt-4">
            Password reset! Redirecting you to login...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              required
              className="w-full rounded-full border border-slate-200 px-5 py-3 text-sm outline-none focus:border-[#1a4d33] focus:ring-2 focus:ring-[#1a4d33]/20"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              className="w-full rounded-full border border-slate-200 px-5 py-3 text-sm outline-none focus:border-[#1a4d33] focus:ring-2 focus:ring-[#1a4d33]/20"
            />

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#1a4d33] hover:bg-[#153f2a] text-white font-bold py-3 text-sm transition disabled:opacity-60"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}