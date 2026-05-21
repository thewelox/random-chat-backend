const express = require("express");

const http = require("http");

const { Server } = require("socket.io");

const cors = require("cors");

const app = express();

app.use(cors());

app.get("/", (req, res) => {
  res.send("VIBE backend running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let waitingUsers = [];

let onlineUsers = 0;

io.on("connection", (socket) => {
  console.log(
    "Connected:",
    socket.id
  );

  onlineUsers++;

  io.emit(
    "online_count",
    onlineUsers
  );

  socket.on("join", (data) => {
    socket.nickname =
      data.nickname;

    socket.gender =
      data.gender;

    const alreadyWaiting =
      waitingUsers.find(
        (user) =>
          user.id === socket.id
      );

    if (!alreadyWaiting) {
      waitingUsers.push(socket);
    }

    matchUsers();
  });

  socket.on("message", (data) => {
    if (!socket.roomId) return;

    io.to(socket.roomId).emit(
      "message",
      {
        id: Date.now(),

        text: data.text,

        nickname:
          socket.nickname,

        gender:
          socket.gender,

        sender: socket.id,

        replyTo:
          data.replyTo || null,
      }
    );
  });

  socket.on("typing", () => {
    if (!socket.roomId) return;

    socket
      .to(socket.roomId)
      .emit("typing");
  });

  socket.on("next", () => {
    leaveRoom(socket);

    const alreadyWaiting =
      waitingUsers.find(
        (user) =>
          user.id === socket.id
      );

    if (!alreadyWaiting) {
      waitingUsers.push(socket);
    }

    matchUsers();
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);

    waitingUsers =
      waitingUsers.filter(
        (user) =>
          user.id !== socket.id
      );

    onlineUsers--;

    if (onlineUsers < 0) {
      onlineUsers = 0;
    }

    io.emit(
      "online_count",
      onlineUsers
    );

    console.log(
      "Disconnected:",
      socket.id
    );
  });
});

function matchUsers() {
  while (
    waitingUsers.length >= 2
  ) {
    const user1 =
      waitingUsers.shift();

    const user2 =
      waitingUsers.shift();

    if (!user1 || !user2)
      return;

    const roomId = `room-${user1.id}-${user2.id}`;

    user1.join(roomId);

    user2.join(roomId);

    user1.roomId = roomId;

    user2.roomId = roomId;

    io.to(roomId).emit(
      "matched"
    );

    console.log(
      `Matched ${user1.nickname} with ${user2.nickname}`
    );
  }
}

function leaveRoom(socket) {
  if (socket.roomId) {
    socket
      .to(socket.roomId)
      .emit(
        "stranger_left"
      );

    socket.leave(
      socket.roomId
    );

    socket.roomId = null;
  }
}

const PORT =
  process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});