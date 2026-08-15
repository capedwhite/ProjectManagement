import prisma from "../db/prisma.js";
import { io } from "../index.js";
const defaultColumns = [
  { id: "todo", name: "Todo" },
  { id: "ongoing", name: "Ongoing" },
  { id: "completed", name: "Completed" },
];
function formatStatus(status) {
  const labels = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  };
  return labels[status] || status;
}
const toColumnId = (value, fallbackIndex = 0) => {
  const raw = String(value ?? `column-${fallbackIndex + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return raw || `column-${fallbackIndex + 1}`;
};

async function logTaskMove({ task, newStatus, userId, projectId }) {
  if (!newStatus || newStatus === task.status) return; // no real status change, skip

  const mover = await prisma.user.findUnique({ where: { id: userId } });

  const activity = await prisma.activity.create({
    data: {
      type: "task_moved",
      message: `${mover.name} moved "${task.title}" from ${formatStatus(task.status)} to ${formatStatus(newStatus)}`,
      projectId,
      userId,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  io.to(`project-${projectId}`).emit("notification", activity);
}
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

const normalizeAssigneeIds = (value) => {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id > 0);
      }
    } catch {
      // ignore
    }
    if (value.includes(",")) {
      return value.split(",").map((s) => Number(s.trim())).filter((id) => !Number.isNaN(id) && id > 0);
    }
    const num = Number(value.trim());
    return !Number.isNaN(num) && num > 0 ? [num] : [];
  }
  if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
    return [value];
  }
  return [];
};

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
      where: {
        OR: [
          {
            ownerId: userId,
          },

          {
            members: {
              some: {
                userId: userId,
              },
            },
          },
        ],
      },

include: {
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
    return res.status(200).json({ projects });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({ message: "Failed to fetch projects" });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

     const project = await prisma.project.findFirst({
      where: {
        id: Number(id),

        OR: [
          // User owns the project
          {
            ownerId: userId,
          },

          // User is a member of the project
          {
            members: {
              some: {
                userId: userId,
              },
            },
          },
        ],
      },

      include: {
        tasks: {
          include: {
            assignee: true,
          },
          orderBy: {
            position: "asc",
          },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        owner: {
          select: { id: true, name: true, email: true },
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
      dueDate,
      labels,
      existingAttachments,
      comments,
      assigneeIds,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "Task title is required",
      });
    }

    const projectId = Number(id);

    // Only project owner can create/edit tasks
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: req.user?.id,
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    // -----------------------------------------
    // ASSIGNEES
    // -----------------------------------------

    let requestedIds = normalizeAssigneeIds(assigneeIds);

    // Remove duplicates
    requestedIds = Array.from(new Set(requestedIds));

    let validatedAssigneeIds = [];

    if (requestedIds.length > 0) {
      // Find users who are actually members of this project
      const members = await prisma.projectMember.findMany({
        where: {
          projectId,
          userId: {
            in: requestedIds,
          },
        },
        select: {
          userId: true,
        },
      });

      validatedAssigneeIds = members.map(
        (member) => member.userId
      );

      // Make sure every requested user is actually a member
      if (validatedAssigneeIds.length !== requestedIds.length) {
        return res.status(400).json({
          message: "One or more assignees are not members of this project",
        });
      }
    }

    // -----------------------------------------
    // POSITION
    // -----------------------------------------

    const nextPosition = await prisma.task.count({
      where: {
        projectId,
        status,
      },
    });

    // -----------------------------------------
    // CREATE TASK
    // -----------------------------------------

    const task = await prisma.task.create({
      data: {
        title: title.trim(),

        description:
          description?.trim() || "",

        status,

        priority,

        position: nextPosition,

        dueDate: dueDate
          ? new Date(dueDate)
          : null,

        labels:
          normalizeLabels(labels).length
            ? normalizeLabels(labels)
            : [priority],

        attachments:
          normalizeAttachments(
            existingAttachments,
            req.files
          ),

        comments:
          normalizeComments(comments),

        projectId,

        // Multiple users
        assignee: {
          connect: validatedAssigneeIds.map((userId) => ({
            id: userId,
          })),
        },
      },

      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
const creator = await prisma.user.findUnique({ where: { id: req.user?.id } });

const activity = await prisma.activity.create({
  data: {
    type: "task_created",
    message: `${creator.name} created "${task.title}"`,
    projectId: task.projectId,
    userId: req.user?.id,
  },
  include: { user: { select: { id: true, name: true } } },
});

io.to(`project-${task.projectId}`).emit("notification", activity);
    return res.status(201).json({
      message: "Task created successfully",
      task,
    });

  } catch (error) {
    console.error("Create task error:", error);

    return res.status(500).json({
      message: "Failed to create task",
    });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user?.id;

    const {
      title,
      description,
      status,
      priority,
      position,
      assigneeIds,
      dueDate,
      labels,
      existingAttachments,
      comments,
    } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const projectIdNumber = Number(projectId);
    const taskIdNumber = Number(taskId);

    // -----------------------------------------
    // FIND PROJECT
    // -----------------------------------------

    const project = await prisma.project.findUnique({
      where: { id: projectIdNumber },
      include: { members: true },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // -----------------------------------------
    // PERMISSIONS — anyone with access (owner or member) can edit tasks
    // -----------------------------------------

    const isOwner = project.ownerId === userId;
    const isMember = project.members.some((member) => member.userId === userId);

    if (!isOwner && !isMember) {
      return res.status(403).json({
        message: "You don't have access to this project",
      });
    }

    // -----------------------------------------
    // FIND TASK
    // -----------------------------------------

    const task = await prisma.task.findFirst({
      where: { id: taskIdNumber, projectId: projectIdNumber },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // -----------------------------------------
    // BUILD UPDATE DATA — same for owner and member now
    // -----------------------------------------

    const data = {
      title: title?.trim() || task.title,
      description: description !== undefined ? description.trim() : task.description,
      status: status !== undefined ? status : task.status,
      priority: priority !== undefined ? priority : task.priority,
      position: position !== undefined ? position : task.position,
      dueDate:
        dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : task.dueDate,
      labels: labels !== undefined ? normalizeLabels(labels) : task.labels || [],
      attachments:
        existingAttachments !== undefined || (req.files || []).length > 0
          ? normalizeAttachments(existingAttachments, req.files)
          : task.attachments || [],
      comments: comments !== undefined ? normalizeComments(comments) : task.comments || [],
    };

    // -----------------------------------------
    // ASSIGNEES — anyone with access can reassign, but only to actual project members
    // -----------------------------------------

    if (assigneeIds !== undefined) {
      let requestedIds = normalizeAssigneeIds(assigneeIds);
      requestedIds = Array.from(new Set(requestedIds));

      let validatedAssigneeIds = [];

      if (requestedIds.length > 0) {
        const members = await prisma.projectMember.findMany({
          where: {
            projectId: projectIdNumber,
            userId: { in: requestedIds },
          },
          select: { userId: true },
        });

        validatedAssigneeIds = members.map((member) => member.userId);

        if (validatedAssigneeIds.length !== requestedIds.length) {
          return res.status(400).json({
            message: "One or more assignees are not members of this project",
          });
        }
      }

      data.assignee = {
        set: validatedAssigneeIds.map((userId) => ({ id: userId })),
      };
    }

    // -----------------------------------------
    // UPDATE
    // -----------------------------------------

    const updatedTask = await prisma.task.update({
      where: { id: taskIdNumber },
      data,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    await logTaskMove({ task, newStatus: status, userId, projectId: projectIdNumber });

    return res.status(200).json({ task: updatedTask });
  } catch (error) {
    console.error("Update task error:", error);
    return res.status(500).json({ message: "Failed to update task" });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const project = await prisma.project.findUnique({
      where: { id: Number(projectId) },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Owner-only, per your permission design
    if (project.ownerId !== userId) {
      return res.status(403).json({
        message: "Only the project owner can delete tasks",
      });
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
export const getmessages = async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { projectId: Number(req.params.id) },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json(messages);}
export const getProjectActivity = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const project = await prisma.project.findUnique({
      where: { id: Number(projectId) },
      include: { members: true },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const isOwner = project.ownerId === userId;
    const isMember = project.members.some((member) => member.userId === userId);

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: "You don't have access to this project" });
    }

    const activities = await prisma.activity.findMany({
      where: { projectId: Number(projectId) },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return res.status(200).json(activities);
  } catch (error) {
    console.error("Get activity error:", error);
    return res.status(500).json({ message: "Failed to fetch activity" });
  }
};