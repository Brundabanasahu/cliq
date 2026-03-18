  import chalk from "chalk";
  import boxen from "boxen";
  import {text,isCancel,cancel,intro,outro} from "@clack/prompts";
  import yoctoSpinner from "yocto-spinner";
  import {marked} from "marked";
  import {markedTerminal} from "marked-terminal";
  import {AIService} from "../ai/google-service.js"
  import {chatService} from "../../service/chat.service.js"
  import {getStoredToken} from "../commands/auth/login.js";
  import prisma from "../../lib/db.js";


marked.use(
  markedTerminal({
  // Styling options for terminal output
  code: chalk.cyan,
  blockquote: chalk.gray.italic,
  heading: chalk.green.bold,
  firstHeading: chalk.magenta.underline.bold,
  hr: chalk.reset,
  listitem: chalk.reset,
  list: chalk.reset,
  paragraph: chalk.reset,
  strong: chalk.bold,
  em: chalk.italic,
  codespan: chalk.yellow.bgBlack,
  del: chalk.dim.gray.strikethrough,
  link: chalk.blue.underline,
  href: chalk.blue.underline,
})
);


const aiService=new AIService()
const chatService=new ChatService()


async function getUserFromToken(){
    const token=await getStoredToken()
    if(!token?.access_token){
        throw new error("Not authenticated.please run 'cliq login' first.");

    }
    const spinner=yoctoSpinner({text:"Authenticating..."}).start();
    const user=await prisma.user.findFirst({
        where:{
            sessions:{
                some:{token:token.access_token},
            },
        },
    }) ; 
    
    if(!user){
        spinner.error("User not found");
        throw new Error("User not found.please login again");
    }
    spinner.success('Welcome back,${user.name}!')
    return user;
}


async function initConversation(userId,conversationId=null,mode="chat"){
    const spinner=yoctoSpinner({ text:"Loading conversation..."}).start();

    const conversation= await chatService.getOrCreateconversation(
        userId,
        conversationId,
        mode
    )
    spinner.success("Conversation Loaded")
    const conversationInfo=boxen(
        '${chalk.bold("Conversation")}:${conversation.title}\n${chalk.gray("ID: "+conversation.id)}\n${chalk.gray("mode: "+conversation,mode)}',
        {
            padding:1,
            margin:{top:1,bottom:1},
            borderStyle:"round",
            borderColor:"cyan",
            title:"Chat Session",
            titleAlignment:"center",
        }
    );
    console.log(conversationinfo)

    if(conversation.messages?.length>0){
        console.log(chalk.yellow("previous messages:\n"));
        displayMessages(conversation.messages);
    }
    return conversation

    function displayMessages(messages) {
  messages.forEach((msg) => {
    if (msg.role === "user") {
      const userBox = boxen(chalk.white(msg.content), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "blue",
        title: "👤 You",
        titleAlignment: "left",
      });

      console.log(userBox);
    } else {
      // Render markdown for assistant messages
      const renderedContent = marked.parse(msg.content);
      const assistantBox = boxen(renderedContent.trim(), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: "🤖 Assistant",
        titleAlignment: "left",
      });

      console.log(assistantBox);
    }
  });
}
async function saveMessage(conversationId, role, content) {
  return await chatService.addMessage(conversationId, role, content);
}

async function updateConversationTitle(conversationId, userInput, messageCount) {
  if (messageCount === 1) {
    const title =
      userInput.slice(0, 50) + (userInput.length > 50 ? "..." : "");
    await chatService.updateTitle(conversationId, title);
  }
}
async function chatLoop(conversation) {
  const helpBox = boxen(
    `${chalk.gray("• Type your message and press Enter")}\n${chalk.gray("• Markdown formatting is supported in responses")}\n${chalk.gray("• Type \"exit\" to end conversation")}\n${chalk.gray("• Press Ctrl+C to quit anytime")}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "gray",
      dimBorder: true,
    }
  );
}

}































export async function startChat(mode="chat",conversationId=null){
    try{
        intro(
            boxen(chalk.bold.cyan("Orbital AI Chat"),{
            padding:1,
            borderStyle:"double",
            borderColor:"cyan"
            })
        )
        const user=await getUserfromToken()
        const conversation=await initConversation(user.id,conversationId,mode);
        await chatLoop(conversation)
        
        outro(chalk.green('Thanks for chatting'))
    }catch(error){
        const errorBox=boxen(chalk.red('Error:${error.message}'),{
            padding:1,
            margin:1,
            borderStyle:"round",
            bordercolor:"red",
        });
        console.log(errorBox);
        process.exit(1);
    }
}
































