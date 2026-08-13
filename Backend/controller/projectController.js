import prisma from "../db/prisma.js";

const defaultColumns = [
  { id: "todo", name: "Todo" },
  { id: "ongoing", name: "Ongoing" },
  { id: "completed", name: "Completed" },
];

const toColumnId = (value, fallbackIndex = 0) => {
  const raw = String(value ?? `column-${fallbackIndex + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return raw || `column-${fallbackIndex + 1}`;
};

const normalizeColumns = (columns) => {
  if (!Array.isArray(columns) || columns.length === 0) {
    return defaultColumns;
  }

  const safe = columns
    .map((column, index) => {
      if (typeof column === "string") {
        const name = column.trim();
        if (!name) return null;
        return { id: toColumnId(name, index), name };
      }

      const name = String(column?.name ?? "Untitled").trim();
      if (!name) return null;

      return {
        id: toColumnId(column?.id ?? name, index),
        name,
      };
    })
    .filter(Boolean);

  return safe.length ? safe : defaultColumns;
};

const normalizeJsonArray = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  return fallback;
};

const normalizeLabels = (labels) =>
  normalizeJsonArray(labels, [])
    .filter((label) => typeof label === "string" && label.trim())
    .map((label) => label.trim())
    .slice(0, 10);

const normalizeAttachments = (attachments, files = []) => {
  const existingAttachments = normalizeJsonArray(attachments, [])
    .map((attachment) => ({
      name: String(attachment?.name || "attachment"),
      type: String(attachment?.type || "file"),
      size: Number(attachment?.size || 0),
      url: attachment?.url || "",
      dataUrl: attachment?.dataUrl || "",
    }))
    .filter(
      (attachment) => attachment.name && (attachment.dataUrl || attachment.url),
    );

  const uploadedAttachments = Array.isArray(files)
    ? files.map((file) => ({
        name: file.originalname,
        type: file.mimetype || "file",
        size: Number(file.size || 0),
        url: `/uploads/${file.filename}`,
      }))
    : [];

  return [...existingAttachments, ...uploadedAttachments];
};

const normalizeComments = (comments) =>
  normalizeJsonArray(comments, [])
    .map((comment) => ({
      id: comment?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: String(comment?.text || "").trim(),
      author: String(comment?.author || "User").trim() || "User",
      createdAt: comment?.createdAt || new Date().toISOString(),
    }))
    .filter((comment) => comment.text);

export const createProject = async (req, res) => {
  try {
    const { title, description, columns } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Project title is required" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const project = await prisma.project.create({
      data: {
        title: title.trim(),
        description: description?.trim() || "",
        columns: normalizeColumns(columns),
        ownerId: userId,
        members: {
      create: { userId: userId, role: "owner" },
    },
      },
      include: {
        tasks: true,
      },
    });

    return res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({ message: "Failed to create project" });
  }
};

export const getUserProjects = async (req, res) => {
  try {
    const userId = req.user?.id;

    const projects = await prisma.project.findMany({
      where: { ownerId: userId },
      include: { tasks: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ projects });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({ message: "Failed to fetch projects" });
  }
};
export const getInvitedProjects = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const memberships = await prisma.projectMember.findMany({
      where: {
        userId: userId,
      },
      include: {
        project: {
          include: {
            tasks: true,
          },
        },
      },
      orderBy: {
        project: {
          createdAt: "desc",
        },
      },
    });

    const projects = memberships.map((membership) => ({
      ...membership.project,
      role: membership.role,
    }));
    return res.status(200).json({
      projects,
    });
  } catch (error) {
    console.error("Get invited projects error:", error);

    return res.status(500).json({
      message: "Failed to fetch projects",
    });
  }
};
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const project = await prisma.project.findFirst({
      where: {
        id: Number(id),
        ownerId: userId,
      },
      include: {
        tasks: {
          include: { assignee: true },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.status(200).json({ project });
  } catch (error) {
    console.error("Get project error:", error);
    return res.status(500).json({ message: "Failed to fetch project" });
  }
};

export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, columns } = req.body;
    const userId = req.user?.id;

    const project = await prisma.project.findFirst({
      where: { id: Number(id), ownerId: userId },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const updatedProject = await prisma.project.update({
      where: { id: Number(id) },
      data: {
        title: title?.trim() ? title.trim() : project.title,
        description:
          description !== undefined
            ? description?.trim() || ""
            : project.description,
        columns:
          Array.isArray(columns) && columns.length > 0
            ? normalizeColumns(columns)
            : project.columns,
      },
    });

    return res.status(200).json({ project: updatedProject });
  } catch (error) {
    console.error("Update project error:", error);
    return res.status(500).json({ message: "Failed to update project" });
  }
};

export const updateProjectColumns = async (req, res) => {
  try {
    const { id } = req.params;
    const { columns } = req.body;
    const userId = req.user?.id;

    const project = await prisma.project.findFirst({
      where: { id: Number(id), ownerId: userId },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const updatedProject = await prisma.project.update({
      where: { id: Number(id) },
      data: {
        columns:
          Array.isArray(columns) && columns.length > 0
            ? normalizeColumns(columns)
            : defaultColumns,
      },
    });

    return res.status(200).json({ project: updatedProject });
  } catch (error) {
    console.error("Update project columns error:", error);
    return res
      .status(500)
      .json({ message: "Failed to update project columns" });
  }
};

export const createTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      status = "todo",
      priority = "medium",
      assigneeId,
      dueDate,
      labels,
      existingAttachments,
      comments,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Task title is required" });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: Number(id),
        ownerId: req.user?.id,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    let normalizedAssigneeId = null;
    if (assigneeId !== undefined && assigneeId !== null && assigneeId !== "") {
      const parsedAssigneeId = Number(assigneeId);
      if (Number.isNaN(parsedAssigneeId)) {
        return res
          .status(400)
          .json({ message: "Assignee ID must be a number" });
      }
      if (normalizedAssigneeId) {
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: Number(id), userId: normalizedAssigneeId } },
  });
  if (!isMember) {
    return res.status(400).json({ error: "Can only assign tasks to people on this project." });
  }
}

      const assignee = await prisma.user.findUnique({
        where: { id: parsedAssigneeId },
      });

      if (!assignee) {
        return res.status(404).json({ message: "Assignee not found" });
      }

      normalizedAssigneeId = parsedAssigneeId;
    }

    const nextPosition = await prisma.task.count({
      where: {
        projectId: Number(id),
        status,
      },
    });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || "",
        status,
        priority,
        position: nextPosition,
        dueDate: dueDate ? new Date(dueDate) : null,
        labels: normalizeLabels(labels).length
          ? normalizeLabels(labels)
          : [priority],
        attachments: normalizeAttachments(existingAttachments, req.files),
        comments: normalizeComments(comments),
        projectId: Number(id),
        assigneeId: normalizedAssigneeId,
      },
      include: {
        assignee: true,
      },
    });

    return res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    console.error("Create task error:", error);
    return res.status(500).json({ message: "Failed to create task" });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const {
      title,
      description,
      status,
      priority,
      position,
      assigneeId,
      dueDate,
      labels,
      existingAttachments,
      comments,
    } = req.body;

    const project = await prisma.project.findFirst({
      where: {
        id: Number(projectId),
        ownerId: req.user?.id,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const task = await prisma.task.findFirst({
      where: {
        id: Number(taskId),
        projectId: Number(projectId),
      },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    let nextAssigneeId = task.assigneeId;
    if (assigneeId !== undefined) {
      if (assigneeId === null || assigneeId === "") {
        nextAssigneeId = null;
      } else {
        const parsedAssigneeId = Number(assigneeId);
        if (Number.isNaN(parsedAssigneeId)) {
          return res
            .status(400)
            .json({ message: "Assignee ID must be a number" });
        }

        const assignee = await prisma.user.findUnique({
          where: { id: parsedAssigneeId },
        });

        if (!assignee) {
          return res.status(404).json({ message: "Assignee not found" });
        }

        nextAssigneeId = parsedAssigneeId;
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: Number(taskId) },
      data: {
        title: title?.trim() || task.title,
        description:
          description !== undefined ? description.trim() : task.description,
        status: status || task.status,
        priority: priority || task.priority,
        position: position ?? task.position,
        dueDate:
          dueDate !== undefined
            ? dueDate
              ? new Date(dueDate)
              : null
            : task.dueDate,
        labels:
          labels !== undefined ? normalizeLabels(labels) : task.labels || [],
        attachments:
          existingAttachments !== undefined || (req.files || []).length > 0
            ? normalizeAttachments(existingAttachments, req.files)
            : task.attachments || [],
        comments:
          comments !== undefined
            ? normalizeComments(comments)
            : task.comments || [],
        assigneeId: nextAssigneeId,
      },
      include: {
        assignee: true,
      },
    });

    return res.status(200).json({ task: updatedTask });
  } catch (error) {
    console.error("Update task error:", error);
    return res.status(500).json({ message: "Failed to update task" });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const task = await prisma.task.findFirst({
      where: {
        id: Number(taskId),
        projectId: Number(projectId),
      },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    await prisma.task.delete({
      where: { id: Number(taskId) },
    });

    return res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete task error:", error);
    return res.status(500).json({ message: "Failed to delete task" });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const project = await prisma.project.findFirst({
      where: { id: Number(id), ownerId: userId },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    await prisma.project.delete({
      where: { id: Number(id) },
    });

    return res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    return res.status(500).json({ message: "Failed to delete project" });
  }
};

