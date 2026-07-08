#!/bin/bash
set -e

echo "📦 1. Cleaning old builds and compiling VSIX package..."
rm -f *.vsix

VSIX_FILE=$(npx @vscode/vsce package | grep -oE '[a-zA-Z0-9._-]+\.vsix' | head -n 1)

if [ -z "$VSIX_FILE" ]; then
    echo "❌ Error: vsce package generation failed."
    exit 1
fi

echo "✅ Successfully built: $VSIX_FILE"
echo "--------------------------------------------------------"
echo "📍 FILE LOCATION TO DRAG: $PWD/$VSIX_FILE"
echo "--------------------------------------------------------"

echo "🌐 2. Launching Brave Browser with your Core Innovation profile..."
MARKETPLACE_URL="https://marketplace.visualstudio.com/manage/publishers/coreinnovation"

# Forces Brave to use your exact 'Default' profile session sandbox
open -b com.brave.Browser --args --profile-directory="Default" "$MARKETPLACE_URL"

echo "🚀 Done! Brave is up. Hit 'Update' on CoreLLM and drop the file in."