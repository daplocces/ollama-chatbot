export function createConversation() {
  return { id: crypto.randomUUID(), title: "New chat", messages: [] };
}

export function loadConversations(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {
    // Start fresh when saved data is unavailable or invalid.
  }

  return [createConversation()];
}

export function saveConversations(conversations, storageKey) {
  localStorage.setItem(storageKey, JSON.stringify(conversations));
}

export function filterConversations(conversations, searchValue = "") {
  const normalized = (searchValue || "").trim().toLowerCase();
  if (!normalized) return conversations;

  return conversations.filter((conversation) => {
    const haystack = [conversation.title, ...((conversation.messages || []).map((message) => message.content))]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function getRelevantConversationMatches(conversations, searchText) {
  const value = (searchText || "").trim().toLowerCase();
  if (!value) return [];

  return conversations
    .map((conversation) => {
      const text = [conversation.title, ...((conversation.messages || []).map((message) => message.content))].join(" ").toLowerCase();
      const score = text.includes(value) ? 1 : 0;
      return { conversation, score };
    })
    .filter((entry) => entry.score > 0)
    .slice(0, 5)
    .map((entry) => entry.conversation);
}

export function getConversationCategory(conversation) {
  const text = (conversation.messages || []).map((message) => `${message.role}: ${message.content}`).join(" \n");
  if (!text) return "Personal";
  if (/code|debug|error|api|function|react|javascript|typescript|python|sql|bug|fix|cli|build|test/i.test(text)) return "Coding";
  if (/research|study|market|trend|analysis|report|compare|paper|book|summary|learn|research/i.test(text)) return "Research";
  if (/sales|pitch|client|launch|product|strategy|budget|brand|business|marketing|growth/i.test(text)) return "Business";
  return "Personal";
}
