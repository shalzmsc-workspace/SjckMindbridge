const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);

// ✅ IMPORTANT FOR RENDER SOCKET
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 🔥 TEMP STORAGE (RENDER SAFE)
const USERS_FILE = "/tmp/users.json";
const MESSAGES_FILE = "/tmp/messages.json";

let onlineUsers = {};


// ================= FILE HELPERS =================
const readUsers = () => {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return [];
  }
};

const readMessages = () => {
  try {
    if (!fs.existsSync(MESSAGES_FILE)) return [];
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
  } catch {
    return [];
  }
};

const writeUsers = (data) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
};

const writeMessages = (data) => {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2));
};


// ================= ONLINE USERS =================
const broadcastOnlineUsers = () => {
  io.emit("online-users", Object.keys(onlineUsers));
};


// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("🔥 Connected:", socket.id);

  socket.on("register-user", (email) => {
    if (!email) return;

    const cleanEmail = email.trim().toLowerCase();
    onlineUsers[cleanEmail] = socket.id;

    broadcastOnlineUsers();
  });

  socket.on("join_room", (room) => {
    if (!room) return;
    socket.join(room);
  });

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
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const users = readUsers();

  const user = users.find(
    (u) =>
      u.email.toLowerCase() === email.trim().toLowerCase() &&
      u.password === password
  );

  res.json({ success: !!user, user });
});


// REGISTER
app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  const cleanEmail = email.trim().toLowerCase();

  if (!name || !cleanEmail || !password) {
    return res.json({ success: false });
  }

  let users = readUsers();

  const exists = users.find(
    (u) => u.email === cleanEmail
  );

  if (exists) {
    return res.json({ success: false });
  }

  users.push({ name, email: cleanEmail, password });

  writeUsers(users);

  res.json({ success: true });
});


// USERS
app.get("/users", (req, res) => {
  res.json(readUsers());
});


// MESSAGES
app.get("/messages/:room", (req, res) => {
  const messages = readMessages();
  const room = req.params.room;

  const filtered = messages.filter(
    (m) => m.room === room
  );

  res.json(filtered);
});


// ================= START =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});