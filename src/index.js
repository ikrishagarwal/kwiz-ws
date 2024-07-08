const { WebSocketServer } = require("ws");
const { formatJson } = require("./helpers");

// Shared state
const state = {
  traffic: 0,
  rooms: {},
  users: [],
};

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", function connection(ws) {
  state.traffic += 1;
  console.log("New connection, total traffic:", state.traffic);

  ws.on("message", (message) => {
    console.log("received: %s", message);

    let request;
    try {
      request = JSON.parse(message);
    } catch (e) {
      ws.send(formatJson({ error: true, message: "Invalid JSON" }));
      return;
    }

    switch (request.request_type) {
      case "host_room":
        if (request.designation === "organizer") {
          if (!request.roomId)
            return ws.send(
              formatJson({ error: true, message: "Invalid room id" })
            );

          state.rooms[request.roomId] = {
            organizer: request.userId,
            attendees: [],
          };
          ws.send(formatJson({ success: true, message: "Room hosted" }));
        } else {
          ws.send(
            formatJson({
              error: true,
              message: "Designation does not support hosting",
            })
          );
        }
        break;

      case "register_user":
        if (request.designation === "attendee") {
          if (!state.rooms[request.roomId])
            return ws.send(
              formatJson({ error: true, message: "Room does not exist" })
            );

          if (!request.username || !request.userId)
            return ws.send(
              formatJson({ error: true, message: "Invalid user id" })
            );

          state.rooms[request.roomId].attendees.push({
            name: request.username,
            id: request.userId,
          });
          ws.send(formatJson({ success: true, message: "User registered" }));
        } else {
          ws.send(
            formatJson({
              error: true,
              message: "Designation does not support registration",
            })
          );
        }
        break;

      case "add_question":
        if (request.designation === "organizer") {
          if (!state.rooms[request.roomId])
            return ws.send(
              formatJson({ error: true, message: "Room does not exist" })
            );

          if (!request.question)
            return ws.send(
              formatJson({ error: true, message: "Invalid question" })
            );

          if (!request.options || request.options.length !== 4)
            return ws.send(
              formatJson({ error: true, message: "Invalid options" })
            );

          state.rooms[request.roomId].question = request.question;
          state.rooms[request.roomId].options = request.options;
          ws.send(formatJson({ success: true, message: "Question added" }));

          // TODO: send the question to attendees
        } else {
          ws.send(
            formatJson({
              error: true,
              message: "Designation does not support adding questions",
            })
          );
        }
        break;

      case "submit_answer":
        if (request.designation === "organizer") {
          if (!state.rooms[request.roomId])
            return ws.send(
              formatJson({ error: true, message: "Room does not exist" })
            );

          if (isNaN(request.answer))
            return ws.send(
              formatJson({ error: true, message: "Invalid answer" })
            );

          if (!state.rooms[request.roomId].question)
            return ws.send(
              formatJson({ error: true, message: "No question added" })
            );

          // TODO: post the solution to attendees
          ws.send(formatJson({ success: true, message: "Answer submitted" }));
        } else {
          ws.send(
            formatJson({
              error: true,
              message: "Designation does not support submitting answers",
            })
          );
        }
        break;

      default:
        ws.send(formatJson({ error: true, message: "Invalid request_type" }));
    }
  });

  ws.on("close", () => {
    state.traffic -= 1;
    console.log("Connection closed, total traffic:", state.traffic);
    // Remove user/room from state.users or state.rooms if necessary
  });
});

/**
// WebSocket message handling
wss.on("message", (message) => {
  console.log("received: %s", message);
  // Example message handling logic
  const data = JSON.parse(message);
  switch (data.type) {
    case "join":
      // Add user to a room
      const room =
        state.rooms.find((r) => r.id === data.roomId) ||
        createRoom(data.roomId);
      room.users.push({ ws, userId: data.userId });
      break;
    case "leave":
      // Remove user from room
      const roomIndex = state.rooms.findIndex((r) => r.id === data.roomId);
      if (roomIndex !== -1) {
        const userIndex = state.rooms[roomIndex].users.findIndex(
          (u) => u.userId === data.userId
        );
        if (userIndex !== -1) {
          state.rooms[roomIndex].users.splice(userIndex, 1);
          if (state.rooms[roomIndex].users.length === 0) {
            // Remove room if empty
            state.rooms.splice(roomIndex, 1);
          }
        }
      }
      break;
    // Handle other message types as needed
  }
});

// WebSocket close event handling
wss.on("close", () => {
  state.traffic -= 1;
  console.log("Connection closed, total traffic:", state.traffic);
  // Remove user from all rooms
  state.rooms.forEach((room) => {
    const userIndex = room.users.findIndex((u) => u.ws === ws);
    if (userIndex !== -1) {
      room.users.splice(userIndex, 1);
      if (room.users.length === 0) {
        // Optionally remove room if empty
        const roomIndex = state.rooms.indexOf(room);
        state.rooms.splice(roomIndex, 1);
      }
    }
  });
});

*/
