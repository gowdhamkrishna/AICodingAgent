import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { config } from "./config.js";

const execAsync = promisify(exec);

export const tools = {
  executeCommand: {
    description: "Execute a shell command in the system",
    fn: async (command) => {
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });
        
        if (stderr && !stdout) {
          return `Command executed with warnings:\n${stderr}`;
        }
        
        return stdout || `Command '${command}' executed successfully`;
      } catch (error) {
        throw new Error(
          `Command failed: ${command}\nError: ${error.message}\nStderr: ${error.stderr}`
        );
      }
    },
  },

  readFile: {
    description: "Read contents of a file",
    fn: async (filePath) => {
      try {
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);
        
        const content = await fs.readFile(absolutePath, "utf-8");
        const stats = await fs.stat(absolutePath);
        
        return `File: ${filePath}\nSize: ${stats.size} bytes\nContent:\n${"=".repeat(50)}\n${content}\n${"=".repeat(50)}`;
      } catch (error) {
        if (error.code === "ENOENT") {
          throw new Error(`File not found: ${filePath}`);
        }
        throw new Error(`Failed to read file: ${error.message}`);
      }
    },
  },

  writeFile: {
    description: "Write or overwrite a file with content",
    fn: async (input) => {
      try {
        const { path: filePath, content } = input;
        
        if (!filePath || content === undefined) {
          throw new Error("Both 'path' and 'content' are required");
        }

        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);
        
        // Create directory if it doesn't exist
        const dir = path.dirname(absolutePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Write the file
        await fs.writeFile(absolutePath, content, "utf-8");
        
        const stats = await fs.stat(absolutePath);
        return `File written successfully: ${filePath}\nSize: ${stats.size} bytes`;
      } catch (error) {
        throw new Error(`Failed to write file: ${error.message}`);
      }
    },
  },

  listFiles: {
    description: "List files and directories in a given path",
    fn: async (dirPath = ".") => {
      try {
        const absolutePath = path.isAbsolute(dirPath)
          ? dirPath
          : path.join(process.cwd(), dirPath);
        
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        
        const files = [];
        const dirs = [];
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            dirs.push(`📁 ${entry.name}/`);
          } else {
            const filePath = path.join(absolutePath, entry.name);
            const stats = await fs.stat(filePath);
            files.push(`📄 ${entry.name} (${formatBytes(stats.size)})`);
          }
        }
        
        const output = [
          `Directory: ${dirPath}`,
          `Total: ${dirs.length} directories, ${files.length} files`,
          "",
          ...dirs,
          ...files,
        ].join("\n");
        
        return output;
      } catch (error) {
        if (error.code === "ENOENT") {
          throw new Error(`Directory not found: ${dirPath}`);
        }
        throw new Error(`Failed to list directory: ${error.message}`);
      }
    },
  },

  analyzeError: {
    description: "Analyze error messages and stack traces to provide debugging help",
    fn: async (errorText) => {
      try {
        const analysis = {
          errorType: "Unknown",
          possibleCauses: [],
          suggestions: [],
        };

        // Common error patterns
        const patterns = {
          "ENOENT": {
            type: "File Not Found",
            causes: ["File or directory doesn't exist", "Incorrect file path", "Missing permissions"],
            suggestions: ["Check if the file path is correct", "Verify the file exists", "Check file permissions"],
          },
          "EACCES": {
            type: "Permission Denied",
            causes: ["Insufficient permissions", "File is locked", "Protected system file"],
            suggestions: ["Run with appropriate permissions", "Close programs using the file", "Check file ownership"],
          },
          "MODULE_NOT_FOUND": {
            type: "Module Not Found",
            causes: ["Package not installed", "Incorrect import path", "Missing dependency"],
            suggestions: ["Run 'npm install' or 'pnpm install'", "Check package.json dependencies", "Verify import statement"],
          },
          "SyntaxError": {
            type: "Syntax Error",
            causes: ["Invalid JavaScript syntax", "Missing brackets/parentheses", "Incorrect ES6 usage"],
            suggestions: ["Check for typos", "Verify bracket matching", "Check for missing semicolons or commas"],
          },
          "TypeError": {
            type: "Type Error",
            causes: ["Calling non-function", "Accessing property of null/undefined", "Wrong data type"],
            suggestions: ["Check variable initialization", "Add null checks", "Verify data types"],
          },
          "ReferenceError": {
            type: "Reference Error",
            causes: ["Variable not declared", "Variable out of scope", "Typo in variable name"],
            suggestions: ["Declare variable before use", "Check variable scope", "Verify spelling"],
          },
        };

        // Analyze error
        for (const [key, info] of Object.entries(patterns)) {
          if (errorText.includes(key)) {
            analysis.errorType = info.type;
            analysis.possibleCauses = info.causes;
            analysis.suggestions = info.suggestions;
            break;
          }
        }

        // Extract stack trace info
        const stackLines = errorText.split("\n").filter(line => line.includes("at "));
        const fileReferences = stackLines.map(line => {
          const match = line.match(/\((.+):(\d+):(\d+)\)/);
          return match ? `${match[1]} (line ${match[2]})` : null;
        }).filter(Boolean);

        return [
          `Error Analysis:`,
          `Type: ${analysis.errorType}`,
          ``,
          `Possible Causes:`,
          ...analysis.possibleCauses.map(c => `  • ${c}`),
          ``,
          `Suggestions:`,
          ...analysis.suggestions.map(s => `  • ${s}`),
          fileReferences.length > 0 ? `\nFiles Involved:\n${fileReferences.map(f => `  • ${f}`).join("\n")}` : "",
        ].join("\n");
      } catch (error) {
        throw new Error(`Failed to analyze error: ${error.message}`);
      }
    },
  },

  searchInFiles: {
    description: "Search for text patterns in files",
    fn: async (input) => {
      try {
        const { pattern, directory = ".", fileExtension } = input;
        
        if (!pattern) {
          throw new Error("Search pattern is required");
        }

        const absolutePath = path.isAbsolute(directory)
          ? directory
          : path.join(process.cwd(), directory);

        const results = [];
        
        async function searchDir(dir) {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
              await searchDir(fullPath);
            } else if (entry.isFile()) {
              if (fileExtension && !entry.name.endsWith(fileExtension)) {
                continue;
              }
              
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                const lines = content.split("\n");
                
                lines.forEach((line, index) => {
                  if (line.includes(pattern)) {
                    results.push({
                      file: path.relative(process.cwd(), fullPath),
                      line: index + 1,
                      content: line.trim(),
                    });
                  }
                });
              } catch (err) {
                // Skip files that can't be read
              }
            }
          }
        }

        await searchDir(absolutePath);

        if (results.length === 0) {
          return `No matches found for '${pattern}'`;
        }

        return [
          `Found ${results.length} matches for '${pattern}':`,
          "",
          ...results.slice(0, 20).map(r => `${r.file}:${r.line}\n  ${r.content}`),
          results.length > 20 ? `\n... and ${results.length - 20} more matches` : "",
        ].join("\n");
      } catch (error) {
        throw new Error(`Search failed: ${error.message}`);
      }
    },
  },

  getSystemInfo: {
    description: "Get system information (OS, Node version, etc.)",
    fn: async () => {
      try {
        const { stdout: nodeVersion } = await execAsync("node --version");
        const { stdout: npmVersion } = await execAsync("npm --version").catch(() => ({ stdout: "Not installed" }));
        const { stdout: gitVersion } = await execAsync("git --version").catch(() => ({ stdout: "Not installed" }));
        
        return [
          `System Information:`,
          `OS: ${os.platform()} ${os.release()}`,
          `Architecture: ${os.arch()}`,
          `Node.js: ${nodeVersion.trim()}`,
          `npm: ${npmVersion.trim()}`,
          `Git: ${gitVersion.trim()}`,
          `Current Directory: ${process.cwd()}`,
          `Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB total, ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB free`,
        ].join("\n");
      } catch (error) {
        throw new Error(`Failed to get system info: ${error.message}`);
      }
    },
  },

  // Enhanced directory browsing capabilities
  browseDirectory: {
    description: "Browse directories with advanced filtering and navigation options",
    fn: async (input) => {
      try {
        const { 
          path: dirPath = ".", 
          recursive = false, 
          maxDepth = 3,
          includeHidden = false,
          fileTypes = [],
          excludeDirs = ["node_modules", ".git", ".vscode", ".idea"],
          sortBy = "name",
          order = "asc"
        } = input;

        const absolutePath = path.isAbsolute(dirPath)
          ? dirPath
          : path.join(process.cwd(), dirPath);

        const results = {
          path: dirPath,
          files: [],
          directories: [],
          totalFiles: 0,
          totalDirs: 0,
          totalSize: 0
        };

        async function scanDirectory(currentPath, currentDepth = 0) {
          if (currentDepth > maxDepth) return;

          try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
              const fullPath = path.join(currentPath, entry.name);
              const relativePath = path.relative(absolutePath, fullPath);
              
              // Skip hidden files/dirs unless requested
              if (!includeHidden && entry.name.startsWith(".")) continue;
              
              // Skip excluded directories
              if (entry.isDirectory() && excludeDirs.includes(entry.name)) continue;

              if (entry.isDirectory()) {
                results.directories.push({
                  name: entry.name,
                  path: relativePath,
                  depth: currentDepth,
                  type: "directory"
                });
                results.totalDirs++;

                if (recursive && currentDepth < maxDepth) {
                  await scanDirectory(fullPath, currentDepth + 1);
                }
              } else {
                const stats = await fs.stat(fullPath);
                const fileInfo = {
                  name: entry.name,
                  path: relativePath,
                  size: stats.size,
                  modified: stats.mtime,
                  depth: currentDepth,
                  type: "file",
                  extension: path.extname(entry.name)
                };

                // Filter by file types if specified
                if (fileTypes.length === 0 || fileTypes.includes(fileInfo.extension)) {
                  results.files.push(fileInfo);
                  results.totalFiles++;
                  results.totalSize += stats.size;
                }
              }
            }
          } catch (error) {
            // Skip directories that can't be read
          }
        }

        await scanDirectory(absolutePath);

        // Sort results
        const sortFunction = (a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case "name":
              comparison = a.name.localeCompare(b.name);
              break;
            case "size":
              comparison = (a.size || 0) - (b.size || 0);
              break;
            case "modified":
              comparison = new Date(a.modified || 0) - new Date(b.modified || 0);
              break;
          }
          return order === "desc" ? -comparison : comparison;
        };

        results.files.sort(sortFunction);
        results.directories.sort(sortFunction);

        return [
          `Directory Browser Results:`,
          `Path: ${dirPath}`,
          `Recursive: ${recursive ? `Yes (max depth: ${maxDepth})` : "No"}`,
          `Total: ${results.totalDirs} directories, ${results.totalFiles} files`,
          `Total Size: ${formatBytes(results.totalSize)}`,
          ``,
          `Directories:`,
          ...results.directories.slice(0, 50).map(d => 
            `${"  ".repeat(d.depth)}📁 ${d.name}/`
          ),
          results.directories.length > 50 ? `... and ${results.directories.length - 50} more directories` : "",
          ``,
          `Files:`,
          ...results.files.slice(0, 50).map(f => 
            `${"  ".repeat(f.depth)}📄 ${f.name} (${formatBytes(f.size)})`
          ),
          results.files.length > 50 ? `... and ${results.files.length - 50} more files` : "",
        ].join("\n");
      } catch (error) {
        throw new Error(`Failed to browse directory: ${error.message}`);
      }
    },
  },

  // Global file operations
  findFiles: {
    description: "Find files across directories with advanced filtering",
    fn: async (input) => {
      try {
        const { 
          pattern, 
          directory = ".", 
          fileTypes = [],
          excludeDirs = ["node_modules", ".git", ".vscode", ".idea"],
          maxDepth = 5,
          includeHidden = false
        } = input;

        if (!pattern) {
          throw new Error("Search pattern is required");
        }

        const absolutePath = path.isAbsolute(directory)
          ? path.resolve(directory)
          : path.resolve(process.cwd(), directory);

        const results = [];

        async function searchDirectory(currentPath, currentDepth = 0) {
          if (currentDepth > maxDepth) return;

          try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
              const fullPath = path.join(currentPath, entry.name);
              
              // Skip hidden files/dirs unless requested
              if (!includeHidden && entry.name.startsWith(".")) continue;
              
              // Skip excluded directories
              if (entry.isDirectory() && excludeDirs.includes(entry.name)) continue;

              if (entry.isDirectory()) {
                await searchDirectory(fullPath, currentDepth + 1);
              } else {
                // Check if file matches pattern
                let matchesPattern = false;
                
                // Handle glob patterns
                if (pattern.includes('*')) {
                  const regexPattern = pattern.replace(/\*/g, '.*');
                  const regex = new RegExp(`^${regexPattern}$`);
                  matchesPattern = regex.test(entry.name);
                } else {
                  matchesPattern = entry.name.includes(pattern);
                }
                
                // Also check file types if specified
                if (!matchesPattern && fileTypes.length > 0) {
                  matchesPattern = fileTypes.includes(path.extname(entry.name));
                }
                
                if (matchesPattern) {
                  const stats = await fs.stat(fullPath);
                  results.push({
                    name: entry.name,
                    path: path.relative(process.cwd(), fullPath),
                    size: stats.size,
                    modified: stats.mtime,
                    extension: path.extname(entry.name)
                  });
                }
              }
            }
          } catch (error) {
            // Skip directories that can't be read
          }
        }

        await searchDirectory(absolutePath);

        if (results.length === 0) {
          return `No files found matching pattern '${pattern}'`;
        }

        return [
          `Found ${results.length} files matching '${pattern}':`,
          ``,
          ...results.slice(0, 100).map(f => 
            `📄 ${f.path} (${formatBytes(f.size)}) - ${f.modified.toLocaleDateString()}`
          ),
          results.length > 100 ? `\n... and ${results.length - 100} more files` : "",
        ].join("\n");
      } catch (error) {
        throw new Error(`File search failed: ${error.message}`);
      }
    },
  },

  // Global text search and replace
  globalSearchReplace: {
    description: "Search and replace text across multiple files",
    fn: async (input) => {
      try {
        const { 
          searchText, 
          replaceText, 
          directory = ".", 
          fileTypes = [".js", ".ts", ".jsx", ".tsx", ".json", ".md"],
          excludeDirs = ["node_modules", ".git", ".vscode", ".idea"],
          dryRun = true
        } = input;

        if (!searchText) {
          throw new Error("Search text is required");
        }

        const absolutePath = path.isAbsolute(directory)
          ? path.resolve(directory)
          : path.resolve(process.cwd(), directory);

        const results = {
          filesProcessed: 0,
          matchesFound: 0,
          replacements: 0,
          changes: []
        };

        async function processDirectory(currentPath) {
          try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
              const fullPath = path.join(currentPath, entry.name);
              
              if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
                await processDirectory(fullPath);
              } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (fileTypes.length === 0 || fileTypes.includes(ext)) {
                  try {
                    const content = await fs.readFile(fullPath, "utf-8");
                    const matches = content.split(searchText).length - 1;
                    
                    if (matches > 0) {
                      results.filesProcessed++;
                      results.matchesFound += matches;
                      
                      if (!dryRun && replaceText !== undefined) {
                        const newContent = content.replace(new RegExp(searchText, 'g'), replaceText);
                        await fs.writeFile(fullPath, newContent, "utf-8");
                        results.replacements += matches;
                        results.changes.push({
                          file: path.relative(process.cwd(), fullPath),
                          matches: matches,
                          replaced: true
                        });
                      } else {
                        results.changes.push({
                          file: path.relative(process.cwd(), fullPath),
                          matches: matches,
                          replaced: false
                        });
                      }
                    }
                  } catch (error) {
                    // Skip files that can't be read
                  }
                }
              }
            }
          } catch (error) {
            // Skip directories that can't be read
          }
        }

        await processDirectory(absolutePath);

        return [
          `Global Search${dryRun ? " (DRY RUN)" : " & Replace"} Results:`,
          `Search: "${searchText}"`,
          replaceText !== undefined ? `Replace: "${replaceText}"` : "",
          `Files Processed: ${results.filesProcessed}`,
          `Matches Found: ${results.matchesFound}`,
          dryRun ? `Replacements: ${results.replacements} (would be made)` : `Replacements: ${results.replacements}`,
          ``,
          `Files with matches:`,
          ...results.changes.map(c => 
            `📄 ${c.file} - ${c.matches} match${c.matches > 1 ? 'es' : ''} ${c.replaced ? '(replaced)' : '(would be replaced)'}`
          ),
        ].join("\n");
      } catch (error) {
        throw new Error(`Global search/replace failed: ${error.message}`);
      }
    },
  },

  // Project management
  createProject: {
    description: "Create a new project with structure",
    fn: async (input) => {
      try {
        const { 
          name, 
          type = "node", 
          template = "basic",
          directory = "."
        } = input;

        if (!name) {
          throw new Error("Project name is required");
        }

        const projectPath = path.join(directory, name);
        await fs.mkdir(projectPath, { recursive: true });

        // Load configuration
        await config.load();
        const projectTemplate = config.getTemplate(type, template);
        
        if (!projectTemplate) {
          throw new Error(`Template ${type}/${template} not found`);
        }

        // Process template files with variables
        const variables = { name };
        const processedFiles = config.processTemplate(projectTemplate.files, variables);

        for (const [fileName, content] of Object.entries(processedFiles)) {
          const filePath = path.join(projectPath, fileName);
          
          // Handle JSON files specially
          if (fileName.endsWith('.json') && typeof content === 'object') {
            await fs.writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");
          } else {
            await fs.writeFile(filePath, content, "utf-8");
          }
        }

        return `Project '${name}' created successfully at ${projectPath}`;
      } catch (error) {
        throw new Error(`Failed to create project: ${error.message}`);
      }
    },
  },

  // Workspace operations
  backupWorkspace: {
    description: "Create a backup of the current workspace",
    fn: async (input) => {
      try {
        const { 
          backupPath = "./backups",
          includeNodeModules = false,
          compression = false
        } = input;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.resolve(backupPath, `backup-${timestamp}`);
        
        // Ensure backup directory is outside current workspace
        const currentDir = path.resolve(process.cwd());
        if (backupDir.startsWith(currentDir)) {
          throw new Error("Backup directory cannot be inside the current workspace");
        }
        
        await fs.mkdir(backupDir, { recursive: true });

        const excludeDirs = includeNodeModules ? [".git"] : ["node_modules", ".git"];

        async function copyDirectory(src, dest) {
          await fs.mkdir(dest, { recursive: true });
          const entries = await fs.readdir(src, { withFileTypes: true });
          
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            // Skip if source path is the same as destination path (avoid recursion)
            if (path.resolve(srcPath) === path.resolve(destPath)) {
              continue;
            }
            
            // Skip backup directory itself
            if (entry.isDirectory() && entry.name.startsWith('backup-')) {
              continue;
            }
            
            if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
              await copyDirectory(srcPath, destPath);
            } else if (entry.isFile()) {
              await fs.copyFile(srcPath, destPath);
            }
          }
        }

        await copyDirectory(process.cwd(), backupDir);

        return `Workspace backed up to ${backupDir}`;
      } catch (error) {
        throw new Error(`Backup failed: ${error.message}`);
      }
    },
  },

  // Configuration management
  getConfig: {
    description: "Get configuration value",
    fn: async (input) => {
      try {
        const { path: configPath } = input;
        await config.load();
        const value = config.get(configPath);
        
        if (value === undefined) {
          return `Configuration path '${configPath}' not found`;
        }
        
        return `Configuration ${configPath}: ${JSON.stringify(value, null, 2)}`;
      } catch (error) {
        throw new Error(`Failed to get config: ${error.message}`);
      }
    },
  },

  setConfig: {
    description: "Set configuration value",
    fn: async (input) => {
      try {
        const { path: configPath, value } = input;
        await config.load();
        config.set(configPath, value);
        await config.save();
        
        return `Configuration ${configPath} set to: ${JSON.stringify(value, null, 2)}`;
      } catch (error) {
        throw new Error(`Failed to set config: ${error.message}`);
      }
    },
  },

  listTemplates: {
    description: "List available project templates",
    fn: async () => {
      try {
        await config.load();
        const templates = config.getTemplates();
        
        const output = ["Available Templates:"];
        
        for (const [type, typeTemplates] of Object.entries(templates)) {
          output.push(`\n${type.toUpperCase()}:`);
          for (const [name, template] of Object.entries(typeTemplates)) {
            output.push(`  • ${name}: ${template.description || 'No description'}`);
          }
        }
        
        return output.join("\n");
      } catch (error) {
        throw new Error(`Failed to list templates: ${error.message}`);
      }
    },
  },

  addTemplate: {
    description: "Add a new project template",
    fn: async (input) => {
      try {
        const { type, name, template } = input;
        
        if (!type || !name || !template) {
          throw new Error("Type, name, and template are required");
        }
        
        await config.load();
        await config.addTemplate(type, name, template);
        
        return `Template ${type}/${name} added successfully`;
      } catch (error) {
        throw new Error(`Failed to add template: ${error.message}`);
      }
    },
  },

  removeTemplate: {
    description: "Remove a project template",
    fn: async (input) => {
      try {
        const { type, name } = input;
        
        if (!type || !name) {
          throw new Error("Type and name are required");
        }
        
        await config.load();
        await config.removeTemplate(type, name);
        
        return `Template ${type}/${name} removed successfully`;
      } catch (error) {
        throw new Error(`Failed to remove template: ${error.message}`);
      }
    },
  },

  resetConfig: {
    description: "Reset configuration to defaults",
    fn: async () => {
      try {
        await config.reset();
        return "Configuration reset to defaults";
      } catch (error) {
        throw new Error(`Failed to reset config: ${error.message}`);
      }
    },
  },

  // Code generation and implementation tools
  generateCode: {
    description: "Generate code based on requirements",
    fn: async (input) => {
      try {
        const { 
          language = "javascript",
          type = "function",
          description,
          requirements,
          outputFile
        } = input;

        if (!description && !requirements) {
          throw new Error("Description or requirements are required");
        }

        // Simple code generation based on type and language
        let code = "";
        const timestamp = new Date().toISOString();

        switch (type) {
          case "function":
            code = generateFunction(language, description, requirements);
            break;
          case "class":
            code = generateClass(language, description, requirements);
            break;
          case "component":
            code = generateComponent(language, description, requirements);
            break;
          case "api":
            code = generateAPI(language, description, requirements);
            break;
          case "test":
            code = generateTest(language, description, requirements);
            break;
          default:
            code = generateGeneric(language, description, requirements);
        }

        // Add header comment
        const header = `// Generated on ${timestamp}\n// ${description || requirements}\n\n`;
        const fullCode = header + code;

        // Write to file if specified
        if (outputFile) {
          await fs.writeFile(outputFile, fullCode, "utf-8");
          return `Code generated and written to ${outputFile}`;
        }

        return fullCode;
      } catch (error) {
        throw new Error(`Code generation failed: ${error.message}`);
      }
    },
  },

  implementFeature: {
    description: "Implement a complete feature with multiple files",
    fn: async (input) => {
      try {
        const { 
          feature,
          language = "javascript",
          framework = "node",
          outputDir = ".",
          includeTests = true
        } = input;

        if (!feature) {
          throw new Error("Feature description is required");
        }

        const featureDir = path.join(outputDir, feature.toLowerCase().replace(/\s+/g, '-'));
        await fs.mkdir(featureDir, { recursive: true });

        const files = [];
        
        // Generate main implementation file
        const mainFile = path.join(featureDir, `${feature.toLowerCase().replace(/\s+/g, '-')}.js`);
        const mainCode = generateFeatureImplementation(feature, language, framework);
        await fs.writeFile(mainFile, mainCode, "utf-8");
        files.push(mainFile);

        // Generate test file if requested
        if (includeTests) {
          const testFile = path.join(featureDir, `${feature.toLowerCase().replace(/\s+/g, '-')}.test.js`);
          const testCode = generateFeatureTests(feature, language);
          await fs.writeFile(testFile, testCode, "utf-8");
          files.push(testFile);
        }

        // Generate README
        const readmeFile = path.join(featureDir, "README.md");
        const readmeContent = generateFeatureReadme(feature, files);
        await fs.writeFile(readmeFile, readmeContent, "utf-8");
        files.push(readmeFile);

        return `Feature '${feature}' implemented in ${featureDir}\nFiles created:\n${files.map(f => `  • ${path.relative(process.cwd(), f)}`).join('\n')}`;
      } catch (error) {
        throw new Error(`Feature implementation failed: ${error.message}`);
      }
    },
  },

  refactorCode: {
    description: "Refactor existing code to improve structure and performance",
    fn: async (input) => {
      try {
        const { 
          filePath,
          refactorType = "optimize",
          outputFile
        } = input;

        if (!filePath) {
          throw new Error("File path is required");
        }

        // Read the existing file
        const content = await fs.readFile(filePath, "utf-8");
        
        let refactoredCode = content;
        
        switch (refactorType) {
          case "optimize":
            refactoredCode = optimizeCode(content);
            break;
          case "modernize":
            refactoredCode = modernizeCode(content);
            break;
          case "add-types":
            refactoredCode = addTypeAnnotations(content);
            break;
          case "add-error-handling":
            refactoredCode = addErrorHandling(content);
            break;
          case "add-documentation":
            refactoredCode = addDocumentation(content);
            break;
          default:
            refactoredCode = optimizeCode(content);
        }

        const outputPath = outputFile || filePath.replace(/\.(js|ts)$/, '.refactored.$1');
        await fs.writeFile(outputPath, refactoredCode, "utf-8");

        return `Code refactored and saved to ${outputPath}`;
      } catch (error) {
        throw new Error(`Code refactoring failed: ${error.message}`);
      }
    },
  },

  createAPI: {
    description: "Create a complete API with endpoints, middleware, and documentation",
    fn: async (input) => {
      try {
        const { 
          name,
          framework = "express",
          endpoints = [],
          outputDir = ".",
          includeAuth = false,
          includeValidation = true
        } = input;

        if (!name) {
          throw new Error("API name is required");
        }

        const apiDir = path.join(outputDir, name);
        await fs.mkdir(apiDir, { recursive: true });

        const files = [];

        // Generate main server file
        const serverFile = path.join(apiDir, "server.js");
        const serverCode = generateAPIServer(name, framework, endpoints, includeAuth, includeValidation);
        await fs.writeFile(serverFile, serverCode, "utf-8");
        files.push(serverFile);

        // Generate package.json
        const packageFile = path.join(apiDir, "package.json");
        const packageContent = generateAPIPackage(name, framework, includeAuth);
        await fs.writeFile(packageFile, packageContent, "utf-8");
        files.push(packageFile);

        // Generate routes
        if (endpoints.length > 0) {
          const routesFile = path.join(apiDir, "routes.js");
          const routesCode = generateAPIRoutes(endpoints, framework);
          await fs.writeFile(routesFile, routesCode, "utf-8");
          files.push(routesFile);
        }

        // Generate middleware
        const middlewareFile = path.join(apiDir, "middleware.js");
        const middlewareCode = generateAPIMiddleware(framework, includeAuth, includeValidation);
        await fs.writeFile(middlewareFile, middlewareCode, "utf-8");
        files.push(middlewareFile);

        // Generate README
        const readmeFile = path.join(apiDir, "README.md");
        const readmeContent = generateAPIReadme(name, endpoints, framework);
        await fs.writeFile(readmeFile, readmeContent, "utf-8");
        files.push(readmeFile);

        return `API '${name}' created in ${apiDir}\nFiles created:\n${files.map(f => `  • ${path.relative(process.cwd(), f)}`).join('\n')}`;
      } catch (error) {
        throw new Error(`API creation failed: ${error.message}`);
      }
    },
  },

  // Enhanced web application generation
  generateApp: {
    description: "Generate a complete web application with HTML, CSS, and JavaScript",
    fn: async (input) => {
      try {
        const { 
          name,
          type = "calculator",
          framework = "vanilla",
          outputDir = ".",
          includeStyles = true,
          includeTests = false,
          features = []
        } = input;

        if (!name) {
          throw new Error("App name is required");
        }

        const appDir = path.join(outputDir, name);
        await fs.mkdir(appDir, { recursive: true });

        const files = [];

        // Generate HTML file
        const htmlFile = path.join(appDir, "index.html");
        const htmlCode = generateAppHTML(name, type, framework, features);
        await fs.writeFile(htmlFile, htmlCode, "utf-8");
        files.push(htmlFile);

        // Generate JavaScript file
        const jsFile = path.join(appDir, "app.js");
        const jsCode = generateAppJS(name, type, framework, features);
        await fs.writeFile(jsFile, jsCode, "utf-8");
        files.push(jsFile);

        // Generate CSS file if requested
        if (includeStyles) {
          const cssFile = path.join(appDir, "styles.css");
          const cssCode = generateAppCSS(name, type, framework, features);
          await fs.writeFile(cssFile, cssCode, "utf-8");
          files.push(cssFile);
        }

        // Generate package.json for modern development
        const packageFile = path.join(appDir, "package.json");
        const packageContent = generateAppPackage(name, framework);
        await fs.writeFile(packageFile, packageContent, "utf-8");
        files.push(packageFile);

        // Generate README
        const readmeFile = path.join(appDir, "README.md");
        const readmeContent = generateAppReadme(name, type, framework, features);
        await fs.writeFile(readmeFile, readmeContent, "utf-8");
        files.push(readmeFile);

        // Generate tests if requested
        if (includeTests) {
          const testFile = path.join(appDir, "app.test.js");
          const testCode = generateAppTests(name, type, framework);
          await fs.writeFile(testFile, testCode, "utf-8");
          files.push(testFile);
        }

        return `Web application '${name}' (${type}) created in ${appDir}\nFiles created:\n${files.map(f => `  • ${path.relative(process.cwd(), f)}`).join('\n')}\n\nTo run the app:\n  cd ${name}\n  open index.html\n  # or for development: npm install && npm start`;
      } catch (error) {
        throw new Error(`App generation failed: ${error.message}`);
      }
    },
  },
};

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

