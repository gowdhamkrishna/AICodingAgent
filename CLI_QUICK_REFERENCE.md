# Cursor Clone CLI - Quick Reference

## Basic Commands

| Command | Description | Example |
|---------|-------------|---------|
| `cursor-ai help` | Show help information | `cursor-ai help` |
| `cursor-ai info` | Get system information | `cursor-ai info` |
| `cursor-ai browse <path>` | Browse directories | `cursor-ai browse .` |
| `cursor-ai find <pattern>` | Find files | `cursor-ai find "*.js"` |
| `cursor-ai search <text>` | Search in files | `cursor-ai search "function"` |
| `cursor-ai replace <old> <new>` | Search and replace | `cursor-ai replace "var" "let"` |
| `cursor-ai create <name>` | Create project | `cursor-ai create my-app` |
| `cursor-ai backup [path]` | Backup workspace | `cursor-ai backup` |

## Common Options

| Option | Description | Example |
|--------|-------------|---------|
| `--recursive` | Enable recursive operations | `cursor-ai browse . --recursive` |
| `--max-depth <n>` | Maximum depth for recursive ops | `cursor-ai browse . --max-depth 3` |
| `--include-hidden` | Include hidden files/dirs | `cursor-ai find ".*" --include-hidden` |
| `--file-types <types>` | Filter by file types | `cursor-ai search "import" --file-types .js,.ts` |
| `--exclude-dirs <dirs>` | Exclude directories | `cursor-ai browse . --exclude-dirs node_modules` |
| `--dry-run` | Preview changes without applying | `cursor-ai replace "old" "new" --dry-run` |

## File Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `*.js` | All JavaScript files | `cursor-ai find "*.js"` |
| `test-*` | Files starting with "test-" | `cursor-ai find "test-*"` |
| `*.test.js` | Test files | `cursor-ai find "*.test.js"` |
| `.*` | Hidden files | `cursor-ai find ".*" --include-hidden` |

## Project Templates

| Type | Template | Description |
|------|----------|-------------|
| `node` | `basic` | Basic Node.js project |
| `node` | `express` | Express.js project |
| `python` | `basic` | Basic Python project |

## Common Workflows

### Daily Development
```bash
# Check system
cursor-ai info

# Browse project
cursor-ai browse . --recursive --max-depth 2

# Find test files
cursor-ai find "*.test.js"

# Search for TODOs
cursor-ai search "TODO"
```

### Code Refactoring
```bash
# Find all var declarations
cursor-ai search "var " --file-types .js

# Preview replacement
cursor-ai replace "var " "let " --file-types .js --dry-run

# Apply changes
cursor-ai replace "var " "let " --file-types .js
```

### Project Setup
```bash
# Create new project
cursor-ai create my-app node express

# Backup before changes
cursor-ai backup /tmp/backups

# Find configuration files
cursor-ai find "config" --file-types .json,.yaml
```

### File Management
```bash
# Find large files
cursor-ai browse . --recursive --sort-by size --order desc

# Find recently modified files
cursor-ai browse . --recursive --sort-by modified --order desc

# Search in specific directory
cursor-ai search "import" --directory ./src --file-types .js,.ts
```

## Configuration

### Get Configuration
```bash
cursor-ai config get global.maxDepth
cursor-ai config get global.excludeDirs
```

### Set Configuration
```bash
cursor-ai config set global.maxDepth 10
cursor-ai config set global.excludeDirs "node_modules,.git,dist"
```

### Reset Configuration
```bash
cursor-ai config reset
```

## Troubleshooting

### Common Issues
```bash
# Check API key
echo $GOOGLE_API_KEY

# Make executable
chmod +x cli.js

# Debug mode
DEBUG=cursor-clone cursor-ai browse .
```

### Reset Everything
```bash
# Reset configuration
cursor-ai config reset

# Check system info
cursor-ai info
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_API_KEY` | Google Gemini API key | Required |
| `CURSOR_MAX_DEPTH` | Default max depth | 5 |
| `CURSOR_EXCLUDE_DIRS` | Default excluded dirs | node_modules,.git |

## Examples by Use Case

### Web Development
```bash
# Find all React components
cursor-ai find "*.jsx" --file-types .jsx

# Search for hooks
cursor-ai search "useState" --file-types .js,.jsx

# Replace class components with functional
cursor-ai replace "class " "function " --file-types .js,.jsx --dry-run
```

### Node.js Development
```bash
# Find all package.json files
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
