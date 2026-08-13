import upload from "../middleware/upload.js";

// POST /api/tasks/:id/attachments
export const createAttachment = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const attachment = await prisma.attachment.create({
      data: {
        filename: req.file.originalname,
        filepath: req.file.path,
        taskId: Number(req.params.id),
      },
    });

    res.status(201).json(attachment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload attachment." });
  }
};
