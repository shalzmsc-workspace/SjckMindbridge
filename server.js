const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());
app.use(cors());

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("🚀 MindBridge Backend Running");
});

// ================= SERVER =================
const server = http.createServer(app);

// ================= MONGODB =================
mongoose.connect(
  "mongodb+srv://sjckcounselling-123:mindbridge123@mindbridgedb.xvawre3.mongodb.net/mindbridge?retryWrites=true&w=majority"
)
.then(() => console.log("✅ MongoDB Connected"))
.catch((err) => console.log("❌ DB Error:", err));

// ================= MODELS =================
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  profile: String
});

const messageSchema = new mongoose.Schema({
  room: String,
  text: String,
  sender: String,
  time: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// ================= SOCKET =================
const io = new Server(server, {
  cors: { origin: "*" }
});

let onlineUsers = {};

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
    if (room) socket.join(room);
  });

  socket.on("send_message", async (data) => {
    try {
      if (!data?.room) return;

      const newMsg = new Message(data);
      await newMsg.save();

      io.to(data.room).emit("receive_message", newMsg);
    } catch (err) {
      console.log("❌ Message error:", err);
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

// REGISTER
app.post("/register", async (req, res) => {
  try {
    console.log("📥 Register:", req.body);

    const { name, email, password } = req.body;
    const cleanEmail = email?.trim().toLowerCase();

    if (!name || !cleanEmail || !password) {
      return res.json({ success: false, message: "All fields required" });
    }

    const exists = await User.findOne({ email: cleanEmail });

    if (exists) {
      return res.json({ success: false, message: "User exists" });
    }

    const newUser = new User({
      name,
      email: cleanEmail,
      password
    });

    await newUser.save();

    console.log("✅ User saved");

    res.json({ success: true });

  } catch (err) {
    console.log("❌ REGISTER ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      password
    });

    if (user) {
      res.json({ success: true, user });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }

  } catch (err) {
    console.log("❌ LOGIN ERROR:", err);
    res.status(500).json({ success: false });
  }
});

// USERS
app.get("/users", async (req, res) => {
  try {
    console.log("🔥 USERS API CALLED");

    const users = await User.find();

    res.json(users);

  } catch (err) {
    console.log("❌ USERS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ PROFILE UPLOAD (FIXED)
app.post("/upload-profile", async (req, res) => {
  try {
    console.log("📸 Upload request:", req.body.email);

    const { email, image } = req.body;

    if (!email || !image) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { profile: image },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("✅ Profile updated");

    res.json({ success: true, user });

  } catch (err) {
    console.log("❌ PROFILE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= START =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});