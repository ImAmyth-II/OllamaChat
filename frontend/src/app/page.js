"use client";
import { useState, useEffect } from "react";
import { chatAPI } from "../lib/api";
import ReactMarkdown from "react-markdown";
export default function ChatApp() {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  // rename and delete input fields
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [renameInputValue, setRenameInputValue] = useState("");
  useEffect(() => {
    const loadExistingChats = async () => {
      try {
        const existingChats = await chatAPI.getChats();
        setChats(existingChats);

        // Optionally set the first chat as active
        if (existingChats.length > 0 && !currentChatId) {
          setCurrentChatId(existingChats[0].id || existingChats[0].chatId);
        }
      } catch (error) {
        console.error("Error loading existing chats:", error);
      }
    };

    loadExistingChats();
  }, []); // empty dependency array means this runs once when component mounts

  // esc key listner
  useEffect(() => {
    const handleEscKey = async (e) => {
      if (e.key === "Escape" && currentChatId) {
        try {
          await fetch(`http://localhost:3001/api/chat/${currentChatId}/stop`, {
            method: "POST",
          });
          console.log("Stream stopped by ESC key");
        } catch (error) {
          console.error("Error stopping stream:", error);
        }
      }
    };

    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [currentChatId]);

  // Create new chat
  const handleNewChat = async () => {
    try {
      const newChat = await chatAPI.createChat();
      setChats([newChat, ...chats]);
      setCurrentChatId(newChat.chatId);
      setMessages([]);
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  // Send message function
  const handleSendMessage = async () => {
    if (!currentChatId || !inputValue.trim()) return;

    try {
      setIsStreaming(true);
      const userMessage = { role: "user", content: inputValue.trim() };
      setMessages((prev) => [...prev, userMessage]);

      // Check if this is the first message
      const isFirstMessage = messages.length === 0;

      setInputValue("");

      const assistantMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      const response = await chatAPI.sendMessage(
        currentChatId,
        userMessage.content
      );

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        console.log("EXACT CHUNK:", JSON.stringify(chunk));

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          const updatedAssistantMessage = {
            ...newMessages[lastIndex],
            content: newMessages[lastIndex].content + chunk,
          };
          newMessages[lastIndex] = updatedAssistantMessage;
          return newMessages;
        });
      }

      // After streaming is complete
      if (isFirstMessage) {
        const updatedChats = await chatAPI.getChats();
        setChats(updatedChats);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsStreaming(false);
    }
  };

  // stop button
  const handleStopStreaming = async () => {
    try {
      await fetch(`http://localhost:3001/api/chat/${currentChatId}/stop`, {
        method: "POST",
      });
      setIsStreaming(false);
    } catch (error) {
      console.error("Error stopping stream:", error);
    }
  };

  // Handle rename chat
  const handleRenameChat = async (chatId) => {
    const currentChat = chats.find(
      (chat) => (chat.id || chat.chatId) === chatId
    );
    setSelectedChatId(chatId);
    setRenameInputValue(currentChat?.title || "");
    setShowRenameModal(true);
  };

  // Handle delete chat
  const handleDeleteChat = async (chatId) => {
    setSelectedChatId(chatId);
    setShowDeleteModal(true);
  };

  // Confirm rename action
  const confirmRename = async () => {
    if (renameInputValue.trim()) {
      try {
        await chatAPI.renameChat(selectedChatId, renameInputValue.trim());
        const updatedChats = await chatAPI.getChats();
        setChats(updatedChats);
        setShowRenameModal(false);
        setSelectedChatId(null);
        setRenameInputValue("");
      } catch (error) {
        console.error("Error renaming chat:", error);
      }
    }
  };

  // Confirm delete action
  const confirmDelete = async () => {
    try {
      await chatAPI.deleteChat(selectedChatId);
      setChats(
        chats.filter((chat) => (chat.id || chat.chatId) !== selectedChatId)
      );

      if (currentChatId === selectedChatId) {
        setCurrentChatId(null);
        setMessages([]);
      }

      setShowDeleteModal(false);
      setSelectedChatId(null);
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  // Cancel modal actions
  const cancelModal = () => {
    setShowRenameModal(false);
    setShowDeleteModal(false);
    setSelectedChatId(null);
    setRenameInputValue("");
  };

  const handleChatClick = async (chatId) => {
    try {
      setIsStreaming(false);
      setCurrentChatId(chatId);

      // Load messages for this chat
      const chatMessages = await chatAPI.getChatMessages(chatId);
      setMessages(chatMessages);
    } catch (error) {
      console.error("Error switching to chat:", error);
    }
  };

  return (
    <div className="h-screen bg-black flex">
      {/* Left Sidebar */}
      <div
        className="w-64 border-r p-4"
        style={{ backgroundColor: "#1f2020", borderRightColor: "#525252" }}
      >
        <button
          onClick={handleNewChat}
          className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 mb-4 font-medium"
        >
          New Chat
        </button>
        <div>
          <h3 className="text-sm font-medium text-white mb-2">Recent Chats</h3>
          <div className="space-y-1">
            {chats.map((chat) => (
              <div
                key={chat.id || chat.chatId}
                className="p-2 rounded cursor-pointer group relative"
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#272a2a")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                style={{ transition: "background-color 0.2s ease" }}
              >
                {/* Main chat content*/}
                <div onClick={() => handleChatClick(chat.id || chat.chatId)}>
                  <div className="text-sm font-medium text-gray-200">
                    {chat.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(chat.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Hover buttons */}
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
                  {/* Rename button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      //calls the Rename function
                      handleRenameChat(chat.id || chat.chatId);
                    }}
                    className="p-1 rounded text-white hover:text-yellow-400"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#1f2020")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                    title="Rename chat"
                  >
                    ✏️
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      //
                      handleDeleteChat(chat.id || chat.chatId);
                    }}
                    className="p-1 rounded text-white hover:text-red-400"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#1f2020")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                    title="Delete chat"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div
          className="p-4 border-b"
          style={{ backgroundColor: "#1f2020", borderBottomColor: "#525252" }}
        >
          <h2 className="font-medium text-gray-200">
            {currentChatId
              ? chats.find((chat) => (chat.id || chat.chatId) === currentChatId)
                  ?.title || "Chat"
              : "New Chat"}
          </h2>
        </div>
        <div
          className="flex-1 p-4 overflow-y-auto"
          style={{ backgroundColor: "#181b1a" }}
        >
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center text-white mt-20">
                <div className="text-lg font-medium mb-2">
                  Start a conversation
                </div>
                <div className="text-sm">
                  Ask me anything and I&apos;ll help you out
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`${
                      message.role === "user"
                        ? "text-gray-200"
                        : "text-gray-300"
                    }`}
                  >
                    <div className="font-medium mb-1">
                      {message.role === "user" ? "You:" : "Ollama:"}
                    </div>
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: "#1f2020" }}
                    >
                      <div
                        className="p-3 rounded-lg prose prose-invert prose-sm max-w-none"
                        style={{ backgroundColor: "#1f2020" }}
                      >
                        {message.role === "assistant" ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="p-4 border-t"
          style={{ backgroundColor: "#1f2020", borderTopColor: "#525252" }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex space-x-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 border text-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent pure-white-placeholder"
                style={{ backgroundColor: "#181b1a", borderColor: "#525252" }}
              />
              {isStreaming ? (
                <button
                  onClick={handleStopStreaming}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 font-medium transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleSendMessage}
                  disabled={!currentChatId || !inputValue.trim()}
                  className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
        >
          <div
            className="rounded-lg p-6 w-96 max-w-md mx-4"
            style={{ backgroundColor: "#1f2020" }}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-200">
              Rename Chat
            </h3>
            <input
              type="text"
              value={renameInputValue}
              onChange={(e) => setRenameInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRename();
                if (e.key === "Escape") cancelModal();
              }}
              className="w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter new chat title"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelModal}
                className="px-4 py-2 text-white hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRename}
                disabled={!renameInputValue.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
        >
          <div
            className="rounded-lg p-6 w-96 max-w-md mx-4"
            style={{ backgroundColor: "#1f2020", backgroundColor: "#1f2020" }}
          >
            <h3 className="text-lg font-semibold mb-2 text-gray-200">
              Delete Chat
            </h3>
            <p className="text-white mb-6">
              Are you sure you want to delete this chat? This action cannot be
              undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelModal}
                className="px-4 py-2 text-white hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