// Code generation helper functions
function generateFunction(language, description, requirements) {
  const funcName = description.toLowerCase().replace(/\s+/g, '_');
  
  switch (language) {
    case "javascript":
      return `function ${funcName}(${requirements || 'params'}) {
  // TODO: Implement ${description}
  return null;
}

module.exports = ${funcName};`;
    
    case "python":
      return `def ${funcName}(${requirements || 'params'}):
    """
    ${description}
    """
    # TODO: Implement ${description}
    return None`;
    
    default:
      return `// ${description}\n// Requirements: ${requirements || 'None'}`;
  }
}

function generateClass(language, description, requirements) {
  const className = description.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');
  
  switch (language) {
    case "javascript":
      return `class ${className} {
  constructor(${requirements || 'params'}) {
    // Initialize ${description}
  }
  
  // TODO: Add methods for ${description}
}

module.exports = ${className};`;
    
    case "python":
      return `class ${className}:
    """
    ${description}
    """
    
    def __init__(self, ${requirements || 'params'}):
        # Initialize ${description}
        pass
    
    # TODO: Add methods for ${description}`;
    
    default:
      return `// ${description}\n// Requirements: ${requirements || 'None'}`;
  }
}

function generateComponent(language, description, requirements) {
  const componentName = description.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');
  
  switch (language) {
    case "react":
      return `import React from 'react';

const ${componentName} = ({ ${requirements || 'props'} }) => {
  return (
    <div>
      {/* TODO: Implement ${description} */}
    </div>
  );
};

export default ${componentName};`;
    
    case "vue":
      return `<template>
  <div>
    <!-- TODO: Implement ${description} -->
  </div>
</template>

<script>
export default {
  name: '${componentName}',
  props: {
    ${requirements || '// Add props here'}
  }
}
</script>`;
    
    default:
      return `// ${description}\n// Requirements: ${requirements || 'None'}`;
  }
}

