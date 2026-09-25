// Connect to a free, public, keyless WebSocket broker
const BROKER_URL = 'wss://broker.emqx.io:8884/mqtt';
const CHAT_TOPIC = 'gh_pages_discord_blue_chat_room_v1';

const client = mqtt.connect(BROKER_URL);

let localMessages = [];
const EXPIRATION_MS = 7 * 60 * 1000; // 7 Minutes

// DOM Elements
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const nameStatusBadge = document.getElementById('name-status-badge');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const exportTxtBtn = document.getElementById('export-txt-btn');

// --- Cookie Storage Helpers ---
function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

// Load Name from Cookie
let currentUsername = getCookie('chat_username');
if (!currentUsername) {
  currentUsername = 'User_' + Math.floor(1000 + Math.random() * 9000);
  setCookie('chat_username', currentUsername);
}
usernameInput.value = currentUsername;

// Top-Left Confirm Name Button
saveUsernameBtn.addEventListener('click', () => {
  const newName = usernameInput.value.trim();
  if (newName) {
    currentUsername = newName;
    setCookie('chat_username', currentUsername);

    nameStatusBadge.textContent = 'Saved!';
    setTimeout(() => { nameStatusBadge.textContent = 'Saved'; }, 2000);
  }
});

// --- MQTT WebSocket Real-Time Connection ---
client.on('connect', () => {
  client.subscribe(CHAT_TOPIC);
});

client.on('message', (topic, payload) => {
  try {
    const msg = JSON.parse(payload.toString());
    const now = Date.now();

    // Ignore if already older than 7 minutes upon arrival
    if (now - msg.timestamp < EXPIRATION_MS) {
      localMessages.push(msg);
      renderAllMessages();
    }
  } catch (e) {
    console.error("Invalid message format", e);
  }
});

// Send Message
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  const msgPayload = {
    id: Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    username: currentUsername,
    text: text,
    timestamp: Date.now()
  };

  client.publish(CHAT_TOPIC, JSON.stringify(msgPayload));
  messageInput.value = '';
});

// --- Auto-delete messages sent 7+ minutes ago ---
setInterval(() => {
  const now = Date.now();
  const initialCount = localMessages.length;

  localMessages = localMessages.filter(msg => now - msg.timestamp < EXPIRATION_MS);

  if (localMessages.length !== initialCount) {
    renderAllMessages();
  }
}, 3000); // Checks every 3 seconds

// --- Export to TXT Document ---
exportTxtBtn.addEventListener('click', () => {
  if (localMessages.length === 0) {
    alert("No active messages in the last 7 minutes to export.");
    return;
  }

  const fileContent = localMessages
    .map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.username}: ${m.text}`)
    .join('\n');

  const blob = new Blob([fileContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat_log_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

// --- Render Helpers ---
function renderAllMessages() {
  messagesContainer.innerHTML = '';
  localMessages.forEach(msg => {
    messagesContainer.appendChild(createMessageElement(msg));
  });
  scrollToBottom();
}

function createMessageElement(msg) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message-item';
  const initial = (msg.username || 'A').charAt(0).toUpperCase();

  msgEl.innerHTML = `
    <div class="avatar">${initial}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="author-name">${escapeHtml(msg.username)}</span>
        <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="message-text">${escapeHtml(msg.text)}</div>
    </div>
  `;
  return msgEl;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
