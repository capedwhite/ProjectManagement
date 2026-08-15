"use client";

import api from "@/api";
import NotificationBell from "@/components/NotificationBell";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import { FiFolder, FiClipboard, FiZap, FiCheckCircle, FiClock, FiCheck, FiTrendingUp, FiPieChart, FiSmile } from "react-icons/fi";

type Task = {
  id: number;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
  createdAt?: string | null;
  assignee?: Array<{ id: number; name: string; email?: string }>;
};

type Project = {
  id: number;
  title: string;
  description?: string;
  createdAt?: string;
  columns?: Array<{ id: string; name: string }>;
  tasks?: Task[];
};

const priorityStyles: Record<string, string> = {
  low: "border-[#3ec170]/30 bg-[#3ec170]/10 text-[#2b9f58]",
  medium: "border-[#3ec1b1]/30 bg-[#3ec1b1]/10 text-[#1f8e81]",
  high: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: number; name?: string; email?: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [lineFilter, setLineFilter] = useState<"week" | "month">("week");

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const authData = await api.get<{ user?: { id?: number; name?: string; email?: string } }>("/auth/me");
        setUser(authData.user || null);

        const projectsData = await api.get<{ projects: Project[] }>("/projects");
        setProjects(projectsData.projects || []);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [router]);

  const totalProjects = projects.length;
  const myTasks = useMemo(() => {
    return projects
      .flatMap((p) => p.tasks || [])
      .filter((t) => {
        if (!user?.id) return true;
        if (Array.isArray(t.assignee) && t.assignee.some((a) => a.id === user.id)) return true;
        return false;
      });
  }, [projects, user]);

  const totalTasks = myTasks.length;
  const completedTasks = myTasks.filter((t) => t.status === "completed" || t.status === "done").length;
  const ongoingTasks = totalTasks - completedTasks;

  // -------------------------------------------------------------
  // Upcoming Deadlines (Close to 3-4 days or overdue)
  // -------------------------------------------------------------
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const list: Array<{
      task: Task;
      project: Project;
      daysRemaining: number;
      isOverdue: boolean;
    }> = [];

    projects.forEach((project) => {
      (project.tasks || []).forEach((task) => {
        if (!task.dueDate) return;
        const isDone = task.status === "completed" || task.status === "done";
        if (isDone) return;

        const dueTime = new Date(task.dueDate).getTime();
        const diffDays = Math.ceil((dueTime - startOfToday) / (24 * 60 * 60 * 1000));

        // Filter tasks that are overdue or due within ~4 days
        if (diffDays <= 4) {
          list.push({
            task,
            project,
            daysRemaining: diffDays,
            isOverdue: diffDays < 0,
          });
        }
      });
    });

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [projects]);

  // -------------------------------------------------------------
  // Line Graph: Activity Filtered by Week vs Month
  // -------------------------------------------------------------
  const lineChartData = useMemo(() => {
    if (lineFilter === "week") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const result: { label: string; projectsCount: number; tasksCount: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayLabel = days[d.getDay()];

        const projs = projects.filter((p) => p.createdAt && p.createdAt.slice(0, 10) === dateStr).length;
        const tasks = projects
          .flatMap((p) => p.tasks || [])
          .filter((t) => t.createdAt && t.createdAt.slice(0, 10) === dateStr).length;

        result.push({
          label: dayLabel,
          projectsCount: projs,
          tasksCount: tasks,
        });
      }
      return result;
    } else {
      // Month view: Last 4 weeks
      const result: { label: string; projectsCount: number; tasksCount: number }[] = [];
      for (let i = 3; i >= 0; i--) {
        const start = new Date();
        start.setDate(start.getDate() - (i + 1) * 7);
        const end = new Date();
        end.setDate(end.getDate() - i * 7);

        const projs = projects.filter((p) => {
          if (!p.createdAt) return false;
          const t = new Date(p.createdAt).getTime();
          return t >= start.getTime() && t < end.getTime();
        }).length;

        const tasks = projects
          .flatMap((p) => p.tasks || [])
          .filter((t) => {
            if (!t.createdAt) return false;
            const time = new Date(t.createdAt).getTime();
            return time >= start.getTime() && time < end.getTime();
          }).length;

        result.push({
          label: `Wk ${4 - i}`,
          projectsCount: projs,
          tasksCount: tasks,
        });
      }
      return result;
    }
  }, [projects, lineFilter]);

  // -------------------------------------------------------------
  // Pie Chart: Task Status Breakdown Across Workspace
  // -------------------------------------------------------------
  const statusPieData = useMemo(() => {
    const allTasks = projects.flatMap((p) => p.tasks || []);
    const total = allTasks.length;
    if (!total) {
      return [
        { name: "Completed", value: 0, color: "#3ec170", percent: 0 },
        { name: "Ongoing", value: 0, color: "#3ec1b1", percent: 0 },
        { name: "Incomplete", value: 0, color: "#94a3b8", percent: 0 },
      ];
    }

    const completed = allTasks.filter((t) => t.status === "completed" || t.status === "done").length;
    const ongoing = allTasks.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s === "ongoing" || s === "doing" || s === "in-progress" || s === "in progress";
    }).length;
    const incomplete = Math.max(0, total - completed - ongoing);

    return [
      {
        name: "Completed",
        value: completed,
        color: "#3ec170",
        percent: Math.round((completed / total) * 100),
      },
      {
        name: "Ongoing",
        value: ongoing,
        color: "#3ec1b1",
        percent: Math.round((ongoing / total) * 100),
      },
      {
        name: "Incomplete",
        value: incomplete,
        color: "#94a3b8",
        percent: Math.round((incomplete / total) * 100),
      },
    ];
  }, [projects]);

  const allWorkspaceTasksCount = projects.flatMap((p) => p.tasks || []).length;

  if (loading) {
    return (
      <main className="min-h-screen p-8 text-slate-600 flex items-center justify-center bg-[#f8fafb]">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3ec170] border-t-transparent"></div>
          <span className="text-sm font-medium">Loading workspace dashboard...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 sm:p-8 space-y-8 bg-[#f8fafb]">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">
            Welcome back, {user?.name || user?.email || "User"}!
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Here is your workspace overview, imminent deadlines, and performance analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell projects={projects} user={user} />
          <Link
            href="/tasks"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            My Tasks ({totalTasks})
          </Link>
          <Link
            href="/projects"
            className="rounded-xl bg-[#3ec170] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#65cd8c] transition"
          >
            Projects →
          </Link>
        </div>
      </div>

      {/* 1. 4 Summary Metric Cards */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 hover:border-[#3ec170]/40 transition space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Projects</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ec170]/10 text-[#3ec170]">
              <FiFolder className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalProjects}</p>
          <p className="text-xs text-slate-500">Active workspaces</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 hover:border-[#3ec170]/40 transition space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Tasks</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ec1b1]/10 text-[#3ec1b1]">
              <FiClipboard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalTasks}</p>
          <p className="text-xs text-slate-500">Assigned to you</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 hover:border-[#3ec1b1]/40 transition space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ongoing Tasks</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ec1b1]/10 text-[#3ec1b1]">
              <FiZap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#1f8e81]">{ongoingTasks}</p>
          <p className="text-xs text-slate-500">In progress / pending</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 hover:border-[#3ec170]/40 transition space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Completed Tasks</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3ec170]/10 text-[#3ec170]">
              <FiCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#2b9f58]">{completedTasks}</p>
          <p className="text-xs text-slate-500">Finished tasks</p>
        </div>
      </div>

      {/* 2. Two Columns Section: Recent Projects & Upcoming Deadlines */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Recent Projects (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiFolder className="w-5 h-5 text-[#3ec170]" />
              <h2 className="text-lg font-bold text-slate-900">Recent Projects</h2>
            </div>
            <Link
              href="/projects"
              className="text-xs font-semibold text-[#3ec170] hover:text-[#2b9f58] transition"
            >
              View All ({totalProjects}) →
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 space-y-3">
              <p className="text-sm">No projects created yet.</p>
              <Link
                href="/projects"
                className="inline-block rounded-xl bg-[#3ec170] px-4 py-2 text-xs font-semibold text-white hover:bg-[#65cd8c] transition"
              >
                Create your first project
              </Link>
            </div>
          ) : (
            <div className="grid gap-3.5">
              {projects.slice(0, 4).map((project) => {
                const projectTaskTotal = project.tasks?.length || 0;
                const projectDoneCount = (project.tasks || []).filter(
                  (t) => t.status === "completed" || t.status === "done"
                ).length;
                const progress = projectTaskTotal ? Math.round((projectDoneCount / projectTaskTotal) * 100) : 0;

                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 transition hover:border-[#3ec170]/60"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 group-hover:text-[#2b9f58] transition truncate text-sm">
                          {project.title}
                        </h3>
                        {project.createdAt && (
                          <span className="text-[10px] text-slate-400">
                            • {new Date(project.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {project.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-24 text-right">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>{projectDoneCount}/{projectTaskTotal} tasks</span>
                          <span className="font-semibold text-slate-700">{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#3ec170] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-slate-400 group-hover:translate-x-0.5 group-hover:text-[#3ec170] transition text-sm">
                        →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Tasks with Close Deadlines (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiClock className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-bold text-slate-900">Upcoming Deadlines</h2>
            </div>
            <span className="rounded-full bg-rose-50 border border-rose-200/60 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              {upcomingDeadlines.length} Due Soon
            </span>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 space-y-2 min-h-[220px]">
              <FiSmile className="w-8 h-8 text-[#3ec170]" />
              <p className="text-sm font-medium text-slate-700">All caught up!</p>
              <p className="text-xs text-slate-400 max-w-[200px]">
                No pending tasks with deadlines in the next 3-4 days.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {upcomingDeadlines.slice(0, 6).map(({ task, project, daysRemaining, isOverdue }) => {
                let badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                let badgeText = `${Math.abs(daysRemaining)}d overdue`;

                if (daysRemaining === 0) {
                  badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                  badgeText = "Due Today";
                } else if (daysRemaining === 1) {
                  badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                  badgeText = "Tomorrow";
                } else if (daysRemaining > 1) {
                  badgeClass = "bg-[#3ec1b1]/10 text-[#1f8e81] border-[#3ec1b1]/30";
                  badgeText = `In ${daysRemaining} days`;
                }

                return (
                  <Link
                    key={`${project.id}-${task.id}`}
                    href={`/projects/${project.id}`}
                    className="block rounded-xl border border-slate-200/90 bg-white p-3.5 transition hover:border-[#3ec170]/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase truncate max-w-[120px]">
                            {project.title}
                          </span>
                          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${priorityStyles[String(task.priority || "medium").toLowerCase()] || priorityStyles.medium}`}>
                            {task.priority || "medium"}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {task.title}
                        </h4>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
                          {badgeText}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(task.dueDate!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Visual Analytics Section: 2 Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Chart 1: Line Graph for Activity Filtered by Month and Week (7 cols) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-7 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-5 h-5 text-[#3ec170]" />
                <h3 className="text-base font-bold text-slate-900">Project Activity & Workload</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of projects & tasks created over time
              </p>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLineFilter("week")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  lineFilter === "week"
                    ? "bg-white text-[#2b9f58] border border-slate-200 font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setLineFilter("month")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  lineFilter === "month"
                    ? "bg-white text-[#2b9f58] border border-slate-200 font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                This Month
              </button>
            </div>
          </div>

          <div className="h-64 w-full pt-4 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="taskAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3ec170" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3ec170" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="projAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3ec1b1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3ec1b1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs border-slate-200">
                          <p className="font-bold text-slate-900 mb-1">{label}</p>
                          <div className="space-y-1">
                            <p className="flex items-center gap-2 text-[#2b9f58] font-semibold">
                              <span className="h-2 w-2 rounded-full bg-[#3ec170]" />
                              Tasks Added: {payload[0]?.value || 0}
                            </p>
                            <p className="flex items-center gap-2 text-[#1f8e81] font-semibold">
                              <span className="h-2 w-2 rounded-full bg-[#3ec1b1]" />
                              Projects Created: {payload[1]?.value || 0}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tasksCount"
                  name="Tasks Added"
                  stroke="#3ec170"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#taskAreaGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="projectsCount"
                  name="Projects Created"
                  stroke="#3ec1b1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#projAreaGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex items-center justify-center gap-6 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3ec170]" />
              <span>Tasks Created</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3ec1b1]" />
              <span>Projects Created</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Task Status Distribution Pie Chart (5 cols) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:col-span-5 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <FiPieChart className="w-5 h-5 text-[#3ec170]" />
              <h3 className="text-base font-bold text-slate-900">Task Status Distribution</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Percentage breakdown across all {allWorkspaceTasksCount} workspace tasks
            </p>
          </div>

          <div className="relative h-56 w-full pt-2 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                          <p className="font-bold text-slate-900" style={{ color: data.color }}>
                            {data.name}
                          </p>
                          <p className="text-slate-600">
                            {data.value} tasks ({data.percent}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-bold text-slate-900">{allWorkspaceTasksCount}</span>
              <span className="text-[10px] uppercase font-semibold text-slate-400">Total Tasks</span>
            </div>
          </div>

          {/* Status Breakdown Legend & Percentages */}
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
            {statusPieData.map((item) => (
              <div key={item.name} className="rounded-xl bg-slate-50 p-2 border border-slate-200/80">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[11px] font-semibold text-slate-700">{item.name}</span>
                </div>
                <p className="text-xs font-bold text-slate-900">{item.percent}%</p>
                <p className="text-[10px] text-slate-400">{item.value} tasks</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
