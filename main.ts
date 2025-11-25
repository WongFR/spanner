// main.ts
import "@std/dotenv/load";
import {
  AnthropicModelProvider,
  ErrorDetectionInterceptor,
  ESLintErrorDetector,
  TypeScriptErrorDetector,
  ZypherAgent,
  ToolExecutionInterceptor
} from "@corespeed/zypher";
import {
  CopyFileTool,
  defineEditFileTool,
  DeleteFileTool,
  GrepSearchTool,
  ListDirTool,
  ReadFileTool,
  RunTerminalCmdTool,
} from "@corespeed/zypher/tools";

const WORKSPACE = "./"; // Root directory where your code and projects are located
Deno.chdir(WORKSPACE);
console.log("🚀 Workspace:", Deno.cwd());

function getRequiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Env ${name} is not set`);
  return v;
}

// Read prompt
const prompt = await Deno.readTextFile("./prompt.md");

// ===== Initialize Zypher Agent =====
const zypher = new ZypherAgent(
  new AnthropicModelProvider({
    apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
  }),
  {
    customInstructions: prompt,
    persistHistory: false,
  },
);

const mcp = zypher.mcpServerManager;
const { EditFileTool } = defineEditFileTool();

// Register Built-in Tools
mcp.registerTool(ReadFileTool);
mcp.registerTool(EditFileTool);
mcp.registerTool(CopyFileTool);
mcp.registerTool(DeleteFileTool);
mcp.registerTool(GrepSearchTool);
mcp.registerTool(ListDirTool);
mcp.registerTool(RunTerminalCmdTool);

// Interceptor: Error detection
const loopInterceptors = zypher.loopInterceptorManager;
const errorInterceptor = new ErrorDetectionInterceptor();
// errorInterceptor.registerDetector(new ESLintErrorDetector());
// If needed, you can register a Java detector (javac / mvn test) here
loopInterceptors.register(errorInterceptor);


await zypher.init();
console.log("✅ Zypher initialized");

async function runZypherTask(task: string): Promise<string> {
  const events = zypher.runTask(task, "claude-sonnet-4-20250514");

  let output = "";

  await new Promise<void>((resolve, reject) => {
    events.subscribe({
      next(ev) {
        if (ev.type === "text") {
          output += ev.content;
        }
      },
      error: reject,
      complete: resolve,
    });
  });

  return output.trim();
}



function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// ===== Simple Frontend HTML (Single File) =====
const INDEX_HTML = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Log Fix Agent</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body {
      font-family: Inter, system-ui, sans-serif;
      margin: 0; height: 100vh; overflow: hidden;
      background: #f3f4f6;
    }
    #app {
      display: flex; flex-direction: column;
      height: 100%;
      max-width: 860px;
      margin: 0 auto; background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.08);
    }

    header {
      padding: 14px 20px; font-size: 18px;
      font-weight: 600; background:#111827; color:white;
    }

    #chat {
      flex: 1; padding: 20px; overflow-y: auto;
      background: #f9fafb;
    }

    .msg { margin-bottom: 14px; display:flex; }
    .msg.user { justify-content:flex-end; }
    .msg.agent { justify-content:flex-start; }

    .bubble {
      padding: 12px 14px; border-radius: 12px; max-width: 70%;
      line-height: 1.4; white-space: pre-wrap;
      font-size: 14px;
    }

    .user .bubble {
      background: #2563eb; color: white;
      border-bottom-right-radius: 4px;
    }
    .agent .bubble {
      background: white; border: 1px solid #e5e7eb;
      border-bottom-left-radius: 4px;
    }

    #controls {
      border-top: 1px solid #e5e7eb;
      padding: 12px; background:white;
      display:flex; flex-direction:column;
      gap: 10px;
    }

    #controls-top {
      display:flex; gap:10px; align-items:center;
    }

    button {
      padding: 8px 14px; border-radius: 8px;
      border: none; cursor: pointer;
      font-size: 14px; font-weight: 500;
      background: #111827; color:white;
      transition: background 0.2s;
    }
    button:hover { background: #374151; }

    input[type=file] {
      padding: 6px;
    }

    textarea {
      width: 100%; resize: vertical; min-height: 70px;
      padding: 10px; border-radius: 8px;
      border: 1px solid #d1d5db; font-size: 14px;
    }
  </style>
</head>

<body>
<div id="app">
  <header>⚙️ Log-based Bug Fix Agent</header>
  <div id="chat"></div>

  <div id="controls">
    <div id="controls-top">
      <input id="logFile" type="file" accept=".txt,.log" />
      <button id="uploadBtn">📤 Upload and Analyze (Step 1)</button>
    </div>

    <div id="phaseBtns">
      <button id="planBtn">📌 Confirm root cause → Generate plan (Step 2)</button>
      <button id="fixBtn">🛠 Confirm plan → Auto fix (Step 3)</button>
    </div>

    <textarea id="userInput" placeholder="Enter root cause or fix plan here..."></textarea>
  </div>
</div>

<script>
  const chat = document.getElementById('chat');
  const logFile = document.getElementById('logFile');
  const uploadBtn = document.getElementById('uploadBtn');
  const planBtn = document.getElementById('planBtn');
  const fixBtn = document.getElementById('fixBtn');
  const userInput = document.getElementById('userInput');

  let currentLogPath = null;

  function addMsg(role, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    const b = document.createElement('div');
    b.className = 'bubble';

    if (role === 'agent') {
     // Render markdown
     b.innerHTML = marked.parse(text);
    } else {
      // User messages remain plain text
      b.textContent = text;
    }

    div.appendChild(b);
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  async function callApi(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  uploadBtn.onclick = async () => {
    const file = logFile.files[0];
    if (!file) { alert("Please select a log file"); return; }
    addMsg("user", "📤 Upload log and start analysis");

    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload-log", { method:"POST", body:form });
    const data = await res.json();

    currentLogPath = data.logPath;
    addMsg("agent", data.resultText);
  };

  planBtn.onclick = async () => {
    if (!currentLogPath) return alert("Please upload log first");
    const cause = userInput.value.trim();
    if (!cause) return alert("Please enter root cause");

    addMsg("user", "Confirm root cause: " + cause);
    const data = await callApi("/api/confirm-root-cause", {
      logPath: currentLogPath,
      chosenRootCause: cause,
    });
    addMsg("agent", data.resultText);
  };

  fixBtn.onclick = async () => {
    if (!currentLogPath) return alert("Please upload log first");
    const plan = userInput.value.trim();
    if (!plan) return alert("Please enter final fix plan");

    addMsg("user", "🛠 Start fixing: " + plan);
    const data = await callApi("/api/confirm-fix-plan", {
      logPath: currentLogPath,
      fixPlan: plan,
    });
    addMsg("agent", data.resultText);
    if (data.reportPath) {
      addMsg("agent", "📄 Report generated: " + data.reportPath);
    }
  };
</script>
</body>
</html>`;

