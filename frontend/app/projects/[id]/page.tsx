"use client";

import api from "@/api";
import { editProjectSchema, taskSchema } from "@/lib/schemas";
import InviteSearch from "@/components/searchbar";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  FiPaperclip,
  FiMessageSquare,
  FiClipboard,
  FiZap,
  FiCheck,
  FiClock,
  FiPieChart,
  FiBarChart2,
  FiTrendingUp,
  FiUsers,
  FiUser,
  FiEdit2,
  FiPlus,
} from "react-icons/fi";

import ProjectChat from "@/components/chat";
import { socket } from "@/lib/socket";

type BoardColumn = {
  id: string;
  name: string;
};

type ActivityItem = {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  user: { id: number; name: string };
};

type Assignee = {
  id: number;
  name: string;
  email?: string;
};

type AttachmentItem = {
  name: string;
  type: string;
  size: number;
  url?: string;
  dataUrl?: string;
};

type TaskItem = {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  position?: number;
  dueDate?: string | null;
  labels?: string[];
  attachments?: AttachmentItem[];
  comments?: CommentItem[];
  assignee?: Assignee[];
  assignees?: Assignee[];
  createdAt?: string | null;
};

type CommentItem = {
  id: string;
  text: string;
  author: string;
  createdAt: string;
};

type ProjectMemberItem = {
  id?: number;
  userId?: number;
  role?: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
};

type ProjectDetail = {
  id: number;
  title: string;
  description?: string;
  columns?: BoardColumn[];
  tasks?: TaskItem[];
  members?: ProjectMemberItem[];
  owner?: {
    id: number;
    name: string;
    email: string;
  };
};

type TaskDraft = {
  title: string;
  description: string;
  priority: string;
  assigneeIds: number[];
  dueDate: string;
  labels: string[];
  existingAttachments: AttachmentItem[];
  newFiles: File[];
  comments: CommentItem[];
};

const defaultColumns: BoardColumn[] = [
  { id: "todo", name: "Todo" },
  { id: "ongoing", name: "Ongoing" },
  { id: "completed", name: "Completed" },
];

const normalizeColumnId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "column";

const priorityStyles: Record<string, string> = {
  low: "border-[#3ec170]/30 bg-[#3ec170]/10 text-[#2b9f58]",
  medium: "border-[#3ec1b1]/30 bg-[#3ec1b1]/10 text-[#1f8e81]",
  high: "border-rose-200 bg-rose-50 text-rose-700",
};

const getAttachmentUrl = (attachment: AttachmentItem) => {
  if (attachment.dataUrl) return attachment.dataUrl;
  if (attachment.url) {
    if (attachment.url.startsWith("http://") || attachment.url.startsWith("https://")) {
      return attachment.url;
    }
    const backendBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");
    return `${backendBase}${attachment.url.startsWith("/") ? "" : "/"}${attachment.url}`;
  }
  return "#";
};

const isImageFile = (attachment: AttachmentItem) => {
  if (attachment.type && attachment.type.includes("image")) return true;
  const name = (attachment.name || "").toLowerCase();
  return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".gif") || name.endsWith(".webp") || name.endsWith(".svg");
};

