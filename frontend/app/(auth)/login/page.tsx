"use client";

import api from "@/api";
import { loginSchema, signupSchema } from "@/lib/schemas";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Image from "next/image";
import { FiTrello, FiUsers, FiMessageCircle, FiEye, FiEyeOff  } from "react-icons/fi";
import Link  from "next/link";
export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Login state
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
const [showPassword, setShowPassword] = useState(false);
const [showSignupPassword, setShowSignupPassword] = useState(false);
  // Signup state
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "" });
  const [signupError, setSignupError] = useState("");
  const [signupFieldErrors, setSignupFieldErrors] = useState<Record<string, string>>({});
  const [signupLoading, setSignupLoading] = useState(false);

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError(""); setFieldErrors({});
    setSignupError(""); setSignupFieldErrors({});
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignupForm((prev) => ({ ...prev, [name]: value }));
    if (signupFieldErrors[name]) setSignupFieldErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleSignupSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSignupError(""); setSignupFieldErrors({});
    const result = signupSchema.safeParse(signupForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(result.error.flatten().fieldErrors)) {
        if (messages && messages.length > 0) errors[key] = messages[0];
      }
      setSignupFieldErrors(errors); return;
    }
    setSignupLoading(true);
    try {
      await api.post("/auth/signup", result.data);
      router.push("/dashboard");
    } catch (err) {
      setSignupError(err instanceof Error ? err.message : "Signup failed");
    } finally { setSignupLoading(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
    <main className="relative flex min-h-screen w-full flex-col md:flex-row bg-[#133527] overflow-x-hidden overflow-y-auto md:overflow-hidden m-0 p-0">
      {/* LEFT PANEL: White Curved Section spanning full height */}
      <div className="relative w-full md:w-[40%] bg-white p-6 sm:p-8 md:p-10 flex flex-col justify-between z-20 min-h-[320px] md:min-h-screen shrink-0">
        {/* Full-height S-Curve Divider extending into the right panel on desktop */}
        <svg
          className="hidden md:block absolute -right-24 lg:-right-32 top-0 h-full w-24 lg:w-32 text-white fill-current pointer-events-none z-30"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M0,0 C65,15 100,28 95,42 C88,58 35,70 12,85 C0,92 0,100 0,100 Z" />
        </svg>

    

        {/* Top Brand Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3ec170] font-bold text-white shadow-sm">
            PM
          </div>
          <div>
            <h2 className="text-base font-bold tracking-wider text-slate-800 uppercase leading-none">
              ProjectHub
            </h2>
            <p className="text-[11px] tracking-widest text-slate-400 uppercase mt-0.5 font-medium">
              Workspace Management
            </p>
          </div>
        </div>

        {/* Center Illustration Area */}
      {/* Center Illustration Area */}
<div className="flex-1 flex items-center justify-center relative py-2">
  <div className="relative w-full h-full max-h-[900px]">
    <Image
      src="/loginpart.png"
      alt="Workspace Illustration"
      fill
      className="object-contain mix-blend-multiply"
      priority
    />
  </div>
</div>

{/* Feature highlight cards */}
<div className="grid grid-cols-3 gap-3">
<div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
  <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ec170]/10">
    <FiTrello size={16} className="text-[#3ec170]" />
  </div>
  <p className="text-[11px] font-semibold text-slate-700">Kanban Boards</p>
</div>

<div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
  <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ec170]/10">
    <FiUsers size={16} className="text-[#3ec170]" />
  </div>
  <p className="text-[11px] font-semibold text-slate-700">Team Invites</p>
</div>

<div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
  <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ec170]/10">
    <FiMessageCircle size={16} className="text-[#3ec170]" />
  </div>
  <p className="text-[11px] font-semibold text-slate-700">Live Chat</p>
