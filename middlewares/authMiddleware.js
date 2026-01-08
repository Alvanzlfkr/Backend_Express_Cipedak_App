import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // Format: Bearer token
  if (!authHeader) return res.status(401).json({ message: "Token tidak ada" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.admin = decoded; // simpan data admin
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token tidak valid" });
  }
}
