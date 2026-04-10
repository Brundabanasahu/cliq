import chalk from "chalk";
import boxen from "boxen";
import { text, isCancel, intro, outro } from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { AIService } from "../google-service.js";
import { ChatService } from "../../../service/chat.service.js";
import { getStoredToken } from "../../commands/auth/login.js";
import prisma from "../../../lib/db.js";



marked.setOptions({
  mangle: false,
  headerIds: false,
});


marked.use(
  markedTerminal({
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

// Services
const aiService = new AIService();
const chatService = new ChatService();

// 🔐 Get user
async function getUserFromToken() {
  const token = await getStoredToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated. Please run 'cliq login' first.");
  }

  const spinner = yoctoSpinner({ text: "Authenticating..." }).start();

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: { token: token.access_token },
      },
    },
  });

  if (!user) {
    spinner.error("User not found");
    throw new Error("User not found. Please login again.");
  }

  spinner.success(`Welcome back, ${user.name}!`);
  return user;
}


async function initConversation(userId, conversationId = null, mode = "chat") {
  const spinner = yoctoSpinner({ text: "Loading conversation..." }).start();

  const conversation = await chatService.getOrCreateConversation(
    userId,
    conversationId,
    mode
  );

  spinner.success("Conversation loaded");

  console.log(
    boxen(
      `${chalk.bold("Conversation")}: ${conversation.title}\n${chalk.gray(
        "ID: " + conversation.id
      )}\n${chalk.gray("Mode: " + conversation.mode)}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "cyan",
        title: "💬 Chat Session",
        titleAlignment: "center",
      }
    )
  );

  if (conversation.messages?.length > 0) {
    console.log(chalk.yellow("📜 Previous messages:\n"));
    displayMessages(conversation.messages);
  }

  return conversation;
}


function displayMessages(messages) {
  messages.forEach((msg) => {
    if (msg.role === "user") {
      console.log(
        boxen(chalk.white(msg.content), {
          padding: 1,
          margin: { left: 2, bottom: 1 },
          borderStyle: "round",
          borderColor: "blue",
          title: "👤 You",
        })
      );
    } else {
      const rendered = marked.parse(msg.content || "");
      console.log(
        boxen(rendered.trim(), {
          padding: 1,
          margin: { left: 2, bottom: 1 },
          borderStyle: "round",
          borderColor: "green",
          title: "🤖 Assistant",
        })
      );
    }
  });
}


async function saveMessage(conversationId, role, content) {
  return await chatService.addMessage(conversationId, role, content);
}


async function getAIResponse(conversationId) {
  const spinner = yoctoSpinner({
    text: "AI is thinking...",
    color: "cyan",
  }).start();

  const dbMessages = await chatService.getMessages(conversationId);
  const aiMessages = chatService.formatMessagesForAI(dbMessages);


  let fullResponse = "";
  let isFirstChunk = true;

  try {
    const result = await aiService.sendMessage(aiMessages, (chunk) => {
      if (isFirstChunk) {
        spinner.stop();
        console.log("\n");
        console.log(chalk.green.bold("🤖 Assistant:"));
        console.log(chalk.gray("─".repeat(60)));
        isFirstChunk = false;
      }

     
      if (typeof chunk === "string") {
        fullResponse += chunk;
      }
    });

    
    if (isFirstChunk) {
      spinner.stop();
      console.log("\n");
      console.log(chalk.green.bold("🤖 Assistant:"));
      console.log(chalk.gray("─".repeat(60)));
    }

    
    if (
      !fullResponse ||
      typeof fullResponse !== "string" ||
      fullResponse.trim() === ""
    ) {
      fullResponse = result.content || "";
    }

    const finalText =
      typeof fullResponse === "string" && fullResponse.trim()
        ? fullResponse
        : "⚠️ No response generated";

    console.log("\n");
    console.log(marked.parse(finalText));
    console.log(chalk.gray("─".repeat(60)));
    console.log("\n");

    return finalText;
  } catch (error) {
    spinner.stop();

    console.log("\n");
    console.log(chalk.red("❌ AI Error:"));
    console.log(chalk.red(error.message));
    console.log(chalk.gray("─".repeat(60)));
    console.log("\n");

    return "⚠️ AI unavailable";
  }
}


async function chatLoop(conversation) {
  console.log(
    boxen(
      `${chalk.gray("• Type your message and press Enter")}
${chalk.gray("• Markdown supported")}
${chalk.gray('• Type "exit" to end')}`,
      {
        padding: 1,
        margin: { bottom: 1 },
        borderStyle: "round",
        borderColor: "gray",
      }
    )
  );

  while (true) {
    const userInput = await text({
      message: chalk.blue("💬 Your message"),
      validate(value) {
        if (!value || value.trim() === "") {
          return "Message cannot be empty";
        }
      },
    });

    if (isCancel(userInput) || userInput.toLowerCase() === "exit") {
      console.log(
        boxen("Chat session ended. Goodbye! 👋", {
          padding: 1,
          borderColor: "yellow",
        })
      );
      break;
    }

    await saveMessage(conversation.id, "user", userInput);

    const aiResponse = await getAIResponse(conversation.id);

    await saveMessage(conversation.id, "assistant", aiResponse);
  }
}

// 🚀 Start
export async function startChat(mode = "chat", conversationId = null) {
  try {
    intro(
      boxen(chalk.bold.cyan("🚀 CLIQ AI Chat"), {
        padding: 1,
        borderStyle: "double",
        borderColor: "cyan",
      })
    );

    const user = await getUserFromToken();
    const conversation = await initConversation(user.id, conversationId, mode);

    await chatLoop(conversation);

    outro(chalk.green("✨ Thanks for chatting!"));
  } catch (error) {
    console.log(
      boxen(chalk.red(`❌ Error: ${error.message}`), {
        padding: 1,
        borderColor: "red",
      })
    );
    process.exit(1);
  }
}