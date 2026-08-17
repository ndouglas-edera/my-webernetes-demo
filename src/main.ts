import { BaseImage, Cluster, type ProcessContext } from "@ngrok/webernetes";

class WebServerImage extends BaseImage {
  static readonly imageName = "web-server";
  static readonly imageVersion = "1.0";
  readonly defaultCommand = ["server"];

  override async exec(ctx: ProcessContext, argv: readonly string[]): Promise<number> {
    ctx.listenHttp(8080, async () => ({
      statusCode: 200,
      body: "Hello from browser-hosted Kubernetes!\n",
    }));
    return await ctx.waitUntilKilled();
  }
}

interface LocalPod {
  name: string;
  namespace: string;
  status: string;
  age: string;
  image: string;
  ip: string;
  node: string;
  labels: Record<string, string>;
  nodeSelector?: Record<string, string>;
}

interface LocalNode {
  name: string;
  status: string;
  age: string;
  version: string;
  labels: Record<string, string>;
}

interface ClusterEvent {
  time: string;
  type: "Normal" | "Warning" | "Info";
  reason: string;
  object: string;
  message: string;
}

const NGINX_YAML_CONTENT = `apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    env: test
spec:
  containers:
  - name: nginx
    image: nginx
    imagePullPolicy: IfNotPresent
  nodeSelector:
    disktype: ssd`;

