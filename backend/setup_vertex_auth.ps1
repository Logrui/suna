# Vertex AI Authentication Setup Script
# This script helps you set up Google Cloud authentication for Suna App

Write-Host "=== Vertex AI Authentication Setup ===" -ForegroundColor Cyan

# Check if gcloud is installed
if (Get-Command "gcloud" -ErrorAction SilentlyContinue) {
    Write-Host "✅ gcloud CLI is installed." -ForegroundColor Green
} else {
    Write-Host "❌ gcloud CLI is NOT installed." -ForegroundColor Red
    Write-Host "Please install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit
}

# 1. Login to Google Cloud (forces re-authentication)
Write-Host "`nLogging in to Google Cloud..." -ForegroundColor Cyan
Write-Host "Please complete the login in the browser window that opens."
gcloud auth login --update-adc --force

# 2. Set the project
$project = "syhc-479122"
Write-Host "`nSetting project to $project..." -ForegroundColor Cyan
gcloud config set project $project

# 3. Set quota project explicitly
Write-Host "`nSetting quota project..." -ForegroundColor Cyan
gcloud auth application-default set-quota-project $project

# Reminder for .env
Write-Host "`n=== IMPORTANT NEXT STEPS ===" -ForegroundColor Cyan
Write-Host "1. Ensure your .env file has the following variables set:"
Write-Host "   VERTEX_AI_PROJECT=$project"
Write-Host "   VERTEX_AI_LOCATION=us-central1"
Write-Host "`n2. Restart your backend server to apply changes."

Write-Host "`nSetup Complete!" -ForegroundColor Green
