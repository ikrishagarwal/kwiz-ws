const stdout = document.querySelector("pre");
function log(type, message) {
  stdout.textContent += `[${new Date().toISOString()}] (${type}): ${message}\n\n`;
}
async function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const proto = location.protocol.startsWith("https") ? "wss" : "ws";
const websocket = new WebSocket(`${proto}://127.0.0.1:8080/`);

websocket.onopen = async () => {
  log("ws", "connection established");
};

websocket.onclose = () => {
  log("ws", "connection closed");
};

websocket.onmessage = (e) => {
  const response = JSON.parse(e.data);
  log("message", JSON.stringify(response, null, 2));
  onResponse(response);
};

function onResponse(data) {}

function send(data) {
  log("send", JSON.stringify(data, null, 2));
  websocket.send(JSON.stringify(data));
}

async function testServer() {
  log("test", "Starting test");

  // organiser register_user
  send({
    request_type: "register_user",
    designation: "attendee",
    data: {
      room_id: "test",
      username: "st1",
    },
  });
  await pause(2000);

  // host_room
  send({
    request_type: "host_room",
    designation: "organizer",
    data: {
      room_id: "test_room",
      username: "abc1",
    },
  });
  await pause(2000);

  // attendee register
  send({
    request_type: "register_user",
    designation: "attendee",
    data: {
      room_id: "test",
      username: "st1",
    },
  });
  await pause(2000);

  // add_questions
  send({
    request_type: "add_questions",
    data: {
      user: "test",
      room_id: "test_room",
      questions: [
        {
          id: "1",
          question: "What is the first question?",
          options: [
            "The first option",
            "The second option",
            "The third option",
            "The fourth option",
          ],
          answer: 0,
        },
        {
          id: "2",
          question: "What is the second question?",
          options: [
            "The first option",
            "The second option",
            "The third option",
            "The fourth option",
          ],
          answer: 1,
        },
        {
          id: "3",
          question: "What is the third question?",
          options: [
            "The first option",
            "The second option",
            "The third option",
            "The fourth option",
          ],
          answer: 2,
        },
        {
          id: "4",
          question: "What is the fourth question?",
          options: [
            "The first option",
            "The second option",
            "The third option",
            "The fourth option",
          ],
          answer: 3,
        },
      ],
    },
  });
  await pause(2000);

  /* Test Attendee Logic */
  // answer_question
  send({
    request_type: "answer_question",
    data: {
      AnswerQuestion: {
        user: "test_attendee",
        room_id: "test_room",
        question_id: "1",
        answer: 0,
      },
    },
  });
  await pause(2000);

  log("test", "Test completed");
}
