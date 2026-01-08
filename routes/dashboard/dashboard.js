import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, (req, res) => {
  res.json({
    message: "Dashboard OK",
    admin: req.admin,
  });
});

export default router;
