#!/bin/bash

# Tradeflow Backend Deployment Script
# This script commits and pushes changes to the backend repository

echo "🚀 Deploying Tradeflow Backend..."

# Check if git is initialized
if [ ! -d .git ]; then
  echo "📦 Initializing git repository..."
  git init
  echo "✅ Git initialized"
fi

# Check if remote exists
if ! git remote | grep -q "origin"; then
  echo "❌ No remote repository configured!"
  echo "Please add your remote repository:"
  echo "  git remote add origin <your-backend-repo-url>"
  exit 1
fi

# Show current status
echo ""
echo "📊 Current status:"
git status --short

# Add all changes
echo ""
echo "➕ Adding all changes..."
git add .

# Commit with timestamp
COMMIT_MSG="Backend update - $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "💾 Committing changes..."
git commit -m "$COMMIT_MSG"

# Check if commit was successful
if [ $? -eq 0 ]; then
  echo "✅ Changes committed successfully"
  
  # Push to remote
  echo ""
  echo "⬆️  Pushing to remote repository..."
  git push origin main
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Backend deployed successfully!"
    echo "🌐 Render will automatically deploy your changes"
  else
    echo ""
    echo "❌ Push failed. Trying 'master' branch..."
    git push origin master
  fi
else
  echo "ℹ️  No changes to commit"
fi

echo ""
echo "✨ Done!"
