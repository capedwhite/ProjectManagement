import prisma from "../db/prisma.js";

export const searchUser = async (req, res) => {
    try {
        const { q, excludeProjectId } = req.query;

        if (!q || q.trim().length < 2) {
            return res.json([]); // don't search on 0-1 characters, too noisy
        }

        // Find users whose name or email matches, excluding people already on the project
        let excludedUserIds = [];
        if (excludeProjectId) {
            const existingMembers = await prisma.projectMember.findMany({
                where: { projectId: Number(excludeProjectId) },
                select: { userId: true },
            });
            excludedUserIds = existingMembers.map((m) => m.userId);
        }

        const users = await prisma.user.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { name: { contains: q, mode: "insensitive" } },
                            { email: { contains: q, mode: "insensitive" } },
                        ],
                    },
                    { id: { notIn: excludedUserIds } },
                ],
            },
            select: { id: true, name: true, email: true },
            take: 8, // cap results, this is a dropdown not a full page
        });

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Search failed." });
    }
}