import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import readline from "readline";
import { tools } from "./tools.js";
import fs from "fs/promises";
import path from "path";

dotenv.config();

const genAi = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const prompt = `
You are an advanced AI coding assistant with capabilities similar to Claude IDE. You help developers write, debug, and improve code.

You have access to powerful tools and should operate in the following states: USER, PLAN, ACTION, OBSERVATION, OUTPUT

STATES:
- USER: Receive and understand the user's coding request
- PLAN: Analyze the request and create a detailed plan (may involve multiple tools)
- ACTION: Execute one specific action from your plan
- OBSERVATION: Process the result of your action
- OUTPUT: Provide the final response with explanations

AVAILABLE TOOLS:
1. executeCommand: Execute shell commands
   - Input: command string
   - Use OS-appropriate commands (Windows/Unix)

2. readFile: Read file contents
   - Input: file path (relative or absolute)
   - Returns: file contents as string

3. writeFile: Write or overwrite file contents
   - Input: { path: string, content: string }
   - Creates directories if needed

4. listFiles: List files in a directory
   - Input: directory path
   - Returns: array of files and folders

5. analyzeError: Analyze error messages and stack traces
   - Input: error message or stack trace
   - Returns: detailed analysis and suggestions

6. browseDirectory: Advanced directory browsing with filtering
   - Input: { path, recursive, maxDepth, includeHidden, fileTypes, excludeDirs, sortBy, order }
   - Returns: detailed directory structure with metadata

7. findFiles: Find files across directories with pattern matching
   - Input: { pattern, directory, fileTypes, excludeDirs, maxDepth, includeHidden }
   - Returns: list of matching files with metadata

8. globalSearchReplace: Search and replace text across multiple files
   - Input: { searchText, replaceText, directory, fileTypes, excludeDirs, dryRun }
   - Returns: search results and replacement statistics

9. createProject: Create new projects with templates
   - Input: { name, type, template, directory }
   - Returns: project creation confirmation

10. backupWorkspace: Create workspace backups
    - Input: { backupPath, includeNodeModules, compression }
    - Returns: backup location and details

11. searchInFiles: Search for text patterns in files
    - Input: { pattern, directory, fileExtension }
    - Returns: search results with context

12. getSystemInfo: Get system information
    - Input: none
    - Returns: system details and environment info

CAPABILITIES:
- Read existing codebases to understand context
- Analyze error messages and provide fixes
- Generate comprehensive, production-ready code
- Refactor and optimize existing code
- Debug issues by examining files and logs
- Set up complete project structures
- Install dependencies and configure environments

BEST PRACTICES:
- Always read relevant files before making changes
- Analyze error stacks thoroughly before suggesting fixes
- Provide clear explanations for each step
- Use descriptive variable/function names
- Add comments for complex logic
- Follow language-specific conventions
- Test commands and validate outputs

RESPONSE FORMAT:
All responses must be valid JSON in one of these formats:

Plan: {"type": "plan", "plan": "Detailed explanation of next step"}
Action: {"type": "action", "function": "toolName", "input": inputData}
Output: {"type": "output", "output": "Final response with explanations", "summary": "Brief summary"}

WORKFLOW EXAMPLE:

User Request: "Fix the bug in my React component"

Step 1: {"type": "plan", "plan": "Read the React component file to understand the current implementation"}
Step 2: {"type": "action", "function": "readFile", "input": "src/Component.jsx"}
Step 3: (observation provided by system)
Step 4: {"type": "plan", "plan": "Analyze the code and identify the issue"}
Step 5: {"type": "plan", "plan": "Write the corrected code to the file"}
Step 6: {"type": "action", "function": "writeFile", "input": {"path": "src/Component.jsx", "content": "..."}}
Step 7: {"type": "output", "output": "Fixed the bug...", "summary": "Component updated"}

IMPORTANT RULES:
- Return ONLY ONE step at a time as JSON
- Wait for observations after each action
- Always provide context in plans
- Be thorough but efficient
- Handle errors gracefully
- Confirm success of operations

The conversation builds incrementally. You receive previous steps and return the next step.
Always wait for the complete message history before responding.
`;

