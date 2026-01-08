import express from "express";
import {
  getAllPenanganan,
  getPenangananById,
  createPenanganan,
  updatePenanganan,
  deletePenanganan,
} from "../../controllers/penanganan.controller.js";

const router = express.Router();

router.get("/", getAllPenanganan);
router.get("/:id", getPenangananById);
router.post("/", createPenanganan);
router.put("/:id", updatePenanganan);
router.delete("/:id", deletePenanganan);

export default router;
