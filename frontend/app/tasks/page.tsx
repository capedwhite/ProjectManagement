"use client";

import api from "@/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiClock,
  FiCalendar,
  FiFolder,
  FiCheckCircle,
  FiSearch,
  FiCheck,
  FiLayers,
} from "react-icons/fi";

type Assignee = {
  id: number;
  name: string;
  email?: string;
};

type TaskItem = {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority?: string;
  dueDate?: string | null;
  projectId: number;
  projectTitle?: string;
  assignee?: Assignee[];
};

type Project = {
  id: number;
  title: string;
  tasks?: TaskItem[];
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
};

// Project accent colors (left vertical strip)
const PROJECT_ACCENTS = [
  "bg-[#3ec170]",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-[#3ec1b1]",
  "bg-[#c13e8f]",
  "bg-sky-500",
  "bg-rose-500",
];

const AVATAR_COLORS = [
  "bg-[#3ec170]/15 text-[#2b9f58] border-white",
  "bg-indigo-100 text-indigo-700 border-white",
  "bg-purple-100 text-purple-700 border-white",
  "bg-amber-100 text-amber-700 border-white",
  "bg-rose-100 text-rose-700 border-white",
  "bg-sky-100 text-sky-700 border-white",
  "bg-teal-100 text-teal-700 border-white",
];

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

function getDueDateStatus(dueDateStr?: string | null, isCompleted?: boolean) {
  if (!dueDateStr) {
    return { type: "none", label: "No due date", className: "text-slate-400" };
  }

  const dueDate = new Date(dueDateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueTime = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  const diffDays = Math.ceil((dueTime - startOfToday) / (24 * 60 * 60 * 1000));

  if (isCompleted) {
    return {
      type: "completed",
      label: dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      className: "text-slate-400",
    };
  }

  if (diffDays < 0) {
    return {
      type: "overdue",
      label: `Overdue (${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
      className: "bg-rose-50 text-rose-700 border border-rose-200/90 font-semibold",
    };
  }

  if (diffDays === 0) {
    return {
      type: "today",
      label: "Due Today",
      className: "bg-rose-50 text-rose-700 border border-rose-200/90 font-semibold",
    };
  }

  if (diffDays <= 3) {
    return {
      type: "soon",
      label: `Due in ${diffDays}d (${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
      className: "bg-amber-50 text-amber-800 border border-amber-200/90 font-medium",
    };
  }

  return {
    type: "upcoming",
    label: `Due ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    className: "text-slate-600 font-medium bg-slate-50 border border-slate-200/70",
  };
}

export default function TasksPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "overdue" | "completed">("all");

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const me = await api.get<{ user: CurrentUser }>("/auth/me");
        const currentUserId = me.user.id;

        const data = await api.get<{
          projects: Project[];
        }>("/projects");

        const allTasks: TaskItem[] = [];

        (data.projects || []).forEach((project) => {
          (project.tasks || []).forEach((task) => {
            const isAssigned =
              Array.isArray(task.assignee) &&
              task.assignee.some(
                (assignee) => assignee.id === currentUserId
              );

            if (isAssigned) {
              allTasks.push({
                ...task,
                projectId: project.id,
                projectTitle: project.title,
              });
            }
          });
        });

        setTasks(allTasks);
      } catch (error) {
        console.error("Failed to load tasks:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [router]);

  // Compute overdue count for quick banner/filter indicator
  const overdueCount = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return tasks.filter((t) => {
      const isDone = t.status?.toLowerCase() === "completed" || t.status?.toLowerCase() === "done";
      if (isDone || !t.dueDate) return false;
      const dueTime = new Date(t.dueDate).getTime();
      return dueTime < startOfToday;
    }).length;
  }, [tasks]);

  // Filter tasks based on search and status filter
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return tasks.filter((task) => {
      const isDone = task.status?.toLowerCase() === "completed" || task.status?.toLowerCase() === "done";

      // Status filter
      if (statusFilter === "active" && isDone) return false;
      if (statusFilter === "completed" && !isDone) return false;
      if (statusFilter === "overdue") {
        if (isDone || !task.dueDate) return false;
        const dueTime = new Date(task.dueDate).getTime();
        if (dueTime >= startOfToday) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const matchesProject = task.projectTitle?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesProject) return false;
      }

      return true;
    });
  }, [tasks, statusFilter, searchQuery]);

  // Group filtered tasks by urgency
  const taskGroups = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const overdue: TaskItem[] = [];
    const dueSoon: TaskItem[] = [];
    const upcoming: TaskItem[] = [];
    const noDueDate: TaskItem[] = [];
    const completed: TaskItem[] = [];

    filteredTasks.forEach((task) => {
      const isDone = task.status?.toLowerCase() === "completed" || task.status?.toLowerCase() === "done";
      if (isDone) {
        completed.push(task);
        return;
      }

      if (!task.dueDate) {
        noDueDate.push(task);
        return;
      }

      const dueTime = new Date(task.dueDate).getTime();
      const diffDays = Math.ceil((dueTime - startOfToday) / (24 * 60 * 60 * 1000));

      if (diffDays < 0) {
        overdue.push(task);
      } else if (diffDays <= 3) {
        dueSoon.push(task);
      } else {
        upcoming.push(task);
      }
    });

    // Sort helper: due date ascending
    const sortByDate = (a: TaskItem, b: TaskItem) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    };

    return [
      {
        id: "overdue",
        title: "Overdue",
        description: "Passed deadlines that need urgent attention",
        tasks: overdue.sort(sortByDate),
        badgeClass: "bg-rose-100 text-rose-700 border-rose-200",
        icon: <FiAlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
      },
      {
        id: "dueSoon",
        title: "Due Today & Soon",
        description: "Deadlines within the next 3 days",
        tasks: dueSoon.sort(sortByDate),
        badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
        icon: <FiClock className="w-4 h-4 text-amber-600 shrink-0" />,
      },
      {
        id: "upcoming",
        title: "Upcoming",
        description: "Scheduled for later",
        tasks: upcoming.sort(sortByDate),
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        icon: <FiCalendar className="w-4 h-4 text-slate-500 shrink-0" />,
      },
      {
        id: "noDueDate",
        title: "No Due Date",
        description: "Backlog without explicit deadline",
        tasks: noDueDate,
        badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
        icon: <FiLayers className="w-4 h-4 text-slate-400 shrink-0" />,
      },
      {
        id: "completed",
        title: "Completed",
        description: "Tasks marked as completed or done",
        tasks: completed,
        badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
        icon: <FiCheckCircle className="w-4 h-4 text-[#3ec170] shrink-0" />,
      },
    ].filter((g) => g.tasks.length > 0);
  }, [filteredTasks]);

  return (
    <main className="min-h-screen p-8 space-y-6 bg-[#f8fafb]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">My Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">
            Prioritized worklist of tasks assigned to you across all projects
          </p>
        </div>

        {/* Quick stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
            {tasks.length} Total Assigned
          </span>
          {overdueCount > 0 && (
            <span className="rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 flex items-center gap-1.5 animate-pulse">
              <FiAlertCircle className="w-3.5 h-3.5" />
              <span>{overdueCount} Overdue</span>
            </span>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70"
            }`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
              statusFilter === "active"
                ? "bg-[#3ec170] text-white shadow-2xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70"
            }`}
          >
            Active (
            {tasks.filter((t) => t.status?.toLowerCase() !== "completed" && t.status?.toLowerCase() !== "done").length}
            )
          </button>
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("overdue")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
                statusFilter === "overdue"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
              }`}
            >
              Overdue ({overdueCount})
            </button>
          )}
          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
              statusFilter === "completed"
                ? "bg-slate-700 text-white shadow-2xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70"
            }`}
          >
            Completed (
            {tasks.filter((t) => t.status?.toLowerCase() === "completed" || t.status?.toLowerCase() === "done").length}
            )
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[220px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks or projects..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 outline-none transition focus:border-[#3ec170] focus:ring-2 focus:ring-[#3ec170]/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-20 rounded-2xl bg-white border border-slate-200/90 p-4 animate-pulse space-y-2"
            >
              <div className="h-4 bg-slate-200 rounded-md w-1/3" />
              <div className="h-3 bg-slate-100 rounded-md w-2/3" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3ec170]/15 text-[#2b9f58]">
            <FiCheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No tasks assigned to you</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You're all caught up! You can check your project boards or assign tasks to yourself.
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-xl bg-[#3ec170] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#34ab61] transition shadow-2xs"
          >
            <FiFolder className="w-4 h-4" />
            <span>Go to My Projects</span>
          </Link>
        </div>
      ) : filteredTasks.length === 0 ? (
        /* Filter Empty State */
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 space-y-2">
          <p className="text-sm font-semibold text-slate-700">No tasks match your filters</p>
          <p className="text-xs text-slate-400">Try adjusting your search query or status filter.</p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setSearchQuery("");
            }}
            className="mt-2 text-xs font-semibold text-[#2b9f58] hover:underline"
          >
            Reset filters
          </button>
        </div>
      ) : (
        /* Grouped Prioritized Tasks List */
        <div className="space-y-8">
          {taskGroups.map((group) => (
            <section key={group.id} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  {group.icon}
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    {group.title}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.2 text-[10px] font-bold border ${group.badgeClass}`}
                  >
                    {group.tasks.length}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:inline-block">
                  {group.description}
                </span>
              </div>

              {/* Compact Rows */}
              <div className="space-y-2.5">
                {group.tasks.map((task) => {
                  const isCompleted =
                    task.status?.toLowerCase() === "completed" || task.status?.toLowerCase() === "done";
                  const isOngoing =
                    task.status?.toLowerCase() === "ongoing" ||
                    task.status?.toLowerCase() === "in_progress" ||
                    task.status?.toLowerCase() === "in progress";
                  const priority = String(task.priority || "medium").toLowerCase();
                  const projectAccent = PROJECT_ACCENTS[task.projectId % PROJECT_ACCENTS.length];
                  const dueInfo = getDueDateStatus(task.dueDate, isCompleted);

                  return (
                    <div
                      key={`${task.projectId}-${task.id}`}
                      className={`group relative flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl bg-white p-3.5 sm:px-4 sm:py-3 border border-slate-200/90 transition-all duration-150 hover:shadow-md hover:border-slate-300 overflow-hidden ${
                        isCompleted ? "opacity-70 bg-slate-50/50 hover:opacity-100" : ""
                      }`}
                    >
                      {/* Left Accent Strip for Project Theme */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${projectAccent}`}
                        title={`Project: ${task.projectTitle || `#${task.projectId}`}`}
                      />

                      {/* Main Left Details */}
                      <div className="flex items-start md:items-center gap-3 min-w-0 flex-1 pl-1">
                        {/* Status Check Icon for completed or ongoing indicator */}
                        <div className="mt-0.5 md:mt-0 shrink-0">
                          {isCompleted ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <FiCheck className="w-3 h-3 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:border-slate-300">
                              <span className="h-2 w-2 rounded-full bg-slate-300 group-hover:bg-[#3ec170]" />
                            </span>
                          )}
                        </div>

                        {/* Title & Meta */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Project Badge */}
                            <span className="rounded-md bg-slate-100/90 border border-slate-200/60 px-2 py-0.5 text-[10px] font-semibold text-slate-700 uppercase tracking-wider">
                              {task.projectTitle || `Project #${task.projectId}`}
                            </span>

                            {/* Priority Badge */}
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                priority === "high"
                                  ? "bg-[#c13e8f]/15 text-[#a82577] border-[#c13e8f]/30"
                                  : priority === "medium"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {task.priority || "medium"}
                            </span>

                            {/* Status Pill */}
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                                isCompleted
                                  ? "bg-slate-100 text-slate-600 border-slate-200"
                                  : isOngoing
                                    ? "bg-[#3ec170]/15 text-[#238b4b] border-[#3ec170]/30 font-bold"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>

                          {/* Task Title */}
                          <h3
                            className={`text-sm font-bold text-slate-900 truncate ${
                              isCompleted ? "line-through text-slate-400 font-medium" : ""
                            }`}
                          >
                            {task.title}
                          </h3>

                          {/* Description preview if present */}
                          {task.description && (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Meta & Action Button */}
                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        {/* Assignee Avatars */}
                        {task.assignee && task.assignee.length > 0 ? (
                          <div className="flex items-center -space-x-1.5 overflow-hidden">
                            {task.assignee.slice(0, 3).map((assignee, i) => (
                              <div
                                key={assignee.id}
                                title={assignee.name || assignee.email || "Assignee"}
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ring-2 ring-white shadow-2xs ${
                                  AVATAR_COLORS[i % AVATAR_COLORS.length]
                                }`}
                              >
                                {getInitials(assignee.name, assignee.email)}
                              </div>
                            ))}
                            {task.assignee.length > 3 && (
                              <div
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-600 ring-2 ring-white"
                                title={`${task.assignee.length - 3} more`}
                              >
                                +{task.assignee.length - 3}
                              </div>
                            )}
                          </div>
                        ) : null}

                        {/* Due Date Indicator */}
                        <div
                          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg ${dueInfo.className}`}
                        >
                          {dueInfo.type === "overdue" ? (
                            <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <FiClock className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{dueInfo.label}</span>
                        </div>

                        {/* View in Board Button */}
                        <Link
                          href={`/projects/${task.projectId}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-[#3ec170] hover:text-[#238b4b] hover:bg-[#3ec170]/10 transition shrink-0"
                        >
                          View Board →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}