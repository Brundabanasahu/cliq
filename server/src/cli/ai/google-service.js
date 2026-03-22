import { google } from "@ai-sdk/google";
import {streamText} from "ai";
import {config} from "../../config/google.config.js"
import chalk from "chalk"



export class AIService{
    constructor(){
    if(!config.googleApiKey){
        throw new Error("GOOGLE_API_KEY is not set in env")
    }

    this.model = google(config.model, {
        apiKey: config.googleApiKey,
    });

}


/**
 * Send a message and get streaming responser
 * @param {Array} messages
 * @param {Function} onChunk
 * @param {Object} tools
 * @Param {Function} onToolCall
 * @returns {Promise<Object>}
 
 */

async sendMessage(messages,onChunk,tools=undefined,onToolCall=nuLL){
    try{
        const streamConfig={
            model:this.model,
            messages:messages,
        }
        
        if(tools && Object.keys(tools).length>0){
            streamConfig.tools=tools;
            streamconfig.maxSteps=5

            console.log(chalk.gray('[DEBUG] Tools enabled: ${Object.keys(tools).join(',')}'));

        }


        const result = await streamText(streamConfig);
        let fullResponse=""
        
        for await (const chunk of result.textStream){
            fullResponse+=chunk;
            if(onChunk){
                onChunk(chunk)
            }
        }
        const fullResult=result;

        const toolCalls=[];
        const toolResults=[];

        if(fullResult.steps && Array.isArray(fullResult.steps)){
            for(const step of fullResult.steps){
                if(step.toolCalls && step.toolCalls.length>0){
                    for(const toolCall of step.toolCalls){
                        toolcalls.push(toolCall);

                        if(onToolcall){
                            onToolCall(toolCall)
                        }
                    }
                }

                if(step.toolResults && step.toolResults.length>0){
                    toolResults.push(...step.toolResults)
                }


            }
        }

        
        return{
            content:fullResponse,
            finishResponse:fullResult.finishReason,
            usage:fullResult.usage
        }
    }catch(error){
        console.error(chalk.red("AI Service Error:"),error.message);
        throw error;

    }
}

/**
 * @param {Arrray} messages - Array of message objects
 * @param {Object} tools - optional tools
 * @returns {Promise<String>} response text
 */

async getMessage(messages,tools=undefined){
    let fullResponse=""
    await this.sendMessage(messages,(chunk)=>{
        fullResponse += chunk
    })
    return fullResponse
}
}













