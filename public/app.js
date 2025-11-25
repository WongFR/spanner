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
  addMsg("user", "Upload log and start analysis");

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

  addMsg("user", "Use plan: " + plan);
  const data = await callApi("/api/confirm-fix-plan", {
    logPath: currentLogPath,
    fixPlan: plan,
  });
  addMsg("agent", data.resultText);
  if (data.reportPath) {
    addMsg("agent", "📄 Report generated: " + data.reportPath);
  }
};

