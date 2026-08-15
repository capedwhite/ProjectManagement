"use client";

import api from "@/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Assignee = {
  id: number;
  name: string;
  email?: string;
};

type TaskItem = {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
  createdAt?: string | null;
  assignee?: Assignee[];
  assignees?: Assignee[];
};

type Project = {
  id: number;
  title: string;
  description?: string;
  tasks?: TaskItem[];
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
};

type CalendarTask = {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate: string; // YYYY-MM-DD
  projectId: number;
  projectTitle: string;
  assignees: Assignee[];
};

const priorityStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  high: {
    bg: "bg-rose-50 hover:bg-rose-100",
    text: "text-rose-800",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  medium: {
    bg: "bg-[#3ec1b1]/10 hover:bg-[#3ec1b1]/20",
    text: "text-[#1f8e81]",
    border: "border-[#3ec1b1]/30",
    dot: "bg-[#3ec1b1]",
  },
  low: {
    bg: "bg-[#3ec170]/10 hover:bg-[#3ec170]/20",
    text: "text-[#2b9f58]",
    border: "border-[#3ec170]/30",
    dot: "bg-[#3ec170]",
  },
};

const completedStyle = {
  bg: "bg-[#3ec170]/10 hover:bg-[#3ec170]/20",
  text: "text-[#2b9f58]",
  border: "border-[#3ec170]/30",
  dot: "bg-[#3ec170]",
};

