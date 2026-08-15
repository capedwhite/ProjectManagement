"use client";

import api from "@/api";
import { createProjectSchema } from "@/lib/schemas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEffect, useState, useId } from "react";
import {
  FiPlus,
  FiX,
  FiClock,
  FiAlertCircle,
  FiActivity,
  FiUsers,
  FiFolder,
  FiCheckCircle,
} from "react-icons/fi";

type Task = {
  id: number;
  title: string;
  status: string;
  priority?: string;
  position?: number;
  dueDate?: string | null;
  createdAt?: string | null;
  assignee?: Array<{ id: number; name: string; email?: string }>;
};

type Project = {
  id: number;
  title: string;
  description?: string | null;
  createdAt?: string;
  ownerId?: number;
  columns?: Array<{ id: string; name: string }> | string[];
  tasks?: Task[];
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
};

type MemberItem = {
  id: number;
  role: string;
  userId: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
};

type ActivityItem = {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  user?: {
    id: number;
    name: string;
  };
};

// Curated color themes for project card accents
const CARD_THEMES = [
  {
    strip: "from-[#3ec170] to-[#3ec1b1]",
    borderHover: "hover:border-[#3ec170]/60",
    bar: "bg-[#3ec170]",
    roleBadge: "bg-[#3ec170]/10 text-[#2b9f58] border-[#3ec170]/30",
  },
  {
    strip: "from-indigo-500 to-blue-400",
    borderHover: "hover:border-indigo-400/60",
    bar: "bg-indigo-500",
    roleBadge: "bg-indigo-50 text-indigo-700 border-indigo-200/70",
  },
  {
    strip: "from-violet-500 to-purple-400",
    borderHover: "hover:border-violet-400/60",
    bar: "bg-violet-500",
    roleBadge: "bg-violet-50 text-violet-700 border-violet-200/70",
  },
  {
    strip: "from-amber-500 to-orange-400",
    borderHover: "hover:border-amber-400/60",
    bar: "bg-amber-500",
    roleBadge: "bg-amber-50 text-amber-700 border-amber-200/70",
  },
  {
    strip: "from-[#3ec1b1] to-teal-400",
    borderHover: "hover:border-[#3ec1b1]/60",
    bar: "bg-[#3ec1b1]",
    roleBadge: "bg-[#3ec1b1]/10 text-[#1f8e81] border-[#3ec1b1]/30",
  },
  {
    strip: "from-pink-500 to-rose-400",
    borderHover: "hover:border-pink-400/60",
    bar: "bg-pink-500",
    roleBadge: "bg-pink-50 text-pink-700 border-pink-200/70",
  },
  {
    strip: "from-sky-500 to-blue-500",
    borderHover: "hover:border-sky-400/60",
    bar: "bg-sky-500",
    roleBadge: "bg-sky-50 text-sky-700 border-sky-200/70",
  },
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

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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

function getProgress(tasks?: Task[]) {
  if (!tasks || tasks.length === 0) return { total: 0, completed: 0, percent: 0 };
  const total = tasks.length;
  const completed = tasks.filter(
    (t) => t.status?.toLowerCase() === "completed" || t.status?.toLowerCase() === "done"
  ).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}

function getOverdueCount(tasks?: Task[]): number {
  if (!tasks || !tasks.length) return 0;
  const now = new Date().getTime();
  return tasks.filter((t) => {
    if (!t.dueDate) return false;
    const isDone = t.status?.toLowerCase() === "completed" || t.status?.toLowerCase() === "done";
    if (isDone) return false;
    return new Date(t.dueDate).getTime() < now;
  }).length;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [membersMap, setMembersMap] = useState<Record<number, MemberItem[]>>({});
  const [activitiesMap, setActivitiesMap] = useState<Record<number, ActivityItem[]>>({});

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const titleInputId = useId();
  const descInputId = useId();

  const loadProjects = async () => {
    try {
      const [authRes, projectsRes] = await Promise.all([
        api.get<{ user?: CurrentUser }>("/auth/me").catch(() => null),
        api.get<{ projects: Project[] }>("/projects"),
      ]);

      if (authRes?.user) {
        setCurrentUser(authRes.user);
      }

      const projList = projectsRes.projects || [];
      setProjects(projList);

      // Fetch members and activities in parallel for all projects
      if (projList.length > 0) {
        const membersPromise = Promise.allSettled(
          projList.map((p) =>
            api
              .get<MemberItem[]>(`/projects/member/${p.id}/members`)
              .then((res) => ({ id: p.id, members: res }))
          )
        );

        const activitiesPromise = Promise.allSettled(
          projList.map((p) =>
            api
              .get<ActivityItem[]>(`/projects/${p.id}/activity`)
              .then((res) => ({ id: p.id, activities: res }))
          )
        );

        const [membersResults, activitiesResults] = await Promise.all([
          membersPromise,
          activitiesPromise,
        ]);

        const newMembersMap: Record<number, MemberItem[]> = {};
        membersResults.forEach((r) => {
          if (r.status === "fulfilled" && r.value) {
            newMembersMap[r.value.id] = r.value.members || [];
          }
        });
        setMembersMap(newMembersMap);

        const newActivitiesMap: Record<number, ActivityItem[]> = {};
        activitiesResults.forEach((r) => {
          if (r.status === "fulfilled" && r.value) {
            newActivitiesMap[r.value.id] = r.value.activities || [];
          }
        });
        setActivitiesMap(newActivitiesMap);
      }
    } catch {
      router.push("/login");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [router]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCreateModalOpen) {
        setIsCreateModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateModalOpen]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Validate with Zod
    const result = createProjectSchema.safeParse({ title, description });
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
      await api.post("/projects", {
        title: result.data.title,
        description: result.data.description,
      });

      setTitle("");
      setDescription("");
      setFieldErrors({});
      setIsCreateModalOpen(false);
      toast.success("Project created successfully");
      await loadProjects();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const getProjectAvatars = (project: Project) => {
    const map = new Map<number, { id: number; name: string; email?: string }>();

    // From members API
    const pMembers = membersMap[project.id] || [];
    pMembers.forEach((m) => {
      if (m.user?.id) {
        map.set(m.user.id, m.user);
      }
    });

    // From task assignees
    (project.tasks || []).forEach((t) => {
      if (Array.isArray(t.assignee)) {
        t.assignee.forEach((a) => {
          if (a?.id) map.set(a.id, a);
        });
      }
    });

    return Array.from(map.values());
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 bg-[#f8fafb]">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">My Projects</h1>
        </div>

        {/* Collapsed + New Project Button */}
        <button
          type="button"
          onClick={() => {
            setFieldErrors({});
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#3ec170] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#34ab61] transition-all duration-150 active:scale-98 cursor-pointer self-start sm:self-auto"
        >
          <FiPlus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create New Project</h2>
                <p className="text-xs text-slate-500 mt-0.5">Start a fresh board for your team</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label
                  htmlFor={titleInputId}
                  className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600"
                >
                  Project Title *
                </label>
                <input
                  id={titleInputId}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (fieldErrors.title) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.title;
                        return next;
                      });
                    }
                  }}
                  placeholder="e.g. Website Redesign"
                  autoFocus
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[#3ec170] focus:ring-2 focus:ring-[#3ec170]/20 ${
                    fieldErrors.title ? "border-red-400 bg-red-50/20" : "border-slate-300 bg-slate-50/50"
                  }`}
                />
                {fieldErrors.title && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor={descInputId}
                  className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600"
                >
                  Description
                </label>
                <textarea
                  id={descInputId}
                  rows={3}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (fieldErrors.description) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.description;
                        return next;
                      });
                    }
                  }}
                  placeholder="Optional summary or goals for this project..."
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition resize-none focus:border-[#3ec170] focus:ring-2 focus:ring-[#3ec170]/20 ${
                    fieldErrors.description ? "border-red-400 bg-red-50/20" : "border-slate-300 bg-slate-50/50"
                  }`}
                />
                {fieldErrors.description && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#3ec170] px-5 py-2 text-sm font-semibold text-white hover:bg-[#34ab61] disabled:opacity-60 transition shadow-xs"
                >
                  {loading ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">All Projects</h2>
          <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
            {projects.length} Total
          </span>
        </div>

        {fetching ? (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-56 rounded-2xl bg-white border border-slate-200/90 p-5 animate-pulse space-y-4"
              >
                <div className="h-4 bg-slate-200 rounded-md w-2/3" />
                <div className="h-2 bg-slate-200 rounded-md w-full" />
                <div className="h-10 bg-slate-100 rounded-md w-full" />
                <div className="h-4 bg-slate-200 rounded-md w-1/2" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3ec170]/15 text-[#2b9f58] mb-3">
              <FiFolder className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No projects yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Get started by creating your first project to organize tasks, track progress, and collaborate.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3ec170] px-4 py-2 text-xs font-semibold text-white hover:bg-[#34ab61] transition shadow-xs cursor-pointer"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => {
              const theme = CARD_THEMES[index % CARD_THEMES.length];
              const progress = getProgress(project.tasks);
              const overdueCount = getOverdueCount(project.tasks);
              const isOwner = currentUser?.id ? project.ownerId === currentUser.id : true;
              const avatars = getProjectAvatars(project);
              const latestActivity = activitiesMap[project.id]?.[0];

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={`group relative flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 ${theme.borderHover} overflow-hidden`}
                >
                  {/* Top Color Accent Strip */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${theme.strip}`} />

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    {/* Header: Title, Role Badge, Overdue Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-[#2b9f58] transition line-clamp-1">
                          {project.title}
                        </h3>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Overdue Badge */}
                          {overdueCount > 0 && (
                            <span
                              className="rounded-full bg-rose-50 border border-rose-200/80 px-2 py-0.5 text-[11px] font-semibold text-rose-600 flex items-center gap-1 shrink-0 animate-pulse"
                              title={`${overdueCount} overdue task${overdueCount > 1 ? "s" : ""}`}
                            >
                              <FiAlertCircle className="w-3 h-3" />
                              <span>{overdueCount} overdue</span>
                            </span>
                          )}

                          {/* Role Badge */}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                              isOwner
                                ? theme.roleBadge
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {isOwner ? "Owner" : "Member"}
                          </span>
                        </div>
                      </div>

                      {/* Relative Timestamp */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                        <FiClock className="w-3 h-3 shrink-0" />
                        <span>Created {formatRelativeTime(project.createdAt)}</span>
                      </div>

                      {/* Progress Bar under title */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Task Progress</span>
                          <span className="font-semibold text-slate-700">
                            {progress.percent}% ({progress.completed}/{progress.total})
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${theme.bar}`}
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <p className="mt-3 text-xs text-slate-600 line-clamp-2 min-h-[32px]">
                        {project.description || "No description provided."}
                      </p>
                    </div>

                    {/* Columns Tags & Members Avatars */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between gap-2 border-t border-slate-100/90 pt-3">
                        {/* Member Avatars Overlapping Circles */}
                        <div className="flex items-center">
                          {avatars.length > 0 ? (
                            <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                              {avatars.slice(0, 4).map((member, i) => (
                                <div
                                  key={member.id}
                                  title={member.name || member.email || "Member"}
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white shadow-xs cursor-default ${
                                    AVATAR_COLORS[i % AVATAR_COLORS.length]
                                  }`}
                                >
                                  {getInitials(member.name, member.email)}
                                </div>
                              ))}
                              {avatars.length > 4 && (
                                <div
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 ring-2 ring-white shadow-xs"
                                  title={`${avatars.length - 4} more members`}
                                >
                                  +{avatars.length - 4}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                              <FiUsers className="w-3.5 h-3.5 text-slate-300" />
                              <span className="text-[11px]">1 member</span>
                            </div>
                          )}
                        </div>

                        {/* Column Chips / Task Summary */}
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                            {project.tasks?.length || 0} tasks
                          </span>
                        </div>
                      </div>

                      {/* Last Activity Preview */}
                      <div className="pt-2 border-t border-slate-100/80">
                        {latestActivity ? (
                          <div
                            className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate"
                            title={latestActivity.message}
                          >
                            <FiActivity className="w-3.5 h-3.5 text-[#3ec170] shrink-0" />
                            <span className="truncate">{latestActivity.message}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                            <FiCheckCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            <span>No recent activity</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

