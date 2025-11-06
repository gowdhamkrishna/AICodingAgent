# Cursor Clone - Usage Guide

## Quick Start

### 1. Installation
```bash
# Clone the repository
git clone <repository-url>
cd cursor-clone

# Install dependencies
npm install

# Set up environment
echo "GOOGLE_API_KEY=your_api_key_here" > .env

# Install globally (optional)
./install.sh
```

### 2. Basic Usage

#### Interactive Mode
```bash
# Start interactive assistant
cursor-ai

# Or run directly
node cli.js
```

#### Command Line Mode
```bash
# Get help
cursor-ai help

# System information
cursor-ai info

# Browse current directory
cursor-ai browse .

# Find JavaScript files
cursor-ai find "*.js"

# Search for text
cursor-ai search "function"

# Create a new project
cursor-ai create my-project

# Backup workspace
cursor-ai backup
```

## Common Commands

### Directory Operations
```bash
# Browse with options
cursor-ai browse . --recursive --max-depth 3

# Find files with filtering
cursor-ai find "*.test.js" --file-types .js

# Search in specific directory
cursor-ai search "TODO" --directory ./src
```

### Text Operations
```bash
# Search and replace (dry run)
cursor-ai replace "var " "let " --file-types .js --dry-run

# Apply changes
cursor-ai replace "var " "let " --file-types .js

# Search in specific file types
cursor-ai search "import" --file-types .js,.ts
```

### Project Management
```bash
# Create different project types
cursor-ai create my-app node basic
cursor-ai create my-api node express
cursor-ai create my-script python basic

# List available templates
cursor-ai templates

# Backup to specific location
cursor-ai backup /tmp/my-backups
```

### Configuration
```bash
# Get configuration
cursor-ai config get global.maxDepth

# Set configuration
cursor-ai config set global.maxDepth 10

# List all templates
cursor-ai templates
```

## Examples by Use Case

### Web Development
```bash
# Find React components
cursor-ai find "*.jsx" --file-types .jsx

# Search for hooks
cursor-ai search "useState" --file-types .js,.jsx

# Replace class with function components
cursor-ai replace "class " "function " --file-types .js,.jsx --dry-run
```

### Node.js Development
```bash
# Find package.json files
cursor-ai find "package.json"

# Search for require statements
cursor-ai search "require(" --file-types .js

# Find test files
cursor-ai find "*.test.js" --file-types .js
```

### Python Development
```bash
# Find Python files
cursor-ai find "*.py"

# Search for imports
cursor-ai search "import " --file-types .py

# Find test files
cursor-ai find "test_*.py" --file-types .py
```

### Database Operations
```bash
# Find SQL files
cursor-ai find "*.sql"

# Search for migrations
cursor-ai search "migration" --file-types .sql,.js

# Find database configs
cursor-ai find "database" --file-types .json,.yaml,.env
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

1. **Permission Issues**
   ```bash
   # Make CLI executable
   chmod +x cli.js
   
   # Run with proper permissions
   sudo cursor-ai info
   ```

2. **API Key Issues**
   ```bash
   # Check if API key is set
   echo $GOOGLE_API_KEY
   
   # Set API key
   export GOOGLE_API_KEY=your_key_here
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

## Tips and Tricks

### 1. Use Aliases
```bash
# Add to ~/.bashrc or ~/.zshrc
alias c="cursor-ai"
alias cb="cursor-ai browse"
alias cf="cursor-ai find"
alias cs="cursor-ai search"
alias cr="cursor-ai replace"
```

### 2. Create Custom Scripts
```bash
#!/bin/bash
# daily-backup.sh
cursor-ai backup /tmp/daily-backups/$(date +%Y-%m-%d)
cursor-ai info
```

### 3. Use with Git Hooks
```bash
#!/bin/bash
# pre-commit hook
cursor-ai search "console.log" --file-types .js
if [ $? -eq 0 ]; then
    echo "Warning: console.log statements found"
fi
```

### 4. Integration with IDEs
```bash
# VS Code tasks.json
{
    "label": "Find TODOs",
    "type": "shell",
    "command": "cursor-ai",
    "args": ["search", "TODO", "--file-types", ".js,.ts"]
}
```

## Best Practices

1. **Always use dry-run first** for replace operations
2. **Backup before major changes** using the backup command
3. **Use specific file types** to avoid unwanted matches
4. **Exclude unnecessary directories** to improve performance
5. **Set up configuration** for your common use cases

## Getting Help

- Run `cursor-ai help` for command help
- Check the README.md for detailed documentation
- Use the interactive mode for guided assistance
- Check the CLI_QUICK_REFERENCE.md for quick commands
