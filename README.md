# Cursor Clone - AI-Powered Development Assistant

## Description
An advanced AI-powered development assistant that provides intelligent code assistance, file system operations, and project management capabilities. Built with Node.js and Google Gemini, it offers both interactive and command-line interfaces for enhanced developer productivity.

## Features

### 🤖 AI-Powered Assistance
- Intelligent code analysis and suggestions
- Error detection and debugging help
- Code refactoring and optimization
- Context-aware code generation

### 📁 Advanced File System Operations
- Recursive directory browsing with filtering
- Global file search with pattern matching
- Cross-directory text search and replace
- File type filtering and exclusion rules

### 🚀 Project Management
- Project creation with customizable templates
- Workspace backup and synchronization
- Configuration management
- Template system for different project types

### 🛠️ Command Line Interface
- Interactive mode for guided assistance
- Direct command execution
- Batch operations support
- Comprehensive help system

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm, yarn, or pnpm
- Google Gemini API key

### Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd cursor-clone
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. Create a `.env` file with your Google Gemini API key:
   ```bash
   echo "GOOGLE_API_KEY=your_api_key_here" > .env
   ```

4. Install globally (optional):
   ```bash
   # Option 1: Using the installation script
   ./install.sh
   
   # Option 2: Manual installation
   sudo npm install -g .
   
   # Option 3: Local installation (add to PATH)
   npm install
   echo 'export PATH="$PATH:$(pwd)"' >> ~/.bashrc
   source ~/.bashrc
   ```

## Usage

### Interactive Mode
Start the interactive assistant:
```bash
npm start
# or
node index.js
```

### Command Line Interface
Use the CLI for direct operations:
```bash
# Interactive CLI mode
cursor-ai

# Direct commands
cursor-ai <command> [options]
```

## CLI Commands

### Directory Operations

#### Browse Directories
```bash
# Basic directory listing
cursor-ai browse .

# Recursive browsing with depth limit
cursor-ai browse . --recursive --max-depth 3

# Include hidden files
cursor-ai browse . --include-hidden

# Filter by file types
cursor-ai browse . --file-types .js,.ts,.jsx

# Exclude specific directories
cursor-ai browse . --exclude-dirs node_modules,.git
```

#### Find Files
```bash
# Find files by pattern
cursor-ai find "*.js"

# Find files with specific extensions
cursor-ai find "config" --file-types .json,.yaml

# Recursive search with depth limit
cursor-ai find "*.test.js" --max-depth 5

# Include hidden files in search
cursor-ai find ".*" --include-hidden
```

### Text Operations

#### Search in Files
```bash
# Search for text in files
cursor-ai search "function"

# Search in specific file types
cursor-ai search "import" --file-types .js,.ts

# Search in specific directory
cursor-ai search "TODO" --directory ./src
```

#### Global Search and Replace
```bash
# Dry run (preview changes)
cursor-ai replace "oldText" "newText" --dry-run

# Actual replacement
cursor-ai replace "oldText" "newText"

# Replace in specific file types
cursor-ai replace "var" "let" --file-types .js

# Replace in specific directory
cursor-ai replace "localhost" "production.com" --directory ./config
```

### Project Management

#### Create Projects
```bash
# Create basic Node.js project
cursor-ai create my-project

# Create with specific type and template
cursor-ai create my-express-app node express

# Create in specific directory
cursor-ai create my-project node basic --directory ./projects
```

#### Workspace Operations
```bash
# Backup current workspace
cursor-ai backup

# Backup to specific location
cursor-ai backup /path/to/backups

# Backup including node_modules
cursor-ai backup --include-node-modules
```

### System Information
```bash
# Get system information
cursor-ai info
```

### Help
```bash
# Show help
cursor-ai help

# Show specific command help
cursor-ai help browse
```

## Configuration

### Global Configuration
The tool uses a configuration file located at `~/.cursor-clone/config.json`. You can customize:

- Default file types for operations
- Excluded directories
- Maximum search depth
- Template settings
- AI model preferences

