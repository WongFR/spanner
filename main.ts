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
console.log("Workspace:", Deno.cwd());

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
console.log("Zypher initialized");

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

// ===== Frontend Files =====
// Frontend files are now separated into public/ directory:
// - public/index.html (HTML structure)
// - public/style.css (CSS styles)
// - public/app.js (JavaScript code)

// ===== HTTP Server =====
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Static file serving
  if (req.method === "GET") {
    if (url.pathname === "/") {
      const html = await Deno.readTextFile("./public/index.html");
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/style.css") {
      const css = await Deno.readTextFile("./public/style.css");
      return new Response(css, {
        headers: { "content-type": "text/css; charset=utf-8" },
      });
    }
    if (url.pathname === "/app.js") {
      const js = await Deno.readTextFile("./public/app.js");
      return new Response(js, {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      });
    }
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
Log file path: \`${logPath}\`.
execute Step1.
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
- Log file path: \`${logPath}\`.
- The user has chosen the following root cause:

${chosenRootCause}

Based on this root cause:

Execute Step2
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
Now the user has confirmed the final fix plan.

- Log file path: \`${logPath}\`.
- Confirmed fix plan:

${fixPlan}

Execute Step3
`;

    const resultText = await runZypherTask(task);
    return jsonResponse({ resultText, reportPath });
  }

  return new Response("Not found", { status: 404 });
});