function generateAPI(language, description, requirements) {
  switch (language) {
    case "javascript":
      return `const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Routes for ${description}
app.get('/api/${description.toLowerCase().replace(/\s+/g, '-')}', (req, res) => {
  res.json({ message: '${description} endpoint' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`;
    
    default:
      return `// ${description}\n// Requirements: ${requirements || 'None'}`;
  }
}

function generateTest(language, description, requirements) {
  const testName = description.toLowerCase().replace(/\s+/g, '_');
  
  switch (language) {
    case "javascript":
      return `const { ${testName} } = require('./${testName}');

describe('${description}', () => {
  test('should work correctly', () => {
    // TODO: Add test cases for ${description}
    expect(true).toBe(true);
  });
});`;
    
    case "python":
      return `import unittest
from ${testName} import ${testName}

class Test${testName.split('_').map(word => 
  word.charAt(0).toUpperCase() + word.slice(1)
).join('')}(unittest.TestCase):
    def test_${testName}(self):
        # TODO: Add test cases for ${description}
        self.assertTrue(True)`;
    
    default:
      return `// Test for ${description}\n// Requirements: ${requirements || 'None'}`;
  }
}

function generateGeneric(language, description, requirements) {
  return `// ${description}
// Language: ${language}
// Requirements: ${requirements || 'None'}

// TODO: Implement ${description}`;
}

