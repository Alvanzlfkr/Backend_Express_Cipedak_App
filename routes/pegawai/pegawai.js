import express from "express";
import { cekNip } from "../controllers/pegawai.controller.js";

const router = express.Router();

router.get("/cek-nip/:nip", cekNip);

export default router;
