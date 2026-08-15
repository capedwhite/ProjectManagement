"use client";

import api from "@/api";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PUBLIC_PATHS = ["/login", "/signup"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    if (isPublicPage) return;

    const fetchUser = async () => {
      try {
        const data = await api.get<{ user?: { name?: string; email?: string } }>("/auth/me");
        setUser(data.user || null);
      } catch {
        // middleware handles redirect if unauthenticated
      }
    };

    fetchUser();
  }, [isPublicPage]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    } finally {
      router.push("/login");
    }
  };

  if (isPublicPage) {
    return <>{children}</>;
  }

  const navItems = [
    {
      name: "Home",
      href: "/dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: "My Projects",
      href: "/projects",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      name: "My Tasks",
      href: "/tasks",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: "Calendar",
      href: "/calendar",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#f8fafb]">
      {/* Side Navigation Bar */}
      <aside className="w-64 bg-white border-r border-slate-200/90 text-slate-800 flex flex-col justify-between p-4 shrink-0 fixed inset-y-0 left-0 z-40">
        <div className="space-y-6">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 px-2 pt-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3ec170] font-bold text-white shadow-none">
              PM
            </div>
            <div>
              <h1 className="font-bold text-base text-slate-900 leading-tight">ProjectHub</h1>
              <p className="text-[11px] text-slate-400">Workspace Management</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 pt-2">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? "bg-[#3ec170] text-white"
                      : "text-slate-600 hover:bg-[#3ec170]/10 hover:text-[#2b9f58]"
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer / User Profile */}
        <div className="border-t border-slate-100 pt-4 space-y-3 px-2">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3ec170]/15 text-xs font-bold text-[#2b9f58] uppercase border border-[#3ec170]/30">
                {(user.name || user.email || "U").slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">{user.name || "User"}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email || ""}</p>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 min-w-0 min-h-screen bg-[#f8fafb]">
        {children}
      </div>
    </div>
  );
}