// Feature implementation helpers
function generateFeatureImplementation(feature, language, framework) {
  const featureName = feature.toLowerCase().replace(/\s+/g, '-');
  
  return `// ${feature} Implementation
// Generated for ${framework} using ${language}

class ${feature.split(' ').map(word => 
  word.charAt(0).toUpperCase() + word.slice(1)
).join('')} {
  constructor() {
    this.initialized = false;
  }
  
  async initialize() {
    // TODO: Initialize ${feature}
    this.initialized = true;
  }
  
  async process() {
    if (!this.initialized) {
      throw new Error('${feature} not initialized');
    }
    
    // TODO: Implement ${feature} logic
    return { success: true };
  }
}

module.exports = ${feature.split(' ').map(word => 
  word.charAt(0).toUpperCase() + word.slice(1)
).join('')};`;
}

function generateFeatureTests(feature, language) {
  const featureName = feature.toLowerCase().replace(/\s+/g, '-');
  const className = feature.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');
  
  return `const ${className} = require('./${featureName}');

describe('${feature}', () => {
  let ${featureName};
  
  beforeEach(() => {
    ${featureName} = new ${className}();
  });
  
  test('should initialize correctly', async () => {
    await ${featureName}.initialize();
    expect(${featureName}.initialized).toBe(true);
  });
  
  test('should process successfully', async () => {
    await ${featureName}.initialize();
    const result = await ${featureName}.process();
    expect(result.success).toBe(true);
  });
});`;
}

