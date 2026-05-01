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

// 🔥 TWO COLLECTIONS SUPPORT
const Counsellor = mongoose.model("Counsellor", userSchema, "counsellor");
const Student = mongoose.model("Student", userSchema, "login"); // <-- change if needed

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
  socket.on("register-user", (email) => {
    if (!email) return;

    const cleanEmail = email.toLowerCase();
    onlineUsers[cleanEmail] = socket.id;

    io.emit("online-users", Object.keys(onlineUsers));
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

    console.log("📥 LOGIN:", cleanEmail);

    // 🔍 Check counsellor first
    let user = await Counsellor.findOne({
      email: cleanEmail,
      password
    });

    // 🔍 If not found → check student
    if (!user) {
      user = await Student.findOne({
        email: cleanEmail,
        password
      });
    }

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
    email = email.toLowerCase();

    let user = await Counsellor.findOneAndUpdate(
      { email },
      { profile: image },
      { new: true }
    );

    if (!user) {
      user = await Student.findOneAndUpdate(
        { email },
        { profile: image },
        { new: true }
      );
    }

    if (!user) {
      return res.status(404).json({ success: false });
    }

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