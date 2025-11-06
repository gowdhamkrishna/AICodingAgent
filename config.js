import fs from "fs/promises";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".cursor-clone");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// Default configuration
const defaultConfig = {
  // Global settings
  global: {
    maxDepth: 5,
    includeHidden: false,
    excludeDirs: ["node_modules", ".git", ".vscode", ".idea", ".DS_Store"],
    fileTypes: [".js", ".ts", ".jsx", ".tsx", ".json", ".md", ".txt"],
    sortBy: "name",
    order: "asc"
  },
  
  // Project templates
  templates: {
    node: {
      basic: {
        files: {
          "package.json": {
            name: "{{name}}",
            version: "1.0.0",
            type: "module",
            main: "index.js",
            scripts: {
              start: "node index.js",
              dev: "node --watch index.js"
            }
          },
          "index.js": "console.log('Hello, World!');",
          "README.md": "# {{name}}\n\nA Node.js project."
        }
      },
      express: {
        files: {
          "package.json": {
            name: "{{name}}",
            version: "1.0.0",
            type: "module",
            main: "index.js",
            scripts: {
              start: "node index.js",
              dev: "node --watch index.js"
            },
            dependencies: {
              express: "^4.18.2"
            }
          },
          "index.js": `import express from 'express';\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.get('/', (req, res) => {\n  res.send('Hello, World!');\n});\n\napp.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});`,
          "README.md": "# {{name}}\n\nAn Express.js project."
        }
      }
    },
    python: {
      basic: {
        files: {
          "main.py": "print('Hello, World!')",
          "requirements.txt": "",
          "README.md": "# {{name}}\n\nA Python project."
        }
      }
    }
  },
  
  // Workspace settings
  workspace: {
    backupPath: "./backups",
    includeNodeModules: false,
    compression: false,
    autoBackup: false,
    backupInterval: 24 // hours
  },
  
  // AI settings
  ai: {
    model: "gemini-2.0-flash-exp",
    maxSteps: 50,
    timeout: 30000, // milliseconds
    temperature: 0.7
  }
};

// Configuration management class
export class ConfigManager {
  constructor() {
    this.config = null;
  }

  async load() {
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true });
      const configData = await fs.readFile(CONFIG_FILE, "utf-8");
      this.config = { ...defaultConfig, ...JSON.parse(configData) };
    } catch (error) {
      if (error.code === "ENOENT") {
        // Config file doesn't exist, use defaults
        this.config = { ...defaultConfig };
        await this.save();
      } else {
        throw error;
      }
    }
    return this.config;
  }

  async save() {
    if (!this.config) {
      await this.load();
    }
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2), "utf-8");
  }

  get(path) {
    if (!this.config) {
      throw new Error("Config not loaded. Call load() first.");
    }
    
    if (!path) return this.config;
    
    const keys = path.split(".");
    let value = this.config;
    
    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  set(path, value) {
    if (!this.config) {
      throw new Error("Config not loaded. Call load() first.");
    }
    
    const keys = path.split(".");
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  async reset() {
    this.config = { ...defaultConfig };
    await this.save();
  }

  async addTemplate(type, name, template) {
    if (!this.config.templates[type]) {
      this.config.templates[type] = {};
    }
    this.config.templates[type][name] = template;
    await this.save();
  }

  async removeTemplate(type, name) {
    if (this.config.templates[type] && this.config.templates[type][name]) {
      delete this.config.templates[type][name];
      await this.save();
    }
  }

  getTemplates() {
    return this.config?.templates || {};
  }

  getTemplate(type, name) {
    return this.config?.templates?.[type]?.[name];
  }

  // Helper method to process template files with variables
  processTemplate(template, variables = {}) {
    if (typeof template === "string") {
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] || match;
      });
    } else if (typeof template === "object" && template !== null) {
      if (Array.isArray(template)) {
        return template.map(item => this.processTemplate(item, variables));
      } else {
        const result = {};
        for (const [key, value] of Object.entries(template)) {
          result[key] = this.processTemplate(value, variables);
        }
        return result;
      }
    }
    return template;
  }
}

// Global config instance
export const config = new ConfigManager();

// Utility functions
export async function getConfig(path) {
  await config.load();
  return config.get(path);
}

export async function setConfig(path, value) {
  await config.load();
  config.set(path, value);
  await config.save();
}

export async function getTemplates() {
  await config.load();
  return config.getTemplates();
}

export async function getTemplate(type, name) {
  await config.load();
  return config.getTemplate(type, name);
}

export async function addTemplate(type, name, template) {
  await config.load();
  await config.addTemplate(type, name, template);
}

export async function removeTemplate(type, name) {
  await config.load();
  await config.removeTemplate(type, name);
}

export async function resetConfig() {
  await config.reset();
}

// Initialize config on import
config.load().catch(console.error);