</div>
</div>
        {/* Bottom Left Footer */}
  
      </div>

      {/* RIGHT PANEL: Dark Green Full-Height Login Form */}
      <div className="relative flex-1 bg-[#3ec170] p-6 sm:p-8 md:p-10 md:pl-12 flex flex-col justify-between text-white z-10 min-h-screen">
        {/* Ambient background bokeh lighting orbs */}
       

        <div className="my-auto space-y-6 max-w-sm w-full mx-auto relative z-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {mode === "login" ? "Login To WorkSpace" : "Start Your Journey"}
            </h1>
            <p className="text-xs text-emerald-200/70 mt-1.5">
              {mode === "login" ? "Enter your credentials to access your workspace" : "Create a new account to get started"}
            </p>
          </div>

        {/* LOGIN FORM */}
{mode === "login" && (
  <form onSubmit={handleSubmit} className="space-y-4">
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-100/90">Email</label>
      <input type="email" name="email" value={form.email} onChange={handleChange}
        placeholder="Enter your email"
        className={`w-full rounded-full bg-white/90 border px-5 py-3.5 text-sm text-[#133527] placeholder-slate-400 outline-none transition focus:border-[#c13e8f] focus:ring-2 focus:ring-[#c13e8f]/40 ${fieldErrors.email ? "border-rose-400" : "border-transparent"}`}
      />
      {fieldErrors.email && <p className="text-xs text-red-600 pl-4">{fieldErrors.email}</p>}
    </div>
   <div className="space-y-1.5">
  <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-100/90">Password</label>
  <div className="relative">
    <input type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={handleChange}
      placeholder="Enter your password"
      className={`w-full rounded-full bg-white/90 border px-5 py-3.5 pr-12 text-sm text-[#133527] placeholder-slate-400 outline-none transition focus:border-[#1a4d33] focus:ring-2 focus:ring-[#1a4d33]/30 ${fieldErrors.password ? "border-rose-400" : "border-transparent"}`}
    />
<button type="button" onClick={() => setShowPassword((prev) => !prev)}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#1a4d33] transition cursor-pointer">
      {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
    </button>
  </div>
  {fieldErrors.password && <p className="text-xs text-red-600 pl-4">{fieldErrors.password}</p>}
</div>
    <div className="flex justify-end">
     <Link href="/forgetPassword" className="text-[11px] text-white/80 hover:text-white hover:underline transition">
  Forgot Password?
</Link>
    </div>
    {error && <div className="rounded-xl bg-red-400 border border-rose-800/80 p-3 text-xs text-white text-center">{error}</div>}
  <button type="submit" disabled={loading} className="w-full rounded-full bg-[#1a4d33] hover:bg-[#153f2a] text-white font-bold py-3.5 px-6 text-sm shadow-lg shadow-black/20 transition disabled:opacity-60 cursor-pointer">
  {loading ? "Signing in..." : "Login to Workspace"}
</button>
    <div className="text-center pt-1">
      <p className="text-xs text-white/80">
        Dont have an account?{" "}
        <button type="button" onClick={() => switchMode("signup")} className="font-bold text-white hover:underline transition ml-1 cursor-pointer">Register Now</button>
      </p>
    </div>
  </form>
)}
{/* SIGNUP FORM */}
{mode === "signup" && (
  <form onSubmit={handleSignupSubmit} className="space-y-4">
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-100/90">Full Name</label>
      <input type="text" name="name" value={signupForm.name} onChange={handleSignupChange}
        placeholder="Enter your full name"
        className={`w-full rounded-full bg-white/90 border px-5 py-3.5 text-sm text-[#133527] placeholder-slate-400 outline-none transition focus:border-[#c13e8f] focus:ring-2 focus:ring-[#c13e8f]/40 ${signupFieldErrors.name ? "border-rose-400" : "border-transparent"}`}
      />
      {signupFieldErrors.name && <p className="text-xs text-red-600 pl-4">{signupFieldErrors.name}</p>}
    </div>
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-100/90">Email</label>
      <input type="email" name="email" value={signupForm.email} onChange={handleSignupChange}
        placeholder="Enter your email"
        className={`w-full rounded-full bg-white/90 border px-5 py-3.5 text-sm text-[#133527] placeholder-slate-400 outline-none transition focus:border-[#c13e8f] focus:ring-2 focus:ring-[#c13e8f]/40 ${signupFieldErrors.email ? "border-rose-400" : "border-transparent"}`}
      />
      {signupFieldErrors.email && <p className="text-xs text-red-600 pl-4">{signupFieldErrors.email}</p>}
    </div>
   <div className="space-y-1.5">
  <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-100/90">Password</label>
  <div className="relative">
    <input type={showSignupPassword ? "text" : "password"} name="password" value={signupForm.password} onChange={handleSignupChange}
      placeholder="Create a password (min. 6 chars)"
      className={`w-full rounded-full bg-white/90 border px-5 py-3.5 pr-12 text-sm text-[#133527] placeholder-slate-400 outline-none transition focus:border-[#1a4d33] focus:ring-2 focus:ring-[#1a4d33]/30 ${signupFieldErrors.password ? "border-rose-400" : "border-transparent"}`}
    />
    <button type="button" onClick={() => setShowSignupPassword((prev) => !prev)}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#1a4d33] transition cursor-pointer">
      {showSignupPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
    </button>
  </div>
  {signupFieldErrors.password && <p className="text-xs text-red-600 pl-4">{signupFieldErrors.password}</p>}
</div>
    {signupError && <div className="rounded-xl bg-rose-950/60 border border-red-600 p-3 text-xs text-white text-center">{signupError}</div>}
    <button type="submit" disabled={signupLoading} className="w-full rounded-full bg-[#1a4d33] hover:bg-[#153f2a] text-white font-bold py-3.5 px-6 text-sm shadow-lg shadow-black/20 transition disabled:opacity-60 cursor-pointer">
      {signupLoading ? "Creating account..." : "Create Account"}
    </button>
    <div className="text-center pt-1">
      <p className="text-xs text-white/80">
        Already have an account?{" "}
        <button type="button" onClick={() => switchMode("login")} className="font-bold text-white hover:underline transition ml-1 cursor-pointer">Sign In</button>
      </p>
    </div>
  </form>
)}
        </div>

        {/* Right Bottom Footer Links */}
        <div className="pt-8 text-center md:text-right space-y-1 relative z-10">
          <div className="flex items-center justify-center md:justify-end gap-3 text-xs text-emerald-200/40">
            <a href="#" className="hover:text-emerald-200/80 transition hover:underline">
              Terms and Services
            </a>
            <span>•</span>
            <a href="#" className="hover:text-emerald-200/80 transition hover:underline">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

