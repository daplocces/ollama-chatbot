import { appState } from "./state.js";
import { createConversation, loadConversations, saveConversations, filterConversations, getRelevantConversationMatches } from "./utils/conversations.js";
import { makeTitle } from "./utils/titles.js";
import { appendActionButtons } from "./message-actions.js";

const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const conversationList = document.getElementById("conversationList");
const newConversationButton = document.getElementById("newConversation");
const activeConversationTitle = document.getElementById("activeConversationTitle");
const sendButton = form.querySelector("button");
const storageKey = "my-chatbot-conversations";

appState.storageKey = storageKey;
appState.conversations = loadConversations(storageKey);
appState.activeConversationId = appState.conversations[0]?.id ?? null;
appState.editingConversationId = null;
appState.isSending = false;

function getActiveConversation() {
  return appState.conversations.find((conversation) => conversation.id === appState.activeConversationId);
}

function saveCurrentConversations() {
  saveConversations(appState.conversations, appState.storageKey);
}

function renderConversationList() {
  conversationList.replaceChildren();
  const visible = filterConversations(appState.conversations);

  for (const conversation of visible) {
    const row = document.createElement("div");
    row.className = "conversation-row";

    if (appState.editingConversationId === conversation.id) {
      const renameInput = document.createElement("input");
      renameInput.className = "rename-input";
      renameInput.value = conversation.title;
      renameInput.onblur = () => finishRename(conversation.id, renameInput.value);
      renameInput.onkeydown = (event) => {
        if (event.key === "Enter") renameInput.blur();
        if (event.key === "Escape") {
          appState.editingConversationId = null;
          renderConversationList();
        }
      };
      row.appendChild(renameInput);
      conversationList.appendChild(row);
      requestAnimationFrame(() => { renameInput.focus(); renameInput.select(); });
      continue;
    }

    const openButton = document.createElement("button");
    openButton.className = "conversation-button" + (conversation.id === appState.activeConversationId ? " active" : "");
    openButton.textContent = conversation.title;
    openButton.disabled = appState.isSending;
    openButton.onclick = () => {
      appState.activeConversationId = conversation.id;
      renderConversationList();
      renderMessages();
    };

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(createAction("✎", "Rename", () => {
      appState.editingConversationId = conversation.id;
      renderConversationList();
    }));
    actions.append(createAction("×", "Delete", () => deleteConversation(conversation.id)));
    row.append(openButton, actions);
    conversationList.appendChild(row);
  }

  if (visible.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "conversation-empty";
    emptyState.textContent = "No matching conversations";
    conversationList.appendChild(emptyState);
  }
}

function createAction(icon, label, action) {
  const button = document.createElement("button");
  button.className = "action";
  button.textContent = icon;
  button.setAttribute("aria-label", label);
  button.disabled = appState.isSending;
  button.onclick = action;
  return button;
}

function renderMessages() {
  messages.replaceChildren();
  const active = getActiveConversation();
  if (!active) return;

  activeConversationTitle.textContent = active.title;
  const msgs = active.messages;
  for (let i = 0; i < msgs.length; i++) {
    const message = msgs[i];
    addMessage(message.content, message.role, i);
  }
}

function addMessage(text, role, index) {
  const element = document.createElement("div");
  element.className = "message " + role;

  if (role === "assistant") {
    element.innerHTML = DOMPurify.sanitize(marked.parse(text));
  } else {
    element.textContent = text;
  }

  messages.appendChild(element);

  if (role === "assistant") {
    appendActionButtons(element, getActiveConversation().id, index);
  }

  messages.scrollTop = messages.scrollHeight;
  return element;
}

function addThinkingMessage() {
  const element = document.createElement("div");
  element.className = "message assistant";
  element.innerHTML = '<span class="thinking-dots"><span></span><span></span><span></span></span>';
  messages.appendChild(element);
  messages.scrollTop = messages.scrollHeight;
  return element;
}

