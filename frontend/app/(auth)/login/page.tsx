"use client";

import api from "@/api";
import { loginSchema } from "@/lib/schemas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    // Validate with Zod
    const result = loginSchema.safeParse(form);
    if (!result.success) {
      const errors: Record<string, string> = {};
      const flat = result.error.flatten().fieldErrors;
      for (const [key, messages] of Object.entries(flat)) {
        if (messages && messages.length > 0) {
          errors[key] = messages[0];
        }
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/login", {
        email: result.data.email,
        password: result.data.password,
      });

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafb] p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 border border-slate-200/90">
        <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1 border border-slate-200/60">
          <button
            type="button"
            className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 border border-slate-200/80"
          >
            Login
          </button>
          <Link
            href="/signup"
            className="flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium text-slate-500 transition hover:text-slate-800"
          >
            Signup
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3ec170] font-bold text-white mb-3">
            PM
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-xs text-slate-500 mt-1">Sign in to your ProjectHub workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className={`w-full rounded-xl border bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#3ec170] focus:bg-white focus:ring-1 focus:ring-[#3ec170] ${fieldErrors.email ? "border-red-400" : "border-slate-300"}`}
              placeholder="you@example.com"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className={`w-full rounded-xl border bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#3ec170] focus:bg-white focus:ring-1 focus:ring-[#3ec170] ${fieldErrors.password ? "border-red-400" : "border-slate-300"}`}
              placeholder="••••••••"
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#3ec170] px-4 py-2.5 font-semibold text-sm text-white transition hover:bg-[#65cd8c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Please wait..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  );
}
