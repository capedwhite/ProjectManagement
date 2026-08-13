import jwt from "jsonwebtoken";
import prisma from "../db/prisma.js";

export const protect = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace("Bearer ", "") ||
      null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    return res.status(401).json({ message: "Invalid token" });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    req.user = user || null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};