export default function CalendarPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "agenda">("month");
  const [filterMode, setFilterMode] = useState<"mine" | "all">("mine");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const authData = await api.get<{ user: CurrentUser }>("/auth/me");
        setCurrentUser(authData.user);

        const data = await api.get<{ projects: Project[] }>("/projects");
        setProjects(data.projects || []);
      } catch (err) {
        console.error("Failed to load calendar data:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const getTaskAssignees = (task: TaskItem): Assignee[] => {
    if (Array.isArray(task.assignee) && task.assignee.length > 0) return task.assignee;
    if (Array.isArray(task.assignees) && task.assignees.length > 0) return task.assignees;
    return [];
  };

  // Extract all calendar tasks mapped by YYYY-MM-DD
  const { allCalendarTasks, tasksByDate } = useMemo(() => {
    const list: CalendarTask[] = [];
    const map = new Map<string, CalendarTask[]>();

    projects.forEach((proj) => {
      if (selectedProjectId !== "all" && String(proj.id) !== selectedProjectId) {
        return;
      }

      (proj.tasks || []).forEach((task) => {
        if (!task.dueDate) return;

        const assignees = getTaskAssignees(task);
        const isAssigned = currentUser
          ? assignees.some((a) => a.id === currentUser.id)
          : true;

        if (filterMode === "mine" && !isAssigned) {
          return;
        }

        const dateStr = task.dueDate.slice(0, 10);
        const calTask: CalendarTask = {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: (task.priority || "medium").toLowerCase(),
          dueDate: dateStr,
          projectId: proj.id,
          projectTitle: proj.title,
          assignees,
        };

        list.push(calTask);

        if (!map.has(dateStr)) {
          map.set(dateStr, []);
        }
        map.get(dateStr)!.push(calTask);
      });
    });

    return { allCalendarTasks: list, tasksByDate: map };
  }, [projects, currentUser, filterMode, selectedProjectId]);

  // Date Navigation Handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Month Grid Calculation (Full Month Calendar with leading/trailing days)
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based day of week (0 = Monday, ..., 6 = Sunday)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const daysInCurrentMonth = lastDayOfMonth.getDate();

    const todayStr = new Date().toISOString().slice(0, 10);
    const days: Array<{
      date: Date;
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Previous month filler days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNumber = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dayNumber);
      const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
      days.push({
        date: d,
        dateString,
        dayNumber,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        date: d,
        dateString,
        dayNumber:i,
        isCurrentMonth: true,
        isToday: dateString === todayStr,
      });
    }

    // Next month filler days to complete 35 or 42 grid slots
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        date: d,
        dateString,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
      });
    }

    return days;
  }, [currentDate]);

  // Week Days Calculation
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    let dayOfWeek = curr.getDay() - 1;
    if (dayOfWeek === -1) dayOfWeek = 6;

    const monday = new Date(curr);
    monday.setDate(curr.getDate() - dayOfWeek);

    const todayStr = new Date().toISOString().slice(0, 10);
    const days: Array<{
      date: Date;
      dateString: string;
      dayNumber: number;
      dayName: string;
      isToday: boolean;
    }> = [];

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateString = d.toISOString().slice(0, 10);
      days.push({
        date: d,
        dateString,
        dayNumber: d.getDate(),
        dayName: dayNames[i],
        isToday: dateString === todayStr,
      });
    }

    return days;
  }, [currentDate]);

  // Agenda list (chronologically sorted)
  const agendaList = useMemo(() => {
    return [...allCalendarTasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [allCalendarTasks]);

  const monthTitle = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <main className="min-h-screen p-8 text-slate-600 flex items-center justify-center bg-[#f8fafb]">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3ec170] border-t-transparent" />
          <span className="text-sm font-medium">Loading task schedule...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 space-y-6 bg-[#f8fafb]">
      {/* Top Header & Workspace Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <svg className="w-4 h-4 text-[#3ec170]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Schedule</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Task Due Date Calendar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Keep track of all project task deadlines and upcoming due dates.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Task Filter */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterMode("mine")}
              className={`rounded-lg px-3 py-1.5 transition ${
                filterMode === "mine"
                  ? "bg-[#3ec170] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              My Tasks
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`rounded-lg px-3 py-1.5 transition ${
                filterMode === "all"
                  ? "bg-[#3ec170] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Projects
            </button>
          </div>

          {/* Project Selector */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#3ec170]"
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Master Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden">
        {/* Navigation & View Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 bg-white p-4 sm:px-6">
          {/* Left: Month Title & Arrow Navigation */}
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 min-w-[180px]">
              {monthTitle}
            </h2>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition active:scale-95"
                aria-label="Previous"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleToday}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition active:scale-95"
              >
                Today
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition active:scale-95"
                aria-label="Next"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right: View Switcher (Month / Week / Agenda) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  viewMode === "month"
                    ? "bg-[#3ec170] text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  viewMode === "week"
                    ? "bg-[#3ec170] text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setViewMode("agenda")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  viewMode === "agenda"
                    ? "bg-[#3ec170] text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Agenda List
              </button>
            </div>
          </div>
        </div>

        {/* 1. Month View */}
        {viewMode === "month" && (
          <div>
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-semibold text-slate-500">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="py-2.5 uppercase tracking-wider text-[11px]">
                  {day}
                </div>
              ))}
            </div>

            {/* 7-Column Month Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-slate-200">
              {monthDays.map((day, idx) => {
                const dayTasks = tasksByDate.get(day.dateString) || [];

                return (
                  <div
                    key={`${day.dateString}-${idx}`}
                    className={`min-h-[115px] sm:min-h-[125px] p-2 transition flex flex-col justify-between ${
                      day.isCurrentMonth
                        ? "bg-white"
                        : "bg-slate-50/70 text-slate-400"
                    } ${day.isToday ? "bg-[#3ec170]/10" : ""}`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          day.isToday
                            ? "bg-[#3ec170] text-white"
                            : day.isCurrentMonth
                            ? "text-slate-800"
                            : "text-slate-400"
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}
                        </span>
                      )}
                    </div>

                    {/* Day Tasks List */}
                    <div className="space-y-1 overflow-y-auto max-h-[85px] pr-0.5">
                      {dayTasks.slice(0, 3).map((task) => {
                        const isDone = task.status === "completed" || task.status === "done";
                        const style = isDone ? completedStyle : priorityStyles[task.priority] || priorityStyles.medium;

                        return (
                          <button
                            key={`${task.projectId}-${task.id}`}
                            type="button"
                            onClick={() => setSelectedTask(task)}
                            className={`group w-full text-left rounded-md border px-2 py-1 text-[11px] font-medium transition flex items-center gap-1.5 ${style.bg} ${style.border} ${style.text}`}
                            title={`${task.title} (${task.projectTitle})`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
                            <span className={`truncate flex-1 ${isDone ? "line-through opacity-75" : ""}`}>
                              {task.title}
                            </span>
                          </button>
                        );
                      })}

                      {dayTasks.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setSelectedTask(dayTasks[0])}
                          className="w-full text-center text-[10px] font-bold text-[#2b9f58] hover:text-[#1e7e43] py-0.5 transition"
                        >
                          +{dayTasks.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Week View */}
        {viewMode === "week" && (
          <div>
            {/* Week Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center divide-x divide-slate-200">
              {weekDays.map((day) => (
                <div key={day.dateString} className="py-3 px-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {day.dayName}
                  </p>
                  <span
                    className={`inline-flex mt-1 h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      day.isToday
                        ? "bg-[#3ec170] text-white"
                        : "text-slate-800"
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                </div>
              ))}
            </div>

            {/* 7-Column Week Day Columns */}
            <div className="grid grid-cols-7 divide-x divide-slate-200 bg-white min-h-[360px]">
              {weekDays.map((day) => {
                const dayTasks = tasksByDate.get(day.dateString) || [];

                return (
                  <div key={day.dateString} className="p-2 space-y-2">
                    {dayTasks.length === 0 ? (
                      <p className="text-[11px] text-slate-300 text-center pt-8 italic">
                        No due tasks
                      </p>
                    ) : (
                      dayTasks.map((task) => {
                        const isDone = task.status === "completed" || task.status === "done";
                        const style = isDone ? completedStyle : priorityStyles[task.priority] || priorityStyles.medium;

                        return (
                          <div
                            key={`${task.projectId}-${task.id}`}
                            onClick={() => setSelectedTask(task)}
                            className={`cursor-pointer rounded-xl border p-2.5 text-xs transition space-y-1 ${style.bg} ${style.border}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="rounded bg-white/80 border border-slate-200 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-600 truncate max-w-[80px]">
                                {task.projectTitle}
                              </span>
                              <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                            </div>

                            <p className={`font-semibold text-slate-900 truncate ${isDone ? "line-through opacity-70" : ""}`}>
                              {task.title}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Agenda List View */}
        {viewMode === "agenda" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Chronological Task Agenda</h3>
              <span className="text-xs font-semibold text-slate-500">
                {agendaList.length} Scheduled Task(s)
              </span>
            </div>

            {agendaList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium">No tasks found with due dates</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {agendaList.map((task) => {
                  const isDone = task.status === "completed" || task.status === "done";
                  const style = isDone ? completedStyle : priorityStyles[task.priority] || priorityStyles.medium;

                  return (
                    <div
                      key={`${task.projectId}-${task.id}`}
                      onClick={() => setSelectedTask(task)}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 uppercase">
                            {task.projectTitle}
                          </span>
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${style.bg} ${style.text} ${style.border}`}>
                            {task.priority}
                          </span>
                          <span className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                            {task.status}
                          </span>
                        </div>

                        <h4 className={`text-sm font-bold text-slate-900 group-hover:text-[#2b9f58] transition truncate ${isDone ? "line-through opacity-70" : ""}`}>
                          {task.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-4 text-xs shrink-0">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/80">
                          <svg className="w-4 h-4 text-[#3ec170]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(task.dueDate).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>

                        <span className="text-[#3ec170] font-semibold group-hover:translate-x-0.5 transition text-sm">
                          →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Details Modal on Click */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-slate-900 space-y-5 border border-slate-100">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase">
                    {selectedTask.projectTitle}
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      priorityStyles[selectedTask.priority]?.bg || "bg-slate-50"
                    } ${priorityStyles[selectedTask.priority]?.text || "text-slate-700"} ${
                      priorityStyles[selectedTask.priority]?.border || "border-slate-200"
                    }`}
                  >
                    {selectedTask.priority} Priority
                  </span>
                  <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                    {selectedTask.status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedTask.title}</h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px] mb-1">
                  Due Date
                </span>
                <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[#3ec170]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {selectedTask.dueDate}
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px] mb-1">
                  Assignees
                </span>
                {selectedTask.assignees.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedTask.assignees.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {a.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Unassigned</span>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px] mb-1.5">
                Description
              </span>
              {selectedTask.description ? (
                <p className="text-xs text-slate-700 bg-slate-50/70 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
                  {selectedTask.description}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No description provided for this task.</p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>

              <Link
                href={`/projects/${selectedTask.projectId}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#3ec170] px-4 py-2 text-xs font-semibold text-white hover:bg-[#65cd8c] transition"
              >
                <span>Open in Project Board</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
