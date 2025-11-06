# Cursor Clone - Installation Guide

## Quick Installation

### Option 1: Global Installation (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd cursor-clone

# Install dependencies
npm install

# Set up your Google API key
echo "GOOGLE_API_KEY=your_api_key_here" > .env

# Install globally
sudo npm install -g .

# Now you can use from anywhere:
cursor-ai help
cursor-ai info
cursor-ai browse .
```

### Option 2: Local Installation
```bash
# Clone and setup
git clone <repository-url>
cd cursor-clone
npm install
echo "GOOGLE_API_KEY=your_api_key_here" > .env

# Add to PATH
echo 'export PATH="$PATH:$(pwd)"' >> ~/.bashrc
source ~/.bashrc

# Now you can use:
cursor-ai help
```

### Option 3: Using the Installation Script
```bash
# Clone the repository
git clone <repository-url>
cd cursor-clone

# Set up API key
echo "GOOGLE_API_KEY=your_api_key_here" > .env

# Run installation script
./install.sh
```

## Getting Your Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key
5. Set it in your `.env` file or environment

## Available Commands

Once installed, you can use these commands from anywhere:

### Basic Commands
```bash
cursor-ai help          # Show help
cursor-ai info          # System information
cursor-ai              # Interactive mode
```

### File Operations
```bash
cursor-ai browse .                    # Browse current directory
cursor-ai find "*.js"                 # Find JavaScript files
cursor-ai search "function"           # Search for text
cursor-ai replace "var " "let "       # Search and replace
```

### Project Management
```bash
cursor-ai create my-project           # Create new project
cursor-ai create my-api node express  # Create Express project
cursor-ai backup                      # Backup workspace
cursor-ai templates                   # List templates
```

### Configuration
```bash
cursor-ai config get global.maxDepth
cursor-ai config set global.maxDepth 10
```

## Interactive Mode

Run `cursor-ai` without arguments to enter interactive mode:

```bash
cursor-ai
```

This will start an interactive session where you can:
- Browse directories
- Find files
- Search for text
- Create projects
- And much more!

## Troubleshooting

### API Key Issues
```bash
# Check if API key is set
echo $GOOGLE_API_KEY

# Set API key
export GOOGLE_API_KEY=your_key_here
```

### Permission Issues
```bash
# Make sure files are executable
chmod +x cli.js cursor

# Install with sudo if needed
sudo npm install -g .
```

### Command Not Found
```bash
# Add to PATH
echo 'export PATH="$PATH:/path/to/cursor-clone"' >> ~/.bashrc
source ~/.bashrc
```

## Uninstallation

```bash
# Remove global installation
sudo npm uninstall -g cursor-clone

# Or remove from PATH
# Edit ~/.bashrc and remove the cursor-clone path
```

## Examples

### Daily Development Workflow
```bash
# Start your day
cursor-ai info

# Browse your project
cursor-ai browse . --recursive --max-depth 2

# Find all test files
cursor-ai find "*.test.js"

# Search for TODOs
cursor-ai search "TODO"

# Create a new feature
cursor-ai create feature-auth node express
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

## Support

- Check the README.md for detailed documentation
- Use `cursor-ai help` for command help
- Run in interactive mode for guided assistance
