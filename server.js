const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);

// ================= MONGODB =================
mongoose.connect("mongodb+srv://mindbridgeuser:YOUR_PASSWORD@mindbridgedb.xvawre3.mongodb.net/mindbridge?retryWrites=true&w=majority")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ DB Error:", err));

// ================= MODELS =================
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  profile: String,
});

const messageSchema = new mongoose.Schema({
  room: String,
  text: String,
  sender: String,
  time: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// ================= SOCKET =================
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let onlineUsers = {};

// 🔥 ONLINE USERS
const broadcastOnlineUsers = () => {
  io.emit("online-users", Object.keys(onlineUsers));
};

io.on("connection", (socket) => {
  console.log("🔥 Connected:", socket.id);

  socket.on("register-user", (email) => {
    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail) return;

    onlineUsers[cleanEmail] = socket.id;
    broadcastOnlineUsers();
  });

  socket.on("join_room", (room) => {
    socket.join(room);
  });

  socket.on("send_message", async (data) => {
    if (!data?.room) return;

    const newMsg = new Message(data);
    await newMsg.save();

    io.to(data.room).emit("receive_message", newMsg);
  });

  socket.on("call-user", ({ to, from }) => {
    const target = onlineUsers[to?.toLowerCase()];
    if (target) {
      io.to(target).emit("incoming-call", { from });
    }
  });

  socket.on("accept-call", ({ to, from }) => {
    const caller = onlineUsers[to?.toLowerCase()];
    if (caller) {
      io.to(caller).emit("call-accepted", { from });
    }
  });

  socket.on("reject-call", ({ to, from }) => {
    const caller = onlineUsers[to?.toLowerCase()];
    if (caller) {
      io.to(caller).emit("call-rejected", { from });
    }
  });

  socket.on("disconnect", () => {
    for (let email in onlineUsers) {
      if (onlineUsers[email] === socket.id) {
        delete onlineUsers[email];
      }
    }
    broadcastOnlineUsers();
  });
});

// ================= APIs =================

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    password,
  });

  if (user) {
    res.json({ success: true, user });
  } else {
    res.json({ success: false });
  }
});

// REGISTER
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  const cleanEmail = email.trim().toLowerCase();

  const exists = await User.findOne({ email: cleanEmail });

  if (exists) {
    return res.json({ success: false, message: "User exists" });
  }

  const newUser = new User({
    name,
    email: cleanEmail,
    password,
  });

  await newUser.save();

  res.json({ success: true });
});

// GET USERS
app.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// GET MESSAGES
app.get("/messages/:room", async (req, res) => {
  const messages = await Message.find({ room: req.params.room });
  res.json(messages);
});

// ================= START =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});