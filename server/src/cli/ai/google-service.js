import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { config } from "../../config/google.config.js";
import chalk from "chalk";

export class AIService {
  constructor() {
    if (!config.googleApiKey) {
      throw new Error("GOOGLE_API_KEY is not set in env");
    }

    this.model = google(config.model, {
      apiKey: config.googleApiKey,
    });
  }

  async sendMessage(messages, onChunk, tools = undefined) {
    try {
       // debug

      const result = await streamText({
        model: this.model,
        messages: messages,
      });

      if(tools && Object.keys(tools).length > 0) {
        streamConfig.tools = tools;
        streamConfig.maxSteps=5

        console.log(chalk.gray('[DEBUG] tools enabled:${Object.keys(tools).join(',')}'));
      }
      let fullResponse = "";

      try {
        for await (const chunk of result.textStream) {
          if (typeof chunk === "string") {
            fullResponse += chunk;

            if (onChunk) {
              onChunk(chunk);
            }
          }


          //tool call
          const toolCalls=[];
          const toolResults=[];

          if(fullResult.steps && Array.isArray(fullResult.steps)) {
            for(const step of fullResult.steps) {
              if(step.toolCalls && step.toolCalls.length > 0) {
                for(const toolcall of step.toolCalls) {
                  toolCalls.push(toolcall);
                  if(onToolCall) {
                    onToolCall(toolcall);
                  }
                }
              }

              if(step.toolResults && step.toolResults.length > 0) {
                toolResults.push(...step.toolResults);
            }
          }
        }


        }
      } catch (streamError) {
        console.warn("Stream error:", streamError.message);
      }

      // ✅ 🔥 CORRECT FALLBACK (MAIN FIX)
      if (
        !fullResponse ||
        typeof fullResponse !== "string" ||
        fullResponse.trim() === ""
      ) {
        try {
          const textResult = await result.text(); // ✅ IMPORTANT FIX
          fullResponse =
            typeof textResult === "string"
              ? textResult
              : JSON.stringify(textResult || "");
        } catch (err) {
          fullResponse = "";
        }
      }

      // ✅ FINAL SAFETY
      if (
        !fullResponse ||
        typeof fullResponse !== "string" ||
        fullResponse.trim() === ""
      ) {
        fullResponse = "⚠️ No response generated";
      }

      return {
        content: fullResponse,
        finishReason: result.finishReason || "stop",
        usage: result.usage || {},
        toolCalls,
        toolResults,
        steps:fullResult.steps
      };
    } catch (error) {
      console.error(chalk.red("AI Service Error:"), error.message);

      return {
        content: this.handleError(error),
        finishReason: "error",
        usage: {},
      };
    }
  }

  async getMessage(messages, tools = undefined) {
    let fullResponse = "";

    const res = await this.sendMessage(
      messages,
      (chunk) => {
        if (typeof chunk === "string") {
          fullResponse += chunk;
        }
      },
      tools
    );

    return fullResponse || res.content;
  }

  handleError(error) {
    const msg = error.message || "";

    if (msg.includes("quota")) {
      return "⚠️ API quota exceeded. Try again later or use a new API key.";
    }

    if (msg.includes("API key") || msg.includes("invalid")) {
      return "⚠️ Invalid or expired API key. Please check your .env.";
    }

    return "⚠️ AI service error. Please try again.";
  }
}