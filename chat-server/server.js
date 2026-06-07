// ════════════════════════════════════════════════════════════════
// TSSWAL — Realtime Chat Server (Express + Socket.io + MongoDB)
// ════════════════════════════════════════════════════════════════
// Events handled :
//   client → server :
//     join_group   { groupId }
//     leave_group  { groupId }
//     send_message { groupId, text, imageUrl?, replyTo? }
//     typing       { groupId, isTyping }
//
//   server → client :
//     new_message    (broadcast à la room)
//     user_typing    { uid, userName, isTyping }
//     error          { message }
//
// Auth : handshake `auth: { idToken }`. Le serveur vérifie le Firebase
//        ID Token via Admin SDK, puis contrôle le statut en DB.
// ════════════════════════════════════════════════════════════════

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import Message from "./models/Message.js";
import User from "./models/User.js";
import Group from "./models/Group.js";

// ─── Firebase Admin SDK (JWT verification) ────────────────────────
const firebaseAdmin = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const adminAuth = getAuth(firebaseAdmin);

// ─── Env ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

if (!MONGODB_URI) {
  console.error("[FATAL] MONGODB_URI is not defined in .env");
  process.exit(1);
}

// ─── Mongo connection ─────────────────────────────────────────────
await mongoose
  .connect(MONGODB_URI, { bufferCommands: false })
  .then(() => console.log("[Mongo] connected"))
  .catch((err) => {
    console.error("[Mongo] connection error:", err);
    process.exit(1);
  });

// ─── Express ──────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

app.get("/", (_req, res) => res.json({ ok: true, service: "tswal-chat-server" }));
app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
  })
);

// ─── HTTP + Socket.io ─────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ["websocket", "polling"],
});

// ─── Auth middleware (handshake) — Firebase ID Token verification ─
io.use(async (socket, next) => {
  try {
    const { idToken } = socket.handshake.auth || {};
    if (!idToken) return next(new Error("Missing idToken"));

    // Verify Firebase ID token — rejects expired/forged tokens
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (e) {
      console.warn("[auth] token verification failed:", e.code || e.message);
      return next(new Error("Invalid or expired token"));
    }

    const uid = decoded.uid;

    const user = await User.findOne({ uid }).lean();
    if (!user) return next(new Error("User not found"));
    if (user.status === "rejected") return next(new Error("Account rejected"));

    socket.data.uid = uid;
    socket.data.userName = user.fullName || "Étudiant";
    socket.data.role = user.role;
    next();
  } catch (e) {
    console.error("[auth] error:", e);
    next(new Error("Auth error"));
  }
});

// ─── Membership helper ────────────────────────────────────────────
async function isMember(groupId, uid) {
  if (!mongoose.Types.ObjectId.isValid(groupId)) return false;
  const g = await Group.findById(groupId).lean();
  return !!g && (g.members || []).includes(uid);
}

// ─── Socket events ────────────────────────────────────────────────
io.on("connection", (socket) => {
  const { uid, userName } = socket.data;
  console.log(`[+] ${userName} (${uid}) connected — ${socket.id}`);

  // ── join_group ─────────────────────────────────────────────────
  socket.on("join_group", async ({ groupId }) => {
    if (!groupId) return socket.emit("error", { message: "Missing groupId" });

    const allowed = await isMember(groupId, uid);
    if (!allowed && socket.data.role !== "admin") {
      return socket.emit("error", { message: "Not a member" });
    }

    socket.join(groupId);
    console.log(`    ↳ ${userName} joined room ${groupId}`);
  });

  // ── leave_group ────────────────────────────────────────────────
  socket.on("leave_group", ({ groupId }) => {
    if (groupId) socket.leave(groupId);
  });

  // ── send_message ───────────────────────────────────────────────
  socket.on("send_message", async ({ groupId, text, imageUrl, replyTo }) => {
    if (!groupId) return socket.emit("error", { message: "Missing groupId" });
    const cleanText = (text || "").trim();
    if (!cleanText && !imageUrl) {
      return socket.emit("error", { message: "Empty message" });
    }
    if (cleanText.length > 4000) {
      return socket.emit("error", { message: "Message too long" });
    }

    const allowed = await isMember(groupId, uid);
    if (!allowed) return socket.emit("error", { message: "Not a member" });

    try {
      const doc = await Message.create({
        groupId,
        uid,
        userName,
        text: cleanText,
        imageUrl: imageUrl || null,
        replyTo: replyTo || null,
      });

      const payload = {
        id: doc._id.toString(),
        groupId,
        uid,
        userName,
        text: doc.text,
        imageUrl: doc.imageUrl,
        replyTo: doc.replyTo,
        createdAt: doc.createdAt,
      };

      // Broadcast to all members in the room (including sender — keeps state in sync)
      io.to(groupId).emit("new_message", payload);
    } catch (err) {
      console.error("[send_message] error:", err);
      socket.emit("error", { message: "Could not save message" });
    }
  });

  // ── typing indicator ───────────────────────────────────────────
  socket.on("typing", ({ groupId, isTyping }) => {
    if (!groupId) return;
    socket.to(groupId).emit("user_typing", { uid, userName, isTyping });
  });

  // ── disconnect ─────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`[-] ${userName} disconnected — ${reason}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[chat-server] listening on :${PORT}`);
  console.log(`[chat-server] CORS allowed: ${ALLOWED_ORIGINS.join(", ")}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[SIGTERM] closing…");
  httpServer.close(() => mongoose.connection.close());
});
