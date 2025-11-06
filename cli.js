#!/usr/bin/env node

import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { tools } from "./tools.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

dotenv.config();

const genAi = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// CLI-specific prompt for global operations
const cliPrompt = `
You are a powerful AI assistant for global file system operations, project management, and code generation.

You have access to advanced tools for:
- Browsing and navigating directories recursively
- Finding files across entire directory trees
- Global search and replace operations
- Project creation and management
- Workspace backup and synchronization
- System information and environment management
- Code generation and implementation
- Feature development and refactoring
- API creation and documentation
- Complete web application generation

AVAILABLE TOOLS:
1. browseDirectory: Advanced directory browsing with filtering
2. findFiles: Find files across directories with pattern matching
3. globalSearchReplace: Search and replace text across multiple files
4. createProject: Create new projects with templates
5. backupWorkspace: Create workspace backups
6. searchInFiles: Search for text patterns in files
7. getSystemInfo: Get system information
8. executeCommand: Execute shell commands
9. readFile: Read file contents
10. writeFile: Write or overwrite file contents
11. listFiles: List files in a directory
12. analyzeError: Analyze error messages and stack traces
13. generateCode: Generate code based on requirements
14. implementFeature: Implement a complete feature with multiple files
15. refactorCode: Refactor existing code to improve structure and performance
16. createAPI: Create a complete API with endpoints, middleware, and documentation
17. generateApp: Generate complete web applications (calculator, todo, weather, etc.)

WEB APPLICATION GENERATION:
When users request web applications like "calculator", "todo app", "weather app", etc., use the generateApp tool with:
- name: The app name
- type: "calculator", "todo", "weather", or "custom"
- framework: "vanilla" (default), "react", "vue", etc.
- includeStyles: true (default)
- includeTests: false (default)
- features: [] (optional additional features)

COMMON APP TYPES:
- calculator: Full-featured calculator with arithmetic operations, keyboard support, modern UI
- todo: Todo list app with add/edit/delete, filtering, local storage, modern design
- weather: Weather app with city search, current conditions, responsive design
- custom: Generic web app template

RESPONSE FORMAT:
All responses must be valid JSON in one of these formats:

Plan: {"type": "plan", "plan": "Detailed explanation of next step"}
Action: {"type": "action", "function": "toolName", "input": inputData}
Output: {"type": "output", "output": "Final response with explanations", "summary": "Brief summary"}

WORKFLOW:
- Always start with a plan
- Execute actions one at a time
- Provide clear output with explanations
- Handle errors gracefully
- Be efficient and thorough
- For app generation, create complete, ready-to-run applications

IMPORTANT RULES:
- Return ONLY ONE step at a time as JSON
- Wait for observations after each action
- Always provide context in plans
- Be thorough but efficient
- Handle errors gracefully
- Confirm success of operations
- For web apps, ensure they are complete and functional
`;

const model = genAi.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  generationConfig: {
    responseMimeType: "application/json",
  },
  systemInstruction: cliPrompt,
});

