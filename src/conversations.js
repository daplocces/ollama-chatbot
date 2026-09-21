function createConversation() {
  return { id: crypto.randomUUID(), title: "New chat", messages: [] };
}

function loadConversations() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {
    // Start fresh when saved data is unavailable or invalid.
  }

  return [createConversation()];
}

function saveConversations() {
  localStorage.setItem(storageKey, JSON.stringify(conversations));
}

function makeTitle(text) {
  if (!text) return "New chat";
  const stopwords = new Set([
    "the","a","an","and","or","but","if","to","of","in","on","for","with",
    "is","are","was","were","be","as","by","that","this","it","i","you",
    "we","they","he","she","me","my","your","our","their","so","from","at"
  ]);
  const words = text.replace(/[^\w\s]/g, " ").toLowerCase().split(/\s+/).filter(Boolean);
  const important = words.filter((word) => !stopwords.has(word));
  const source = important.length ? important : words;
  const chosen = source.slice(0, 3).map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  const title = chosen.join(" ");
  return title || "New chat";
}

async function summarizeToThreeWords(text) {
  try {
    const payload = {
      model: "llama3.2",
      messages: [
        { role: "system", content: "You are a concise title generator. Produce a short title of at most three words that summarizes the user text. Use title case. Return only the words, no punctuation, no quotes." },
        { role: "user", content: text }
      ],
      stream: false
    };

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Summarization failed: " + response.status);
    const data = await response.json();
    const result = data?.message?.content?.trim();
    if (!result) return null;

    const words = result.replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean).slice(0, 3);
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  } catch (error) {
    console.warn("Title summarization failed:", error);
    return null;
  }
}