### Configuration Commands
```bash
# Get configuration value
cursor-ai config get global.maxDepth

# Set configuration value
cursor-ai config set global.maxDepth 10

# List all templates
cursor-ai templates list

# Add custom template
cursor-ai templates add node my-template ./template.json
```

## Project Templates

### Available Templates

#### Node.js Templates
- **basic**: Simple Node.js project with package.json and index.js
- **express**: Express.js project with dependencies and basic server setup

#### Python Templates
- **basic**: Simple Python project with main.py and requirements.txt

### Creating Custom Templates
```bash
# Add a new template
cursor-ai templates add node my-template ./my-template.json
```

Template format:
```json
{
  "description": "My custom template",
  "files": {
    "package.json": {
      "name": "{{name}}",
      "version": "1.0.0",
      "scripts": {
        "start": "node index.js"
      }
    },
    "index.js": "console.log('Hello from {{name}}!');",
    "README.md": "# {{name}}\n\nA custom project template."
  }
}
```

## Advanced Usage

### Batch Operations
```bash
# Find and replace across multiple file types
cursor-ai replace "old" "new" --file-types .js,.ts,.jsx,.tsx

# Search with complex patterns
cursor-ai find "test-*" --file-types .js --exclude-dirs node_modules,dist
```

### Integration with Scripts
```bash
#!/bin/bash
# Backup and create new project
cursor-ai backup /tmp/backups
cursor-ai create new-feature node express
cd new-feature
npm install
```

### Environment Variables
```bash
# Set custom configuration
export CURSOR_MAX_DEPTH=10
export CURSOR_EXCLUDE_DIRS="node_modules,.git,dist"
cursor-ai browse .
```

## Troubleshooting

### Common Issues

1. **API Key Issues**
   ```bash
   # Check if API key is set
   echo $GOOGLE_API_KEY
   
   # Set API key
   export GOOGLE_API_KEY=your_key_here
   ```

2. **Permission Issues**
   ```bash
   # Make CLI executable
   chmod +x cli.js
   
   # Run with proper permissions
   sudo cursor-ai info
   ```

3. **Configuration Issues**
   ```bash
   # Reset configuration
   cursor-ai config reset
   
   # Check configuration
   cursor-ai config get
   ```

### Debug Mode
```bash
# Enable debug logging
DEBUG=cursor-clone cursor-ai browse .
```

## Examples

### Daily Workflow
```bash
# Start your day
cursor-ai info

# Browse your project
cursor-ai browse . --recursive --max-depth 2

# Find all test files
cursor-ai find "*.test.js"

# Search for TODO comments
cursor-ai search "TODO"

# Create a new feature branch
cursor-ai create feature-auth node express
```

### Code Refactoring
```bash
# Find all var declarations
cursor-ai search "var " --file-types .js

# Replace var with let (dry run first)
cursor-ai replace "var " "let " --file-types .js --dry-run

# Apply changes
cursor-ai replace "var " "let " --file-types .js
```

### Project Setup
```bash
# Create project structure
cursor-ai create my-app node express
cd my-app

# Install dependencies
npm install

# Backup before changes
cursor-ai backup ../backups

# Start development
npm run dev
```

## API Reference

### Tools Available
- `executeCommand`: Execute shell commands
- `readFile`: Read file contents
- `writeFile`: Write file contents
- `listFiles`: List directory contents
- `browseDirectory`: Advanced directory browsing
- `findFiles`: Find files with patterns
- `searchInFiles`: Search text in files
- `globalSearchReplace`: Global search and replace
- `createProject`: Create new projects
- `backupWorkspace`: Backup workspace
- `getSystemInfo`: Get system information
- `getConfig`: Get configuration
- `setConfig`: Set configuration
- `listTemplates`: List project templates
- `addTemplate`: Add custom template
- `removeTemplate`: Remove template
- `resetConfig`: Reset configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - see LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review the examples
- Open an issue on GitHub 
