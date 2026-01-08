import express from "express";

import adminRoutes from "./admin/index.js";
import dashboardRoutes from "./dashboard/dashboard.js";
import tamuRoutes from "./tamu/index.js";
import peminjamanRoutes from "./peminjaman/index.js";
import peminjamanValidasiRoutes from "./peminjaman/validasi.js";
import ruanganRoutes from "./ruangan/index.js";
import penangananRoutes from "./penanganan/penanganan.js";
import waAdmin from "./wa.admin.js";
import ruanganTersediaRoutes from "./ruangan/tersedia.js";
import aiRoutes from "./ai/ai.js";

const router = express.Router();

router.use("/admin", adminRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/tamu", tamuRoutes);
router.use("/peminjaman", peminjamanRoutes);
router.use("/peminjaman", peminjamanValidasiRoutes);
router.use("/ruangan", ruanganRoutes);
router.use("/admin", waAdmin);
router.use("/penanganan", penangananRoutes);
router.use("/ai", aiRoutes);
router.use("/ruangan/tersedia", ruanganTersediaRoutes);

export default router;
