const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

// ================= MIDDLEWARE =================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE"]
}));

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("🚀 MindBridge Backend Running");
});

// ================= SERVER =================
const server = http.createServer(app);

// ================= MONGODB =================
mongoose.connect(
  "mongodb+srv://sjckcounselling-123:mindbridge123@mindbridgedb.xvawre3.mongodb.net/mindbridgeDB?retryWrites=true&w=majority"
)
.then(() => console.log("✅ MongoDB Connected"))
.catch((err) => console.log("❌ DB Error:", err));

// ================= MODELS =================
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  profile: String,
  role: { type: String, default: "student" }
});

const Counsellor = mongoose.model("Counsellor", userSchema, "counsellor");
const Student = mongoose.model("Student", userSchema, "login");

const messageSchema = new mongoose.Schema({
  room: String,
  text: String,
  sender: String,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400
  }
});

const Message = mongoose.model("Message", messageSchema);

// ================= SOCKET =================
const io = new Server(server, {
  cors: { origin: "*" }
});

let onlineUsers = {};

io.on("connection", (socket) => {

  console.log("🔥 Socket connected:", socket.id);

  // ================= REGISTER =================
  socket.on("register-user", (email) => {
    if (!email) return;

    const cleanEmail = email.toLowerCase();
    onlineUsers[cleanEmail] = socket.id;

    console.log("👤 Online:", cleanEmail);

    io.emit("online-users", Object.keys(onlineUsers));
  });

  // ================= JOIN ROOM =================
  socket.on("join_room", (room) => {
    if (!room) return;

    socket.join(room);
    console.log("📦 Joined room:", room);
  });

  // ================= 🔥 CALL FIX =================
  socket.on("call-user", ({ to, from }) => {

    const cleanTo = to.toLowerCase();
    const cleanFrom = from.toLowerCase();

    console.log("📞 CALL:", cleanFrom, "→", cleanTo);

    const targetSocket = onlineUsers[cleanTo];

    if (targetSocket) {
      io.to(targetSocket).emit("incoming-call", { from: cleanFrom });
    } else {
      console.log("❌ User not online:", cleanTo);
    }
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);

    for (let email in onlineUsers) {
      if (onlineUsers[email] === socket.id) {
        delete onlineUsers[email];
      }
    }

    io.emit("online-users", Object.keys(onlineUsers));
  });
});

// ================= USERS =================
app.get("/users", async (req, res) => {
  try {
    const counsellors = await Counsellor.find();
    const students = await Student.find();
    res.json([...counsellors, ...students]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase();

    let user = await Counsellor.findOne({ email: cleanEmail, password });

    if (!user) {
      user = await Student.findOne({ email: cleanEmail, password });
    }

    if (user) {
      res.json({ success: true, user });
    } else {
      res.json({ success: false });
    }

  } catch {
    res.status(500).json({ success: false });
  }
});

// ================= SEND MESSAGE =================
app.post("/send-message", async (req, res) => {
  try {
    const { room, text, sender } = req.body;

    const newMessage = new Message({ room, text, sender });
    await newMessage.save();

    io.to(room).emit("receive_message", newMessage);

    res.json(newMessage);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= START =================
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});