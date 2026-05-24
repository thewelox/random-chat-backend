const express = require("express");

const http = require("http");

const { Server } = require("socket.io");

const cors = require("cors");

const app = express();

app.use(cors());

app.get("/", (req, res) => {
  res.send("VIBE backend running 🌌");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/*
  RANDOM CHAT
*/

let waitingUsers = [];

let onlineUsers = 0;

/*
  CLUB SYSTEM
*/

let clubUsers = [];

let clubMessages = [];

/*
  SOCKET CONNECTION
*/

io.on("connection", (socket) => {
  console.log(
    "Connected:",
    socket.id
  );

  /*
    USER ONLINE
  */

  onlineUsers++;

  io.emit(
    "online_count",
    onlineUsers
  );

  /*
    ANTISPAM
  */

  socket.lastMessageTime = 0;

  /*
    RANDOM CHAT JOIN
  */

  socket.on("join", (data) => {
    socket.nickname =
      data.nickname || "Anonymous";

    socket.gender =
      data.gender || "male";

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

  /*
    RANDOM MESSAGE
  */

  socket.on("message", (data) => {
    if (!socket.roomId) return;

    const now = Date.now();

    /*
      ANTISPAM
    */

    if (
      now - socket.lastMessageTime <
      700
    ) {
      return;
    }

    socket.lastMessageTime = now;

    const messageData = {
      id: Date.now(),

      timestamp: Date.now(),

      text: data.text,

      nickname:
        socket.nickname,

      gender:
        socket.gender,

      sender: socket.id,

      reaction: null,

      replyTo:
        data.replyTo || null,
    };

    io.to(socket.roomId).emit(
      "message",
      messageData
    );
  });

  /*
    MESSAGE REACTIONS
  */

  socket.on(
    "react_message",
    ({ messageId, emoji }) => {
      io.emit(
        "message_reaction",
        {
          messageId,
          emoji,
        }
      );
    }
  );

  /*
    RANDOM TYPING
  */

  socket.on("typing", () => {
    if (!socket.roomId) return;

    socket
      .to(socket.roomId)
      .emit("typing");
  });

  /*
    NEXT USER
  */

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

  /*
    CLUB JOIN
  */

  socket.on(
    "join_club",
    (profile) => {
      socket.clubProfile = {
        nickname:
          profile.nickname ||
          "Anonymous",

        bio:
          profile.bio ||
          "VIBE member 🌌",

        avatar:
          profile.avatar ||
          "/male.jpg",
      };

      const alreadyExists =
        clubUsers.find(
          (user) =>
            user.id === socket.id
        );

      if (!alreadyExists) {
        clubUsers.push({
          id: socket.id,

          nickname:
            socket.clubProfile
              .nickname,

          bio:
            socket.clubProfile
              .bio,

          avatar:
            socket.clubProfile
              .avatar,
        });
      }

      /*
        SEND USERS
      */

      io.emit(
        "club_online_users",
        clubUsers
      );

      /*
        SEND OLD MESSAGES
      */

      socket.emit(
        "club_old_messages",
        clubMessages
      );

      /*
        SYSTEM MESSAGE
      */

      io.emit(
        "club_system",
        {
          text: `${socket.clubProfile.nickname} joined VIBE 🌌`,
        }
      );

      console.log(
        `${socket.clubProfile.nickname} joined VIBE Club`
      );
    }
  );

  /*
    CLUB MESSAGE
  */

  socket.on(
    "club_message",
    (data) => {
      if (!socket.clubProfile)
        return;

      const now = Date.now();

      /*
        ANTISPAM
      */

      if (
        now - socket.lastMessageTime <
        700
      ) {
        return;
      }

      socket.lastMessageTime = now;

      const messageData = {
        id: Date.now(),

        nickname:
          socket.clubProfile
            .nickname,

        bio:
          socket.clubProfile.bio,

        avatar:
          socket.clubProfile
            .avatar,

        text: data.text,

        timestamp: Date.now(),
      };

      /*
        SAVE MESSAGE
      */

      clubMessages.push(
        messageData
      );

      /*
        KEEP LAST 100
      */

      if (
        clubMessages.length > 100
      ) {
        clubMessages.shift();
      }

      io.emit(
        "club_message",
        messageData
      );
    }
  );

  /*
    CLUB TYPING
  */

  socket.on(
    "club_typing",
    () => {
      if (!socket.clubProfile)
        return;

      socket.broadcast.emit(
        "club_typing",
        {
          nickname:
            socket.clubProfile
              .nickname,
        }
      );
    }
  );

  /*
    PROFILE UPDATE
  */

  socket.on(
    "update_profile",
    (profile) => {
      if (!socket.clubProfile)
        return;

      socket.clubProfile.nickname =
        profile.nickname;

      socket.clubProfile.bio =
        profile.bio;

      socket.clubProfile.avatar =
        profile.avatar;

      clubUsers = clubUsers.map(
        (user) =>
          user.id === socket.id
            ? {
                ...user,

                nickname:
                  profile.nickname,

                bio: profile.bio,

                avatar:
                  profile.avatar,
              }
            : user
      );

      io.emit(
        "club_online_users",
        clubUsers
      );
    }
  );

  /*
    DISCONNECT
  */

  socket.on("disconnect", () => {
    leaveRoom(socket);

    /*
      REMOVE WAITING
    */

    waitingUsers =
      waitingUsers.filter(
        (user) =>
          user.id !== socket.id
      );

    /*
      REMOVE CLUB USER
    */

    clubUsers =
      clubUsers.filter(
        (user) =>
          user.id !== socket.id
      );

    io.emit(
      "club_online_users",
      clubUsers
    );

    /*
      SYSTEM MESSAGE
    */

    if (socket.clubProfile) {
      io.emit(
        "club_system",
        {
          text: `${socket.clubProfile.nickname} left VIBE`,
        }
      );
    }

    /*
      ONLINE COUNT
    */

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

/*
  MATCH USERS
*/

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

    if (
      user1.id === user2.id
    ) {
      continue;
    }

    const roomId = `room-${user1.id}-${user2.id}-${Date.now()}`;

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

/*
  LEAVE ROOM
*/

function leaveRoom(socket) {
  if (!socket.roomId) return;

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

/*
  START SERVER
*/

const PORT =
  process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});