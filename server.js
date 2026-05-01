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
  methods: ["GET", "POST"]
}));

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
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24 hours auto delete
  }
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// ================= SOCKET =================
const io = new Server(server, {
  cors: { origin: "*" }
});

let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🔥 Socket Connected:", socket.id);

  socket.on("register-user", (email) => {
    if (!email) return;
    onlineUsers[email] = socket.id;
  });

  socket.on("join_room", (room) => {
    if (!room) return;
    socket.join(room);
    console.log("📦 Joined room:", room);
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);

    for (let email in onlineUsers) {
      if (onlineUsers[email] === socket.id) {
        delete onlineUsers[email];
      }
    }
  });
});

// ================= GET MESSAGES =================
app.get("/messages/:room", async (req, res) => {
  try {
    const messages = await Message.find({
      room: req.params.room
    }).sort({ createdAt: 1 });

    res.json(messages);

  } catch (err) {
    console.log("❌ GET MSG ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= SEND MESSAGE =================
app.post("/send-message", async (req, res) => {
  try {
    const { room, text, sender } = req.body;

    console.log("📩 Incoming:", req.body);

    if (!room || !text || !sender) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const newMessage = new Message({
      room,
      text,
      sender
    });

    await newMessage.save();

    console.log("✅ Message saved");

    // 🔥 REALTIME EMIT (ONLY HERE, NOT IN SOCKET)
    io.to(room).emit("receive_message", newMessage);

    res.json(newMessage);

  } catch (err) {
    console.log("❌ SEND ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= REGISTER =================
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.json({ success: false, message: "All fields required" });
    }

    const cleanEmail = email.toLowerCase();

    const exists = await User.findOne({ email: cleanEmail });

    if (exists) {
      return res.json({ success: false, message: "User exists" });
    }

    const newUser = new User({
      name,
      email: cleanEmail,
      password,
      profile: ""
    });

    await newUser.save();

    res.json({ success: true });

  } catch (err) {
    console.log("❌ REGISTER ERROR:", err);
    res.status(500).json({ success: false });
  }
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
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

// ================= GET USER =================
app.get("/user/:email", async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.params.email.toLowerCase()
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= PROFILE UPDATE =================
app.post("/upload-profile", async (req, res) => {
  try {
    const { email, image } = req.body;

    if (!email || !image) {
      return res.status(400).json({
        success: false,
        message: "Missing data"
      });
    }

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { profile: image },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({ success: true, user });

  } catch (err) {
    console.log("❌ PROFILE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

// ================= START =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
app.get("/users", async (req, res) => {
  try {
    const users = await User.find(); // MongoDB
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});