const stdout = document.querySelector('pre');
function log(type, message) {
  stdout.textContent += `[${new Date().toISOString()}] (${type}): ${message}\n\n`;
}
async function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const proto = location.protocol.startsWith('https') ? 'wss' : 'ws';
const websocket = new WebSocket(
  `${proto}://${window.location.host}/ws`,
);

websocket.onopen = () => {
  log("ws", "connection established");
};

websocket.onclose = () => {
  log("ws", "connection closed");
};

websocket.onmessage = (e) => {
  const response = JSON.parse(e.data);
  log('message', JSON.stringify(response, null, 2));
  onResponse(response);
};

function onResponse(data) {

}

function send(data) {
  log('send', JSON.stringify(data, null, 2));
  websocket.send(JSON.stringify(data));
}