const model = genAi.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  generationConfig: {
    responseMimeType: "application/json",
  },
  systemInstruction: prompt,
});

const input = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Enhanced logging
function logStep(step, prefix = "") {
  console.log("\n" + "=".repeat(60));
  if (step.type === "plan") {
    console.log(`${prefix}📋 PLAN: ${step.plan}`);
  } else if (step.type === "action") {
    console.log(`${prefix}⚡ ACTION: ${step.function}`);
    console.log(`   Input: ${JSON.stringify(step.input, null, 2)}`);
  } else if (step.type === "output") {
    console.log(`${prefix}✅ OUTPUT:`);
    console.log(`\n${step.output}`);
    if (step.summary) {
      console.log(`\n📌 Summary: ${step.summary}`);
    }
  } else if (step.type === "observation") {
    console.log(`${prefix}👁️  OBSERVATION:`);
    console.log(`   ${step.observation.substring(0, 200)}${step.observation.length > 200 ? "..." : ""}`);
  }
  console.log("=".repeat(60) + "\n");
}

function askQuestion() {
  input.question("\n💬 Ask me anything (type 'exit' to quit): ", async (message) => {
    if (message.toLowerCase() === "exit") {
      console.log("👋 Goodbye! Happy coding!");
      input.close();
      return;
    }

    const messages = [];
    const userMessage = {
      type: "user",
      prompt: message,
    };
    
    messages.push(JSON.stringify(userMessage));
    console.log("\n🚀 Processing your request...\n");

    let stepCount = 0;
    const maxSteps = 50; // Prevent infinite loops

    while (stepCount < maxSteps) {
      try {
        stepCount++;
        
        // Generate next step
        const result = await model.generateContent(messages.join("\n"));
        const response = result.response.text();
        
        let step;
        try {
          step = JSON.parse(response);
        } catch (parseError) {
          console.error("❌ Error parsing AI response:", response);
          break;
        }

        logStep(step, `[Step ${stepCount}] `);
        messages.push(response);

        // Handle actions
        if (step.type === "action") {
          try {
            if (!tools[step.function]) {
              throw new Error(`Tool '${step.function}' not found`);
            }

            const result = await tools[step.function].fn(step.input);
            const observation = {
              type: "observation",
              observation: `Success: ${result}`,
            };
            
            logStep(observation);
            messages.push(JSON.stringify(observation));
            continue;
          } catch (error) {
            const observation = {
              type: "observation",
              observation: `Error: ${error.message}\nStack: ${error.stack}`,
            };
            
            console.error("❌ Action failed:", error.message);
            logStep(observation);
            messages.push(JSON.stringify(observation));
            continue;
          }
        }

        // Handle output (completion)
        if (step.type === "output") {
          console.log("\n✨ Task completed successfully!\n");
          break;
        }

        // Continue for plan states
        if (step.type === "plan") {
          continue;
        }

      } catch (error) {
        console.error("\n❌ Unexpected error:", error.message);
        console.error("Stack:", error.stack);
        break;
      }
    }

    if (stepCount >= maxSteps) {
      console.log("\n⚠️  Maximum steps reached. Task may be incomplete.");
    }

    // Ask for next input
    askQuestion();
  });
}

// Welcome message
console.log("\n" + "=".repeat(60));
console.log("🤖 Advanced AI Coding Assistant");
console.log("   Similar to Claude IDE - Ready to help!");
console.log("=".repeat(60));
console.log("\nCapabilities:");
console.log("  • Read and analyze your codebase");
console.log("  • Debug errors and fix issues");
console.log("  • Generate production-ready code");
console.log("  • Refactor and optimize code");
console.log("  • Set up project structures");
console.log("=".repeat(60));

// Start the assistant
askQuestion();