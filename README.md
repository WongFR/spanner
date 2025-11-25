# Spanner

A log-based debugging and bug-fix agent for multi-project systems. Spanner analyzes error logs, identifies root causes across multiple projects, and automatically generates and applies fixes.

## Features

- **Log Analysis**: Automatically analyzes error logs from multi-project Java systems
- **Root Cause Detection**: Identifies root causes by reconstructing cross-project call chains
- **Interactive Workflow**: Step-by-step process with user confirmations at each stage
- **Automatic Fixing**: Generates fix plans and applies code changes automatically
- **Git Integration**: Automatically creates branches, commits, and pushes fixes

## Architecture

Spanner uses:
- **Zypher Agent**: AI-powered code analysis and modification
- **Anthropic Claude**: For intelligent log analysis and fix generation
- **Deno**: Runtime environment
- **TypeScript**: Type-safe development

## Prerequisites

- [Deno](https://deno.com/) (latest version)
- Anthropic API key
- Projects in local folder
## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd spanner
```

2. Install dependencies (Deno will handle this automatically):
```bash
deno install
```

3. Create a `.env` file in the root directory with the following environment variables:
```env
ANTHROPIC_API_KEY=your_api_key_here
PROJECTS_FOLDER=/path/to/your/projects
```

   - `ANTHROPIC_API_KEY`: Required. Your Anthropic API key for Claude access
   - `PROJECTS_FOLDER`: Required. Path to directory containing all your projects
   
   **Note**: Project name must match the project tags in your logs (e.g., `[projecta]`, `[projectb]`).

## Usage

### Start the Server

```bash
deno run -A main.ts
```

The server will start on the default port (usually `8000`). Open your browser and navigate to `http://localhost:8000`.

### Workflow

#### Step 1: Upload and Analyze
1. Upload a log file (`.txt` or `.log` format)
2. Spanner analyzes the log and identifies up to 3 possible root causes
3. Review the candidate root causes

#### Step 2: Confirm Root Cause
1. Select or enter the root cause you want to address
2. Spanner generates up to 3 alternative fix plans
3. Each plan includes:
   - Target project and files
   - High-level fix strategy
   - Potential risks and trade-offs

#### Step 3: Apply Fix
1. Select or enter the fix plan to execute
2. Spanner will:
   - Create a new git branch
   - Apply code changes
   - Run tests (Maven/Gradle)
   - Commit and push changes
   - Generate a bugfix report

## Project Structure

```
spanner/
├── main.ts              # Main server and agent setup
├── prompt.md            # Agent instructions and workflow
├── public/              # Frontend files
│   ├── index.html      # HTML structure
│   ├── style.css       # CSS styles
│   └── app.js          # JavaScript application logic
├── logs/               # Uploaded log files (gitignored)
├── backup/             # Backup files (gitignored)
├── bugfix-report.md    # Generated fix reports (gitignored)
├── .env               # Environment variables (gitignored)
├── deno.json          # Deno configuration
└── README.md          # This file
```

