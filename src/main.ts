import { readFileSync } from "fs";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { formatJson } from "#root/helpers";
import {
  checkAttendee,
  checkOrganizer,
  checkUniqueUserId,
  roomExists,
} from "#root/utils";

import {
  ErrorMessages,
  SuccessMessages,
  ActionMessages,
  Actions,
  RequestType,
  type WSExtended,
  type StatsType,
} from "#root/structures";

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
      ws.send(formatJson({ error: true, message: ErrorMessages.InvalidData }));
      return;
    }

    switch (request.request_type) {
      case RequestType.HOST_ROOM:
        if (!checkOrganizer(request.designation))
          return ws.send(
            formatJson({
              error: true,
              message: ErrorMessages.WrongDesignationHosting,
            })
          );

        if (!request.roomId)
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidRoomId })
          );

        if (!request.userId)
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidUserId })
          );

        if (roomExists(Object.keys(state.rooms), request.roomId))
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.DuplicateRoom })
          );

        state.rooms[request.roomId] = {
          organizer: request.userId,
          attendees: [],
          scores: [],
          question: "",
          answers: [],
        };

        ws.send(
          formatJson({ success: true, message: SuccessMessages.RoomCreated })
        );
        break;

      case RequestType.REGISTER_USER:
        if (!checkAttendee(request.designation))
          return ws.send(
            formatJson({
              error: true,
              message: ErrorMessages.WrongDesignationRegistration,
            })
          );

        if (!roomExists(Object.keys(state.rooms), request.roomId))
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.DuplicateRoom })
          );

        if (!request.username || !request.userId)
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidUserId })
          );

        if (!checkUniqueUserId(state, request.userId))
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.DuplicateUser })
          );

        state.rooms[request.roomId].attendees.push({
          username: request.username,
          id: request.userId,
        });

        state.rooms[request.roomId].scores.push({
          id: request.userId,
          score: 0,
          username: request.username,
        });

        ws.data = {
          roomId: request.roomId,
          userId: request.userId,
          username: request.username,
        };

        ws.send(
          formatJson({ success: true, message: SuccessMessages.UserCreated })
        );
        break;

      case RequestType.ADD_QUESTION:
        if (!checkOrganizer(request.designation))
          return ws.send(
            formatJson({
              error: true,
              message: ErrorMessages.WrongDesignationAddingQuestions,
            })
          );

        if (!roomExists(Object.keys(state.rooms), request.roomId))
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidRoom })
          );

        if (!request.question.trim())
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.EmptyQuestion })
          );

        if (
          !request.options ||
          request.options.length !== 4 ||
          !request.options.every((option: string) => option.trim())
        )
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidOptions })
          );

        state.rooms[request.roomId].question = request.question;

        wss.clients.forEach((client) => {
          const extendedClient = client as WSExtended;
          if (
            extendedClient.data &&
            extendedClient.data.roomId === request.roomId
          ) {
            client.send(
              formatJson({
                action: Actions.AddQuestion,
                message: ActionMessages.AddQuestion,
                question: request.question,
                options: request.options,
              })
            );
          }
        });

        state.rooms[request.roomId].answers = [];

        ws.send(
          formatJson({ success: true, message: ActionMessages.AddQuestion })
        );
        break;

      case RequestType.SUBMIT_ANSWER:
        if (!checkOrganizer(request.designation))
          return ws.send(
            formatJson({
              error: true,
              message: ErrorMessages.WrongDesignationSubmission,
            })
          );

        if (!roomExists(Object.keys(state.rooms), request.roomId))
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidRoom })
          );

        if (isNaN(Number(request.answer)))
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidAnswer })
          );

        if (!state.rooms[request.roomId].question)
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.NoQuestion })
          );

        const newScores = [] as Array<{
          id: string;
          score: number;
          username: string;
        }>;

        wss.clients.forEach((client) => {
          const extendedClient = client as WSExtended;
          if (
            extendedClient.data &&
            extendedClient.data.roomId === request.roomId
          ) {
            const selectedAnswer =
              state.rooms[request.roomId].answers.find(
                (answer) => answer.userId === extendedClient.data.userId
              )?.answer || null;

            let currentUser = state.rooms[request.roomId].scores.find(
              (score) => score.id === extendedClient.data.userId
            );

            if (!currentUser)
              currentUser = {
                id: extendedClient.data.userId,
                score: 0,
                username: extendedClient.data.username,
              };

            currentUser.score +=
              selectedAnswer !== null && selectedAnswer === request.answer
                ? 1
                : 0;
            newScores.push(currentUser);

            client.send(
              formatJson({
                action: Actions.SubmitAnswer,
                message: ActionMessages.SubmitAnswer,
                score: currentUser.score,
              })
            );
          }
        });

        state.rooms[request.roomId].scores = newScores;

        ws.send(
          formatJson({
            success: true,
            message: SuccessMessages.AnswerSubmitted,
          })
        );
        break;

      case RequestType.ANSWER:
        if (!checkAttendee(request.designation))
          return ws.send(
            formatJson({
              error: true,
              message: ErrorMessages.WrongDesignationAnswer,
            })
          );

        if (!roomExists(Object.keys(state.rooms), request.roomId))
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidRoom })
          );

        if (isNaN(request.answer))
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidAnswer })
          );

        if (!state.rooms[request.roomId].question)
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.NoQuestion })
          );

        if (!request.userId)
          return ws.send(
            formatJson({ error: true, message: ErrorMessages.InvalidUserId })
          );

        state.rooms[request.roomId].answers.push({
          userId: request.userId,
          answer: request.answer,
        });

        ws.send(
          formatJson({
            success: true,
            message: SuccessMessages.AnswerSubmitted,
          })
        );
        break;

      case RequestType.LOG:
        // just skip it as it's already logging
        break;

      default:
        ws.send(
          formatJson({ error: true, message: ErrorMessages.InvalidRequest })
        );
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
