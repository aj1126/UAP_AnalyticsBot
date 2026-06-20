# UAP AnalyticsBot: Installation & Usage Guide

The UAP AnalyticsBot is a local, Node-based CLI tool designed to scan a target directory, extract text and metadata, and serialize a comprehensive analytics report into JSON. 

The core execution pipeline operates entirely in **read-only mode**. It utilizes asynchronous data streams to process files without bottlenecking system memory, and it will strictly never modify, move, or delete your original source files.

## Prerequisites

Before installing the bot, ensure your system has the following dependencies installed:

1. **Node.js** (v22 or higher recommended)
2. **Git** (for cloning the repository)

## Installation

### Option 1: Automated Installation (Recommended for Windows)

Simply double-click the **`install.bat`** file at the root of the project directory.

Alternatively, open Windows PowerShell and run the following command to automatically verify/install Node.js and pull all required dependencies:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; .\setup.ps1
```

### Option 2: Manual Installation

Open Windows PowerShell and execute the following commands to clone the repository and install the required Node modules.

```powershell
# 1. Clone the repository to your local machine
git clone https://github.com/aj1126/UAP_AnalyticsBot.git

# 2. Navigate into the project directory
cd .\UAP_AnalyticsBot\

# 3. Install the required dependencies
npm install
```

## Running the Bot

### Option 1: Visual Web GUI (Recommended)

1. Double-click the **`gui.bat`** file in the root folder, or run `npm run gui` in your terminal.
2. The bot will automatically spin up a local web server and launch your default browser to `http://localhost:3000`.
3. Use the **Folder Explorer** panel on the left to select any local directory, and click **Analyze Folder** to see detailed visual statistics.

### Option 2: 1-Click Drag-and-Drop Runner

- **Drag-and-Drop**: Simply drag the folder you want to analyze and drop it directly onto the **`run.bat`** file in Windows Explorer.
- **Double-click**: Double-click **`run.bat`** and paste the folder path when prompted.

### Option 3: Command Line Interface (CLI)

The CLI requires a target directory to scan. You pass this path as an argument after the `--` flag.

```powershell
# Syntax
npm start -- "C:\Absolute\Path\To\Your\Source\Folder"

# Example
npm start -- "C:\Users\Public\Documents\Project_Perseus_Lore"
```

If you do not provide a path, the bot will default to scanning its own current working directory (which is usually not what you want for data analysis).

### Understanding the Output

Upon a successful run, the bot outputs a highly structured JSON report directly to your terminal (`stdout`). The report is divided into four analytical tiers:

1. **Descriptive:** Extracts term frequencies, standardizes glossaries, and isolates hard dates/locations.
2. **Diagnostic:** Maps correlation matrices (e.g., specific word usage rates tied to specific dates or locations).
3. **Predictive:** Forecasts keyword and location trends based on the chronological timeline of file modifications.
4. **Prescriptive:** Flags files missing crucial metadata (dates/locations) and recommends folder restructuring for better topic clustering.

*Tip: To save the JSON output to a file instead of reading it in the terminal, you can pipe the output in PowerShell:*
```powershell
npm start -- "C:\Path\To\Folder" > analytics_report.json
```

## Supported File Types

Currently, the ingestion engine natively parses the following extensions:
* `.txt`
* `.md`
* `.json`
* `.csv`
* `.log`
* `.pdf`
* `.png`
* `.jpg`
* `.jpeg`

## Testing & Validation

If you are modifying the codebase or want to verify the pipeline's integrity on your machine, you can run the built-in test suite:

```powershell
npm test
```

If you modify the core architecture or supported commands, regenerate the automated `README.md` documentation by running:

```powershell
npm run docs:generate
```