// Enhanced CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    return { command: 'interactive', options: {} };
  }

  const command = args[0];
  const options = {};
  const positionalArgs = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      
      if (value && !value.startsWith('-')) {
        // Handle array values (comma-separated)
        if (key === 'file-types' || key === 'exclude-dirs') {
          options[key] = value.split(',').map(v => v.trim());
        } else if (key === 'max-depth') {
          options[key] = parseInt(value);
        } else if (key === 'include-hidden' || key === 'recursive' || key === 'dry-run' || key === 'include-node-modules') {
          options[key] = true;
        } else {
          options[key] = value;
        }
        i++; // Skip the value
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const value = args[i + 1];
      
      if (value && !value.startsWith('-')) {
        options[key] = value;
        i++; // Skip the value
      } else {
        options[key] = true;
      }
    } else {
      positionalArgs.push(arg);
    }
  }

  // Map positional arguments to options based on command
  switch (command) {
    case 'browse':
      if (positionalArgs[0]) options.path = positionalArgs[0];
      break;
    case 'find':
      if (positionalArgs[0]) options.pattern = positionalArgs[0];
      if (positionalArgs[1]) options.directory = positionalArgs[1];
      break;
    case 'search':
      if (positionalArgs[0]) options.pattern = positionalArgs[0];
      if (positionalArgs[1]) options.directory = positionalArgs[1];
      break;
    case 'replace':
      if (positionalArgs[0]) options.searchText = positionalArgs[0];
      if (positionalArgs[1]) options.replaceText = positionalArgs[1];
      if (positionalArgs[2]) options.directory = positionalArgs[2];
      break;
    case 'create':
      if (positionalArgs[0]) options.name = positionalArgs[0];
      if (positionalArgs[1]) options.type = positionalArgs[1];
      if (positionalArgs[2]) options.template = positionalArgs[2];
      if (positionalArgs[3]) options.directory = positionalArgs[3];
      break;
    case 'backup':
      if (positionalArgs[0]) options.backupPath = positionalArgs[0];
      break;
    case 'generate':
      if (positionalArgs[0]) options.type = positionalArgs[0];
      if (positionalArgs.length > 1) {
        options.description = positionalArgs.slice(1).join(' ');
      }
      break;
    case 'implement':
      if (positionalArgs.length > 0) {
        options.feature = positionalArgs.join(' ');
      }
      break;
    case 'refactor':
      if (positionalArgs[0]) options.filePath = positionalArgs[0];
      if (positionalArgs[1]) options.refactorType = positionalArgs[1];
      break;
    case 'api':
      if (positionalArgs[0]) options.name = positionalArgs[0];
      break;
    case 'app':
      if (positionalArgs[0]) options.name = positionalArgs[0];
      if (positionalArgs[1]) options.type = positionalArgs[1];
      break;
  }

  return { command, options, positionalArgs };
}

// Enhanced logging for CLI
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

