"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiBell, FiAlertCircle, FiClock, FiTarget, FiMessageSquare, FiFolder } from "react-icons/fi";

export type NotificationItem = {
  id: string;
  type: "assignment" | "deadline" | "project" | "comment";
  title: string;
  message: string;
  projectId: number;
  projectTitle: string;
  taskId?: number;
  urgency?: "high" | "medium" | "low";
  timestamp: string;
  date: Date;
};

type Task = {
  id: number;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
  createdAt?: string | null;
  comments?: Array<{ id: string; text: string; author: string; createdAt: string }>;
  assignee?: Array<{ id: number; name: string; email?: string }>;
};

type Project = {
  id: number;
  title: string;
  description?: string;
  createdAt?: string;
  ownerId?: number;
  members?: Array<{ userId?: number; user?: { id: number; name: string; email: string } }>;
  tasks?: Task[];
};

interface NotificationBellProps {
  projects: Project[];
  user: { id?: number; name?: string; email?: string } | null;
}

export default function NotificationBell({ projects, user }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "deadline" | "assignment" | "project">("all");
  const [readIds, setReadIds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read notification IDs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`read_notifications_${user?.id || "guest"}`);
      if (saved) {
        setReadIds(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, [user?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Compute all notifications relevant to current user
  const notifications: NotificationItem[] = useMemo(() => {
    if (!user?.id && !user?.email) return [];
    const list: NotificationItem[] = [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    projects.forEach((project) => {
      // 1. Project Membership Notification
      const isMember =
        project.members?.some((m) => m.userId === user?.id || m.user?.id === user?.id) ||
        project.ownerId === user?.id;

      if (isMember) {
        list.push({
          id: `proj-${project.id}`,
          type: "project",
          title: "Project Workspace",
          message: `You are a member of project "${project.title}".`,
          projectId: project.id,
          projectTitle: project.title,
          urgency: "low",
          timestamp: project.createdAt ? new Date(project.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Recently",
          date: project.createdAt ? new Date(project.createdAt) : new Date(0),
        });
      }

      // 2. Task Notifications
      (project.tasks || []).forEach((task) => {
        const isAssigned =
          Array.isArray(task.assignee) &&
          task.assignee.some((a) => a.id === user?.id || (user?.email && a.email === user.email));

        // Task Assigned Notification
        if (isAssigned) {
          list.push({
            id: `assign-${project.id}-${task.id}`,
            type: "assignment",
            title: "Task Assigned",
            message: `You were assigned to "${task.title}" in ${project.title}.`,
            projectId: project.id,
            projectTitle: project.title,
            taskId: task.id,
            urgency: "medium",
            timestamp: task.createdAt ? new Date(task.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Recently",
            date: task.createdAt ? new Date(task.createdAt) : new Date(0),
          });

          // Task Comments Notification from others
          if (Array.isArray(task.comments) && task.comments.length > 0) {
            task.comments.forEach((comment) => {
              if (comment.author && comment.author.toLowerCase() !== (user?.name || "").toLowerCase() && comment.author.toLowerCase() !== "you") {
                list.push({
                  id: `comment-${project.id}-${task.id}-${comment.id}`,
                  type: "comment",
                  title: "New Task Comment",
                  message: `${comment.author} commented on "${task.title}": "${comment.text.slice(0, 50)}${comment.text.length > 50 ? "…" : ""}"`,
                  projectId: project.id,
                  projectTitle: project.title,
                  taskId: task.id,
                  urgency: "low",
                  timestamp: new Date(comment.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                  date: new Date(comment.createdAt),
                });
              }
            });
          }
        }

        // 3. Deadline Approaching Notifications (for assigned or all tasks in project)
        if (task.dueDate && isAssigned) {
          const isDone = task.status === "completed" || task.status === "done";
          if (!isDone) {
            const dueTime = new Date(task.dueDate).getTime();
            const diffDays = Math.ceil((dueTime - startOfToday) / (24 * 60 * 60 * 1000));

            if (diffDays < 0) {
              // Overdue
              list.push({
                id: `deadline-overdue-${project.id}-${task.id}`,
                type: "deadline",
                title: "Task Overdue!",
                message: `"${task.title}" in ${project.title} is overdue by ${Math.abs(diffDays)} day(s)!`,
                projectId: project.id,
                projectTitle: project.title,
                taskId: task.id,
                urgency: "high",
                timestamp: "Urgent",
                date: new Date(task.dueDate),
              });
            } else if (diffDays === 0) {
              // Due Today
              list.push({
                id: `deadline-today-${project.id}-${task.id}`,
                type: "deadline",
                title: "Deadline Due Today",
                message: `"${task.title}" in ${project.title} is due today!`,
                projectId: project.id,
                projectTitle: project.title,
                taskId: task.id,
                urgency: "high",
                timestamp: "Today",
                date: new Date(task.dueDate),
              });
            } else if (diffDays <= 4) {
              // Due soon (within 4 days)
              list.push({
                id: `deadline-soon-${project.id}-${task.id}`,
                type: "deadline",
                title: "Deadline Approaching",
                message: `"${task.title}" is due in ${diffDays} day(s) (${new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}).`,
                projectId: project.id,
                projectTitle: project.title,
                taskId: task.id,
                urgency: diffDays <= 2 ? "high" : "medium",
                timestamp: `In ${diffDays}d`,
                date: new Date(task.dueDate),
              });
            }
          }
        }
      });
    });

    // Sort by high urgency first, then recent date
    return list.sort((a, b) => {
      const urgencyRank = { high: 3, medium: 2, low: 1 };
      const rankDiff = (urgencyRank[b.urgency || "low"] || 1) - (urgencyRank[a.urgency || "low"] || 1);
      if (rankDiff !== 0) return rankDiff;
      return b.date.getTime() - a.date.getTime();
    });
  }, [projects, user]);

  // Unread notifications count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  // Filtered list
  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return notifications;
    if (activeFilter === "deadline") return notifications.filter((n) => n.type === "deadline");
    if (activeFilter === "assignment") return notifications.filter((n) => n.type === "assignment" || n.type === "comment");
    if (activeFilter === "project") return notifications.filter((n) => n.type === "project");
    return notifications;
  }, [notifications, activeFilter]);

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem(`read_notifications_${user?.id || "guest"}`, JSON.stringify(allIds));
    } catch {
      // ignore
    }
  };

  const markSingleAsRead = (id: string) => {
    if (readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    try {
      localStorage.setItem(`read_notifications_${user?.id || "guest"}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const getTypeIcon = (type: NotificationItem["type"], urgency?: string) => {
    if (type === "deadline") {
      return urgency === "high" ? <FiAlertCircle className="w-4 h-4 text-rose-500" /> : <FiClock className="w-4 h-4 text-amber-500" />;
    }
    if (type === "assignment") {
      return <FiTarget className="w-4 h-4 text-[#1f8e81]" />;
    }
    if (type === "comment") {
      return <FiMessageSquare className="w-4 h-4 text-[#2b9f58]" />;
    }
    return <FiFolder className="w-4 h-4 text-[#2b9f58]" />;
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-[#3ec170]/60 hover:bg-[#3ec170]/10 hover:text-[#2b9f58] active:scale-95 focus:outline-none"
        aria-label="Open notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge Indicator */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#3ec170] px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white z-50 overflow-hidden text-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#3ec170]/15 border border-[#3ec170]/30 px-2 py-0.5 text-[11px] font-semibold text-[#2b9f58]">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-semibold text-[#2b9f58] hover:text-[#1e7e43] transition"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 px-3 pt-2 gap-1 bg-white text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition ${activeFilter === "all" ? "bg-[#3ec170]/15 text-[#2b9f58] font-semibold" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("deadline")}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition ${activeFilter === "deadline" ? "bg-rose-50 text-rose-700 font-semibold" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Deadlines
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("assignment")}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition ${activeFilter === "assignment" ? "bg-[#3ec1b1]/15 text-[#1f8e81] font-semibold" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("project")}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition ${activeFilter === "project" ? "bg-[#3ec170]/15 text-[#2b9f58] font-semibold" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Projects
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-1.5">
                <FiBell className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-semibold text-slate-700">No notifications here</p>
                <p className="text-[11px]">You're completely up to date!</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isRead = readIds.includes(notif.id);

                return (
                  <Link
                    key={notif.id}
                    href={`/projects/${notif.projectId}`}
                    onClick={() => {
                      markSingleAsRead(notif.id);
                      setIsOpen(false);
                    }}
                    className={`flex items-start gap-3 rounded-xl p-3 transition text-left ${isRead ? "bg-white hover:bg-slate-50 opacity-80" : "bg-[#3ec170]/5 hover:bg-[#3ec170]/10 font-medium"
                      }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-sm mt-0.5">
                      {getTypeIcon(notif.type, notif.urgency)}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-bold ${notif.urgency === "high" ? "text-rose-600" : "text-slate-900"}`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                          {notif.timestamp}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                        {notif.message}
                      </p>

                      <div className="flex items-center gap-2 pt-1 text-[10px] text-[#2b9f58] font-semibold">
                        <span>{notif.projectTitle}</span>
                        <span>•</span>
                        <span>View Board →</span>
                      </div>
                    </div>

                    {!isRead && (
                      <span className="h-2 w-2 rounded-full bg-[#3ec170] shrink-0 mt-1.5" title="Unread" />
                    )}
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-center">
            <Link
              href="/tasks"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              View all your assigned tasks →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
