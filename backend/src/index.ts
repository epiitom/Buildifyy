require ("dotenv").config();
import OpenAI from "openai";
import {BASE_PROMPT,getSystemPrompt} from "./prompts"
import {basePrompt as nodeBasePrompt} from "./defaults/node";
import {basePrompt as reactBasePrompt} from "./defaults/react";
import express, {Request,Response} from "express"
const app = express();

app.use(express.json())

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

app.post("/template",async (req:Request, res:Response) => {
    const prompt = req.body.prompt;
   
    const response = await client.chat.completions.create({
           model: "gpt-4",
        messages :[
          {
          role: 'user' , content: prompt
        },
         {
           role: 'system',
             content: "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra." 
            }       
],
  })

   const answer = response.choices[0].message?.content?.trim();
     if(answer == "react"){
        res.json({
             prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
              uiPrompts: [reactBasePrompt]
            })
        return;
     }
     if(answer == "node"){
        res.json({
           prompts: [`Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
           uiPrompts : [nodeBasePrompt]    
          })
        return;
     }
         res.status(403).json({message: "You cant access this"})
     return;

})
  app.post("/chat",async(req:Request, res:Response) => {
      
    const messages = req.body.messages;
    const response = await client.chat.completions.create({
           model: "gpt-4",
          messages : [
            {role: "system", content: getSystemPrompt()},
            ...messages  
          ],
            max_tokens: 1000,     
    });
      res.json({
    response: response.choices[0]?.message?.content,
  });
  });

app.listen(3000)

    

// async function main(){
// const response = await client.chat.completions.create({
//     model: "gpt-4",
//      messages: [
//         {
//          role:"system",
//          content:  getSystemPrompt(),   
//      },
//      {
//         role: "user",
//        content: "create a todo app"
//      }
//     ],
//     stream:true,
   
// });

// for await (const chunk of response) {
//  console.log((chunk.choices[0]?.delta?.content || ""));
// }
// }
// main()   