function normalizeInlineMarkdown(html) {
  return html
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(ul|ol|li|blockquote|pre|code|h[1-6]|table|thead|tbody|tr|td|th)[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureTypingCursor(element) {
  let cursor = element.querySelector(".typing-cursor");
  if (!cursor) {
    cursor = document.createElement("span");
    cursor.className = "typing-cursor";
    cursor.textContent = "|";
    cursor.setAttribute("aria-hidden", "true");
    element.appendChild(cursor);
  }
  return cursor;
}

function removeTypingCursor(element) {
  const cursor = element.querySelector(".typing-cursor");
  if (cursor) cursor.remove();
}

async function typewriteMessage(element, text, conversationId, assistantIndex) {
  const characters = Array.from(text);
  const delay = characters.length > 600 ? 10 : 24;
  element.classList.add("typing");
  element.textContent = "";

  for (let i = 0; i < characters.length; i++) {
    const current = characters.slice(0, i + 1).join("");
    const html = normalizeInlineMarkdown(DOMPurify.sanitize(marked.parse(current)));
    element.innerHTML = html + '<span class="typing-cursor" aria-hidden="true">|</span>';
    messages.scrollTop = messages.scrollHeight;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  element.classList.remove("typing");
  removeTypingCursor(element);
  element.innerHTML = DOMPurify.sanitize(marked.parse(text));
  appendActionButtons(element, conversationId, assistantIndex);
}

function setSending(value) {
  appState.isSending = value;
  input.disabled = value;
  sendButton.disabled = value;
  newConversationButton.disabled = value;
  renderConversationList();
}

function finishRename(id, value) {
  const conversation = appState.conversations.find((item) => item.id === id);
  const title = value.replace(/\s+/g, " ").trim();
  if (conversation && title) {
    conversation.title = title.slice(0, 48);
    saveCurrentConversations();
  }
  appState.editingConversationId = null;
  renderConversationList();
  renderMessages();
}

function deleteConversation(id) {
  if (appState.isSending) return;

  appState.conversations = appState.conversations.filter((conversation) => conversation.id !== id);
  if (appState.conversations.length === 0) appState.conversations = [createConversation()];
  if (appState.activeConversationId === id) appState.activeConversationId = appState.conversations[0].id;

  saveCurrentConversations();
  renderConversationList();
  renderMessages();
}

function showRetry(element, error, conversationId) {
  element.classList.add("error");
  element.replaceChildren();

  const text = document.createElement("span");
  text.textContent = "Could not get a reply: " + error.message;

  const button = document.createElement("button");
  button.className = "retry";
  button.textContent = "Retry";
  button.onclick = () => {
    if (!appState.isSending && appState.activeConversationId === conversationId) askOllama(getActiveConversation());
  };

  element.append(text, button);
}

async function askOllama(conversation) {
  const pending = addThinkingMessage();
  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3.2", messages: conversation.messages.slice(-10), stream: false })
    });
    if (!response.ok) throw new Error("Ollama replied with: " + response.status);

    const data = await response.json();
    const reply = data.message.content;
    conversation.messages.push({ role: "assistant", content: reply });
    saveCurrentConversations();

    const assistantIndex = conversation.messages.length - 1;
    await typewriteMessage(pending, reply, conversation.id, assistantIndex);
  } catch (error) {
    showRetry(pending, error, conversation.id);
  } finally {
    setSending(false);
  }
}

form.onsubmit = async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || appState.isSending) return;

  setSending(true);
  const conversation = getActiveConversation();
  if (conversation.messages.length === 0) {
    conversation.title = makeTitle(text);
  }

  conversation.messages.push({ role: "user", content: text });
  input.value = "";
  saveCurrentConversations();
  renderConversationList();
  renderMessages();
  await askOllama(conversation);
};

newConversationButton.onclick = () => {
  if (appState.isSending) return;
  const conversation = createConversation();
  appState.conversations.unshift(conversation);
  appState.activeConversationId = conversation.id;
  saveCurrentConversations();
  renderConversationList();
  renderMessages();
  input.focus();
};

appState.renderConversationList = renderConversationList;
appState.renderMessages = renderMessages;
appState.saveConversations = saveCurrentConversations;
appState.askOllama = askOllama;

renderConversationList();
renderMessages();
