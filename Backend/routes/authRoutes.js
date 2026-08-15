import express from "express";
import { forgetPassword, login, logout, me, resetPassword, signup } from "../controller/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", protect, me);
router.post("/logout", logout);
router.post("/forgot-password",forgetPassword);
router.post("/reset-password", resetPassword);
export default router;