const getTaskAssignees = (task: TaskItem | null | undefined): Assignee[] => {
  if (!task) return [];
  if (Array.isArray(task.assignees) && task.assignees.length > 0) {
    return task.assignees;
  }
  if (Array.isArray(task.assignee) && task.assignee.length > 0) {
    return task.assignee;
  }
  return [];
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params?.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"kanban" | "list" | "dashboard">("kanban");
  const [currentUser, setCurrentUser] = useState<{ id?: number; name?: string; email?: string } | null>(null);

  const [draggedTask, setDraggedTask] = useState<TaskItem | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<BoardColumn | null>(null);

  // Modals state
  const [viewingTask, setViewingTask] = useState<TaskItem | null>(null);
  const [detailCommentInput, setDetailCommentInput] = useState("");
  const [taskModalColumn, setTaskModalColumn] = useState<BoardColumn | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editingProject, setEditingProject] = useState(false);

  const [projectDraft, setProjectDraft] = useState({ title: "", description: "" });
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({
    title: "",
    description: "",
    priority: "medium",
    assigneeIds: [],
    dueDate: "",
    labels: ["medium"],
    existingAttachments: [],
    newFiles: [],
    comments: [],
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!projectId) return;

    // Load history from the database
    api.get<ActivityItem[]>(`/projects/${projectId}/activity`).then(setActivityLog).catch(() => {});

    // Listen for new activity happening live
    socket.connect();
    socket.emit("join-project", projectId);

    const handleNotification = (activity: ActivityItem) => {
      setActivityLog((prev) => [activity, ...prev]);
    };

    socket.on("notification", handleNotification);

    return () => {
      socket.off("notification", handleNotification);
    };
  }, [projectId]);

  const [taskSaving, setTaskSaving] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [taskFieldErrors, setTaskFieldErrors] = useState<Record<string, string>>({});
  const [projectFieldErrors, setProjectFieldErrors] = useState<Record<string, string>>({});

  // Project members state
  const [projectMembers, setProjectMembers] = useState<ProjectMemberItem[]>([]);

  // Invite members state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadProjectMembers = async () => {
    try {
      const data = await api.get<ProjectMemberItem[]>(`/projects/member/${projectId}/members`);
      if (Array.isArray(data)) {
        setProjectMembers(data);
      }
    } catch (err) {
      console.error("Failed to load project members:", err);
    }
  };

  const loadProject = async () => {
    try {
      const data = await api.get<{ project: ProjectDetail }>(`/projects/${projectId}`);
      setProject(data.project);
      if (data.project?.members && Array.isArray(data.project.members)) {
        setProjectMembers(data.project.members);
      }
    } catch {
      router.push("/projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    loadProject();
    loadProjectMembers();
    api.get<{ user?: { id?: number; name?: string; email?: string } }>("/auth/me")
      .then((d) => setCurrentUser(d.user || null))
      .catch(() => {});
  }, [projectId, router]);

  const memberOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; email: string; role?: string }>();

    // From projectMembers state
    projectMembers.forEach((m) => {
      if (m?.user?.id) {
        map.set(m.user.id, {
          id: m.user.id,
          name: m.user.name || m.user.email || `Member #${m.user.id}`,
          email: m.user.email || "",
          role: m.role || "member",
        });
      }
    });

    // From project.members if present
    if (project?.members) {
      project.members.forEach((m) => {
        if (m?.user?.id && !map.has(m.user.id)) {
          map.set(m.user.id, {
            id: m.user.id,
            name: m.user.name || m.user.email || `Member #${m.user.id}`,
            email: m.user.email || "",
            role: m.role || "member",
          });
        }
      });
    }

    // From project.owner if present
    if (project?.owner?.id && !map.has(project.owner.id)) {
      map.set(project.owner.id, {
        id: project.owner.id,
        name: project.owner.name || project.owner.email || `Owner #${project.owner.id}`,
        email: project.owner.email || "",
        role: "owner",
      });
    }

    // From current task's assignees if editing
    if (editingTask) {
      getTaskAssignees(editingTask).forEach((a) => {
        if (a?.id && !map.has(a.id)) {
          map.set(a.id, {
            id: a.id,
            name: a.name || `User #${a.id}`,
            email: a.email || "",
            role: "assignee",
          });
        }
      });
    }

    return Array.from(map.values());
  }, [projectMembers, project, editingTask]);

  const columns = useMemo(() => {
    const source = project?.columns && project.columns.length ? project.columns : defaultColumns;
    return source.map((column, index) => {
      const value = typeof column === "string" ? column : column?.name ?? `Board ${index + 1}`;
      const id = normalizeColumnId(
        typeof column === "string" ? value : String(column?.id ?? column?.name ?? value),
      );
      return {
        id,
        name: typeof column === "string" ? value : column?.name ?? value,
      };
    });
  }, [project?.columns]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    columns.forEach((col) => map.set(col.id, []));

    (project?.tasks || []).forEach((task) => {
      const targetColumn = normalizeColumnId(task.status);
      const existing = map.get(targetColumn) || [];
      existing.push(task);
      map.set(targetColumn, existing);
    });

    return map;
  }, [columns, project?.tasks]);

  const openNewTaskModal = (column: BoardColumn) => {
    setEditingTask(null);
    setTaskModalColumn(column);
    setTaskDraft({
      title: "",
      description: "",
      priority: "medium",
      assigneeIds: [],
      dueDate: "",
      labels: ["medium"],
      existingAttachments: [],
      newFiles: [],
      comments: [],
    });
    setCommentInput("");
    setTaskFieldErrors({});
  };

  const openEditTaskModal = (task: TaskItem) => {
    const column = columns.find((c) => c.id === task.status) || columns[0] || defaultColumns[0];
    const assignees = getTaskAssignees(task);

    setEditingTask(task);
    setTaskModalColumn(column);
    setTaskDraft({
      title: task.title || "",
      description: task.description || "",
      priority: (task.priority || "medium").toLowerCase(),
      assigneeIds: assignees.map((a) => a.id),
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      labels: Array.isArray(task.labels) && task.labels.length ? task.labels : [task.priority || "medium"],
      existingAttachments: task.attachments || [],
      newFiles: [],
      comments: task.comments || [],
    });
    setCommentInput("");
    setTaskFieldErrors({});
  };

  const toggleAssignee = (userId: number) => {
    setTaskDraft((prev) => {
      const exists = prev.assigneeIds.includes(userId);
      const nextIds = exists
        ? prev.assigneeIds.filter((id) => id !== userId)
        : [...prev.assigneeIds, userId];
      return { ...prev, assigneeIds: nextIds };
    });
  };

  const handleAttachmentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setTaskDraft((prev) => ({
      ...prev,
      newFiles: [...prev.newFiles, ...fileArray],
    }));
    event.target.value = "";
  };

  const removeExistingAttachment = (name: string) => {
    setTaskDraft((prev) => ({
      ...prev,
      existingAttachments: prev.existingAttachments.filter((att) => att.name !== name),
    }));
  };

  const removeNewFile = (index: number) => {
    setTaskDraft((prev) => ({
      ...prev,
      newFiles: prev.newFiles.filter((_, i) => i !== index),
    }));
  };

  const addCommentToTaskDraft = () => {
    if (!commentInput.trim()) return;

    const newComment: CommentItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text: commentInput.trim(),
      author: "You",
      createdAt: new Date().toISOString(),
    };

    setTaskDraft((prev) => ({
      ...prev,
      comments: [...prev.comments, newComment],
    }));
    setCommentInput("");
  };

  const handleAddCommentInDetail = async () => {
    if (!detailCommentInput.trim() || !viewingTask) return;

    const newComment: CommentItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text: detailCommentInput.trim(),
      author: "You",
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...(viewingTask.comments || []), newComment];

    try {
      const response = await api.put<{ task: TaskItem }>(
        `/projects/${projectId}/tasks/${viewingTask.id}`,
        { comments: updatedComments },
      );

      setViewingTask(response.task);
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: (prev.tasks || []).map((t) => (t.id === viewingTask.id ? response.task : t)),
        };
      });
      setDetailCommentInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add comment");
    }
  };

  const buildTaskFormData = (status: string) => {
    const fd = new FormData();
    fd.append("title", taskDraft.title);
    fd.append("description", taskDraft.description || "");
    fd.append("status", status);
    fd.append("priority", taskDraft.priority);

    if (taskDraft.dueDate) {
      fd.append("dueDate", taskDraft.dueDate);
    } else {
      fd.append("dueDate", "");
    }

    if (taskDraft.assigneeIds.length > 0) {
      fd.append("assigneeId", String(taskDraft.assigneeIds[0]));
      taskDraft.assigneeIds.forEach((id) => {
        fd.append("assigneeIds", String(id));
      });
    }

    fd.append("labels", JSON.stringify(taskDraft.labels));
    fd.append("existingAttachments", JSON.stringify(taskDraft.existingAttachments));
    fd.append("comments", JSON.stringify(taskDraft.comments));

    taskDraft.newFiles.forEach((file) => {
      fd.append("attachments", file);
    });

    return fd;
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskModalColumn) return;

    setTaskFieldErrors({});

    const result = taskSchema.safeParse({
      title: taskDraft.title,
      description: taskDraft.description,
      priority: taskDraft.priority,
      dueDate: taskDraft.dueDate,
      assigneeId: taskDraft.assigneeIds.length > 0 ? String(taskDraft.assigneeIds[0]) : "",
      assigneeIds: taskDraft.assigneeIds,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      const flat = result.error.flatten().fieldErrors;
      for (const [key, messages] of Object.entries(flat)) {
        if (messages && messages.length > 0) {
          errors[key] = messages[0];
        }
      }
      setTaskFieldErrors(errors);
      return;
    }

    setTaskSaving(true);

    try {
      const formData = buildTaskFormData(taskModalColumn.id);

      if (editingTask) {
        const response = await api.put<{ task: TaskItem }>(
          `/projects/${projectId}/tasks/${editingTask.id}`,
          formData,
        );

        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: (prev.tasks || []).map((task) =>
              task.id === editingTask.id ? response.task : task,
            ),
          };
        });

        if (viewingTask?.id === editingTask.id) {
          setViewingTask(response.task);
        }
      } else {
        const response = await api.post<{ task: TaskItem }>(
          `/projects/${projectId}/tasks`,
          formData,
        );

        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: [...(prev.tasks || []), response.task],
          };
        });
      }

      setEditingTask(null);
      setTaskModalColumn(null);
      setTaskDraft({
        title: "",
        description: "",
        priority: "medium",
        assigneeIds: [],
        dueDate: "",
        labels: ["medium"],
        existingAttachments: [],
        newFiles: [],
        comments: [],
      });
      setCommentInput("");
      setTaskFieldErrors({});
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save task");
    } finally {
      setTaskSaving(false);
    }
  };

  const handleDropTask = async (targetColumnId: string) => {
    if (!draggedTask) return;

    try {
      await api.put(`/projects/${projectId}/tasks/${draggedTask.id}`, {
        status: targetColumnId,
      });

      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: (prev.tasks || []).map((task) =>
            task.id === draggedTask.id ? { ...task, status: targetColumnId } : task,
          ),
        };
      });

      if (viewingTask?.id === draggedTask.id) {
        setViewingTask((prev) => prev ? { ...prev, status: targetColumnId } : prev);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to move task");
    } finally {
      setDraggedTask(null);
    }
  };

  const handleAddColumn = async () => {
    const nextName = window.prompt("Enter a new board name:", "Review");
    if (!nextName || !nextName.trim()) return;

    const newColumn: BoardColumn = {
      id: normalizeColumnId(nextName),
      name: nextName.trim(),
    };

    const updatedColumns = [...(project?.columns || defaultColumns), newColumn];

    try {
      await api.put(`/projects/${projectId}/columns`, { columns: updatedColumns });
      setProject((prev) => (prev ? { ...prev, columns: updatedColumns } : prev));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add board");
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setProjectFieldErrors({});

    const result = editProjectSchema.safeParse(projectDraft);
    if (!result.success) {
      const errors: Record<string, string> = {};
      const flat = result.error.flatten().fieldErrors;
      for (const [key, messages] of Object.entries(flat)) {
        if (messages && messages.length > 0) {
          errors[key] = messages[0];
        }
      }
      setProjectFieldErrors(errors);
      return;
    }

    try {
      const response = await api.put<{ project: ProjectDetail }>(`/projects/${projectId}`, {
        title: result.data.title,
        description: result.data.description,
      });

      setProject((prev) =>
        prev
          ? {
              ...prev,
              title: response.project.title,
              description: response.project.description,
            }
          : prev,
      );

      setEditingProject(false);
      setProjectFieldErrors({});
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update project");
    }
  };

  const handleColumnDrop = async (targetColumn: BoardColumn) => {
    if (!draggedColumn || draggedColumn.id === targetColumn.id) return;

    const columnList = [...columns];
    const fromIndex = columnList.findIndex((item) => item.id === draggedColumn.id);
    const toIndex = columnList.findIndex((item) => item.id === targetColumn.id);

    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = columnList.splice(fromIndex, 1);
    columnList.splice(toIndex, 0, moved);

    try {
      await api.put(`/projects/${projectId}/columns`, { columns: columnList });
      setProject((prev) => (prev ? { ...prev, columns: columnList } : prev));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to reorder columns");
    } finally {
      setDraggedColumn(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    const confirmed = window.confirm("Are you sure you want to delete this project?");
    if (!confirmed) return;

    try {
      await api.delete(`/projects/${projectId}`);
      router.push("/projects");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete project");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    try {
      await api.delete(`/projects/${projectId}/tasks/${taskId}`);
      setViewingTask(null);
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: (prev.tasks || []).filter((t) => t.id !== taskId),
        };
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete task");
    }
  };

  const handleInvite = async (email: string) => {
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await api.post<{ message?: string; error?: string }>(
        `/projects/member/${projectId}/invite`,
        { email },
      );
      setInviteMsg({ type: "success", text: res.message || `Invitation sent to ${email}` });
      loadProjectMembers();
      loadProject();
    } catch (err) {
      setInviteMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to send invitation" });
    } finally {
      setInviting(false);
    }
  };

  if (loading || !project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafb] text-slate-700">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3ec170] border-t-transparent"></div>
          <span className="text-sm font-medium">Loading project...</span>
        </div>
      </main>
    );
  }

  const selectedPriority = taskDraft.priority.toUpperCase();
  const priorityBadgeClass = priorityStyles[taskDraft.priority] || priorityStyles.medium;

  return (
    <main className="min-h-screen bg-[#f8fafb] p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        {/* Project Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.push("/projects")}
              className="mb-2 text-sm text-slate-500 hover:text-[#3ec170] transition flex items-center gap-1 font-medium"
            >
              ← Back to projects
            </button>
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-bold text-slate-900">{project.title}</h1>
              <button
                type="button"
                title="Edit project"
                onClick={() => {
                  setProjectDraft({
                    title: project.title,
                    description: project.description ?? "",
                  });
                  setEditingProject(true);
                  setProjectFieldErrors({});
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition"
              >
                <FiEdit2 className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {project.description || "No description for this project yet."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDeleteProject}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 transition"
            >
              Delete project
            </button>
            <button
              type="button"
              onClick={() => setActivityOpen(true)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:border-[#3ec1b1] hover:text-[#1f8e81] hover:bg-[#3ec1b1]/5 transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-[#3ec1b1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Activity
            </button>
            <button
              type="button"
              onClick={() => { setInviteOpen(true); setInviteMsg(null); }}
              className="rounded-xl bg-[#3ec1b1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3ec1b1]/85 transition"
            >
              Invite People
            </button>
          </div>
        </div>

        {/* Invite Members Panel */}
        {inviteOpen && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Invite people to this project</h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-700 transition"
              >
                Close ✕
              </button>
            </div>
            <InviteSearch projectId={projectId} onInvite={handleInvite} />
            {inviteMsg && (
              <p className={`text-xs font-medium ${inviteMsg.type === "success" ? "text-[#2b9f58]" : "text-rose-600"
                }`}>
                {inviteMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Top Horizontal Section Bar */}
        <div className="mb-6 flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("kanban")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "kanban"
                ? "bg-[#3ec170] text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2m0 10V7m6 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            Kanban Board
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "list"
                ? "bg-[#3ec170] text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Task List
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "dashboard"
                ? "bg-[#3ec170] text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            Dashboard
          </button>
        </div>

        {/* Tab Content 1: Kanban Board */}
        {activeTab === "kanban" && (
          <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-4">
            {columns.map((column) => (
              <div
                key={column.id}
                draggable
                onDragStart={(event) => {
                  event.stopPropagation();
                  setDraggedColumn(column);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleColumnDrop(column);
                }}
                className="rounded-2xl border border-slate-200/90 bg-slate-100/70 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">{column.name}</h2>
                  <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {(tasksByColumn.get(column.id) || []).length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openNewTaskModal(column)}
                  className="mb-4 w-full rounded-xl bg-white border border-dashed border-[#3ec170]/40 text-[#2b9f58] hover:bg-[#3ec170]/10 hover:border-[#3ec170] px-3 py-2 text-sm font-semibold transition"
                >
                  + Add task
                </button>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropTask(column.id);
                  }}
                  className="space-y-3"
                >
                  {(tasksByColumn.get(column.id) || []).map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.stopPropagation();
                        setDraggedTask(task);
                      }}
                      onClick={() => setViewingTask(task)}
                      className="group relative cursor-pointer rounded-xl border border-slate-200/90 bg-white p-3.5 transition hover:border-[#3ec170]/60 active:cursor-grabbing"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 group-hover:text-[#2b9f58] transition text-sm">{task.title}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityStyles[String(task.priority || "medium").toLowerCase()] || priorityStyles.medium}`}>
                            {task.priority || "medium"}
                          </span>
                          <button
                            type="button"
                            title="Edit Task"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditTaskModal(task);
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {task.dueDate ? (
                        <p className="mb-2 text-[11px] text-slate-500 font-medium">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                      ) : null}


                      {task.description ? (
                        <p className="mb-2 text-xs text-slate-600 line-clamp-2">{task.description}</p>
                      ) : null}

                      <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                        {(task.attachments?.length || 0) > 0 ? (
                          <span className="flex items-center gap-1">
                            <FiPaperclip className="w-3.5 h-3.5" />
                            {task.attachments!.length} attachment(s)
                          </span>
                        ) : (
                          <span>No attachments</span>
                        )}
                        {(task.comments?.length || 0) > 0 ? (
                          <span className="flex items-center gap-1">
                            <FiMessageSquare className="w-3.5 h-3.5" />
                            {task.comments!.length} comment(s)
                          </span>
                        ) : null}
                      </div>

                      {/* Assignees display on card */}
                      {(() => {
                        const assigneesList = getTaskAssignees(task);
                        if (!assigneesList.length) return null;

                        return (
                          <div className="mt-2 flex items-center justify-between gap-1 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                            <span className="text-[10px] text-slate-400 font-medium">Assignees:</span>
                            <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
                              <div className="flex items-center -space-x-1.5 overflow-hidden">
                                {assigneesList.slice(0, 3).map((a, idx) => (
                                  <div
                                    key={`${task.id}-assignee-${a.id || idx}`}
                                    title={a.name}
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3ec170] border border-white text-[9px] font-bold text-white uppercase shrink-0"
                                  >
                                    {a.name ? a.name.slice(0, 2) : "U"}
                                  </div>
                                ))}
                                {assigneesList.length > 3 && (
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 border border-white text-[9px] font-bold text-slate-700 shrink-0">
                                    +{assigneesList.length - 3}
                                  </div>
                                )}
                              </div>
                              <span className="truncate max-w-[100px] text-[10px] text-slate-600 font-medium">
                                {assigneesList.map((a) => a.name).join(", ")}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ))}

                  {(tasksByColumn.get(column.id) || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center text-xs text-slate-400">
                      No tasks here yet
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {/* Add Board Card at the end of latest board */}
            <div
              onClick={handleAddColumn}
              className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100/50 p-6 min-h-[260px] cursor-pointer transition hover:border-[#3ec170] hover:bg-[#3ec170]/5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 group-hover:border-[#3ec170] group-hover:bg-[#3ec170] group-hover:text-white transition">
                <FiPlus className="h-7 w-7" />
              </div>
              <span className="mt-3 text-sm font-bold text-slate-600 group-hover:text-[#2b9f58] transition">
                Add board
              </span>
            </div>
          </div>
        )}

        {/* Tab Content 2: Vertical Task List */}
        {activeTab === "list" && (
          <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Project Tasks</h2>
                <p className="text-xs text-slate-500">Showing all tasks in vertical list format</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs text-slate-700 font-medium">
                  {(project.tasks || []).length} Total Tasks
                </span>
                <button
                  type="button"
                  onClick={() => openNewTaskModal(columns[0] || defaultColumns[0])}
                  className="rounded-xl bg-[#3ec170] px-4 py-2 text-sm font-semibold text-white hover:bg-[#65cd8c] transition"
                >
                  + Add Task
                </button>
              </div>
            </div>

            {(project.tasks || []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
                No tasks in this project yet. Click "+ Add Task" above to create your first task.
              </div>
            ) : (
              <div className="space-y-3">
                {(project.tasks || []).map((task) => {
                  const colName = columns.find((c) => c.id === task.status)?.name || task.status;
                  return (
                    <div
                      key={task.id}
                      onClick={() => setViewingTask(task)}
                      className="group flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer rounded-xl border border-slate-200/90 bg-white p-4 transition hover:border-[#3ec170]/60"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 uppercase">
                            {colName}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${priorityStyles[String(task.priority || "medium").toLowerCase()] || priorityStyles.medium}`}>
                            {task.priority || "medium"}
                          </span>
                          {(() => {
                            const assigneesList = getTaskAssignees(task);
                            if (!assigneesList.length) return null;
                            return (
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                <span>Assignees:</span>
                                <div className="flex flex-wrap gap-1">
                                  {assigneesList.map((a) => (
                                    <span
                                      key={`${task.id}-list-assignee-${a.id}`}
                                      className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600"
                                    >
                                      {a.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#2b9f58] transition">
                          {task.title}
                        </h3>

                        {task.description ? (
                          <p className="text-xs text-slate-500 line-clamp-1">{task.description}</p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          {task.dueDate ? (
                            <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                          ) : null}
                          {(task.attachments?.length || 0) > 0 ? (
                            <span className="flex items-center gap-1">
                              <FiPaperclip className="w-3.5 h-3.5" />
                              {task.attachments!.length}
                            </span>
                          ) : null}
                          {(task.comments?.length || 0) > 0 ? (
                            <span className="flex items-center gap-1">
                              <FiMessageSquare className="w-3.5 h-3.5" />
                              {task.comments!.length}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title="Edit Task"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditTaskModal(task);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingTask(task);
                            }}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[#3ec170]/10 hover:text-[#2b9f58] transition"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content 3: Dashboard Overview with 4 Metric Cards & 4 Recharts Analytics */}
        {activeTab === "dashboard" && (() => {
          const projectTasksList = project?.tasks || [];
          const totalProjectTasks = projectTasksList.length;

          const completedProjectTasks = projectTasksList.filter((t) => {
            const s = String(t.status || "").toLowerCase();
            return s === "completed" || s === "done";
          }).length;

          const ongoingProjectTasks = projectTasksList.filter((t) => {
            const s = String(t.status || "").toLowerCase();
            return s === "ongoing" || s === "doing" || s === "in-progress" || s === "in progress";
          }).length;

          const incompleteProjectTasks = Math.max(0, totalProjectTasks - (completedProjectTasks + ongoingProjectTasks));

          // 1. Pie Chart Data (Status Breakdown)
          const pieData = [
            {
              name: "Completed",
              value: completedProjectTasks,
              color: "#3ec170",
              percent: totalProjectTasks ? Math.round((completedProjectTasks / totalProjectTasks) * 100) : 0,
            },
            {
              name: "Ongoing",
              value: ongoingProjectTasks,
              color: "#3ec1b1",
              percent: totalProjectTasks ? Math.round((ongoingProjectTasks / totalProjectTasks) * 100) : 0,
            },
            {
              name: "Incomplete",
              value: incompleteProjectTasks,
              color: "#94a3b8",
              percent: totalProjectTasks ? Math.round((incompleteProjectTasks / totalProjectTasks) * 100) : 0,
            },
          ];

          // 2. Line Chart Data (Tasks Added by Day in Week)
          const weeklyDays: { key: string; label: string; count: number }[] = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString("en-US", { weekday: "short" });
            weeklyDays.push({ key: dateStr, label, count: 0 });
          }

          projectTasksList.forEach((t) => {
            if (t.createdAt) {
              const taskDateStr = new Date(t.createdAt).toISOString().slice(0, 10);
              const found = weeklyDays.find((day) => day.key === taskDateStr);
              if (found) {
                found.count += 1;
              }
            }
          });

          // 3. Horizontal Bar Chart Data (Tasks per Assignee)
          const assigneeMap = new Map<string, number>();
          projectTasksList.forEach((t) => {
            const list = getTaskAssignees(t);
            if (list.length === 0) {
              assigneeMap.set("Unassigned", (assigneeMap.get("Unassigned") || 0) + 1);
            } else {
              list.forEach((u) => {
                const name = u.name || `User #${u.id}`;
                assigneeMap.set(name, (assigneeMap.get(name) || 0) + 1);
              });
            }
          });

          const assigneeData = Array.from(assigneeMap.entries())
            .map(([name, count]) => ({
              name: name.length > 10 ? `${name.slice(0, 9)}…` : name,
              fullName: name,
              count,
            }))
            .sort((a, b) => b.count - a.count);

          // 4. Member Task Completion Comparison (Completed vs Pending per Member)
          const memberCompletionMap = new Map<string, { id: number; name: string; completed: number; pending: number; total: number }>();

          memberOptions.forEach((m) => {
            memberCompletionMap.set(String(m.id), {
              id: m.id,
              name: m.name,
              completed: 0,
              pending: 0,
              total: 0,
            });
          });

          projectTasksList.forEach((t) => {
            const isDone = String(t.status || "").toLowerCase() === "completed" || String(t.status || "").toLowerCase() === "done";
            const assignees = getTaskAssignees(t);

            if (assignees.length === 0) {
              const unassignedKey = "unassigned";
              if (!memberCompletionMap.has(unassignedKey)) {
                memberCompletionMap.set(unassignedKey, { id: -1, name: "Unassigned", completed: 0, pending: 0, total: 0 });
              }
              const item = memberCompletionMap.get(unassignedKey)!;
              item.total += 1;
              if (isDone) item.completed += 1;
              else item.pending += 1;
            } else {
              assignees.forEach((a) => {
                const key = String(a.id);
                if (!memberCompletionMap.has(key)) {
                  memberCompletionMap.set(key, { id: a.id, name: a.name || `User #${a.id}`, completed: 0, pending: 0, total: 0 });
                }
                const item = memberCompletionMap.get(key)!;
                item.total += 1;
                if (isDone) item.completed += 1;
                else item.pending += 1;
              });
            }
          });

          const memberCompletionData = Array.from(memberCompletionMap.values())
            .filter((m) => m.total > 0 || memberOptions.some((opt) => opt.id === m.id))
            .map((m) => ({
              name: m.name.length > 10 ? `${m.name.slice(0, 9)}…` : m.name,
              fullName: m.name,
              completed: m.completed,
              pending: m.pending,
              total: m.total,
              rate: m.total ? Math.round((m.completed / m.total) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total);

          return (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6">
                <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Project Dashboard Overview</h2>
                    <p className="text-xs text-slate-500">Key task metrics and visual analytics for {project.title}</p>
                  </div>
                </div>

                {/* 4 Top Metric Cards Grid */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  {/* Card 1: Total Tasks */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Total Tasks</span>
                      <FiClipboard className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{totalProjectTasks}</p>
                    <p className="text-[10px] text-slate-500">All tasks in project</p>
                  </div>

                  {/* Card 2: Ongoing Tasks */}
                  <div className="rounded-xl border border-[#3ec1b1]/30 bg-[#3ec1b1]/10 p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[#1f8e81]">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Ongoing Tasks</span>
                      <FiZap className="w-4 h-4 text-[#3ec1b1]" />
                    </div>
                    <p className="text-2xl font-bold text-[#1f8e81]">{ongoingProjectTasks}</p>
                    <p className="text-[10px] text-[#1f8e81]/80">In progress / doing</p>
                  </div>

                  {/* Card 3: Completed Tasks */}
                  <div className="rounded-xl border border-[#3ec170]/30 bg-[#3ec170]/10 p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[#2b9f58]">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Completed Tasks</span>
                      <FiCheck className="w-4 h-4 text-[#3ec170]" />
                    </div>
                    <p className="text-2xl font-bold text-[#2b9f58]">{completedProjectTasks}</p>
                    <p className="text-[10px] text-[#2b9f58]/80">Finished tasks</p>
                  </div>

                  {/* Card 4: Incomplete Tasks */}
                  <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Incomplete Tasks</span>
                      <FiClock className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-bold text-slate-700">{incompleteProjectTasks}</p>
                    <p className="text-[10px] text-slate-500">Pending completion</p>
                  </div>
                </div>

                {/* 2x2 Analytics Charts Grid */}
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

                  {/* Chart 1: Status Pie Chart (Top Left) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
                    <div className="mb-2">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FiPieChart className="w-4 h-4 text-[#3ec170]" />
                        <span>Task Status Breakdown</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">% of completed, ongoing & incomplete tasks</p>
                    </div>

                    <div className="h-[230px] w-full min-w-0 flex items-center justify-center">
                      {totalProjectTasks > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={78}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900">
                                      <p className="font-semibold" style={{ color: d.color }}>{d.name}</p>
                                      <p className="text-slate-600">{d.value} task(s) ({d.percent}%)</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center text-xs text-slate-400">
                          <FiBarChart2 className="w-8 h-8 text-slate-300 mb-1" />
                          No tasks recorded yet
                        </div>
                      )}
                    </div>

                    {/* Pie Legend Badges */}
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100 text-[11px]">
                      {pieData.map((item) => (
                        <div key={item.name} className="flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200/80 px-2.5 py-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600">{item.name}:</span>
                          <span className="font-bold text-slate-900">{item.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chart 2: Tasks Added in Week Line Chart (Top Right) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
                    <div className="mb-2">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FiTrendingUp className="w-4 h-4 text-[#3ec170]" />
                        <span>Tasks Added in Week</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">Daily tasks created across the past 7 days</p>
                    </div>

                    <div className="h-[230px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyDays} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
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
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900">
                                    <p className="font-semibold text-[#2b9f58]">{label}</p>
                                    <p className="text-slate-600">{payload[0].value} task(s) added</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#3ec170"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: "#fff", stroke: "#3ec170", strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: "#65cd8c" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-2 text-center pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      Velocity & activity tracking over the last 7 days
                    </div>
                  </div>

                  {/* Chart 3: Workload by Assignee Horizontal Bar Chart (Bottom Left) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
                    <div className="mb-2">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FiUsers className="w-4 h-4 text-[#3ec1b1]" />
                        <span>Workload by Assignee</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">Total assigned task volume per team member</p>
                    </div>

                    <div className="h-[230px] w-full min-w-0">
                      {assigneeData.length > 0 && totalProjectTasks > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={assigneeData}
                            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis
                              type="number"
                              stroke="#94a3b8"
                              fontSize={11}
                              tickLine={false}
                              axisLine={{ stroke: "#e2e8f0" }}
                              allowDecimals={false}
                            />
                            <YAxis
                              dataKey="name"
                              type="category"
                              stroke="#94a3b8"
                              fontSize={11}
                              tickLine={false}
                              axisLine={{ stroke: "#e2e8f0" }}
                              width={80}
                            />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900">
                                      <p className="font-semibold text-[#1f8e81]">{d.fullName}</p>
                                      <p className="text-slate-600">{d.count} task(s) assigned</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="count" fill="#3ec1b1" barSize={10} radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-400">
                          <FiUser className="w-8 h-8 text-slate-300 mb-1" />
                          No assigned tasks yet
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-center pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      {assigneeData.length} team member / group(s) assigned
                    </div>
                  </div>

                  {/* Chart 4: Member Completion Comparison Bar Chart (Bottom Right) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <FiBarChart2 className="w-4 h-4 text-[#3ec170]" />
                          <span>Member Task Completion Comparison</span>
                        </h3>
                        <p className="text-[11px] text-slate-500">Completed vs pending tasks for each team member</p>
                      </div>

                      {/* Mini Legend */}
                      <div className="hidden sm:flex items-center gap-3 text-[10px]">
                        <span className="flex items-center gap-1 text-[#2b9f58] font-semibold">
                          <span className="h-2 w-2 rounded-xs bg-[#3ec170]" /> Completed
                        </span>
                        <span className="flex items-center gap-1 text-[#1f8e81] font-semibold">
                          <span className="h-2 w-2 rounded-xs bg-[#3ec1b1]" /> Pending
                        </span>
                      </div>
                    </div>

                    <div className="h-[230px] w-full min-w-0">
                      {memberCompletionData.length > 0 && totalProjectTasks > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={memberCompletionData}
                            margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="name"
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
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 space-y-1">
                                      <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{d.fullName}</p>
                                      <div className="space-y-0.5 text-[11px]">
                                        <p className="text-[#2b9f58] flex items-center justify-between gap-3">
                                          <span>Completed:</span>
                                          <span className="font-bold">{d.completed}</span>
                                        </p>
                                        <p className="text-[#1f8e81] flex items-center justify-between gap-3">
                                          <span>Pending:</span>
                                          <span className="font-bold">{d.pending}</span>
                                        </p>
                                        <p className="text-slate-600 flex items-center justify-between gap-3 pt-1 border-t border-slate-100 font-semibold">
                                          <span>Completion Rate:</span>
                                          <span className="text-slate-900 font-bold">{d.rate}%</span>
                                        </p>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="completed" name="Completed" fill="#3ec170" barSize={12} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="pending" name="Pending" fill="#3ec1b1" barSize={12} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-400">
                          <FiBarChart2 className="w-8 h-8 text-slate-300 mb-1" />
                          No member completion data yet
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      {memberCompletionData.slice(0, 4).map((m) => (
                        <span key={m.fullName} className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px]">
                          {m.name}: <span className="font-bold text-slate-900">{m.rate}% done</span>
                        </span>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Task Details Modal */}
      {viewingTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 space-y-6 border border-slate-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600 uppercase">
                    {columns.find((c) => c.id === viewingTask.status)?.name || viewingTask.status}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${priorityStyles[String(viewingTask.priority || "medium").toLowerCase()] || priorityStyles.medium}`}>
                    {viewingTask.priority || "medium"} priority
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{viewingTask.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const taskToEdit = viewingTask;
                    setViewingTask(null);
                    openEditTaskModal(taskToEdit);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-[#3ec170]/10 border border-[#3ec170]/30 px-3 py-1.5 text-xs font-semibold text-[#2b9f58] hover:bg-[#3ec170]/20 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTask(viewingTask.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTask(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-600 border border-slate-100">
              <div>
                <span className="font-semibold text-slate-400 block mb-0.5">DUE DATE</span>
                {viewingTask.dueDate ? (
                  <span className="font-medium text-slate-800">{new Date(viewingTask.dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                ) : (
                  <span className="text-slate-400 italic">No due date set</span>
                )}
              </div>
              <div>
                <span className="font-semibold text-slate-400 block mb-1">ASSIGNEES</span>
                {(() => {
                  const list = getTaskAssignees(viewingTask);
                  if (!list.length) {
                    return <span className="text-slate-400 italic">Unassigned</span>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((a) => (
                        <span
                          key={`view-assignee-${a.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#3ec170]/10 border border-[#3ec170]/20 px-2.5 py-0.5 text-xs font-medium text-[#2b9f58]"
                        >
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3ec170] text-[8px] font-bold text-white uppercase">
                            {a.name ? a.name.slice(0, 2) : "U"}
                          </span>
                          {a.name}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Description</h4>
              {viewingTask.description ? (
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                  {viewingTask.description}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">No description provided.</p>
              )}
            </div>

            {/* Attachments Section with File Links */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Attachments ({(viewingTask.attachments || []).length})
              </h4>
              {(viewingTask.attachments || []).length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {viewingTask.attachments!.map((att, idx) => {
                    const fileUrl = getAttachmentUrl(att);
                    const isImg = isImageFile(att);

                    return (
                      <div
                        key={`${att.name}-${idx}`}
                        className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 transition"
                      >
                        {isImg && (
                          <div className="relative h-28 w-full overflow-hidden rounded-lg bg-slate-200">
                            <img
                              src={fileUrl}
                              alt={att.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate" title={att.name}>
                              {att.name}
                            </p>
                            {att.size ? (
                              <p className="text-[10px] text-slate-400">
                                {(att.size / 1024).toFixed(1)} KB
                              </p>
                            ) : null}
                          </div>
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-slate-700 transition"
                          >
                            <span>Open</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No attachments for this task.</p>
              )}
            </div>

            {/* Comments Section */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Comments ({(viewingTask.comments || []).length})
              </h4>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {(viewingTask.comments || []).length > 0 ? (
                  viewingTask.comments!.map((comment) => (
                    <div key={comment.id} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1 border border-slate-100">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-semibold text-slate-800">{comment.author}</span>
                        <span>{new Date(comment.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-600">{comment.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No comments yet.</p>
                )}
              </div>

              {/* Add comment in detail modal */}
              <div className="flex gap-2 pt-2">
                <input
                  value={detailCommentInput}
                  onChange={(e) => setDetailCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddCommentInDetail();
                    }
                  }}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs outline-none transition focus:border-[#3ec170]"
                />
                <button
                  type="button"
                  onClick={handleAddCommentInDetail}
                  disabled={!detailCommentInput.trim()}
                  className="rounded-xl bg-[#3ec170] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-[#65cd8c] transition"
                >
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Task Create/Edit Form Modal */}
      {taskModalColumn ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white text-slate-900 overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3ec170]/15 text-sm font-bold text-[#2b9f58]">
                  {editingTask ? <FiEdit2 className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {editingTask ? "Edit Task" : "Create New Task"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Column: <span className="font-semibold text-[#2b9f58]">{taskModalColumn.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTaskModalColumn(null);
                  setEditingTask(null);
                  setTaskFieldErrors({});
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateTask} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

                  {/* Left Column: Core Task Details (7 cols) */}
                  <div className="space-y-4 lg:col-span-7">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Task Details
                      </span>
                    </div>

                    {/* Task Title */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={taskDraft.title}
                        onChange={(e) => {
                          setTaskDraft((prev) => ({ ...prev, title: e.target.value }));
                          if (taskFieldErrors.title) {
                            setTaskFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.title;
                              return next;
                            });
                          }
                        }}
                        placeholder="What needs to be done?"
                        className={`w-full rounded-xl border bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#3ec170] focus:bg-white focus:ring-1 focus:ring-[#3ec170] ${taskFieldErrors.title ? "border-red-400 bg-red-50/30" : "border-slate-300"
                          }`}
                      />
                      {taskFieldErrors.title && (
                        <p className="mt-1 text-xs font-medium text-red-600">{taskFieldErrors.title}</p>
                      )}
                    </div>

                    {/* Task Description */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Description
                      </label>
                      <textarea
                        value={taskDraft.description}
                        onChange={(e) => {
                          setTaskDraft((prev) => ({ ...prev, description: e.target.value }));
                          if (taskFieldErrors.description) {
                            setTaskFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.description;
                              return next;
                            });
                          }
                        }}
                        rows={4}
                        placeholder="Provide background context, requirements, acceptance criteria..."
                        className={`w-full rounded-xl border bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#3ec170] focus:bg-white focus:ring-1 focus:ring-[#3ec170] resize-y ${taskFieldErrors.description ? "border-red-400 bg-red-50/30" : "border-slate-300"
                          }`}
                      />
                      {taskFieldErrors.description && (
                        <p className="mt-1 text-xs font-medium text-red-600">{taskFieldErrors.description}</p>
                      )}
                    </div>

                    {/* Attachments Section */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Attachments
                        </label>
                        <span className="text-[11px] text-slate-400">
                          {taskDraft.existingAttachments.length + taskDraft.newFiles.length} file(s)
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          id="task-file-input"
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                          onChange={handleAttachmentUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="task-file-input"
                          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-xs font-medium text-slate-600 hover:border-[#3ec170] hover:bg-[#3ec170]/10 hover:text-[#2b9f58] cursor-pointer transition"
                        >
                          <svg className="h-4 w-4 text-[#3ec170]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Click to browse or attach files</span>
                        </label>
                      </div>

                      {/* File Chips */}
                      {(taskDraft.existingAttachments.length > 0 || taskDraft.newFiles.length > 0) && (
                        <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto">
                          {taskDraft.existingAttachments.map((attachment) => (
                            <div
                              key={`existing-${attachment.name}-${attachment.size}`}
                              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                            >
                              <span className="font-medium truncate max-w-[140px]">{attachment.name}</span>
                              <button
                                type="button"
                                onClick={() => removeExistingAttachment(attachment.name)}
                                className="text-slate-400 hover:text-red-500 transition font-bold"
                                title="Remove attachment"
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          {taskDraft.newFiles.map((file, index) => (
                            <div
                              key={`new-${file.name}-${index}`}
                              className="flex items-center gap-2 rounded-lg border border-[#3ec170]/30 bg-[#3ec170]/10 px-2.5 py-1 text-xs text-[#2b9f58]"
                            >
                              <span className="font-medium truncate max-w-[140px]">{file.name}</span>
                              <span className="text-[10px] text-[#2b9f58]/70">
                                ({(file.size / 1024).toFixed(0)}KB)
                              </span>
                              <button
                                type="button"
                                onClick={() => removeNewFile(index)}
                                className="text-[#2b9f58] hover:text-red-500 transition font-bold"
                                title="Remove file"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Properties & Assignment (5 cols) */}
                  <div className="space-y-4 lg:col-span-5 lg:border-l lg:border-slate-100 lg:pl-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Assignment & Status
                      </span>
                    </div>

                    {/* Multi-Member Assignee Selector */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Assignees ({taskDraft.assigneeIds.length} selected)
                        </label>
                        {taskDraft.assigneeIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setTaskDraft((prev) => ({ ...prev, assigneeIds: [] }))}
                            className="text-[11px] font-medium text-rose-500 hover:text-rose-700 transition"
                          >
                            Clear all
                          </button>
                        )}
                      </div>

                      {/* Selected Assignee Chips */}
                      {taskDraft.assigneeIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto rounded-xl border border-[#3ec170]/20 bg-[#3ec170]/5 p-2">
                          {taskDraft.assigneeIds.map((id) => {
                            const u = memberOptions.find((m) => m.id === id);
                            const name = u?.name || `User #${id}`;
                            return (
                              <span
                                key={`selected-assignee-${id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#3ec170]/30 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                              >
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3ec170] text-[8px] font-bold text-white uppercase">
                                  {name.slice(0, 2)}
                                </span>
                                <span className="truncate max-w-[120px]">{name}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleAssignee(id)}
                                  className="text-slate-400 hover:text-red-500 font-bold ml-0.5 text-sm leading-none"
                                  title="Unassign"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      ) : null}

                      {/* Member Selection List */}
                      {memberOptions.length > 0 ? (
                        <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-slate-200 bg-slate-50/60 p-1.5">
                          {memberOptions.map((member) => {
                            const isSelected = taskDraft.assigneeIds.includes(member.id);
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => toggleAssignee(member.id)}
                                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${isSelected
                                    ? "bg-[#3ec170] text-white font-semibold"
                                    : "hover:bg-slate-200/70 text-slate-700 font-medium"
                                  }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold uppercase ${isSelected ? "bg-white text-[#2b9f58]" : "bg-[#3ec170]/20 text-[#2b9f58]"
                                      }`}
                                  >
                                    {member.name.slice(0, 2)}
                                  </div>
                                  <span className="truncate">{member.name}</span>
                                  {member.email && (
                                    <span className={`text-[10px] truncate ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                                      ({member.email})
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs ml-2 font-bold">{isSelected ? "✓" : "+"}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          No project members found yet. Use "Invite People" to add teammates.
                        </p>
                      )}
                    </div>

                    {/* Priority & Due Date side by side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Priority
                        </label>
                        <select
                          value={taskDraft.priority}
                          onChange={(e) =>
                            setTaskDraft((prev) => ({
                              ...prev,
                              priority: e.target.value,
                              labels: [e.target.value],
                            }))
                          }
                          className={`w-full rounded-xl border bg-slate-50/50 px-3 py-2 text-sm font-medium outline-none transition focus:border-[#3ec170] focus:bg-white focus:ring-1 focus:ring-[#3ec170] ${taskFieldErrors.priority ? "border-red-400" : "border-slate-300"
                            }`}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityBadgeClass}`}>
                            {selectedPriority}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Due Date
                        </label>
                        <input
                          type="date"
                          value={taskDraft.dueDate}
                          onChange={(e) => setTaskDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
                          className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-medium outline-none transition focus:border-[#3ec170] focus:bg-white focus:ring-1 focus:ring-[#3ec170]"
                        />
                      </div>
                    </div>

                    {/* Comments Section */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Comments ({taskDraft.comments.length})
                        </label>
                      </div>

                      {taskDraft.comments.length > 0 ? (
                        <div className="max-h-28 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                          {taskDraft.comments.map((comment) => (
                            <div key={comment.id} className="rounded-lg bg-white p-2 text-xs text-slate-700 border border-slate-200/80">
                              <div className="mb-0.5 flex items-center justify-between text-[10px] text-slate-400">
                                <span className="font-bold text-slate-700">{comment.author}</span>
                                <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-slate-600">{comment.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex gap-2">
                        <input
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              addCommentToTaskDraft();
                            }
                          }}
                          placeholder="Add a comment..."
                          className="flex-1 rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-1.5 text-xs outline-none transition focus:border-[#3ec170] focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={addCommentToTaskDraft}
                          disabled={!commentInput.trim()}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4 shrink-0">
                <div className="text-xs text-slate-400">
                  {editingTask ? `Editing Task #${editingTask.id}` : `New Task for ${taskModalColumn.name}`}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTaskModalColumn(null);
                      setEditingTask(null);
                      setTaskFieldErrors({});
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={taskSaving}
                    className="rounded-xl bg-[#3ec170] px-5 py-2 text-sm font-semibold text-white hover:bg-[#65cd8c] disabled:opacity-60 transition"
                  >
                    {taskSaving ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Project Modal */}
      {editingProject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-slate-900 border border-slate-200">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Edit Project</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingProject(false);
                  setProjectFieldErrors({});
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Project title</label>
                <input
                  value={projectDraft.title}
                  onChange={(e) => {
                    setProjectDraft((prev) => ({ ...prev, title: e.target.value }));
                    if (projectFieldErrors.title) {
                      setProjectFieldErrors((prev) => { const next = { ...prev }; delete next.title; return next; });
                    }
                  }}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[#3ec170] focus:ring-1 focus:ring-[#3ec170] ${projectFieldErrors.title ? "border-red-400" : "border-slate-300 bg-slate-50/50"}`}
                />
                {projectFieldErrors.title && (
                  <p className="mt-1 text-xs text-red-600">{projectFieldErrors.title}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Description</label>
                <textarea
                  value={projectDraft.description}
                  onChange={(e) => {
                    setProjectDraft((prev) => ({ ...prev, description: e.target.value }));
                    if (projectFieldErrors.description) {
                      setProjectFieldErrors((prev) => { const next = { ...prev }; delete next.description; return next; });
                    }
                  }}
                  rows={3}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[#3ec170] focus:ring-1 focus:ring-[#3ec170] ${projectFieldErrors.description ? "border-red-400" : "border-slate-300 bg-slate-50/50"}`}
                />
                {projectFieldErrors.description && (
                  <p className="mt-1 text-xs text-red-600">{projectFieldErrors.description}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(false);
                    setProjectFieldErrors({});
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#3ec170] px-5 py-2 text-sm font-semibold text-white hover:bg-[#65cd8c] transition"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Chat Side Panel (slides in from right) ── */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col border-l border-slate-200 bg-white transition-transform duration-300"
        style={{
          width: 360,
          transform: chatOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[#3ec170]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-bold text-slate-900">Project Chat</span>
          </div>
          <button onClick={() => setChatOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {/* chat body */}
        <div className="flex-1 overflow-hidden">
          {chatOpen && currentUser?.id ? (
            <ProjectChat
              projectId={projectId}
              currentUserId={currentUser.id}
              currentUserName={currentUser.name || currentUser.email || "User"}
            />
          ) : chatOpen ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading user…</div>
          ) : null}
        </div>
      </div>

      {/* ── Activity Side Panel (slides in from left) ── */}
      <div
        className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-transform duration-300"
        style={{
          width: 360,
          transform: activityOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-[#3ec1b1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span className="text-sm font-bold text-slate-900">Activity</span>
          </div>
          <button onClick={() => setActivityOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {/* activity list */}
        <div className="flex-1 overflow-y-auto bg-white">
          {activityLog.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400 p-6 text-center">
              <svg className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm font-medium text-slate-600">No activity yet</span>
              <span className="text-xs text-slate-400">Actions like moving or adding tasks will appear here live</span>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 px-4">
              {activityLog.map((item) => (
                <li key={item.id} className="py-3">
                  <p className="text-sm text-slate-800 font-medium">{item.message}</p>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Overlay when either panel is open */}
      {(chatOpen || activityOpen) && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs transition-opacity"
          onClick={() => { setChatOpen(false); setActivityOpen(false); }}
        />
      )}

      {/* Floating Chat Button */}
      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          title="Open Project Chat"
          className="fixed bottom-6 right-6 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-[#3ec170] text-white border border-white/20 transition hover:bg-[#65cd8c] hover:scale-105 active:scale-95"
          aria-label="Open Chat"
        >
          <FiMessageSquare className="h-6 w-6" />
        </button>
      )}
    </main>
  );
}
