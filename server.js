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

// 🔥 IMPORTANT: match your Mongo collection name
const User = mongoose.model("User", userSchema, "counsellor");

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
  console.log("🔥 Socket Connected:", socket.id);

  socket.on("register-user", (email) => {
    if (!email) return;

    const cleanEmail = email.toLowerCase();
    onlineUsers[cleanEmail] = socket.id;

    io.emit("online-users", Object.keys(onlineUsers));
  });

  socket.on("join_room", (room) => {
    if (!room) return;
    socket.join(room);
  });

  socket.on("disconnect", () => {
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
    const users = await User.find();
    console.log("👥 USERS:", users); // 🔥 DEBUG
    res.json(users);
  } catch (err) {
    console.log("❌ USERS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= DELETE =================
app.delete("/delete-user/:email", async (req, res) => {
  try {
    await User.deleteOne({
      email: req.params.email.toLowerCase()
    });
    res.json({ success: true });
  } catch (err) {
    console.log("❌ DELETE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

// ================= REGISTER =================
app.post("/register", async (req, res) => {
  try {
    let { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.json({ success: false });
    }

    email = email.toLowerCase();

    const exists = await User.findOne({ email });
    if (exists) {
      return res.json({ success: false });
    }

    const newUser = new User({
      name,
      email,
      password,
      profile: "",
      role: "student"
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
    console.log("📥 LOGIN:", req.body);

    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
      password
    });

    console.log("👤 FOUND:", user);

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

// ================= PROFILE UPDATE =================
app.post("/upload-profile", async (req, res) => {
  try {
    let { email, image } = req.body;

    if (!email || !image) {
      return res.status(400).json({ success: false });
    }

    email = email.toLowerCase();

    console.log("📸 Updating profile:", email);

    let user = await User.findOneAndUpdate(
      { email },
      { profile: image },
      { new: true }
    );

    // 🔥 AUTO CREATE IF NOT FOUND (fixes your issue permanently)
    if (!user) {
      console.log("⚠️ User not found → creating new");

      user = new User({
        email,
        name: "User",
        profile: image
      });

      await user.save();
    }

    res.json({ success: true, user });

  } catch (err) {
    console.log("❌ PROFILE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

// ================= MESSAGES =================
app.get("/messages/:room", async (req, res) => {
  try {
    const messages = await Message.find({
      room: req.params.room
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/send-message", async (req, res) => {
  try {
    const { room, text, sender } = req.body;

    if (!room || !text || !sender) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const newMessage = new Message({ room, text, sender });
    await newMessage.save();

    io.to(room).emit("receive_message", newMessage);

    res.json(newMessage);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= START =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});