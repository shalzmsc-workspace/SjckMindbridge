const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

// ================= MIDDLEWARE =================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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

// ================= MESSAGE MODEL =================
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
    console.log("📦 Joined:", room);
  });

  // ================= SEND CALL =================
  socket.on("call-user", ({ to, from }) => {

    const cleanTo = to?.toLowerCase();
    const cleanFrom = from?.toLowerCase();

    console.log("📞 CALL:", cleanFrom, "➡", cleanTo);

    const targetSocket = onlineUsers[cleanTo];

    if (targetSocket) {
      io.to(targetSocket).emit("incoming-call", {
        from: cleanFrom
      });
      console.log("✅ Call delivered");
    } else {
      console.log("❌ User not online:", cleanTo);
    }
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);

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

// ================= SINGLE USER =================
app.get("/user/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    let user = await Counsellor.findOne({ email });

    if (!user) {
      user = await Student.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= REGISTER =================
app.post("/register", async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.json({ success: false });
    }

    email = email.toLowerCase();

    const exists =
      (await Counsellor.findOne({ email })) ||
      (await Student.findOne({ email }));

    if (exists) {
      return res.json({ success: false, message: "User exists" });
    }

    const newUser =
      role === "counsellor"
        ? new Counsellor({ name, email, password, role: "counsellor" })
        : new Student({ name, email, password, role: "student" });

    await newUser.save();

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
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

// ================= PROFILE =================
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

    res.json({ success: true, user });

  } catch {
    res.status(500).json({ success: false });
  }
});

// ================= GET MESSAGES =================
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

// ================= SEND MESSAGE =================
app.post("/send-message", async (req, res) => {
  try {
    const { room, text, sender } = req.body;

    if (!room || !text || !sender) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const newMessage = new Message({ room, text, sender });

    await newMessage.save();

    console.log("📨 Message:", room);

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