function generateFeatureReadme(feature, files) {
  return `# ${feature}

## Description
This feature implements ${feature.toLowerCase()}.

## Files
${files.map(f => `- \`${f}\``).join('\n')}

## Usage
\`\`\`javascript
const ${feature.split(' ').map(word => 
  word.charAt(0).toUpperCase() + word.slice(1)
).join('')} = require('./${feature.toLowerCase().replace(/\s+/g, '-')}');

const instance = new ${feature.split(' ').map(word => 
  word.charAt(0).toUpperCase() + word.slice(1)
).join('')}();
await instance.initialize();
const result = await instance.process();
\`\`\`

## Testing
Run tests with:
\`\`\`bash
npm test
\`\`\``;
}

// Code refactoring helpers
function optimizeCode(content) {
  // Simple optimizations
  let optimized = content
    .replace(/var /g, 'let ')
    .replace(/function\s+(\w+)\s*\(/g, 'const $1 = (')
    .replace(/\)\s*{/g, ') => {');
  
  return `// Optimized code
${optimized}`;
}

function modernizeCode(content) {
  // Add modern JavaScript features
  return `// Modernized code with ES6+ features
${content}
`;
}

function addTypeAnnotations(content) {
  // Add JSDoc type annotations
  return `// Code with type annotations
${content}
`;
}

function addErrorHandling(content) {
  // Add try-catch blocks
  return `// Code with error handling
${content}
`;
}

function addDocumentation(content) {
  // Add JSDoc comments
  return `// Well-documented code
${content}
`;
}

// API generation helpers
function generateAPIServer(name, framework, endpoints, includeAuth, includeValidation) {
  return `const express = require('express');
const cors = require('cors');
${includeAuth ? "const jwt = require('jsonwebtoken');" : ''}
${includeValidation ? "const { body, validationResult } = require('express-validator');" : ''}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

${includeAuth ? `// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};` : ''}

// Routes
app.get('/', (req, res) => {
  res.json({ message: '${name} API is running!' });
});

${endpoints.map(endpoint => `
app.${endpoint.method || 'get'}('${endpoint.path || '/api'}/${endpoint.name || 'endpoint'}', ${includeAuth ? 'authenticateToken, ' : ''}(req, res) => {
  res.json({ message: '${endpoint.name || 'endpoint'} endpoint' });
});`).join('')}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(\`${name} server running on port \${PORT}\`);
});

module.exports = app;`;
}

function generateAPIPackage(name, framework, includeAuth) {
  const packageData = {
    name: name.toLowerCase().replace(/\s+/g, '-'),
    version: "1.0.0",
    description: `${name} API`,
    main: "server.js",
    scripts: {
      start: "node server.js",
      dev: "nodemon server.js",
      test: "jest"
    },
    dependencies: {
      express: "^4.18.2",
      cors: "^2.8.5"
    },
    devDependencies: {
      nodemon: "^3.0.1",
      jest: "^29.5.0"
    }
  };
  
  if (includeAuth) {
    packageData.dependencies['jsonwebtoken'] = "^9.0.0";
  }
  
  return JSON.stringify(packageData, null, 2);
}

function generateAPIRoutes(endpoints, framework) {
  return `const express = require('express');
const router = express.Router();

${endpoints.map(endpoint => `
// ${endpoint.name || 'endpoint'} route
router.${endpoint.method || 'get'}('${endpoint.path || '/'}', (req, res) => {
  res.json({ message: '${endpoint.name || 'endpoint'} endpoint' });
});`).join('')}

module.exports = router;`;
}

function generateAPIMiddleware(framework, includeAuth, includeValidation) {
  return `const express = require('express');
${includeAuth ? "const jwt = require('jsonwebtoken');" : ''}
${includeValidation ? "const { body, validationResult } = require('express-validator');" : ''}

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
};

${includeAuth ? `
// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};` : ''}

${includeValidation ? `
// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};` : ''}

module.exports = {
  errorHandler${includeAuth ? ',\n  authenticateToken' : ''}${includeValidation ? ',\n  validateRequest' : ''}
};`;
}

function generateAPIReadme(name, endpoints, framework) {
  return `# ${name} API

## Description
A ${framework} API for ${name.toLowerCase()}.

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
\`\`\`bash
npm start
\`\`\`

## Endpoints
${endpoints.map(endpoint => `
### ${endpoint.name || 'endpoint'}
- **Method:** ${endpoint.method || 'GET'}
- **Path:** ${endpoint.path || '/api'}
- **Description:** ${endpoint.description || 'No description'}
`).join('')}

## Development
\`\`\`bash
npm run dev
\`\`\`

## Testing
\`\`\`bash
npm test
\`\`\``;
}

// Web application generation helpers
function generateAppHTML(name, type, framework, features) {
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  
  switch (type) {
    case "calculator":
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} Calculator</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <div class="calculator">
            <div class="display">
                <input type="text" id="display" readonly>
            </div>
            <div class="buttons">
                <button class="btn clear" onclick="clearDisplay()">C</button>
                <button class="btn clear" onclick="deleteLast()">⌫</button>
                <button class="btn operator" onclick="appendToDisplay('/')">/</button>
                <button class="btn operator" onclick="appendToDisplay('*')">×</button>
                
                <button class="btn number" onclick="appendToDisplay('7')">7</button>
                <button class="btn number" onclick="appendToDisplay('8')">8</button>
                <button class="btn number" onclick="appendToDisplay('9')">9</button>
                <button class="btn operator" onclick="appendToDisplay('-')">-</button>
                
                <button class="btn number" onclick="appendToDisplay('4')">4</button>
                <button class="btn number" onclick="appendToDisplay('5')">5</button>
                <button class="btn number" onclick="appendToDisplay('6')">6</button>
                <button class="btn operator" onclick="appendToDisplay('+')">+</button>
                
                <button class="btn number" onclick="appendToDisplay('1')">1</button>
                <button class="btn number" onclick="appendToDisplay('2')">2</button>
                <button class="btn number" onclick="appendToDisplay('3')">3</button>
                <button class="btn equals" onclick="calculate()" rowspan="2">=</button>
                
                <button class="btn number zero" onclick="appendToDisplay('0')">0</button>
                <button class="btn number" onclick="appendToDisplay('.')">.</button>
            </div>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>`;

    case "todo":
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} Todo App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <div class="todo-app">
            <h1>${title} Todo List</h1>
            <div class="input-section">
                <input type="text" id="todoInput" placeholder="Add a new todo...">
                <button onclick="addTodo()">Add</button>
            </div>
            <div class="filters">
                <button class="filter-btn active" onclick="filterTodos('all')">All</button>
                <button class="filter-btn" onclick="filterTodos('active')">Active</button>
                <button class="filter-btn" onclick="filterTodos('completed')">Completed</button>
            </div>
            <ul id="todoList" class="todo-list"></ul>
            <div class="footer">
                <span id="todoCount">0 items left</span>
                <button onclick="clearCompleted()">Clear Completed</button>
            </div>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>`;

    case "weather":
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} Weather App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <div class="weather-app">
            <h1>${title} Weather</h1>
            <div class="search-section">
                <input type="text" id="cityInput" placeholder="Enter city name...">
                <button onclick="getWeather()">Search</button>
            </div>
            <div id="weatherInfo" class="weather-info">
                <div class="weather-card">
                    <h2 id="cityName">Search for a city</h2>
                    <div id="weatherDetails">
                        <p>Enter a city name to see the weather</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>`;

    default:
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <div class="app">
            <h1>${title}</h1>
            <div id="app-content">
                <p>Welcome to ${title}!</p>
            </div>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>`;
  }
}

