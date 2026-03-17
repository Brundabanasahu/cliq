import prisma from "../lib/db.js";

export class ChatService{
    /**
     * Create a new conversation
     * @param {string} userId - User ID
     * @param {string} mode - chat,tool, or agent
     * @param {string} title - optional conversation title
     */


    async createConversation(userId,mode="chat",title=null){
        return prisma.conversation.create({
            data:{
                userId,
                mode,
                title:title || 'New ${mode} conversation'
            }
        })
    }

     /**
     * Create a new conversation
     * @param {string} userId - User ID
     * @param {string} conversationId - Optional conversation ID
     * @param {string} title - chat,tool or agent
     */

     async getOrCreateConversation(userId,conversationId=null,mode="chat"){
        if(conversationId){
            const conversation=await prisma.conversation.findFirst({
                where:{
                    id:conversationId,
                    userId
                },
                include:{
                    messages:{
                        orderBy:{
                            createdAt:"asc"
                        }
                    }
                }
            });

            if(conversation) return conversation
        }
        return await this.createConversation(userId,mode)
     }

        
     /**
      * @param {string} conversationId - conversation ID
      * @param {string} role - user,assistant, system,tool
      * @param {string|object} content - message content
      * 
      * 
      */
}