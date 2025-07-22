import express from "express";
import cors from "cors";
import sequelize from "./db.js";
import Chat from "./models/Chat.js";
import Message from "./models/Message.js";

const activeStreams = new Map();
const port = 3001;
const app = express();
app.use(cors());
app.use(express.json());

// Replace your current CORS setup with this:
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://192.168.0.175:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Start server with database sync
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    // Sync all models (creates tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log("✅ Database tables synced successfully!");

    // Start the server
    app.listen(port, () => {
      console.log(`🚀 Backend server running on port ${port}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

//////API END POINTS START////////

// Basic health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// endpoint to Create new chat
app.post("/api/chat", async (req, res) => {
  try {
    const newChat = await Chat.create({
      title: "New Chat",
    });

    res.json({
      chatId: newChat.id,
      title: newChat.title,
      created_at: newChat.created_at,
    });
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

// endpoint to Get list of past chat sessions
app.get("/api/chats", async (req, res) => {
  try {
    const chats = await Chat.findAll({
      order: [["created_at", "DESC"]], // Most recent first
      attributes: ["id", "title", "created_at"],
    });

    res.json(chats);
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// end point to Get full message history
app.get("/api/chat/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;

    const messages = await Message.findAll({
      where: { chat_id: chatId },
      order: [["timestamp", "ASC"]], // Chronological order
      attributes: ["id", "role", "content", "timestamp"],
    });

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// endpoint to Send message & stream reply
app.post("/api/chat/:chatId/message", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    // Create AbortController for this request
    const controller = new AbortController();
    activeStreams.set(chatId, controller);

    // Save user message to database
    const userMessage = await Message.create({
      chat_id: chatId,
      role: "user",
      content: content,
      timestamp: new Date(),
    });

    // Check if this is the first message and update chat title
    const messageCount = await Message.count({
      where: { chat_id: chatId },
    });

    if (messageCount === 1) {
      const title =
        content.length > 30 ? content.substring(0, 30) + "..." : content;

      await Chat.update({ title: title }, { where: { id: chatId } });
    }

    // Set up streaming response
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    try {
      // Send request to Ollama with abort signal
      const ollamaResponse = await fetch(
        "http://127.0.0.1:11434/api/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gemma3:1b",
            prompt: content,
            stream: true,
          }),
          signal: controller.signal, // This enables cancellation
        }
      );

      let assistantResponse = "";
      const reader = ollamaResponse.body.getReader();

      // Stream response back to client
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            // Only write if response exists AND is not empty
            if (parsed.response && parsed.response.length > 0) {
              assistantResponse += parsed.response;
              res.write(parsed.response);
            }
            // Stop streaming when done
            if (parsed.done) {
              break;
            }
          } catch (e) {
            // Skip invalid JSON
            console.log("JSON parse error:", e.message);
          }
        }
      }

      // Save assistant response to database
      await Message.create({
        chat_id: chatId,
        role: "assistant",
        content: assistantResponse,
        timestamp: new Date(),
      });

      res.end();
    } catch (error) {
      if (error.name === "AbortError") {
        // Stream was cancelled
        res.write("\n[Stream stopped by user]");
        res.end();
      } else {
        throw error;
      }
    } finally {
      // Clean up: remove from active streams
      activeStreams.delete(chatId);
    }
  } catch (error) {
    console.error("Error in message endpoint:", error);
    activeStreams.delete(chatId); // Clean up on error
    res.status(500).json({ error: "Failed to process message" });
  }
});

// endpoint to Stop streaming response
app.post("/api/chat/:chatId/stop", async (req, res) => {
  try {
    const { chatId } = req.params;

    // Check if there's an active stream for this chat
    const controller = activeStreams.get(chatId);

    if (controller) {
      // Cancel the streaming request
      controller.abort();
      activeStreams.delete(chatId);

      res.json({
        message: "Stream stopped successfully",
        chatId: chatId,
        timestamp: new Date(),
        status: "stopped",
      });
    } else {
      res.json({
        message: "No active stream found for this chat",
        chatId: chatId,
        timestamp: new Date(),
        status: "no_stream",
      });
    }
  } catch (error) {
    console.error("Error stopping stream:", error);
    res.status(500).json({ error: "Failed to stop stream" });
  }
});

// Endpoint to Rename chat
app.put("/api/chat/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { title } = req.body;

    await Chat.update({ title: title }, { where: { id: chatId } });

    res.json({
      message: "Chat renamed successfully",
      chatId: chatId,
      title: title,
    });
  } catch (error) {
    console.error("Error renaming chat:", error);
    res.status(500).json({ error: "Failed to rename chat" });
  }
});

// Endpoint to Delete chat
app.delete("/api/chat/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;

    // First delete all messages in this chat
    await Message.destroy({
      where: { chat_id: chatId },
    });

    // Then delete the chat itself
    await Chat.destroy({
      where: { id: chatId },
    });

    res.json({
      message: "Chat deleted successfully",
      chatId: chatId,
    });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});
//////API END POINTS ENDS////////
