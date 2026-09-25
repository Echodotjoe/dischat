const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const TXT_FILE = path.join(__dirname, 'chat_history.txt');
const EXPIRATION_MS = 7 * 60 * 1000; // 7 minutes in milliseconds

let messages = [];

// Load existing chat history from txt on startup
function loadMessagesFromFile() {
  if (!fs.existsSync(TXT_FILE)) {
    fs.writeFileSync(TXT_FILE, '', 'utf8');
    return;
  }

  try {
    const fileContent = fs.readFileSync(TXT_FILE, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const now = Date.now();

    messages = lines
      .map(line => {
        try { return JSON.parse(line); } catch (e) { return null; }
      })
      .filter(msg => msg && (now - msg.timestamp < EXPIRATION_MS));

    saveMessagesToFile();
  } catch (err) {
    console.error('Error loading chat history:', err);
    messages = [];
  }
}

// Rewrite chat_history.txt with current active messages
function saveMessagesToFile() {
  try {
    const fileData = messages.map(msg => JSON.stringify(msg)).join('\n');
    fs.writeFileSync(TXT_FILE, fileData, 'utf8');
  } catch (err) {
    console.error('Error saving chat history to txt file:', err);
  }
}

// Delete messages sent 7+ minutes ago and update clients
function pruneOldMessages() {
  const now = Date.now();
  const initialLength = messages.length;
  messages = messages.filter(msg => now - msg.timestamp < EXPIRATION_MS);

  if (messages.length !== initialLength) {
    saveMessagesToFile();
    io.emit('chat_history', messages);
  }
}

// Run initial load & start pruning timer
loadMessagesFromFile();
setInterval(pruneOldMessages, 5000);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  pruneOldMessages();
  socket.emit('chat_history', messages);

  socket.on('send_message', (data) => {
    const username = (data.username || 'Anonymous').trim().slice(0, 25) || 'Anonymous';
    const text = (data.text || '').trim();

    if (!text) return;

    const newMessage = {
      id: Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      username: username,
      text: text,
      timestamp: Date.now()
    };

    messages.push(newMessage);
    saveMessagesToFile();

    io.emit('new_message', newMessage);
  });
});

server.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
});
