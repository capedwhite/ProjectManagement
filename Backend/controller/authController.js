import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../db/prisma.js";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../utils/sendEmail.js";

const createToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, name:user.name }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

const sendAuthCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
      },
    });
const pendingInvites = await prisma.projectInvite.findMany({ where: { email } });
    if (pendingInvites.length > 0) {
      await prisma.projectMember.createMany({
        data: pendingInvites.map((invite) => ({
          projectId: invite.projectId,
          userId: user.id,
          role: "member",
        })),
        skipDuplicates: true,
      });
      await prisma.projectInvite.deleteMany({ where: { email } });
    }

    const token = createToken(user);
    sendAuthCookie(res, token);

    return res.status(201).json({
      message: "Signup successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong during signup" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = createToken(user);
    sendAuthCookie(res, token);
console.log("Login successful for user:", user.email);
    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong during login" });
  }
};

export const me = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

export const logout = (req, res) => {
  res.clearCookie("token");
  return res.status(200).json({ message: "Logged out successfully" });
};
 export const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return the same success response whether or not the user exists —
    // otherwise you leak which emails are registered (a real security issue)
    if (!user) {
      return res.json({ message: "If an account exists for that email, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const resetLink = `${process.env.CLIENT_URL}/resetPassword?token=${token}`;
    await sendPasswordResetEmail({ to: user.email, name: user.name, resetLink });

    res.json({ message: "If an account exists for that email, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
}