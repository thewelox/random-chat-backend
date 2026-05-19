const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let waitingUsers = [];

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join", (data) => {
    socket.nickname = data.nickname;

    waitingUsers.push(socket);

    matchUsers();
  });

  socket.on("message", (data) => {
    io.to(socket.roomId).emit("message", {
      text: data.text,
      nickname: socket.nickname,
      sender: socket.id,
    });
  });

  socket.on("typing", () => {
    socket.to(socket.roomId).emit("typing");
  });

  socket.on("next", () => {
    leaveRoom(socket);

    waitingUsers.push(socket);

    matchUsers();
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);

    waitingUsers = waitingUsers.filter(
      (user) => user.id !== socket.id
    );
  });
});

function matchUsers() {
  while (waitingUsers.length >= 2) {
    const user1 = waitingUsers.shift();

    const user2 = waitingUsers.shift();

    const roomId = `room-${user1.id}-${user2.id}`;

    user1.join(roomId);
    user2.join(roomId);

    user1.roomId = roomId;
    user2.roomId = roomId;

    io.to(roomId).emit("matched");
  }
}

function leaveRoom(socket) {
  if (socket.roomId) {
    socket.to(socket.roomId).emit(
      "stranger_left"
    );

    socket.leave(socket.roomId);

    socket.roomId = null;
  }
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});