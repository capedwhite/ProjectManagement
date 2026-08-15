"use client";

import api from "@/api";
import { useEffect, useRef, useState } from "react";

type User = { id: number; name: string; email: string };

export default function InviteSearch({
  projectId,
  onInvite,
  inviting = false,
}: {
  projectId: number;
  onInvite: (email: string) => void;
  inviting?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<User[]>(
          `/user/search?q=${encodeURIComponent(query.trim())}&excludeProjectId=${projectId}`
        );
        setResults(data || []);
      } catch (err) {
        console.error("Failed to search users:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, projectId]);

  const handleSendInvite = (emailToSend: string) => {
    const trimmed = emailToSend.trim();
    if (!trimmed) return;
    onInvite(trimmed);
    setQuery("");
    setResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleSendInvite(query);
    }
  };

  return (
    <div className="relative w-full space-y-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter name or email address..."
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-[#3ec170] focus:ring-1 focus:ring-[#3ec170] transition"
          />
          {loading && (
            <span className="absolute right-3 top-3 text-xs text-[#2b9f58] animate-pulse">
              Searching...
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!query.trim() || inviting}
          className="rounded-xl bg-[#3ec170] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#65cd8c] disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0 flex items-center gap-2"
        >
          {inviting && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          <span>{inviting ? "Sending..." : "Send Invite"}</span>
        </button>
      </form>

      {/* Search results dropdown list */}
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 border-slate-200">
          {results.map((user) => (
            <div
              key={user.id}
              onClick={() => {
                if (!inviting) handleSendInvite(user.email);
              }}
              className={`flex items-center justify-between rounded-lg p-2.5 hover:bg-[#3ec170]/10 transition ${
                inviting ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              </div>
              <button
                type="button"
                disabled={inviting}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendInvite(user.email);
                }}
                className="rounded-lg bg-[#3ec170] px-3 py-1 text-xs font-semibold text-white hover:bg-[#65cd8c] disabled:opacity-50 transition ml-2 flex items-center gap-1.5"
              >
                {inviting && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                Invite
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Direct email fallback prompt */}
      {query.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <span>No user found matching "{query}".</span>
          <button
            type="button"
            disabled={inviting}
            onClick={() => handleSendInvite(query)}
            className="rounded-lg bg-[#3ec170] px-3 py-1 text-xs font-semibold text-white hover:bg-[#65cd8c] disabled:opacity-50 transition flex items-center gap-1.5"
          >
            {inviting && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            Invite "{query}"
          </button>
        </div>
      )}
    </div>
  );
}