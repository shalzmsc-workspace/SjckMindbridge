const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const USERS_FILE = path.join(__dirname, "users.json");
const MESSAGES_FILE = path.join(__dirname, "messages.json");

let onlineUsers = {}; // { email: socketId }


// ================= SAFE FILE HELPERS =================
const readUsers = () => {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch (err) {
    console.log("❌ Error reading users:", err);
    return [];
  }
};

const readMessages = () => {
  try {
    if (!fs.existsSync(MESSAGES_FILE)) return [];
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
  } catch (err) {
    console.log("❌ Error reading messages:", err);
    return [];
  }
};

const writeMessages = (data) => {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.log("❌ Error writing messages:", err);
  }
};

const writeUsers = (data) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.log("❌ Error writing users:", err);
  }
};


// ================= 🔥 ONLINE USERS =================
const broadcastOnlineUsers = () => {
  io.emit("online-users", Object.keys(onlineUsers));
};


// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("🔥 Connected:", socket.id);

  // REGISTER USER
  socket.on("register-user", (email) => {
    if (!email) return;

    const cleanEmail = email.trim().toLowerCase();

    onlineUsers[cleanEmail] = socket.id;

    console.log("✅ Registered:", cleanEmail);
    broadcastOnlineUsers();
  });

  // JOIN ROOM
  socket.on("join_room", (room) => {
    if (!room) return;
    socket.join(room);
  });

  // SEND MESSAGE
  socket.on("send_message", (data) => {
    if (!data?.room) return;

    const messages = readMessages();

    const newMsg = {
      ...data,
      createdAt: Date.now(),
    };

    messages.push(newMsg);
    writeMessages(messages);

    io.to(data.room).emit("receive_message", newMsg);
  });

  // CALL USER
  socket.on("call-user", ({ to, from }) => {
    if (!to || !from) return;

    const target = onlineUsers[to.toLowerCase()];

    if (target) {
      io.to(target).emit("incoming-call", { from });
      console.log("📞 Calling:", to);
    } else {
      console.log("❌ User not online:", to);
    }
  });

  // ACCEPT CALL
  socket.on("accept-call", ({ to, from }) => {
    const caller = onlineUsers[to?.toLowerCase()];

    if (caller) {
      io.to(caller).emit("call-accepted", { from });
      console.log("✅ Call accepted:", from);
    }
  });

  // REJECT CALL
  socket.on("reject-call", ({ to, from }) => {
    const caller = onlineUsers[to?.toLowerCase()];

    if (caller) {
      io.to(caller).emit("call-rejected", { from });
      console.log("❌ Call rejected:", from);
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);

    for (let email in onlineUsers) {
      if (onlineUsers[email] === socket.id) {
        delete onlineUsers[email];
        console.log("🔴 Removed:", email);
      }
    }

    broadcastOnlineUsers();
  });
});


// ================= APIs =================

// LOGIN
app.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = email.trim().toLowerCase();

    const users = readUsers();

    const user = users.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail &&
        u.password === password
    );

    if (user) {
      console.log("✅ Login success:", cleanEmail);
      res.json({ success: true, user });
    } else {
      console.log("❌ Login failed:", cleanEmail);
      res.json({ success: false });
    }
  } catch (err) {
    console.log("❌ Login error:", err);
    res.json({ success: false });
  }
});


// GET USERS
app.get("/users", (req, res) => {
  res.json(readUsers());
});


// REGISTER
app.post("/register", (req, res) => {
  try {
    const { name, email, password } = req.body;

    const cleanEmail = email.trim().toLowerCase();

    if (!name || !cleanEmail || !password) {
      return res.json({
        success: false,
        message: "All fields required ❌",
      });
    }

    let users = readUsers();

    const exists = users.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    if (exists) {
      return res.json({
        success: false,
        message: "User already exists ❌",
      });
    }

    const newUser = {
      name,
      email: cleanEmail,
      password,
    };

    users.push(newUser);
    writeUsers(users);

    console.log("✅ Registered:", cleanEmail);

    res.json({
      success: true,
      message: "User registered ✅",
    });
  } catch (err) {
    console.log("❌ Register error:", err);
    res.json({
      success: false,
      message: "Server error ❌",
    });
  }
});


// GET MESSAGES (24h)
app.get("/messages/:room", (req, res) => {
  const room = req.params.room;
  const messages = readMessages();

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const filtered = messages.filter(
    (msg) =>
      msg.room === room &&
      now - msg.createdAt < oneDay
  );

  res.json(filtered);
});


// ================= START =================
server.listen(5000, "0.0.0.0", () => {
  console.log("🚀 Server running on http://localhost:5000");
});