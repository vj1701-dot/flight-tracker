#!/bin/bash

# Google Sheets Environment Setup Script
echo "🔧 Setting up Google Sheets environment variables..."

# Extract private key from the service account file
PRIVATE_KEY=$(cat ~/flight-tracker-sheets-key.json | jq -r .private_key)

echo ""
echo "📋 Add these environment variables to your system:"
echo ""
echo "export GOOGLE_SHEETS_CLIENT_EMAIL='YOUR_SERVICE_ACCOUNT_EMAIL_HERE'"
echo ""
echo "export GOOGLE_SHEETS_PRIVATE_KEY='YOUR_PRIVATE_KEY_HERE'"
echo ""
echo "export GOOGLE_SHEETS_ID='YOUR_SPREADSHEET_ID_HERE'"
echo ""
echo "📝 To use these:"
echo "1. Replace 'YOUR_SPREADSHEET_ID_HERE' with your actual Google Sheets ID"
echo "2. Add these to your ~/.bashrc or ~/.zshrc file"
echo "3. Or create a .env file in your project directory"
echo ""
echo "🧪 After setting up, test with:"
echo "node migrate-to-sheets.js --test"