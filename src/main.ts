import { readFileSync } from "fs";
import { createServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { formatJson } from "#root/helpers";

const PORT = process.env.PORT || 8080;
const DEV = process.argv.at(2) === "dev";

console.log("Dev mode:", DEV);

const server = createServer(async (req, res) => {
  // For dev purposes
  const html = readFileSync("./static/index.html", "utf8");
  const js = readFileSync("./static/script.js", "utf8");

  if (DEV) {
    switch (req.url) {
      case "/script.js":
        res.writeHead(200, { "Content-Type": "application/javascript" });
        res.end(js);
        break;

      case "/":
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
        break;
    }
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Websocket server running");
  }
});
// Shared state
const state: StatsType = {
  traffic: 0,
  rooms: {},
  users: [],
};

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WSExtended) => {
  state.traffic += 1;
  console.log("New connection, total traffic:", state.traffic);

  ws.on("message", (message) => {
    console.log("received: %s", message);

    let request;
    try {
      request = JSON.parse(message.toString());
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

          //   state.rooms[request.roomId].attendees.push({
          //     name: request.username,
          //     id: request.userId,
          //   });

          ws.data = {
            roomId: request.roomId,
          };
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

          wss.clients.forEach((client) => {
            if ((client as WSExtended).data.roomId === request.roomId) {
              client.send(
                formatJson({
                  action: "add_question",
                  message: "Question added",
                  question: request.question,
                  options: request.options,
                })
              );
            }
          });
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

          wss.clients.forEach((client) => {
            if ((client as WSExtended).data.roomId === request.roomId) {
              client.send(
                formatJson({
                  action: "submit_answer",
                  message: "Answer submitted",
                  answer: request.answer,
                })
              );
            }
          });
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

server.listen(PORT, () => {
  console.log("Server started on http://localhost:" + PORT);
});

type StatsType = {
  traffic: number;
  rooms: Record<string, { question: string; options: string[] }>;
  users: string[];
};

type WSExtended = WebSocket & { data: { roomId: string } };
