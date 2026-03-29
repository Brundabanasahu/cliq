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

  /**
   * Send message with streaming + fallback
   */
  async sendMessage(messages, onChunk, tools = undefined, onToolCall = null) {
    try {
      const result = await streamText({
        model: this.model,
        messages: messages,
        experimental_streamData: true,
      });

      let fullResponse = "";

      // ✅ STREAM HANDLING (safe)
      try {
        for await (const chunk of result.fullStream) {
          if (chunk.type === "text-delta") {
            const text = chunk.textDelta || "";

            fullResponse += text;

            if (onChunk) {
              onChunk(text);
            }
          }
        }
      } catch (streamError) {
        // 🔒 stream fail hone par crash nahi hone dena
        console.warn("Stream error:", streamError.message);
      }

      // ✅ FALLBACK (MOST IMPORTANT)
     // ✅ FALLBACK SAFE CHECK
if (
  !fullResponse ||
  typeof fullResponse !== "string" ||
  fullResponse.trim() === ""
) {
  fullResponse = result.text || "";
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
      };
    } catch (error) {
      console.error(chalk.red("AI Service Error:"), error.message);

      // ✅ USER-FRIENDLY ERROR RESPONSE (no crash)
      return {
        content: this.handleError(error),
        finishReason: "error",
        usage: {},
      };
    }
  }

  /**
   * Simple wrapper (non-stream use)
   */
  async getMessage(messages, tools = undefined) {
    let fullResponse = "";

    const res = await this.sendMessage(
      messages,
      (chunk) => {
        fullResponse += chunk;
      },
      tools
    );

    return fullResponse || res.content;
  }

  /**
   * 🔥 Error handler (important for CLI stability)
   */
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