function generateAppJS(name, type, framework, features) {
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  
  switch (type) {
    case "calculator":
      return `// ${title} Calculator JavaScript
let display = document.getElementById('display');
let currentInput = '';
let operator = '';
let previousInput = '';
let shouldResetDisplay = false;

function appendToDisplay(value) {
    if (shouldResetDisplay) {
        display.value = '';
        shouldResetDisplay = false;
    }
    
    if (value === '.' && display.value.includes('.')) {
        return; // Prevent multiple decimal points
    }
    
    display.value += value;
    currentInput = display.value;
}

function clearDisplay() {
    display.value = '';
    currentInput = '';
    operator = '';
    previousInput = '';
}

function deleteLast() {
    display.value = display.value.slice(0, -1);
    currentInput = display.value;
}

function calculate() {
    if (!operator || !previousInput) return;
    
    const prev = parseFloat(previousInput);
    const current = parseFloat(currentInput);
    let result;
    
    switch (operator) {
        case '+':
            result = prev + current;
            break;
        case '-':
            result = prev - current;
            break;
        case '*':
            result = prev * current;
            break;
        case '/':
            if (current === 0) {
                display.value = 'Error';
                return;
            }
            result = prev / current;
            break;
        default:
            return;
    }
    
    display.value = result.toString();
    currentInput = result.toString();
    operator = '';
    previousInput = '';
    shouldResetDisplay = true;
}

function setOperator(op) {
    if (operator && previousInput && currentInput) {
        calculate();
    }
    
    operator = op;
    previousInput = currentInput;
    shouldResetDisplay = true;
}

// Keyboard support
document.addEventListener('keydown', (e) => {
    const key = e.key;
    
    if (key >= '0' && key <= '9' || key === '.') {
        appendToDisplay(key);
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
        setOperator(key);
    } else if (key === 'Enter' || key === '=') {
        calculate();
    } else if (key === 'Escape' || key === 'c' || key === 'C') {
        clearDisplay();
    } else if (key === 'Backspace') {
        deleteLast();
    }
});`;

    case "todo":
      return `// ${title} Todo App JavaScript
let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = 'all';

function renderTodos() {
    const todoList = document.getElementById('todoList');
    const todoCount = document.getElementById('todoCount');
    
    let filteredTodos = todos;
    if (currentFilter === 'active') {
        filteredTodos = todos.filter(todo => !todo.completed);
    } else if (currentFilter === 'completed') {
        filteredTodos = todos.filter(todo => todo.completed);
    }
    
    todoList.innerHTML = filteredTodos.map((todo, index) => \`
        <li class="todo-item \${todo.completed ? 'completed' : ''}">
            <input type="checkbox" \${todo.completed ? 'checked' : ''} 
                   onchange="toggleTodo(\${index})">
            <span class="todo-text">\${todo.text}</span>
            <button class="delete-btn" onclick="deleteTodo(\${index})">×</button>
        </li>
    \`).join('');
    
    const activeCount = todos.filter(todo => !todo.completed).length;
    todoCount.textContent = \`\${activeCount} item\${activeCount !== 1 ? 's' : ''} left\`;
}

function addTodo() {
    const input = document.getElementById('todoInput');
    const text = input.value.trim();
    
    if (text) {
        todos.push({
            text: text,
            completed: false,
            id: Date.now()
        });
        input.value = '';
        saveTodos();
        renderTodos();
    }
}

function deleteTodo(index) {
    const todoIndex = todos.findIndex(todo => todo.id === todos[index].id);
    todos.splice(todoIndex, 1);
    saveTodos();
    renderTodos();
}

function toggleTodo(index) {
    const todoIndex = todos.findIndex(todo => todo.id === todos[index].id);
    todos[todoIndex].completed = !todos[todoIndex].completed;
    saveTodos();
    renderTodos();
}

function filterTodos(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    renderTodos();
}

function clearCompleted() {
    todos = todos.filter(todo => !todo.completed);
    saveTodos();
    renderTodos();
}

function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// Enter key support
document.getElementById('todoInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTodo();
    }
});

// Initialize
renderTodos();`;

    case "weather":
      return `// ${title} Weather App JavaScript
const API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your OpenWeatherMap API key
const API_URL = 'https://api.openweathermap.org/data/2.5/weather';

async function getWeather() {
    const cityInput = document.getElementById('cityInput');
    const city = cityInput.value.trim();
    
    if (!city) {
        alert('Please enter a city name');
        return;
    }
    
    try {
        const response = await fetch(\`\${API_URL}?q=\${city}&appid=\${API_KEY}&units=metric\`);
        const data = await response.json();
        
        if (data.cod === 200) {
            displayWeather(data);
        } else {
            alert('City not found. Please try again.');
        }
    } catch (error) {
        console.error('Error fetching weather:', error);
        alert('Error fetching weather data. Please try again.');
    }
}

function displayWeather(data) {
    const cityName = document.getElementById('cityName');
    const weatherDetails = document.getElementById('weatherDetails');
    
    cityName.textContent = \`\${data.name}, \${data.sys.country}\`;
    
    weatherDetails.innerHTML = \`
        <div class="weather-main">
            <div class="temperature">\${Math.round(data.main.temp)}°C</div>
            <div class="description">\${data.weather[0].description}</div>
        </div>
        <div class="weather-details">
            <div class="detail">
                <span class="label">Feels like:</span>
                <span class="value">\${Math.round(data.main.feels_like)}°C</span>
            </div>
            <div class="detail">
                <span class="label">Humidity:</span>
                <span class="value">\${data.main.humidity}%</span>
            </div>
            <div class="detail">
                <span class="label">Wind:</span>
                <span class="value">\${data.wind.speed} m/s</span>
            </div>
            <div class="detail">
                <span class="label">Pressure:</span>
                <span class="value">\${data.main.pressure} hPa</span>
            </div>
        </div>
    \`;
}

// Enter key support
document.getElementById('cityInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        getWeather();
    }
});

// Load weather for default city on page load
window.addEventListener('load', () => {
    // You can set a default city here
    // getWeather();
});`;

    default:
      return `// ${title} JavaScript
console.log('${title} app loaded!');

// Add your app logic here
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, ready to initialize ${title}');
    
    // Initialize your app
    initializeApp();
});

function initializeApp() {
    // Add initialization logic here
    console.log('${title} initialized');
}`;
  }
}

