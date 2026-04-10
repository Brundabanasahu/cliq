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

      const result = await streamText({
        model: this.model,
        messages: messages,
        ...(tools && { tools }) 
      });

      
      let fullResponse = "";
      let toolCalls = [];
      let toolResults = [];

      
      if (tools && Object.keys(tools).length > 0) {
        console.log(
          chalk.gray(
            `[DEBUG] tools enabled: ${Object.keys(tools).join(", ")}`
          )
        );
      }

      try {
        for await (const chunk of result.textStream) {
          if (typeof chunk === "string") {
            fullResponse += chunk;

            if (onChunk) {
              onChunk(chunk);
            }
          }
        }
      } catch (streamError) {
        console.warn("Stream error:", streamError.message);
      }

      
      if (!fullResponse.trim()) {
        try {
          const textResult = await result.text();
          fullResponse =
            typeof textResult === "string"
              ? textResult
              : JSON.stringify(textResult || "");
        } catch {
          fullResponse = "";
        }
      }

      
      if (!fullResponse.trim()) {
        fullResponse = "⚠️ No response generated";
      }

      return {
        content: fullResponse,
        finishReason: result.finishReason || "stop",
        usage: result.usage || {},
        toolCalls,
        toolResults,
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

 /**
   * Generate structured output using a Zod schema
   * @param {Object} schema - Zod schema
   * @param {string} prompt - Prompt for generation
   * @returns {Promise<Object>} Parsed object matching the schema
   */
 async generateStructured(schema, prompt) {
    try {
      const result = await generateObject({
        model: this.model,
        schema: schema,
        prompt: prompt,
      });
      
      return result.object;
    } catch (error) {
      console.error(chalk.red("AI Structured Generation Error:"), error.message);
      throw error;
    }
  }
}