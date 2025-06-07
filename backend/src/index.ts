require("dotenv").config();
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import { basePrompt as nodeBasePrompt } from "./defaults/node";
import { basePrompt as reactBasePrompt } from "./defaults/react";
import express, { Request, Response } from "express";
const cors = require('cors');
const app = express();

app.use(express.json());

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Initialize Gemini AI
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required in environment variables");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/template", async (req: Request, res: Response) => {
    const prompt = req.body.prompt;
    
    try {
        // Get the gemini-2.0-flash model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        
        const fullPrompt = `${prompt}\n\nReturn either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra.`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const answer = response.text().trim().toLowerCase();
        
        console.log("Gemini response:", answer); // Debug log

        if (answer?.includes("react")) {
            res.json({
                prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [reactBasePrompt]
            });
            return;
        }

        if (answer?.includes("node")) {
            res.json({
                prompts: [`Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [nodeBasePrompt]
            });
            return;
        }

        // Analyze the prompt directly if Gemini response is unclear
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes('react') || promptLower.includes('component') || promptLower.includes('jsx')) {
            console.log("Defaulting to react based on prompt analysis");
            res.json({
                prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [reactBasePrompt]
            });
        } else if (promptLower.includes('node') || promptLower.includes('server') || promptLower.includes('api')) {
            console.log("Defaulting to node based on prompt analysis");
            res.json({
                prompts: [`Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [nodeBasePrompt]
            });
        } else {
            // Final fallback to react
            console.log("Final fallback to react for unclear response:", answer);
            res.json({
                prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [reactBasePrompt]
            });
        }

    } catch (error) {
        console.error("Error in /template endpoint:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/chat", async (req: Request, res: Response) => {
    try {
        const messages = req.body.messages;
        
        // Get the gemini-2.0-flash model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        
        // Convert messages to Gemini format
        // Gemini expects a conversation history in a specific format
        let conversationHistory = getSystemPrompt() + "\n\n";
        
        // Build conversation context
        messages.forEach((message:any, index:number) => {
            if (message.role === "user") {
                conversationHistory += `User: ${message.content}\n\n`;
            } else if (message.role === "assistant") {
                conversationHistory += `Assistant: ${message.content}\n\n`;
            }
        });
        
        // Get the last user message for the current prompt
        const lastUserMessage = messages[messages.length - 1];
        const currentPrompt = conversationHistory + `User: ${lastUserMessage.content}\n\nAssistant:`;
        
        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [{ text: currentPrompt }]
            }],
            generationConfig: {
                maxOutputTokens: 1000,
            }
        });
        
        const response = await result.response;
        const responseText = response.text();
        
        res.json({
            response: responseText,
        });
        
    } catch (error) {
        console.error("Error in /chat endpoint:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});

// Uncomment and modify for testing
// async function main() {
//     try {
//         const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        
//         const prompt = getSystemPrompt() + "\n\nUser: create a todo app\n\nAssistant:";
        
//         const result = await model.generateContentStream({
//             contents: [{
//                 role: "user", 
//                 parts: [{ text: prompt }]
//             }]
//         });
        
//         for await (const chunk of result.stream) {
//             const chunkText = chunk.text();
//             console.log(chunkText);
//         }
//     } catch (error) {
//         console.error("Error:", error);
//     }
// }
// main();