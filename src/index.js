const { WebSocketServer } = require("ws");
const { formatJson } = require("./helpers");

// Shared state
const state = {
  traffic: 0,
  rooms: {},
  users: [],
};

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", function connection(ws, socket) {
  state.traffic += 1;
  console.log("New connection, total traffic:", state.traffic);

  ws.on("message", (message) => {
    console.log("received: %s", message);

    let request;
    try {
      request = JSON.parse(message);
    } catch (e) {
      ws.send(formatJson({ error: "Invalid JSON" }));
      ws.terminate();
      return;
    }

    switch (request.request_type) {
      case "host_room":
        if (request.designation === "organizer") {
          state.rooms[request.roomId] = {
            organizer: request.userId,
            attendees: [],
          };
        }
        ws.send(formatJson({ success: "Room hosted" }));

      case "register_user":
        if (request.designation === "attendee") {
          state.rooms[request.roomId].attendees.push(request.userId);
        }
        ws.send(formatJson({ success: "User registered" }));

      default:
        ws.send(formatJson({ error: "Invalid request_type" }));
        ws.terminate();
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
