
// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { cleanupOldAttendancePhotos } from "./utils/cleanup.js";
import bcrypt from "bcryptjs";
import Employee from "./models/Employee.js";
import http from "http";                // ⬅️ new
import { Server } from "socket.io";     // ⬅️ new

// routes
import authRoutes from "./routes/authRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app); // ⬅️ wrap express in http server

// ✅ Socket.IO setup
const io = new Server(server, { cors: { origin: "*" } });
app.set("io", io); // so controllers can emit events

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);
  socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (req, res) => res.send("Employee Attendance API is running 🚀"));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/file", fileRoutes);

// error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 2000;

connectDB(process.env.MONGO_URI)
  .then(async () => {
    // --- Boss seeding ---
    const ADMIN_EMP_ID = process.env.ADMIN_EMP_ID || "BOSS";
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe123!";
    const ADMIN_NAME = process.env.ADMIN_NAME || "Company Boss";
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "boss@example.com";

    try {
      const existing = await Employee.findOne({ empId: ADMIN_EMP_ID });
      if (!existing) {
        const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await Employee.create({
          empId: ADMIN_EMP_ID,
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          role: "boss",
          passwordHash: hash,
        });
        console.log(`✅ Boss user created (${ADMIN_EMP_ID}).`);
      }
    } catch (seedErr) {
      console.error("❌ Error seeding boss user:", seedErr);
    }

    server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`)); // ⬅️ use server.listen
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  });

// cleanup
cron.schedule("0 2 * * *", () => {
  console.log("🕑 Running daily cleanup job...");
  cleanupOldAttendancePhotos();
});
