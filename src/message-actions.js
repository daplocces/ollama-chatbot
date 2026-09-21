async function copyTextToClipboard(text) {
  if (!text) return false;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    return true;
  } catch (error) {
    console.warn("Copy failed:", error);
    return false;
  }
}

function appendActionButtons(element, conversationId, assistantIndex) {
  if (!element || element.classList.contains("typing")) return;
  if (element.nextElementSibling && element.nextElementSibling.classList.contains("message-actions")) return;

  const conversation = conversations.find((candidate) => candidate.id === conversationId);
  const replyText = conversation && conversation.messages[assistantIndex] ? conversation.messages[assistantIndex].content : "";

  const actions = document.createElement("div");
  actions.className = "message-actions";

  const redoBtn = document.createElement("button");
  redoBtn.type = "button";
  redoBtn.className = "redo";
  redoBtn.textContent = "Redo";
  redoBtn.setAttribute("aria-label", "Regenerate response");
  redoBtn.onclick = () => { regenerateAt(conversationId, assistantIndex); };

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy";
  copyBtn.textContent = "Copy";
  copyBtn.setAttribute("aria-label", "Copy response");
  copyBtn.onclick = async () => {
    const copied = await copyTextToClipboard(replyText);
    if (!copied) return;
    copyBtn.classList.add("copied");
    setTimeout(() => copyBtn.classList.remove("copied"), 1500);
  };

  actions.append(redoBtn, copyBtn);
  element.insertAdjacentElement("afterend", actions);
}

async function regenerateAt(conversationId, assistantIndex) {
  if (isSending) return;
  const conversation = conversations.find((candidate) => candidate.id === conversationId);
  if (!conversation) return;

  const keep = Math.max(0, assistantIndex);
  conversation.messages = conversation.messages.slice(0, keep);
  saveConversations();
  renderConversationList();
  renderMessages();
  await askOllama(conversation);
}
