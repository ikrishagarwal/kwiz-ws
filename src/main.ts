import { readFileSync } from "fs";
import { createServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { formatJson } from "#root/helpers";
import { checkAttendee, checkOrganizer, roomExists } from "./utils.js";

const PORT = process.env.PORT || 8080;
const DEV = process.argv.at(2) === "dev";

console.log("Dev mode:", DEV);

const server = createServer(async (req, res) => {
  try {
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
  } catch {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Websocket server running");
  }
});

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
      case RequestType.HOST_ROOM:
        if (!checkOrganizer(request.designation))
          return ws.send(
            formatJson({
              error: true,
              message: "Designation does not support hosting",
            })
          );

        if (!request.roomId)
          return ws.send(
            formatJson({ error: true, message: "Invalid room id" })
          );

        state.rooms[request.roomId] = {
          question: "",
          options: [],
        };

        ws.send(formatJson({ success: true, message: "Room hosted" }));
        break;

      case RequestType.REGISTER_USER:
        if (!checkAttendee(request.designation))
          return ws.send(
            formatJson({
              error: true,
              message: "Designation does not support registration",
            })
          );

        if (!roomExists(Object.keys(state.rooms), request.roomId))
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
        break;

      case RequestType.ADD_QUESTION:
        if (!checkOrganizer(request.designation))
          return ws.send(
            formatJson({
              error: true,
              message: "Designation does not support adding questions",
            })
          );

        if (!roomExists(Object.keys(state.rooms), request.roomId))
          return ws.send(
            formatJson({ error: true, message: "Room does not exist" })
          );

        if (!request.question.trim())
          return ws.send(
            formatJson({ error: true, message: "Empty question" })
          );

        if (
          !request.options ||
          request.options.length !== 4 ||
          !request.options.every((option: string) => option.trim())
        )
          return ws.send(
            formatJson({ error: true, message: "Invalid options" })
          );

        state.rooms[request.roomId].question = request.question;
        state.rooms[request.roomId].options = request.options;

        wss.clients.forEach((client) => {
          const extendedClient = client as WSExtended;
          if (extendedClient.data && extendedClient.data.roomId === request.roomId) {
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
        break;

      case RequestType.SUBMIT_ANSWER:
        if (!checkOrganizer(request.designation))
          return ws.send(
            formatJson({
              error: true,
              message: "Designation does not support submitting answers",
            })
          );

        if (!roomExists(Object.keys(state.rooms), request.roomId))
          return ws.send(
            formatJson({ error: true, message: "Room does not exist" })
          );

        if (isNaN(request.answer))
          return ws.send(
            formatJson({ error: true, message: "Invalid answer index" })
          );

        if (!state.rooms[request.roomId].question)
          return ws.send(
            formatJson({ error: true, message: "No question added" })
          );

        wss.clients.forEach((client) => {
          const extendedClient = client as WSExtended;
          if (extendedClient.data && extendedClient.data.roomId === request.roomId) {
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
        break;

      default:
        ws.send(formatJson({ error: true, message: "Invalid request type" }));
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

enum RequestType {
  HOST_ROOM = "host_room",
  REGISTER_USER = "register_user",
  ADD_QUESTION = "add_question",
  SUBMIT_ANSWER = "submit_answer",
}
