import express from "express";
import tamuRoutes from "./tamu.js";

const router = express.Router();
router.use("/", tamuRoutes);

export default router;
