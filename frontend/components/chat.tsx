"use client";

import { useEffect, useState, useRef } from "react";
import { socket } from "@/lib/socket";
import api from "@/api";

type Message = {
  id: number;
  text: string;
  createdAt: string;
  user: { id: number; name: string };
};

export default function ProjectChat({ projectId, currentUserId, currentUserName }: {
  projectId: number;
  currentUserId: number;
  currentUserName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load history + connect socket + join room
  useEffect(() => {
    api.get<Message[]>(`/projects/${projectId}/messages`).then(setMessages);

    socket.connect();
    socket.emit("join-project", projectId);

    socket.on("new-message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.emit("leave-project", projectId);
      socket.off("new-message");
      socket.disconnect();
    };
  }, [projectId]);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    socket.emit("send-message", {
      projectId,
      text,
      userId: currentUserId,
      userName: currentUserName,
    });

    setText("");
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.user?.id === currentUserId;
          const initials = (m.user?.name || "?").slice(0, 2).toUpperCase();
          return (
            <div key={m.id} className={`flex items-start gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#3ec170] flex items-center justify-center text-[10px] font-bold text-white">
                {initials}
              </div>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${isMe ? "bg-[#3ec170] text-white" : "bg-slate-100 text-slate-800 border border-slate-200/70"}`}>
                {!isMe && <p className="text-[10px] font-semibold text-[#1f8e81] mb-0.5">{m.user?.name}</p>}
                <p>{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-200 px-3 py-2 bg-slate-50">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-[#3ec170]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#3ec170] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#65cd8c] transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}