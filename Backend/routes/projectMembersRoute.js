import express from "express";

import { inviteProjectMember, getProjectMembers } from "../controller/projectMemberController.js"
const router = express.Router();

// POST /api/projects/:id/invite — invite by email
router.post("/:id/invite", inviteProjectMember);

// GET /api/projects/:id/members — list everyone with access, for the assignee dropdown
router.get("/:id/members", getProjectMembers);

export default router;