async function initTerminalDemo() {
  const styleTag = document.createElement("style");
  styleTag.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      background-color: #0d1117 !important;
      color: #c9d1d9;
      min-height: 100vh;
      width: 100%;
    }
  `;
  document.head.appendChild(styleTag);

  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; color: #c9d1d9; padding: 24px; min-height: 100vh; background-color: #0d1117;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #30363d; padding-bottom: 16px;">
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">Webernetes Dashboard & Terminal</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #8b949e;">Browser-based Kubernetes cluster emulator</p>
        </div>
        <button id="toggle-events-btn" style="background: #21262d; border: 1px solid #30363d; color: #f0f6fc; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <span id="toggle-icon">▶</span> Lifecycle Events Panel
        </button>
      </div>

      <div style="display: flex; gap: 16px; align-items: flex-start;">
        <div style="flex: 1; min-width: 0;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 14px; color: #f0f6fc;">📦 Active Pods</h3>
                <span id="pod-count" style="font-size: 11px; background: #21262d; padding: 2px 8px; border-radius: 12px; border: 1px solid #30363d;">1 Pod</span>
              </div>
              <div id="pod-grid" style="display: flex; flex-direction: column; gap: 8px; max-height: 160px; overflow-y: auto; padding-right: 4px;"></div>
            </div>

            <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 14px; color: #f0f6fc;">🖥️ Active Nodes</h3>
                <span id="node-count" style="font-size: 11px; background: #21262d; padding: 2px 8px; border-radius: 12px; border: 1px solid #30363d;">3 Nodes</span>
              </div>
              <div id="node-grid" style="display: flex; flex-direction: column; gap: 8px; max-height: 160px; overflow-y: auto; padding-right: 4px;"></div>
            </div>
          </div>

          <div style="font-family: monospace; background: #010409; border: 1px solid #30363d; padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            <div id="output" style="white-space: pre-wrap; margin-bottom: 12px; min-height: 240px; max-height: 360px; overflow-y: auto; font-size: 13px; line-height: 1.4;">Initializing Webernetes cluster...</div>
            <div style="display: flex; align-items: center; border-top: 1px solid #30363d; padding-top: 12px;">
              <span style="color: #58a6ff; margin-right: 8px;">user@webernetes:~$</span>
              <input id="cmd" type="text" placeholder="Type 'help' or use Up/Down arrow keys for command history..." style="flex: 1; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 13px; outline: none;" disabled />
            </div>
          </div>
        </div>

        <div id="events-panel" style="width: 340px; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; transition: all 0.25s ease-in-out; display: flex; flex-direction: column; height: 600px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #30363d;">
            <h3 style="margin: 0; font-size: 14px; color: #f0f6fc; display: flex; align-items: center; gap: 6px;">⚡ Lifecycle Events</h3>
            <button id="clear-events-btn" style="background: transparent; border: none; color: #8b949e; font-size: 11px; cursor: pointer;">Clear</button>
          </div>
          <div id="events-stream" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; font-family: monospace; font-size: 11px;"></div>
        </div>
      </div>
    </div>
  `;

  const output = document.querySelector<HTMLDivElement>("#output")!;
  const input = document.querySelector<HTMLInputElement>("#cmd")!;
  const podGrid = document.querySelector<HTMLDivElement>("#pod-grid")!;
  const podCount = document.querySelector<HTMLSpanElement>("#pod-count")!;
  const nodeGrid = document.querySelector<HTMLDivElement>("#node-grid")!;
  const nodeCount = document.querySelector<HTMLSpanElement>("#node-count")!;
  
  const eventsPanel = document.querySelector<HTMLDivElement>("#events-panel")!;
  const eventsStream = document.querySelector<HTMLDivElement>("#events-stream")!;
  const toggleBtn = document.querySelector<HTMLButtonElement>("#toggle-events-btn")!;
  const toggleIcon = document.querySelector<HTMLSpanElement>("#toggle-icon")!;
  const clearEventsBtn = document.querySelector<HTMLButtonElement>("#clear-events-btn")!;

  let eventsPanelExpanded = true;
  const commandHistory: string[] = [];
  let historyIndex = -1;

  const localFiles: Record<string, string> = {
    "pod-nginx.yaml": NGINX_YAML_CONTENT,
  };

  let pods: LocalPod[] = [
    {
      name: "demo-pod",
      namespace: "default",
      status: "Running",
      age: "2m",
      image: "web-server:1.0",
      ip: "10.244.0.5",
      node: "node-2",
      labels: { app: "demo" }
    }
  ];

  let nodes: LocalNode[] = [
    {
      name: "node-1",
      status: "Ready",
      age: "5m",
      version: "v1.30.0-webernetes",
      labels: {
        "kubernetes.io/hostname": "node-1",
        "node-role.kubernetes.io/control-plane": ""
      }
    },
    {
      name: "node-2",
      status: "Ready",
      age: "5m",
      version: "v1.30.0-webernetes",
      labels: {
        "kubernetes.io/hostname": "node-2",
        "node-role.kubernetes.io/worker": ""
      }
    },
    {
      name: "node-3",
      status: "Ready",
      age: "5m",
      version: "v1.30.0-webernetes",
      labels: {
        "kubernetes.io/hostname": "node-3",
        "node-role.kubernetes.io/worker": ""
      }
    }
  ];

  let clusterEvents: ClusterEvent[] = [];

  toggleBtn.addEventListener("click", () => {
    eventsPanelExpanded = !eventsPanelExpanded;
    if (eventsPanelExpanded) {
      eventsPanel.style.width = "340px";
      eventsPanel.style.padding = "16px";
      eventsPanel.style.opacity = "1";
      eventsPanel.style.display = "flex";
      toggleIcon.innerText = "▶";
    } else {
      eventsPanel.style.width = "0px";
      eventsPanel.style.padding = "0px";
      eventsPanel.style.opacity = "0";
      eventsPanel.style.display = "none";
      toggleIcon.innerText = "◀";
    }
  });

  clearEventsBtn.addEventListener("click", () => {
    clusterEvents = [];
    renderEvents();
  });

  const addEvent = (type: "Normal" | "Warning" | "Info", reason: string, object: string, message: string) => {
    const time = new Date().toLocaleTimeString().split(" ")[0];
    clusterEvents.unshift({ time, type, reason, object, message });
    renderEvents();
  };

  const renderEvents = () => {
    if (clusterEvents.length === 0) {
      eventsStream.innerHTML = `<div style="color: #8b949e; text-align: center; margin-top: 20px;">No lifecycle events captured yet.</div>`;
      return;
    }

    eventsStream.innerHTML = clusterEvents.map((ev) => {
      let badgeColor = "#3fb950";
      let badgeBg = "#23863622";
      let border = "#238636";

      if (ev.type === "Warning") {
        badgeColor = "#f85149";
        badgeBg = "#da363322";
        border = "#f85149";
      } else if (ev.type === "Info") {
        badgeColor = "#58a6ff";
        badgeBg = "#388bfd15";
        border = "#388bfd33";
      }

      return `
        <div style="background: #0d1117; border-left: 3px solid ${border}; border-radius: 4px; padding: 8px; margin-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #8b949e;">${ev.time}</span>
            <span style="font-size: 9px; background: ${badgeBg}; color: ${badgeColor}; padding: 1px 5px; border-radius: 3px; font-weight: bold;">${ev.type.toUpperCase()}</span>
          </div>
          <div style="color: #f0f6fc; font-weight: 600;">${ev.reason} <span style="color: #8b949e; font-weight: normal;">(${ev.object})</span></div>
          <div style="color: #8b949e; margin-top: 2px;">${ev.message}</div>
        </div>
      `;
    }).join("");
  };

  const printHtml = (htmlContent: string) => {
    output.innerHTML += `\n${htmlContent}`;
    output.scrollTop = output.scrollHeight;
  };

  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const highlightYaml = (yamlText: string): string => {
    return yamlText
      .split("\n")
      .map((line) => {
        const escaped = escapeHtml(line);
        if (escaped.includes(":")) {
          const parts = escaped.split(":");
          const key = parts[0];
          const val = parts.slice(1).join(":");
          return `<span style="color: #79c0ff; font-weight: 500;">${key}</span><span style="color: #8b949e;">:</span><span style="color: #a5d6ff;">${val}</span>`;
        }
        return `<span style="color: #c9d1d9;">${escaped}</span>`;
      })
      .join("\n");
  };

  const formatHelpText = (): string => {
    return `<span style="color: #ffa657;">Webernetes CLI Reference:

Available Commands:
  • ls / cat                                          List files or print contents of a file
  • kubectl get [pods|nodes] [--show-labels]          List resources with filters/labels
  • kubectl label nodes node-3 disktype=ssd;          Add label to a node
  • kubectl apply -f filename.yaml;                   Apply manifest file
  • kubectl delete [pod|node] name;                   Remove resource
  • curl 8.8.8.8                                      Fetch HTTP endpoint
  • clear / history                                   Manage terminal view & history</span>`;
  };

  const formatLabels = (labels: Record<string, string>): string => {
    const entries = Object.entries(labels);
    if (entries.length === 0) return "<none>";
    return entries.map(([k, v]) => (v ? `${k}=${v}` : k)).join(",");
  };

  const getNodeRoles = (node: LocalNode): string => {
    const roles: string[] = [];
    Object.keys(node.labels).forEach((label) => {
      if (label.startsWith("node-role.kubernetes.io/")) {
        const role = label.replace("node-role.kubernetes.io/", "");
        if (role) roles.push(role);
      }
    });
    return roles.length > 0 ? roles.join(",") : "<none>";
  };

  const checkPendingPods = () => {
    pods.forEach((p) => {
      if (p.status === "Pending" && p.nodeSelector) {
        const matchingNode = nodes.find((n) =>
          Object.entries(p.nodeSelector!).every(([k, v]) => n.labels[k] === v)
        );
        if (matchingNode) {
          p.status = "Running";
          p.node = matchingNode.name;
          p.ip = `10.244.0.${Math.floor(Math.random() * 200 + 10)}`;
          addEvent("Normal", "Scheduled", `pod/${p.name}`, `Successfully assigned ${p.namespace}/${p.name} to ${matchingNode.name}`);
          addEvent("Normal", "Started", `pod/${p.name}`, `Started container ${p.name}`);
        }
      }
    });
  };

  const updateDashboard = () => {
    podCount.innerText = `${pods.length} ${pods.length === 1 ? "Pod" : "Pods"}`;
    if (pods.length === 0) {
      podGrid.innerHTML = `<div style="font-size: 12px; color: #8b949e; padding: 6px;">No pods running</div>`;
    } else {
      podGrid.innerHTML = pods.map((p) => {
        const isPending = p.status === "Pending";
        const badgeColor = isPending ? "#d29922" : "#3fb950";
        const badgeBg = isPending ? "#bb800922" : "#23863622";
        const borderColor = isPending ? "#d29922" : "#238636";

        return `
          <div style="background: #0d1117; border: 1px solid ${borderColor}; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <div>
              <div style="font-weight: 600; font-size: 13px; color: #58a6ff;">${p.name}</div>
              <div style="font-size: 11px; color: #8b949e;">${p.image} · ${p.node || "unassigned"}</div>
            </div>
            <span style="font-size: 10px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${borderColor}; padding: 2px 6px; border-radius: 4px;">${p.status}</span>
          </div>
        `;
      }).join("");
    }

    nodeCount.innerText = `${nodes.length} ${nodes.length === 1 ? "Node" : "Nodes"}`;
    if (nodes.length === 0) {
      nodeGrid.innerHTML = `<div style="font-size: 12px; color: #8b949e; padding: 6px;">No nodes available</div>`;
    } else {
      nodeGrid.innerHTML = nodes.map((n) => `
        <div style="background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #f0f6fc;">${n.name}</div>
            <div style="font-size: 11px; color: #8b949e;">${getNodeRoles(n)}</div>
          </div>
          <span style="font-size: 10px; background: #388bfd15; color: #58a6ff; border: 1px solid #388bfd33; padding: 2px 6px; border-radius: 4px;">${n.status}</span>
        </div>
      `).join("");
    }

    podGrid.scrollTop = podGrid.scrollHeight;
    nodeGrid.scrollTop = nodeGrid.scrollHeight;
  };

  try {
    const cluster = new Cluster();
    cluster.registerImage(WebServerImage);
    await cluster.init();

    await cluster.apply([
      {
        apiVersion: "v1",
        kind: "Pod",
        metadata: { name: "demo-pod", labels: { app: "demo" } },
        spec: { containers: [{ name: "web", image: "web-server:1.0" }] },
      },
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: { name: "demo-service" },
        spec: {
          type: "NodePort",
          ports: [{ port: 80, targetPort: 8080, nodePort: 31000, protocol: "TCP" }],
          selector: { app: "demo" },
        },
      },
    ]);

    addEvent("Normal", "ClusterInitialized", "cluster", "Webernetes browser cluster online");
    addEvent("Normal", "Scheduled", "pod/demo-pod", "Assigned default/demo-pod to node-2");
    addEvent("Normal", "Started", "pod/demo-pod", "Started container web");

    await new Promise((r) => setTimeout(r, 800));

    updateDashboard();
    output.innerText = "Webernetes cluster online!";
    input.disabled = false;
    input.focus();

    input.addEventListener("keydown", async (e) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
          historyIndex++;
          input.value = commandHistory[commandHistory.length - 1 - historyIndex];
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex--;
          input.value = commandHistory[commandHistory.length - 1 - historyIndex];
        } else if (historyIndex === 0) {
          historyIndex = -1;
          input.value = "";
        }
        return;
      }

      if (e.key !== "Enter") return;

      const rawCmd = input.value.trim();
      input.value = "";
      historyIndex = -1;
      if (!rawCmd) return;

      commandHistory.push(rawCmd);
      printHtml(`<span style="color: #58a6ff;">user@webernetes:~$</span> ${escapeHtml(rawCmd)}`);

      const tokens = rawCmd.split(/\s+/);
      const mainCmd = tokens[0];

      if (mainCmd === "clear") {
        output.innerText = "";
        return;
      }

      if (mainCmd === "ls") {
        const fileList = Object.keys(localFiles)
          .map((f) => `<span style="color: #56d364; font-weight: 600;">${f}</span>`)
          .join("  ");
        printHtml(fileList);
        return;
      }

      if (mainCmd === "cat") {
        const fileName = tokens[1];
        if (!fileName) {
          printHtml(`<span style="color: #f85149;">cat: missing file operand</span>`);
        } else if (localFiles[fileName]) {
          printHtml(highlightYaml(localFiles[fileName]));
        } else {
          printHtml(`<span style="color: #f85149;">cat: ${escapeHtml(fileName)}: No such file or directory</span>`);
        }
        return;
      }

      if (mainCmd === "help" || rawCmd === "kubectl --help" || rawCmd === "kubectl -h" || rawCmd === "--help") {
        printHtml(formatHelpText());
        return;
      }

      if (mainCmd === "history") {
        if (commandHistory.length === 0) {
          printHtml(`<span style="color: #ffa657;">No command history.</span>`);
          return;
        }
        const formattedHistory = commandHistory
          .map((c, i) => `<span style="color: #8b949e;">${String(i + 1).padStart(3, " ")}</span>  ${escapeHtml(c)}`)
          .join("\n");
        printHtml(`<span style="color: #ffa657;">${formattedHistory}</span>`);
        return;
      }

      if (rawCmd.startsWith("kubectl label node ") || rawCmd.startsWith("kubectl label nodes ")) {
        const isPlural = tokens[1] === "label" && (tokens[2] === "node" || tokens[2] === "nodes");
        const nodeOffset = isPlural ? 3 : 2;
        const targetNode = tokens[nodeOffset];
        const labelExpr = tokens[nodeOffset + 1];

        if (!targetNode || !labelExpr) {
          printHtml(`<span style="color: #f85149;">Error: invalid syntax. Usage: kubectl label node &lt;node-name&gt; &lt;key&gt;=&lt;value&gt; or &lt;key&gt;=</span>`);
          addEvent("Warning", "InvalidSyntax", "label", "Failed label command syntax");
          return;
        }

        const nodeObj = nodes.find((n) => n.name === targetNode);
        if (!nodeObj) {
          printHtml(`<span style="color: #f85149;">Error from server (NotFound): nodes "${escapeHtml(targetNode)}" not found</span>`);
          addEvent("Warning", "NotFound", `node/${targetNode}`, `Label failed: node ${targetNode} not found`);
          return;
        }

        if (labelExpr.includes("=")) {
          const [key, val] = labelExpr.split("=");
          nodeObj.labels[key] = val;
        } else {
          nodeObj.labels[labelExpr] = "";
        }

        addEvent("Normal", "Labeled", `node/${targetNode}`, `Node labeled with ${labelExpr}`);
        printHtml(`<span style="color: #7ee787;">node/${escapeHtml(targetNode)} labeled</span>`);

        checkPendingPods();
        updateDashboard();
        return;
      }

      if (rawCmd.startsWith("kubectl apply -f")) {
        const fileName = tokens[tokens.indexOf("-f") + 1];
        if (!fileName || !localFiles[fileName]) {
          printHtml(`<span style="color: #f85149;">error: the path "${escapeHtml(fileName || "")}" does not exist</span>`);
          addEvent("Warning", "FileNotFound", "manifest", `Apply failed: file ${fileName} not found`);
          return;
        }

        if (fileName === "pod-nginx.yaml") {
          const podName = "nginx";
          if (pods.some((p) => p.name === podName)) {
            printHtml(`<span style="color: #8b949e;">pod/${podName} unchanged</span>`);
            return;
          }

          const nodeSelector = { disktype: "ssd" };
          const matchingNode = nodes.find((n) => n.labels.disktype === "ssd");

          const newPod: LocalPod = {
            name: podName,
            namespace: "default",
            status: matchingNode ? "Running" : "Pending",
            age: "1s",
            image: "nginx",
            ip: matchingNode ? `10.244.0.${Math.floor(Math.random() * 200 + 10)}` : "<none>",
            node: matchingNode ? matchingNode.name : "<none>",
            labels: { env: "test" },
            nodeSelector
          };

          pods.push(newPod);
          addEvent("Normal", "Created", `pod/${podName}`, "pod/nginx created from manifest");

          if (matchingNode) {
            addEvent("Normal", "Scheduled", `pod/${podName}`, `Successfully assigned default/${podName} to ${matchingNode.name}`);
            addEvent("Normal", "Started", `pod/${podName}`, `Started container ${podName}`);
          } else {
            addEvent("Warning", "FailedScheduling", `pod/${podName}`, "0/3 nodes are available: 3 node(s) didn't match Pod's node selector");
          }

          updateDashboard();
          printHtml(`<span style="color: #7ee787;">pod/${podName} created</span>`);
        }
        return;
      }

      if (rawCmd.startsWith("kubectl get pods") || rawCmd.startsWith("kubectl get pod")) {
        const showLabels = tokens.includes("--show-labels");
        const allNamespaces = tokens.includes("-A") || tokens.includes("--all-namespaces");
        
        let namespaceFilter = "default";
        const nsIndex = tokens.indexOf("-n");
        if (nsIndex !== -1 && tokens[nsIndex + 1]) {
          namespaceFilter = tokens[nsIndex + 1];
        }

        const filteredPods = pods.filter((p) => allNamespaces || p.namespace === namespaceFilter);

        if (filteredPods.length === 0) {
          printHtml(`<span style="color: #8b949e;">No resources found in target namespace.</span>`);
          return;
        }

        let header = "";
        if (allNamespaces) header += "NAMESPACE   ";
        header += "NAME        READY   STATUS    RESTARTS   AGE   IP             NODE";
        if (showLabels) header += "          LABELS";

        let formattedOutput = `<span style="color: #79c0ff; font-weight: 600;">${header}</span>\n`;

        for (const p of filteredPods) {
          let line = "";
          if (allNamespaces) line += `${p.namespace.padEnd(11)} `;
          
          const statusColor = p.status === "Running" ? "#7ee787" : "#d29922";
          
          line += `${p.name.padEnd(11)} 1/1     <span style="color: ${statusColor};">${p.status.padEnd(9)}</span> 0          ${p.age.padEnd(5)} ${(p.ip || "<none>").padEnd(13)} ${(p.node || "<none>").padEnd(10)}`;
          if (showLabels) line += ` <span style="color: #8b949e;">${formatLabels(p.labels)}</span>`;
          formattedOutput += `${line}\n`;
        }
        printHtml(formattedOutput.trimEnd());
        return;
      }

      if (rawCmd.startsWith("kubectl get nodes") || rawCmd.startsWith("kubectl get node")) {
        const showLabels = tokens.includes("--show-labels");

        if (nodes.length === 0) {
          printHtml(`<span style="color: #8b949e;">No nodes found in cluster.</span>`);
          return;
        }

        let header = "NAME     STATUS   ROLES          AGE   VERSION";
        if (showLabels) header += "          LABELS";

        let formattedOutput = `<span style="color: #79c0ff; font-weight: 600;">${header}</span>\n`;

        for (const n of nodes) {
          const roles = getNodeRoles(n);
          let line = `${n.name.padEnd(8)} <span style="color: #7ee787;">${n.status.padEnd(8)}</span> ${roles.padEnd(14)} ${n.age.padEnd(5)} ${n.version.padEnd(16)}`;
          if (showLabels) line += ` <span style="color: #8b949e;">${formatLabels(n.labels)}</span>`;
          formattedOutput += `${line}\n`;
        }
        printHtml(formattedOutput.trimEnd());
        return;
      }

      if (rawCmd.startsWith("kubectl delete pod ") || rawCmd.startsWith("kubectl delete pods ")) {
        const name = tokens[3] || tokens[2];
        const index = pods.findIndex((p) => p.name === name);

        if (index === -1) {
          printHtml(`<span style="color: #f85149;">Error from server (NotFound): pods "${escapeHtml(name)}" not found</span>`);
          return;
        }

        pods.splice(index, 1);
        addEvent("Normal", "Killing", `pod/${name}`, "Stopping container web");
        addEvent("Normal", "Terminated", `pod/${name}`, `Pod ${name} deleted`);

        updateDashboard();
        printHtml(`<span style="color: #7ee787;">pod "${escapeHtml(name)}" deleted</span>`);
        return;
      }

      if (rawCmd.startsWith("kubectl delete node ") || rawCmd.startsWith("kubectl delete nodes ")) {
        const name = tokens[3] || tokens[2];
        const index = nodes.findIndex((n) => n.name === name);

        if (index === -1) {
          printHtml(`<span style="color: #f85149;">Error from server (NotFound): nodes "${escapeHtml(name)}" not found</span>`);
          return;
        }

        nodes.splice(index, 1);
        addEvent("Warning", "NodeDeleted", `node/${name}`, `Node ${name} removed from cluster`);

        pods.forEach((p) => {
          if (p.node === name) {
            const newNode = nodes[0]?.name || "unassigned";
            p.node = newNode;
            addEvent("Warning", "NodeEviction", `pod/${p.name}`, `Rescheduled to ${newNode}`);
          }
        });

        updateDashboard();
        printHtml(`<span style="color: #7ee787;">node "${escapeHtml(name)}" deleted</span>`);
        return;
      }

      if (rawCmd.startsWith("curl ")) {
        const url = rawCmd.replace("curl ", "").trim();
        addEvent("Info", "HttpRequest", "curl", `GET ${url}`);
        try {
          const res: any = await cluster.fetch(url);
          const text = typeof res?.text === "function" ? await res.text() : res?.body || res;
          printHtml(`<span style="color: #a5d6ff;">${escapeHtml(String(text))}</span>`);
          addEvent("Normal", "HttpResponse", "curl", `200 OK from ${url}`);
        } catch (err: any) {
          printHtml(`<span style="color: #f85149;">curl: (7) Failed to connect: ${escapeHtml(err.message)}</span>`);
          addEvent("Warning", "HttpError", "curl", `Connection failed: ${err.message}`);
        }
        return;
      }

      printHtml(`<span style="color: #f85149;">command not found: ${escapeHtml(rawCmd)}. Type 'help' or '--help' to see supported commands.</span>`);
      addEvent("Warning", "InvalidCommand", "cli", `Unknown command execution attempted: ${rawCmd}`);
    });

  } catch (error: any) {
    output.innerText = `Error initializing cluster: ${error.message}`;
  }
}

initTerminalDemo();
