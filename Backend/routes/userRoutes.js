import express from "express";
import prisma from "../db/prisma.js";
import requireAuth from "../middleware/requireAuth.js";
import { searchUser } from "../controller/userController.js";

const router = express.Router();

// GET /api/users/search?q=someone&excludeProjectId=2
router.get("/search", requireAuth, searchUser);

export default router;