// Execute a single command
async function executeCommand(command, options) {
  const messages = [];
  const userMessage = {
    type: "user",
    prompt: `Execute command: ${command} with options: ${JSON.stringify(options)}`,
  };
  
  messages.push(JSON.stringify(userMessage));
  console.log(`\n🚀 Executing: ${command}\n`);

  let stepCount = 0;
  const maxSteps = 20;

  while (stepCount < maxSteps) {
    try {
      stepCount++;
      
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

      if (step.type === "output") {
        console.log("\n✨ Command completed successfully!\n");
        break;
      }

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
    console.log("\n⚠️  Maximum steps reached. Command may be incomplete.");
  }
}

// Interactive mode with AI integration
async function interactiveMode() {
  const readline = await import("readline");
  const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n" + "=".repeat(60));
  console.log("🤖 Advanced AI Coding Assistant - Interactive Mode");
  console.log("   File operations, code generation, and project management");
  console.log("=".repeat(60));
  console.log("\nAvailable commands:");
  console.log("  • browse <path> - Browse directories with advanced filtering");
  console.log("  • find <pattern> - Find files across directories");
  console.log("  • search <text> - Search for text in files");
  console.log("  • replace <search> <replace> - Global search and replace");
  console.log("  • create <name> - Create new project");
  console.log("  • backup - Create workspace backup");
  console.log("  • generate <type> - Generate code (function, class, component, api, test)");
  console.log("  • implement <feature> - Implement a complete feature");
  console.log("  • refactor <file> - Refactor existing code");
  console.log("  • api <name> - Create a complete API");
  console.log("  • app <name> <type> - Generate complete web app (calculator, todo, weather, etc.)");
  console.log("  • info - Get system information");
  console.log("  • help - Show this help");
  console.log("  • exit - Exit the program");
  console.log("=".repeat(60));
  console.log("\n💡 You can also ask natural language questions like:");
  console.log("  • 'Create a user authentication system'");
  console.log("  • 'Generate a React component for a todo list'");
  console.log("  • 'Create a calculator web application'");
  console.log("  • 'Generate a todo list app'");
  console.log("  • 'Refactor this code to use async/await'");
  console.log("  • 'Help me debug this error'");

  function askQuestion() {
    input.question("\n💬 Ask me anything (or type 'help' for commands): ", async (message) => {
      if (message.toLowerCase() === "exit") {
        console.log("👋 Goodbye! Happy coding!");
        input.close();
        return;
      }

      if (message.toLowerCase() === "help") {
        showInteractiveHelp();
        askQuestion();
        return;
      }

      // Check if it's a direct command
      const parts = message.trim().split(" ");
      const command = parts[0];
      
      // Handle direct commands
      if (isDirectCommand(command)) {
        try {
          await handleDirectCommand(message);
        } catch (error) {
          console.error(`❌ Error: ${error.message}`);
        }
        askQuestion();
        return;
      }

      // Handle natural language requests with AI
      try {
        await handleAIRequest(message);
      } catch (error) {
        console.error(`❌ AI Error: ${error.message}`);
      }
      
      askQuestion();
    });
  }

  askQuestion();
}

// Check if the input is a direct command
function isDirectCommand(command) {
  const directCommands = [
    'browse', 'find', 'search', 'replace', 'create', 'backup', 
    'generate', 'implement', 'refactor', 'api', 'app', 'info', 'templates',
    'config'
  ];
  return directCommands.includes(command.toLowerCase());
}

// Handle direct commands
async function handleDirectCommand(message) {
  const parts = message.trim().split(" ");
  const command = parts[0];
  const args = parts.slice(1);

  // Parse arguments
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] && args[i].startsWith('-')) {
      const key = args[i].replace(/^-+/, '');
      const value = args[i + 1];
      if (value && !value.startsWith('-')) {
        options[key] = value;
        i++; // Skip the value
      } else {
        options[key] = true;
      }
    }
  }

  // Map positional arguments
  switch (command) {
    case 'browse':
      if (args[0] && !args[0].startsWith('-')) options.path = args[0];
      break;
    case 'find':
      if (args[0] && !args[0].startsWith('-')) options.pattern = args[0];
      if (args[1] && !args[1].startsWith('-')) options.directory = args[1];
      break;
    case 'search':
      if (args[0] && !args[0].startsWith('-')) options.pattern = args[0];
      if (args[1] && !args[1].startsWith('-')) options.directory = args[1];
      break;
    case 'replace':
      if (args[0] && !args[0].startsWith('-')) options.searchText = args[0];
      if (args[1] && !args[1].startsWith('-')) options.replaceText = args[1];
      if (args[2] && !args[2].startsWith('-')) options.directory = args[2];
      break;
    case 'create':
      if (args[0] && !args[0].startsWith('-')) options.name = args[0];
      if (args[1] && !args[1].startsWith('-')) options.type = args[1];
      if (args[2] && !args[2].startsWith('-')) options.template = args[2];
      if (args[3] && !args[3].startsWith('-')) options.directory = args[3];
      break;
    case 'backup':
      if (args[0] && !args[0].startsWith('-')) options.backupPath = args[0];
      break;
    case 'generate':
      if (args[0] && !args[0].startsWith('-')) options.type = args[0];
      if (args.length > 1) {
        // Join all remaining args as description
        const descArgs = args.slice(1).filter(arg => !arg.startsWith('-'));
        options.description = descArgs.join(' ');
      }
      break;
    case 'implement':
      if (args[0] && !args[0].startsWith('-')) options.feature = args.join(' ');
      break;
    case 'refactor':
      if (args[0] && !args[0].startsWith('-')) options.filePath = args[0];
      if (args[1] && !args[1].startsWith('-')) options.refactorType = args[1];
      break;
    case 'api':
      if (args[0] && !args[0].startsWith('-')) options.name = args[0];
      break;
    case 'app':
      if (args[0] && !args[0].startsWith('-')) options.name = args[0];
      if (args[1] && !args[1].startsWith('-')) options.type = args[1];
      break;
  }

  await executeDirectCommand(command, options);
}

