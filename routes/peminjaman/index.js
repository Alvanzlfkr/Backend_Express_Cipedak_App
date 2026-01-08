import express from "express";
import peminjamanRoutes from "./peminjaman.js";

const router = express.Router();
router.use("/", peminjamanRoutes);

export default router;