// ===== HTTP Server =====
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Frontend page
  if (req.method === "GET" && url.pathname === "/") {
    return new Response(INDEX_HTML, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Step 1: Upload log and perform root cause candidate analysis
  if (req.method === "POST" && url.pathname === "/api/upload-log") {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response("no file", { status: 400 });
    }
    const text = await file.text();

    await Deno.mkdir("./logs", { recursive: true });
    const logPath = `./logs/session-${Date.now()}.log`;
    await Deno.writeTextFile(logPath, text);

    const task = `
[Phase: analyze]

Log file path: \`${logPath}\`.

1. Reconstruct the cross-project call chain using project names in each log line.
2. Identify and rank multiple possible root causes.
3. Output a concise, numbered list of candidate root causes for the user to choose from.
4. Do NOT modify any code or run git commands at this phase.
`;

    const resultText = await runZypherTask(task);
    return jsonResponse({ logPath, resultText });
  }

  // Step 2: User confirms root cause → Generate fix plan list
  if (req.method === "POST" && url.pathname === "/api/confirm-root-cause") {
    const body = await req.json();
    const logPath: string = body.logPath;
    const chosenRootCause: string = body.chosenRootCause;

    const task = `
[Phase: plan]

We are now at the planning phase.

- Log file path: \`${logPath}\`.
- The user has chosen the following root cause:

${chosenRootCause}

Based on this root cause:

1. Design 2–3 alternative fix plans.
2. For each plan, clearly describe:
   - target project and key files
   - high-level fix strategy
   - potential risks / trade-offs
3. Do NOT modify any files or run git commands at this phase.
4. Output a numbered list of plans that the user can pick from or edit.
`;

    const resultText = await runZypherTask(task);
    return jsonResponse({ resultText });
  }

  // Step 3: User confirms fix plan → Auto fix + push + report
  if (req.method === "POST" && url.pathname === "/api/confirm-fix-plan") {
    const body = await req.json();
    const logPath: string = body.logPath;
    const fixPlan: string = body.fixPlan;

    const reportPath = "./bugfix-report.md";

    const task = `
[Phase: fix]

Now the user has confirmed the final fix plan.

- Log file path: \`${logPath}\`.
- Confirmed fix plan:

${fixPlan}

You MUST now:

1. For the relevant project(s):
   - Create/switch to branch "fix-from-log-auto" via shell commands.
   - Apply code changes using read_file + edit_file.
   - Run tests (mvn test / gradle test) if available.
   - Commit and push the changes.
2. Generate or update a Markdown report at \`${reportPath}\`, including:
   - call chain summary
   - root cause description
   - selected fix plan (the text above, maybe refined)
   - changed files summary
   - test results
   - git commit link (if push succeeded)

Be explicit and safe in your shell commands. Avoid any destructive operations.
Finally, briefly summarize what you did so the UI can show it.
`;

    const resultText = await runZypherTask(task);
    return jsonResponse({ resultText, reportPath });
  }

  return new Response("Not found", { status: 404 });
});