function generateAppCSS(name, type, framework, features) {
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  
  switch (type) {
    case "calculator":
      return `/* ${title} Calculator Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

.container {
    width: 100%;
    max-width: 400px;
    padding: 20px;
}

.calculator {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
    border: 1px solid rgba(255, 255, 255, 0.18);
}

.display {
    margin-bottom: 20px;
}

.display input {
    width: 100%;
    height: 60px;
    font-size: 24px;
    text-align: right;
    padding: 0 15px;
    border: none;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    outline: none;
}

.buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
}

.btn {
    height: 60px;
    border: none;
    border-radius: 10px;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
}

.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn:active {
    transform: translateY(0);
}

.btn.number {
    background: rgba(255, 255, 255, 0.9);
    color: #333;
}

.btn.operator {
    background: #ff6b6b;
    color: white;
}

.btn.clear {
    background: #ffa726;
    color: white;
}

.btn.equals {
    background: #4caf50;
    color: white;
    grid-row: span 2;
}

.btn.zero {
    grid-column: span 2;
}`;

    case "todo":
      return `/* ${title} Todo App Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
    min-height: 100vh;
    padding: 20px;
}

.container {
    max-width: 600px;
    margin: 0 auto;
}

.todo-app {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    padding: 30px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

h1 {
    text-align: center;
    color: #2d3436;
    margin-bottom: 30px;
    font-size: 2.5em;
}

.input-section {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.input-section input {
    flex: 1;
    padding: 15px;
    border: 2px solid #ddd;
    border-radius: 10px;
    font-size: 16px;
    outline: none;
    transition: border-color 0.3s ease;
}

.input-section input:focus {
    border-color: #74b9ff;
}

.input-section button {
    padding: 15px 25px;
    background: #74b9ff;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.3s ease;
}

.input-section button:hover {
    background: #0984e3;
}

.filters {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    justify-content: center;
}

.filter-btn {
    padding: 10px 20px;
    border: 2px solid #ddd;
    background: white;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.filter-btn.active,
.filter-btn:hover {
    background: #74b9ff;
    color: white;
    border-color: #74b9ff;
}

.todo-list {
    list-style: none;
    margin-bottom: 20px;
}

.todo-item {
    display: flex;
    align-items: center;
    padding: 15px;
    margin-bottom: 10px;
    background: #f8f9fa;
    border-radius: 10px;
    transition: all 0.3s ease;
}

.todo-item:hover {
    background: #e9ecef;
}

.todo-item.completed .todo-text {
    text-decoration: line-through;
    color: #6c757d;
}

.todo-item input[type="checkbox"] {
    margin-right: 15px;
    transform: scale(1.2);
}

.todo-text {
    flex: 1;
    font-size: 16px;
}

.delete-btn {
    background: #ff6b6b;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 18px;
    transition: background 0.3s ease;
}

.delete-btn:hover {
    background: #e74c3c;
}

.footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 20px;
    border-top: 1px solid #ddd;
}

.footer button {
    padding: 10px 20px;
    background: #ff6b6b;
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.3s ease;
}

.footer button:hover {
    background: #e74c3c;
}`;

    case "weather":
      return `/* ${title} Weather App Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
    min-height: 100vh;
    padding: 20px;
}

.container {
    max-width: 500px;
    margin: 0 auto;
}

.weather-app {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    padding: 30px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    text-align: center;
}

h1 {
    color: #2d3436;
    margin-bottom: 30px;
    font-size: 2.5em;
}

.search-section {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
}

.search-section input {
    flex: 1;
    padding: 15px;
    border: 2px solid #ddd;
    border-radius: 10px;
    font-size: 16px;
    outline: none;
    transition: border-color 0.3s ease;
}

.search-section input:focus {
    border-color: #74b9ff;
}

.search-section button {
    padding: 15px 25px;
    background: #74b9ff;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.3s ease;
}

.search-section button:hover {
    background: #0984e3;
}

.weather-info {
    margin-top: 20px;
}

.weather-card {
    background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
    color: white;
    border-radius: 15px;
    padding: 30px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.weather-main {
    margin-bottom: 20px;
}

.temperature {
    font-size: 4em;
    font-weight: bold;
    margin-bottom: 10px;
}

.description {
    font-size: 1.2em;
    text-transform: capitalize;
}

.weather-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-top: 20px;
}

.detail {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}

.label {
    font-weight: bold;
}

.value {
    font-weight: normal;
}`;

    default:
      return `/* ${title} Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

.container {
    max-width: 800px;
    width: 100%;
    padding: 20px;
}

.app {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    padding: 40px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    text-align: center;
}

h1 {
    color: #2d3436;
    margin-bottom: 30px;
    font-size: 2.5em;
}

#app-content {
    color: #636e72;
    font-size: 1.2em;
    line-height: 1.6;
}`;
  }
}

