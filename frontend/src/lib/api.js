const API_BASE_URL = "http://localhost:3001/api";

export const chatAPI = {
  // Create new chat
  createChat: async () => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
    });
    return response.json();
  },

  // Send message with streaming
  sendMessage: async (chatId, content) => {
    return fetch(`${API_BASE_URL}/chat/${chatId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  },

  // Get chat list
  getChats: async () => {
    const response = await fetch(`${API_BASE_URL}/chats`);
    return response.json();
  },

  // Get chat messages
  getChatMessages: async (chatId) => {
    const response = await fetch(`${API_BASE_URL}/chat/${chatId}`);
    return response.json();
  },

  // Rename chat
  renameChat: async (chatId, newTitle) => {
    const response = await fetch(`${API_BASE_URL}/chat/${chatId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    return response.json();
  },

  // Delete chat
  deleteChat: async (chatId) => {
    const response = await fetch(`${API_BASE_URL}/chat/${chatId}`, {
      method: "DELETE",
    });
    return response.json();
  },
};
