const WebSocket = require('ws');
const express = require('express');
const http = require('http');

// Shared state
const state = {
  traffic: 0,
  rooms: [],
  users: [],
};

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  state.traffic += 1;
  console.log('New connection, total traffic:', state.traffic);

  ws.on('message', (message) => {
    console.log('received: %s', message);
    // Handle message, update state.rooms or state.users as needed
  });

  ws.on('close', () => {
    state.traffic -= 1;
    console.log('Connection closed, total traffic:', state.traffic);
    // Remove user/room from state.users or state.rooms if necessary
  });
});

// WebSocket message handling
wss.on('message', (message) => {
  console.log('received: %s', message);
  // Example message handling logic
  const data = JSON.parse(message);
  switch (data.type) {
    case 'join':
      // Add user to a room
      const room = state.rooms.find(r => r.id === data.roomId) || createRoom(data.roomId);
      room.users.push({ ws, userId: data.userId });
      break;
    case 'leave':
      // Remove user from room
      const roomIndex = state.rooms.findIndex(r => r.id === data.roomId);
      if (roomIndex !== -1) {
        const userIndex = state.rooms[roomIndex].users.findIndex(u => u.userId === data.userId);
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
wss.on('close', () => {
  state.traffic -= 1;
  console.log('Connection closed, total traffic:', state.traffic);
  // Remove user from all rooms
  state.rooms.forEach(room => {
    const userIndex = room.users.findIndex(u => u.ws === ws);
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

// app.static('/', express.static('public'));

// Start server
server.listen(8080, () => {
  console.log('Listening on http://localhost:8080');
});