function generateAppPackage(name, framework) {
  const packageData = {
    name: name.toLowerCase().replace(/\s+/g, '-'),
    version: "1.0.0",
    description: `${name} web application`,
    main: "index.html",
    scripts: {
      start: "npx http-server . -p 3000 -o",
      dev: "npx live-server --port=3000 --open=/index.html",
      build: "echo 'No build process needed for vanilla JS'",
      test: "echo 'No tests specified'"
    },
    keywords: ["web", "app", "javascript", "html", "css"],
    author: "",
    license: "MIT",
    devDependencies: {
      "http-server": "^14.1.1",
      "live-server": "^1.2.2"
    }
  };
  
  return JSON.stringify(packageData, null, 2);
}

function generateAppReadme(name, type, framework, features) {
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  
  return `# ${title}

A ${type} web application built with ${framework} JavaScript.

## Features

${getAppFeatures(type)}

## Getting Started

### Prerequisites
- A modern web browser
- Node.js (optional, for development server)

### Installation

1. Clone or download this project
2. Open \`index.html\` in your web browser

### Development

For a better development experience with live reload:

\`\`\`bash
npm install
npm run dev
\`\`\`

This will start a development server at http://localhost:3000

## Usage

${getAppUsage(type)}

## File Structure

\`\`\`
${name}/
├── index.html      # Main HTML file
├── app.js          # JavaScript application logic
├── styles.css      # CSS styles
├── package.json    # Project configuration
└── README.md       # This file
\`\`\`

## Customization

You can customize the app by modifying:
- \`styles.css\` for visual changes
- \`app.js\` for functionality changes
- \`index.html\` for structure changes

## License

MIT License - feel free to use this project for learning or as a starting point for your own applications.`;
}

function generateAppTests(name, type, framework) {
  return `// ${name} Tests
// Simple test framework for basic functionality

function runTests() {
    console.log('Running tests for ${name}...');
    
    // Add your tests here
    test('App initializes correctly', () => {
        // Test initialization
        console.log('✓ App initializes correctly');
    });
    
    // Add more tests based on app type
    ${getAppTests(type)}
    
    console.log('All tests completed!');
}

function test(name, testFn) {
    try {
        testFn();
    } catch (error) {
        console.error(\`✗ \${name}: \${error.message}\`);
    }
}

// Run tests when page loads
if (typeof window !== 'undefined') {
    window.addEventListener('load', runTests);
} else {
    runTests();
}`;
}

// Helper functions for app-specific content
function getAppFeatures(type) {
  switch (type) {
    case "calculator":
      return `- Basic arithmetic operations (+, -, ×, ÷)
- Decimal number support
- Clear and delete functions
- Keyboard support
- Responsive design
- Modern glassmorphism UI`;
    case "todo":
      return `- Add, edit, and delete todos
- Mark todos as complete/incomplete
- Filter todos (All, Active, Completed)
- Local storage persistence
- Responsive design
- Modern UI with smooth animations`;
    case "weather":
      return `- Search weather by city
- Current weather conditions
- Temperature, humidity, wind speed
- Responsive design
- Modern card-based UI`;
    default:
      return `- Modern responsive design
- Clean and intuitive interface
- Cross-browser compatibility`;
  }
}

function getAppUsage(type) {
  switch (type) {
    case "calculator":
      return `1. Click number buttons to input numbers
2. Click operator buttons (+, -, ×, ÷) to select operations
3. Click = to calculate the result
4. Use C to clear the display
5. Use ⌫ to delete the last character
6. Keyboard shortcuts are also supported`;
    case "todo":
      return `1. Type a todo item in the input field
2. Click "Add" or press Enter to add the todo
3. Click the checkbox to mark a todo as complete
4. Use the filter buttons to view different todo states
5. Click the × button to delete a todo
6. Use "Clear Completed" to remove all completed todos`;
    case "weather":
      return `1. Enter a city name in the search field
2. Click "Search" or press Enter
3. View the current weather conditions for that city
4. The app displays temperature, humidity, wind speed, and more`;
    default:
      return `1. Open the application in your web browser
2. Follow the on-screen instructions
3. Enjoy using the application!`;
  }
}

function getAppTests(type) {
  switch (type) {
    case "calculator":
      return `test('Calculator basic operations', () => {
        // Test basic arithmetic
        console.log('✓ Calculator operations work correctly');
    });`;
    case "todo":
      return `test('Todo CRUD operations', () => {
        // Test add, update, delete
        console.log('✓ Todo operations work correctly');
    });`;
    case "weather":
      return `test('Weather API integration', () => {
        // Test weather data fetching
        console.log('✓ Weather API integration works');
    });`;
    default:
      return `test('App functionality', () => {
        // Test basic app functionality
        console.log('✓ App functionality works correctly');
    });`;
  }
}