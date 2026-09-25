const socket = io();

const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const nameStatusBadge = document.getElementById('name-status-badge');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');

// Cookie Read/Write Helpers
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

// Get nickname from cookie or assign default
let currentUsername = getCookie('chat_username');
if (!currentUsername) {
  currentUsername = 'User_' + Math.floor(1000 + Math.random() * 9000);
  setCookie('chat_username', currentUsername);
}
usernameInput.value = currentUsername;

// Confirm & Save Name in Cookie
saveUsernameBtn.addEventListener('click', () => {
  const newName = usernameInput.value.trim();
  if (newName) {
    currentUsername = newName;
    setCookie('chat_username', currentUsername);

    nameStatusBadge.textContent = 'Saved!';
    setTimeout(() => {
      nameStatusBadge.textContent = 'Saved';
    }, 2000);
  }
});

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function renderMessage(msg) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message-item';

  const initial = (msg.username || 'A').charAt(0).toUpperCase();

  msgEl.innerHTML = `
    <div class="avatar">${initial}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="author-name">${escapeHtml(msg.username)}</span>
        <span class="timestamp">${formatTime(msg.timestamp)}</span>
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

// Receive updated history (when connecting or when messages auto-delete after 7 mins)
socket.on('chat_history', (messages) => {
  messagesContainer.innerHTML = '';
  messages.forEach(msg => messagesContainer.appendChild(renderMessage(msg)));
  scrollToBottom();
});

// Receive single new message
socket.on('new_message', (msg) => {
  messagesContainer.appendChild(renderMessage(msg));
  scrollToBottom();
});

// Send message
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  socket.emit('send_message', {
    username: currentUsername,
    text: text
  });

  messageInput.value = '';
});

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
