#!/bin/bash

# Cursor Clone Installation Script
echo "🚀 Installing Cursor Clone CLI..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "📦 Installing from: $DIR"

# Install globally
if sudo npm install -g "$DIR"; then
    echo "✅ Cursor Clone installed successfully!"
    echo ""
    echo "🎉 You can now use the following commands from anywhere:"
    echo "  cursor-ai help"
    echo "  cursor-ai info"
    echo "  cursor-ai browse ."
    echo "  cursor-ai find '*.js'"
    echo "  cursor-ai create my-project"
    echo ""
    echo "📚 For more information, run: cursor-ai help"
else
    echo "❌ Installation failed. You may need to run with sudo:"
    echo "  sudo npm install -g $DIR"
    echo ""
    echo "Or install locally and add to PATH:"
    echo "  npm install"
    echo "  echo 'export PATH=\"\$PATH:$DIR\"' >> ~/.bashrc"
    echo "  source ~/.bashrc"
fi