// Handle AI requests
async function handleAIRequest(message) {
  const messages = [];
  const userMessage = {
    type: "user",
    prompt: message,
  };
  
  messages.push(JSON.stringify(userMessage));
  console.log("\n🚀 Processing your request with AI...\n");

  let stepCount = 0;
  const maxSteps = 20;

  while (stepCount < maxSteps) {
    try {
      stepCount++;
      
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

      if (step.type === "output") {
        console.log("\n✨ Task completed successfully!\n");
        break;
      }

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
}

// Show interactive help
function showInteractiveHelp() {
  console.log("\n📖 Available Commands:");
  console.log("  browse <path> [options] - Browse directories");
  console.log("  find <pattern> [options] - Find files");
  console.log("  search <text> [options] - Search in files");
  console.log("  replace <search> <replace> [options] - Global replace");
  console.log("  create <name> [type] [template] - Create project");
  console.log("  backup [path] - Backup workspace");
  console.log("  generate <type> <description> - Generate code");
  console.log("  implement <feature> - Implement complete feature");
  console.log("  refactor <file> [type] - Refactor code");
  console.log("  api <name> - Create API");
  console.log("  info - System information");
  console.log("  help - Show this help");
  console.log("  exit - Exit program");
  console.log("\n💡 Natural Language Examples:");
  console.log("  'Create a user authentication system'");
  console.log("  'Generate a React component for a todo list'");
  console.log("  'Refactor this code to use async/await'");
  console.log("  'Help me debug this error'");
  console.log("  'Create a REST API for managing users'");
}

// Execute command directly in interactive mode
async function executeDirectCommand(command, options) {
  switch (command) {
    case "browse":
      await executeDirectTool("browseDirectory", { 
        path: options.path || ".", 
        recursive: options.recursive || false,
        maxDepth: options.maxDepth || 3,
        includeHidden: options.includeHidden || false,
        fileTypes: options.fileTypes || [],
        excludeDirs: options.excludeDirs || ["node_modules", ".git", ".vscode", ".idea"],
        sortBy: options.sortBy || "name",
        order: options.order || "asc"
      });
      break;
      
    case "find":
      if (!options.pattern) {
        console.error("❌ Error: Pattern is required for find command");
        return;
      }
      await executeDirectTool("findFiles", { 
        pattern: options.pattern,
        directory: options.directory || ".",
        fileTypes: options.fileTypes || [],
        excludeDirs: options.excludeDirs || ["node_modules", ".git", ".vscode", ".idea"],
        maxDepth: options.maxDepth || 5,
        includeHidden: options.includeHidden || false
      });
      break;
      
    case "search":
      if (!options.pattern) {
        console.error("❌ Error: Search pattern is required");
        return;
      }
      await executeDirectTool("searchInFiles", { 
        pattern: options.pattern,
        directory: options.directory || ".",
        fileExtension: options.fileTypes ? options.fileTypes[0] : undefined
      });
      break;
      
    case "replace":
      if (!options.searchText) {
        console.error("❌ Error: Search text is required");
        return;
      }
      await executeDirectTool("globalSearchReplace", { 
        searchText: options.searchText,
        replaceText: options.replaceText,
        directory: options.directory || ".",
        fileTypes: options.fileTypes || [".js", ".ts", ".jsx", ".tsx", ".json", ".md"],
        excludeDirs: options.excludeDirs || ["node_modules", ".git", ".vscode", ".idea"],
        dryRun: options.dryRun || false
      });
      break;
      
    case "create":
      if (!options.name) {
        console.error("❌ Error: Project name is required");
        return;
      }
      await executeDirectTool("createProject", { 
        name: options.name,
        type: options.type || "node",
        template: options.template || "basic",
        directory: options.directory || "."
      });
      break;
      
    case "backup":
      await executeDirectTool("backupWorkspace", { 
        backupPath: options.backupPath || "./backups",
        includeNodeModules: options.includeNodeModules || false,
        compression: options.compression || false
      });
      break;
      
    case "info":
      await executeDirectTool("getSystemInfo", {});
      break;
      
    case "templates":
      await executeDirectTool("listTemplates", {});
      break;
      
    case "generate":
      if (!options.type) {
        console.error("❌ Error: Code type is required");
        console.log("Usage: generate <type> <description>");
        console.log("Types: function, class, component, api, test");
        return;
      }
      await executeDirectTool("generateCode", {
        type: options.type,
        description: options.description,
        language: options.language || "javascript",
        outputFile: options.outputFile
      });
      break;
      
    case "implement":
      if (!options.feature) {
        console.error("❌ Error: Feature description is required");
        console.log("Usage: implement <feature description>");
        return;
      }
      await executeDirectTool("implementFeature", {
        feature: options.feature,
        language: options.language || "javascript",
        framework: options.framework || "node",
        outputDir: options.outputDir || ".",
        includeTests: options.includeTests !== false
      });
      break;
      
    case "refactor":
      if (!options.filePath) {
        console.error("❌ Error: File path is required");
        console.log("Usage: refactor <file> [type]");
        return;
      }
      await executeDirectTool("refactorCode", {
        filePath: options.filePath,
        refactorType: options.refactorType || "optimize",
        outputFile: options.outputFile
      });
      break;
      
    case "api":
      if (!options.name) {
        console.error("❌ Error: API name is required");
        console.log("Usage: api <name>");
        return;
      }
      await executeDirectTool("createAPI", {
        name: options.name,
        framework: options.framework || "express",
        endpoints: options.endpoints || [],
        outputDir: options.outputDir || ".",
        includeAuth: options.includeAuth || false,
        includeValidation: options.includeValidation !== false
      });
      break;
      
    case "app":
      if (!options.name) {
        console.error("❌ Error: App name is required");
        console.log("Usage: app <name> <type>");
        console.log("Types: calculator, todo, weather, custom");
        return;
      }
      await executeDirectTool("generateApp", {
        name: options.name,
        type: options.type || "calculator",
        framework: options.framework || "vanilla",
        outputDir: options.outputDir || ".",
        includeStyles: options.includeStyles !== false,
        includeTests: options.includeTests || false,
        features: options.features || []
      });
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log("Type 'help' for available commands.");
  }
}

// Direct tool execution (without AI)
async function executeDirectTool(toolName, input) {
  try {
    if (!tools[toolName]) {
      throw new Error(`Tool '${toolName}' not found`);
    }
    
    const result = await tools[toolName].fn(input);
    console.log(result);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Main CLI function
async function main() {
  const { command, options } = parseArgs();

  if (command === 'interactive') {
    await interactiveMode();
    return;
  }

  // Handle specific commands with direct tool execution
  switch (command) {
    case "browse":
      await executeDirectTool("browseDirectory", { 
        path: options.path || ".", 
        recursive: options.recursive || false,
        maxDepth: options.maxDepth || 3,
        includeHidden: options.includeHidden || false,
        fileTypes: options.fileTypes || [],
        excludeDirs: options.excludeDirs || ["node_modules", ".git", ".vscode", ".idea"],
        sortBy: options.sortBy || "name",
        order: options.order || "asc"
      });
      break;
      
    case "find":
      if (!options.pattern) {
        console.error("❌ Error: Pattern is required for find command");
        console.log("Usage: cursor-ai find <pattern> [directory] [options]");
        process.exit(1);
      }
      await executeDirectTool("findFiles", { 
        pattern: options.pattern,
        directory: options.directory || ".",
        fileTypes: options.fileTypes || [],
        excludeDirs: options.excludeDirs || ["node_modules", ".git", ".vscode", ".idea"],
        maxDepth: options.maxDepth || 5,
        includeHidden: options.includeHidden || false
      });
      break;
      
    case "search":
      if (!options.pattern) {
        console.error("❌ Error: Search pattern is required");
        console.log("Usage: cursor-ai search <pattern> [directory] [options]");
        process.exit(1);
      }
      await executeDirectTool("searchInFiles", { 
        pattern: options.pattern,
        directory: options.directory || ".",
        fileExtension: options.fileTypes ? options.fileTypes[0] : undefined
      });
      break;
      
    case "replace":
      if (!options.searchText) {
        console.error("❌ Error: Search text is required");
        console.log("Usage: cursor-ai replace <search> <replace> [directory] [options]");
        process.exit(1);
      }
      await executeDirectTool("globalSearchReplace", { 
        searchText: options.searchText,
        replaceText: options.replaceText,
        directory: options.directory || ".",
        fileTypes: options.fileTypes || [".js", ".ts", ".jsx", ".tsx", ".json", ".md"],
        excludeDirs: options.excludeDirs || ["node_modules", ".git", ".vscode", ".idea"],
        dryRun: options.dryRun || false
      });
      break;
      
    case "create":
      if (!options.name) {
        console.error("❌ Error: Project name is required");
        console.log("Usage: cursor-ai create <name> [type] [template] [directory]");
        process.exit(1);
      }
      await executeDirectTool("createProject", { 
        name: options.name,
        type: options.type || "node",
        template: options.template || "basic",
        directory: options.directory || "."
      });
      break;
      
    case "backup":
      await executeDirectTool("backupWorkspace", { 
        backupPath: options.backupPath || "./backups",
        includeNodeModules: options.includeNodeModules || false,
        compression: options.compression || false
      });
      break;
      
    case "info":
      await executeDirectTool("getSystemInfo", {});
      break;
      
    case "templates":
      await executeDirectTool("listTemplates", {});
      break;
      
    case "generate":
      if (!options.type) {
        console.error("❌ Error: Code type is required");
        console.log("Usage: cursor-ai generate <type> <description>");
        console.log("Types: function, class, component, api, test");
        process.exit(1);
      }
      await executeDirectTool("generateCode", {
        type: options.type,
        description: options.description || "Generated code",
        language: options.language || "javascript",
        outputFile: options.outputFile
      });
      break;
      
    case "implement":
      if (!options.feature) {
        console.error("❌ Error: Feature description is required");
        console.log("Usage: cursor-ai implement <feature description>");
        process.exit(1);
      }
      await executeDirectTool("implementFeature", {
        feature: options.feature,
        language: options.language || "javascript",
        framework: options.framework || "node",
        outputDir: options.outputDir || ".",
        includeTests: options.includeTests !== false
      });
      break;
      
    case "refactor":
      if (!options.filePath) {
        console.error("❌ Error: File path is required");
        console.log("Usage: cursor-ai refactor <file> [type]");
        process.exit(1);
      }
      await executeDirectTool("refactorCode", {
        filePath: options.filePath,
        refactorType: options.refactorType || "optimize",
        outputFile: options.outputFile
      });
      break;
      
    case "api":
      if (!options.name) {
        console.error("❌ Error: API name is required");
        console.log("Usage: cursor-ai api <name>");
        process.exit(1);
      }
      await executeDirectTool("createAPI", {
        name: options.name,
        framework: options.framework || "express",
        endpoints: options.endpoints || [],
        outputDir: options.outputDir || ".",
        includeAuth: options.includeAuth || false,
        includeValidation: options.includeValidation !== false
      });
      break;
      
    case "app":
      if (!options.name) {
        console.error("❌ Error: App name is required");
        console.log("Usage: cursor-ai app <name> <type>");
        console.log("Types: calculator, todo, weather, custom");
        process.exit(1);
      }
      await executeDirectTool("generateApp", {
        name: options.name,
        type: options.type || "calculator",
        framework: options.framework || "vanilla",
        outputDir: options.outputDir || ".",
        includeStyles: options.includeStyles !== false,
        includeTests: options.includeTests || false,
        features: options.features || []
      });
      break;
      
    case "config":
      if (options.get) {
        await executeDirectTool("getConfig", { path: options.get });
      } else if (options.set) {
        await executeDirectTool("setConfig", { path: options.set, value: options.value });
      } else {
        console.log("Usage: cursor-ai config get <path> | set <path> <value>");
      }
      break;
      
    case "help":
      showHelp();
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log("Run 'cursor-ai help' for available commands.");
      process.exit(1);
  }
}

// Show help information
function showHelp() {
  console.log("\n🚀 Cursor Clone - AI-Powered Development Assistant");
  console.log("=" .repeat(60));
  console.log("\nUSAGE:");
  console.log("  cursor-ai <command> [arguments] [options]");
  console.log("  cursor-ai                    # Interactive mode");
  
  console.log("\nCOMMANDS:");
  console.log("  browse [path]                Browse directories with filtering");
  console.log("  find <pattern> [dir]         Find files across directories");
  console.log("  search <text> [dir]          Search for text in files");
  console.log("  replace <old> <new> [dir]     Global search and replace");
  console.log("  create <name> [type] [tmpl]  Create new project");
  console.log("  backup [path]                 Backup workspace");
  console.log("  generate <type> <desc>        Generate code (function, class, component, api, test)");
  console.log("  implement <feature>          Implement a complete feature");
  console.log("  refactor <file> [type]       Refactor existing code");
  console.log("  api <name>                   Create a complete API");
  console.log("  app <name> <type>            Generate complete web app (calculator, todo, weather, etc.)");
  console.log("  info                         Get system information");
  console.log("  templates                    List available templates");
  console.log("  config get <path>            Get configuration value");
  console.log("  config set <path> <value>    Set configuration value");
  console.log("  help                         Show this help");
  
  console.log("\nOPTIONS:");
  console.log("  --recursive                  Enable recursive operations");
  console.log("  --max-depth <number>         Maximum depth for recursive operations");
  console.log("  --include-hidden             Include hidden files/directories");
  console.log("  --file-types <types>         Filter by file types (comma-separated)");
  console.log("  --exclude-dirs <dirs>         Exclude directories (comma-separated)");
  console.log("  --dry-run                     Show what would be done without making changes");
  console.log("  --include-node-modules       Include node_modules in operations");
  
  console.log("\nEXAMPLES:");
  console.log("  cursor-ai browse . --recursive --max-depth 3");
  console.log("  cursor-ai find '*.js' --file-types .js,.ts");
  console.log("  cursor-ai search 'function' --file-types .js");
  console.log("  cursor-ai replace 'var ' 'let ' --file-types .js --dry-run");
  console.log("  cursor-ai create my-project node express");
  console.log("  cursor-ai backup /tmp/backups");
  console.log("  cursor-ai generate function 'calculate fibonacci number'");
  console.log("  cursor-ai implement 'user authentication system'");
  console.log("  cursor-ai refactor old-code.js optimize");
  console.log("  cursor-ai api user-management");
  console.log("  cursor-ai app my-calculator calculator");
  console.log("  cursor-ai app todo-list todo");
  console.log("  cursor-ai app weather-app weather");
  console.log("  cursor-ai config get global.maxDepth");
  console.log("  cursor-ai config set global.maxDepth 10");
  
  console.log("\nPROJECT TEMPLATES:");
  console.log("  node basic                   Basic Node.js project");
  console.log("  node express                 Express.js project");
  console.log("  python basic                 Basic Python project");
  
  console.log("\nWEB APP TEMPLATES:");
  console.log("  calculator                   Full-featured calculator with modern UI");
  console.log("  todo                         Todo list app with filtering and persistence");
  console.log("  weather                      Weather app with city search and current conditions");
  console.log("  custom                       Generic web app template");
  
  console.log("\nFor more information, visit: https://github.com/your-repo/cursor-clone");
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the CLI
main().catch(console.error);
