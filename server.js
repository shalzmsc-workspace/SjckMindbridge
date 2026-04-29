const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// 🔥 IMPORTANT CORS FIX
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
    expires: 86400
  }
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// ================= SOCKET =================
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🔥 Socket Connected:", socket.id);

  socket.on("register-user", (email) => {
    if (!email) return;
    onlineUsers[email] = socket.id;
  });

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log("📦 Joined room:", room);
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

// ================= 🔥 GET MESSAGES =================
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

// ================= 🔥 SEND MESSAGE =================
app.post("/send-message", async (req, res) => {
  try {
    const { room, text, sender } = req.body;

    console.log("📩 Incoming message:", req.body);

    if (!room || !text || !sender) {
      return res.status(400).json({
        error: "Missing fields"
      });
    }

    const newMessage = new Message({
      room,
      text,
      sender
    });

    await newMessage.save();

    console.log("✅ Saved to DB");

    // 🔥 SEND TO SOCKET USERS ALSO
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

    const cleanEmail = email?.toLowerCase();

    const exists = await User.findOne({ email: cleanEmail });

    if (exists) {
      return res.json({ success: false });
    }

    const user = new User({
      name,
      email: cleanEmail,
      password,
      profile: ""
    });

    await user.save();

    res.json({ success: true });

  } catch (err) {
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
      res.json({ success: false });
    }

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ================= USER =================
app.get("/user/:email", async (req, res) => {
  const user = await User.findOne({
    email: req.params.email.toLowerCase()
  });

  res.json(user);
});

// ================= PROFILE =================
app.post("/upload-profile", async (req, res) => {
  try {
    const { email, image } = req.body;

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { profile: image },
      { new: true }
    );

    res.json({ success: true, user });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ================= START =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});