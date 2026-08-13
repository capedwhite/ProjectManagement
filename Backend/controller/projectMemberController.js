import prisma from "../db/prisma.js";
import { sendInviteEmail } from "../utils/sendEmail.js";

export const inviteProjectMember = async (req, res) => {
    try {
        const projectId = Number(req.params.id);
        const { email } = req.body;

        if (!email) return res.status(400).json({ error: "Email is required." });

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: "Project not found." });
        if (project.ownerId !== req.user.id) {
            return res.status(403).json({ error: "Only the project owner can invite people." });
        }
        const inviter = await prisma.user.findUnique({ where: { id: req.user.id } });
        const invitedUser = await prisma.user.findUnique({ where: { email } });

        if (invitedUser) {
            const alreadyMember = await prisma.projectMember.findUnique({
                where: { projectId_userId: { projectId, userId: invitedUser.id } },
            });
            if (alreadyMember) {
                return res.status(409).json({ error: "That person is already on this project." });
            }

            const member = await prisma.projectMember.create({
                data: { projectId, userId: invitedUser.id, role: "member" },
                include: { user: { select: { id: true, name: true, email: true } } },
            });
            await sendInviteEmail({
                to: email,
                projectTitle: project.title,
                inviterName: inviter.name,
            });
            return res.status(201).json({ status: "added", member });
        }

        // No account yet — store a pending invite instead
        const existingInvite = await prisma.projectInvite.findUnique({
            where: { projectId_email: { projectId, email } },
        });
        if (existingInvite) {
            return res.status(409).json({ error: "That email has already been invited." });
        }

        const invite = await prisma.projectInvite.create({ data: { projectId, email } });
        await sendInviteEmail({
            to: email,
            projectTitle: project.title,
            inviterName: inviter.name,
        });
        return res.status(201).json({ status: "pending", invite });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to invite user." });
    }
}

export const getProjectMembers = async (req, res) => {
    try {
        const members = await prisma.projectMember.findMany({
            where: { projectId: Number(req.params.id) },
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch members." });
    }
}
