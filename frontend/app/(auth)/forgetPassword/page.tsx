"use client";

import { useState } from "react";
import Link from "next/link";
import api from "@/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await api.post<{ message: string }>("/auth/forgot-password", { email });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#3ec170] p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-[#133527]">Forgot password?</h1>
        <p className="text-sm text-slate-500 mt-1">Enter your email and we'll send you a reset link.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="w-full rounded-full border border-slate-200 px-5 py-3 text-sm outline-none focus:border-[#1a4d33] focus:ring-2 focus:ring-[#1a4d33]/20"
          />

          {message && <p className="text-sm text-[#1a4d33] bg-[#1a4d33]/10 rounded-lg p-3">{message}</p>}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#1a4d33] hover:bg-[#153f2a] text-white font-bold py-3 text-sm transition disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p className="text-sm text-center text-slate-500 mt-4">
          <Link href="/login" className="font-bold text-[#1a4d33] hover:underline">Back to login</Link>
        </p>
      </div>
    </main>
  );
}