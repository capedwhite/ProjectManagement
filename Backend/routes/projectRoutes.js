import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import {
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  getmessages,
  getProjectActivity,
  getProjectById,
  getUserProjects,
  updateProject,
  updateProjectColumns,
  updateTask,
} from "../controller/projectController.js";
import { getProjectMembers } from "../controller/projectMemberController.js";

const router = express.Router();

router.use(protect);

router.get("/", getUserProjects);
router.get("/shared",getProjectMembers)
router.post("/", createProject);
router.get("/:id", getProjectById);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);
router.put("/:id/columns", updateProjectColumns);
router.post("/:id/tasks", upload.array("attachments", 10), createTask);
router.put("/:projectId/tasks/:taskId", upload.array("attachments", 10), updateTask);
router.delete("/:projectId/tasks/:taskId", deleteTask);
// GET /api/projects/:id/messages
router.get("/:id/messages", getmessages);
router.get("/:projectId/activity", getProjectActivity);
export default router;
