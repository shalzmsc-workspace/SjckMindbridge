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

// 🔥 TWO COLLECTIONS
const Counsellor = mongoose.model("Counsellor", userSchema, "counsellor");
const Student = mongoose.model("Student", userSchema, "login");

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
    console.log("❌ USERS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ================= REGISTER =================
app.post("/register", async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.json({ success: false, message: "All fields required" });
    }

    email = email.toLowerCase();

    // 🔍 check existing user
    const exists =
      (await Counsellor.findOne({ email })) ||
      (await Student.findOne({ email }));

    if (exists) {
      return res.json({ success: false, message: "User already exists" });
    }

    let newUser;

    // 🔥 Save based on role
    if (role === "counsellor") {
      newUser = new Counsellor({
        name,
        email,
        password,
        profile: "",
        role: "counsellor"
      });
    } else {
      newUser = new Student({
        name,
        email,
        password,
        profile: "",
        role: "student"
      });
    }

    await newUser.save();

    console.log("✅ Registered:", email);

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
    const cleanEmail = email.toLowerCase();

    console.log("📥 LOGIN:", cleanEmail);

    // 🔍 check counsellor
    let user = await Counsellor.findOne({
      email: cleanEmail,
      password
    });

    // 🔍 check student
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

    if (!email || !image) {
      return res.status(400).json({ success: false });
    }

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
    console.log("❌ PROFILE ERROR:", err);
    res.status(500).json({ success: false });
  }
});


// ================= START =================
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});