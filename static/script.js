const stdout = document.querySelector("pre");
function log(type, message) {
  stdout.textContent += `[${new Date().toISOString()}] (${type}): ${message}\n\n`;
}
async function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const proto = location.protocol.startsWith("https") ? "wss" : "ws";
const websocket = new WebSocket(`${proto}://127.0.0.1:8080/`);
// const websocket = new WebSocket("https://kwiz-ws.shuttleapp.rs:8080");

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
    room_id: "test",
    username: "st1",
    userId: "blah",
  });
  await pause(100);

  // host_room
  send({
    request_type: "host_room",
    designation: "organizer",
    roomId: "test_room",
    userId: "abc1",
  });
  await pause(100);

  // attendee register
  send({
    request_type: "register_user",
    designation: "attendee",
    roomId: "test_room",
    username: "st1",
    userId: "blasstr",
  });
  await pause(100);

  // add_questions
  send({
    request_type: "add_question",
    designation: "organizer",
    roomId: "test_room",
    question: "What is the first question?",
    options: [
      "The first option",
      "The second option",
      "The third option",
      "The fourth option",
    ],
  });
  await pause(100);

  send({
    request_type: "submit_answer",
    designation: "organizer",
    roomId: "test_room",
    answer: 0,
  });
  await pause(100);

  log("test", "Test completed");

  return;
}
