import prisma from "../lib/db.js";

export class ChatService {
  /**
   * Create a new conversation
   * @param {string} userId - User ID
   * @param {string} mode - chat, tool, or agent
   * @param {string|null} title - Optional conversation title
   * @returns {Promise<Object>} Created conversation
   */
  async createConversation(userId, mode = "chat", title = null) {
    return prisma.conversation.create({
      data: {
        userId,
        mode,
        title: title || `New ${mode} conversation`,
      },
    });
  }

  /**
   * Get existing conversation or create a new one
   * @param {string} userId - User ID
   * @param {string|null} conversationId - Conversation ID (optional)
   * @param {string} mode - chat, tool, or agent
   * @returns {Promise<Object>} Conversation with messages
   */
  async getOrCreateConversation(userId, conversationId = null, mode = "chat") {
    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc"
            },
          },
        },
      });

      if (conversation) return conversation;
    }

    return await this.createConversation(userId, mode);
  }

  /**
   * Add a message to a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} role - user, assistant, system, tool
   * @param {string|Object} content - Message content
   * @returns {Promise<Object>} Created message
   */
  async addMessage(conversationId, role, content) {
    const contentStr =
      typeof content === "string" ? content : JSON.stringify(content);

    const message = await prisma.message.create({
      data: {
        conversationId,
        role,
        content: contentStr,
      },
    });


    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  /**
   * Get all messages of a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} List of messages
   */
  async getMessages(conversationId) {
    const messages= await prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return messages.map((msg)=>({
      ...msg,
      content:this.parseContent(msg.content),
    }));
  }

  /**
   * Get all conversations of a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of conversations
   */
  async getUserConversation(userId) {
    return await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1, // only latest message
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
  }

  /**
   * Delete a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteConversation(conversationId, userId) {
    return await prisma.conversation.deleteMany({
      where: {
        id: conversationId,
        userId,
      },
    });
  }

  /**
   * Update conversation title
   * @param {string} conversationId - Conversation ID
   * @param {string} title - New title
   * @returns {Promise<Object>} Updated conversation
   */
  async updateTitle(conversationId, title) {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  parseContent(content){
    try{
      return JSON.parse(content);
    }catch{
      return content;
    }
  }

formatMessagesForAI(messages) {
  return messages.map((msg) => ({
    role: msg.role,
    content:
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
        ? msg.content.map((c) => c.text).join(" ")
        : "",
  }));
}
}