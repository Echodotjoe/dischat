// Connect to HiveMQ Public WebSocket Broker over SSL
const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const CHAT_TOPIC = 'discord_blue_ghpages_chat_v2';

let localMessages = [];
const EXPIRATION_MS = 7 * 60 * 1000; // 7 Minutes

// DOM Elements
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const nameStatusBadge = document.getElementById('name-status-badge');
const connStatus = document.getElementById('conn-status');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
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

// --- MQTT Connection Initialization ---
const clientId = 'client_' + Math.random().toString(16).substr(2, 8);
const client = mqtt.connect(BROKER_URL, {
  clientId: clientId,
  keepalive: 60,
  clean: true,
  reconnectPeriod: 1000
});

client.on('connect', () => {
  connStatus.textContent = 'Connected';
  connStatus.className = 'conn-badge connected';
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.placeholder = "Message #global-chat...";

  client.subscribe(CHAT_TOPIC, { qos: 0 }, (err) => {
    if (err) console.error("Subscription Error:", err);
  });
});

client.on('reconnect', () => {
  connStatus.textContent = 'Reconnecting...';
  connStatus.className = 'conn-badge connecting';
});

client.on('offline', () => {
  connStatus.textContent = 'Offline';
  connStatus.className = 'conn-badge disconnected';
  messageInput.disabled = true;
  sendBtn.disabled = true;
});

client.on('error', (err) => {
  console.error("MQTT Error:", err);
  connStatus.textContent = 'Connection Error';
  connStatus.className = 'conn-badge disconnected';
});

// Incoming Messages
client.on('message', (topic, payload) => {
  try {
    const msg = JSON.parse(payload.toString());
    const now = Date.now();

    // Prevent duplicates
    if (!localMessages.some(m => m.id === msg.id) && (now - msg.timestamp < EXPIRATION_MS)) {
      localMessages.push(msg);
      renderAllMessages();
    }
  } catch (e) {
    console.error("Failed to parse message", e);
  }
});

// Send Message
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || messageInput.disabled) return;

  const msgPayload = {
    id: Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    username: currentUsername,
    text: text,
    timestamp: Date.now()
  };

  // Publish message to public room
  client.publish(CHAT_TOPIC, JSON.stringify(msgPayload), { qos: 0 });

  messageInput.value = '';
});

// --- Auto-delete messages older than 7 minutes ---
setInterval(() => {
  const now = Date.now();
  const initialCount = localMessages.length;

  localMessages = localMessages.filter(msg => now - msg.timestamp < EXPIRATION_MS);

  if (localMessages.length !== initialCount) {
    renderAllMessages();
  }
}, 3000);

// --- Export Active Messages to .txt ---
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

// --- UI Rendering ---
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
