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
  runtimeClassName?: string;
}

interface LocalNode {
  name: string;
  status: string;
  age: string;
  version: string;
  labels: Record<string, string>;
}

interface LocalNamespace {
  name: string;
  status: string;
  age: string;
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
  namespace: default
  labels:
    env: test
spec:
  containers:
  - name: nginx
    image: nginx
    imagePullPolicy: IfNotPresent
  nodeSelector:
    disktype: ssd`;

const RUNTIMECLASS_EDERA_YAML_CONTENT = `apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: edera
handler: edera`;

const HARDENED_VESSEL_YAML_CONTENT = `apiVersion: v1
kind: Pod
metadata:
  name: hardened-vessel
  namespace: default
spec:
  runtimeClassName: edera
  containers:
  - name: hardened-vessel
    image: denhamparry/leaky-vessel:0.1
    imagePullPolicy: Always
    env:
    - name: SUPER_ORCHESTRATOR_SECRET
      value: "this-is-fine-hardened"`;

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
    "runtimeclass-edera.yaml": RUNTIMECLASS_EDERA_YAML_CONTENT,
    "pod-hardened-vessel.yaml": HARDENED_VESSEL_YAML_CONTENT,
  };

  const activeRuntimeClasses = new Set<string>();

  let namespaces: LocalNamespace[] = [
    { name: "default", status: "Active", age: "10m" },
    { name: "kube-system", status: "Active", age: "10m" },
    { name: "kube-public", status: "Active", age: "10m" },
    { name: "kube-node-lease", status: "Active", age: "10m" }
  ];

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
  • ls                                       List files in current directory
  • cat &lt;filename&gt;                             Print contents of a file
  • kubectl run &lt;name&gt; [--image=&lt;img&gt;] [-n &lt;ns&gt;] Create & run a pod
  • kubectl create namespace &lt;name&gt;            Create a new namespace
  • kubectl get [pods|nodes|namespaces|ns]     List resources (-n &lt;ns&gt; or -A supported)
  • kubectl label node &lt;node-name&gt; &lt;key&gt;=&lt;val&gt;  Add label to a node
  • kubectl apply -f &lt;filename.yaml&gt;                  Apply manifest file
  • kubectl delete [pod|node] &lt;name&gt;                  Remove resource
  • curl &lt;url&gt;                                       Fetch HTTP endpoint
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
      if (p.status !== "Pending") return;

      if (p.runtimeClassName && !activeRuntimeClasses.has(p.runtimeClassName)) {
        return;
      }

      let targetNode: LocalNode | undefined;
      if (p.nodeSelector) {
        targetNode = nodes.find((n) =>
          Object.entries(p.nodeSelector!).every(([k, v]) => n.labels[k] === v)
        );
      } else {
        targetNode = nodes.find((n) => !n.labels["node-role.kubernetes.io/control-plane"]) || nodes[0];
      }

      if (targetNode) {
        p.status = "Running";
        p.node = targetNode.name;
        p.ip = `10.244.0.${Math.floor(Math.random() * 200 + 10)}`;
        addEvent("Normal", "Scheduled", `pod/${p.name}`, `Successfully assigned ${p.namespace}/${p.name} to ${targetNode.name}`);
        addEvent("Normal", "Started", `pod/${p.name}`, `Started container ${p.name}`);
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
              <div style="font-weight: 600; font-size: 13px; color: #58a6ff;">${p.name} <span style="font-size: 10px; color: #8b949e; font-weight: normal;">(${p.namespace})</span></div>
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

      if (rawCmd.startsWith("kubectl create namespace ") || rawCmd.startsWith("kubectl create ns ")) {
        const nsName = tokens[3] || tokens[2];
        if (!nsName || nsName.startsWith("-")) {
          printHtml(`<span style="color: #f85149;">Error: namespace name required. Usage: kubectl create namespace &lt;name&gt;</span>`);
          addEvent("Warning", "InvalidSyntax", "create", "Failed kubectl create namespace syntax");
          return;
        }

        if (namespaces.some((ns) => ns.name === nsName)) {
          printHtml(`<span style="color: #f85149;">Error from server (AlreadyExists): namespaces "${escapeHtml(nsName)}" already exists</span>`);
          addEvent("Warning", "AlreadyExists", `namespace/${nsName}`, `Create failed: namespace ${nsName} already exists`);
          return;
        }

        namespaces.push({
          name: nsName,
          status: "Active",
          age: "1s"
        });

        addEvent("Normal", "Created", `namespace/${nsName}`, `namespace/${nsName} created`);
        printHtml(`<span style="color: #7ee787;">namespace/${escapeHtml(nsName)} created</span>`);
        return;
      }

      if (rawCmd.startsWith("kubectl run ")) {
        const podName = tokens[2];
        if (!podName || podName.startsWith("-")) {
          printHtml(`<span style="color: #f85149;">Error: pod name required. Usage: kubectl run &lt;pod-name&gt; [--image=&lt;image&gt;] [-n &lt;namespace&gt;]</span>`);
          addEvent("Warning", "InvalidSyntax", "run", "Failed kubectl run command syntax");
          return;
        }

        let imageName = podName;
        let targetNamespace = "default";
        const customLabels: Record<string, string> = { run: podName };

        for (let i = 3; i < tokens.length; i++) {
          const arg = tokens[i];
          if (arg.startsWith("--image=")) {
            imageName = arg.split("=")[1] || imageName;
          } else if (arg.startsWith("--namespace=")) {
            targetNamespace = arg.split("=")[1] || targetNamespace;
          } else if (arg === "-n" || arg === "--namespace") {
            if (tokens[i + 1]) {
              targetNamespace = tokens[i + 1];
              i++;
            }
          } else if (arg.startsWith("-n")) {
            targetNamespace = arg.substring(2) || targetNamespace;
          } else if (arg.startsWith("--labels=")) {
            const rawLabelsStr = rawCmd.match(/--labels=["']?([^"']+)["']?/)?.[1] || arg.replace("--labels=", "").replace(/["']/g, "");
            rawLabelsStr.split(",").forEach((pair) => {
              const [k, v] = pair.split("=");
              if (k) customLabels[k.trim()] = v ? v.trim() : "";
            });
          }
        }

        if (!namespaces.some((ns) => ns.name === targetNamespace)) {
          printHtml(`<span style="color: #f85149;">Error from server (NotFound): namespaces "${escapeHtml(targetNamespace)}" not found</span>`);
          addEvent("Warning", "NotFound", `namespace/${targetNamespace}`, `Run failed: namespace ${targetNamespace} not found`);
          return;
        }

        if (pods.some((p) => p.name === podName && p.namespace === targetNamespace)) {
          printHtml(`<span style="color: #f85149;">Error from server (AlreadyExists): pods "${escapeHtml(podName)}" already exists in namespace "${escapeHtml(targetNamespace)}"</span>`);
          addEvent("Warning", "AlreadyExists", `pod/${podName}`, `Run failed: pod ${podName} already exists in ${targetNamespace}`);
          return;
        }

        const assignedNode = nodes.find((n) => !n.labels["node-role.kubernetes.io/control-plane"]) || nodes[0];

        const newPod: LocalPod = {
          name: podName,
          namespace: targetNamespace,
          status: "Running",
          age: "1s",
          image: imageName,
          ip: `10.244.0.${Math.floor(Math.random() * 200 + 10)}`,
          node: assignedNode ? assignedNode.name : "node-2",
          labels: customLabels
        };

        pods.push(newPod);
        addEvent("Normal", "Created", `pod/${podName}`, `pod/${podName} created in namespace ${targetNamespace} via kubectl run`);
        if (assignedNode) {
          addEvent("Normal", "Scheduled", `pod/${podName}`, `Successfully assigned ${targetNamespace}/${podName} to ${assignedNode.name}`);
          addEvent("Normal", "Started", `pod/${podName}`, `Started container ${podName}`);
        }

        updateDashboard();
        printHtml(`<span style="color: #7ee787;">pod/${escapeHtml(podName)} created</span>`);
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

        let targetNamespace = "default";
        const nsIndex = tokens.indexOf("-n");
        if (nsIndex !== -1 && tokens[nsIndex + 1]) {
          targetNamespace = tokens[nsIndex + 1];
        }

        if (fileName === "pod-nginx.yaml") {
          const podName = "nginx";
          if (pods.some((p) => p.name === podName && p.namespace === targetNamespace)) {
            printHtml(`<span style="color: #8b949e;">pod/${podName} unchanged</span>`);
            return;
          }

          const nodeSelector = { disktype: "ssd" };
          const matchingNode = nodes.find((n) => n.labels.disktype === "ssd");

          const newPod: LocalPod = {
            name: podName,
            namespace: targetNamespace,
            status: matchingNode ? "Running" : "Pending",
            age: "1s",
            image: "nginx",
            ip: matchingNode ? `10.244.0.${Math.floor(Math.random() * 200 + 10)}` : "<none>",
            node: matchingNode ? matchingNode.name : "<none>",
            labels: { env: "test" },
            nodeSelector
          };

          pods.push(newPod);
          addEvent("Normal", "Created", `pod/${podName}`, `pod/nginx created in ${targetNamespace} from manifest`);

          if (matchingNode) {
            addEvent("Normal", "Scheduled", `pod/${podName}`, `Successfully assigned ${targetNamespace}/${podName} to ${matchingNode.name}`);
            addEvent("Normal", "Started", `pod/${podName}`, `Started container ${podName}`);
          } else {
            addEvent("Warning", "FailedScheduling", `pod/${podName}`, "0/3 nodes are available: 3 node(s) didn't match Pod's node selector");
          }

          updateDashboard();
          printHtml(`<span style="color: #7ee787;">pod/${podName} created</span>`);
        } else if (fileName === "runtimeclass-edera.yaml") {
          activeRuntimeClasses.add("edera");
          addEvent("Normal", "Created", "runtimeclass/edera", "runtimeclass.node.k8s.io/edera created");
          printHtml(`<span style="color: #7ee787;">runtimeclass.node.k8s.io/edera created</span>`);

          checkPendingPods();
          updateDashboard();
        } else if (fileName === "pod-hardened-vessel.yaml") {
          const podName = "hardened-vessel";
          if (pods.some((p) => p.name === podName && p.namespace === targetNamespace)) {
            printHtml(`<span style="color: #8b949e;">pod/${podName} unchanged</span>`);
            return;
          }

          const runtimeClassName = "edera";
          const runtimeClassExists = activeRuntimeClasses.has(runtimeClassName);

          const assignedNode = runtimeClassExists
            ? nodes.find((n) => !n.labels["node-role.kubernetes.io/control-plane"]) || nodes[0]
            : undefined;

          const newPod: LocalPod = {
            name: podName,
            namespace: targetNamespace,
            status: runtimeClassExists ? "Running" : "Pending",
            age: "1s",
            image: "denhamparry/leaky-vessel:0.1",
            ip: assignedNode ? `10.244.0.${Math.floor(Math.random() * 200 + 10)}` : "<none>",
            node: assignedNode ? assignedNode.name : "<none>",
            labels: {},
            runtimeClassName
          };

          pods.push(newPod);
          addEvent("Normal", "Created", `pod/${podName}`, `pod/hardened-vessel created in ${targetNamespace} from manifest`);

          if (runtimeClassExists && assignedNode) {
            addEvent("Normal", "Scheduled", `pod/${podName}`, `Successfully assigned ${targetNamespace}/${podName} to ${assignedNode.name}`);
            addEvent("Normal", "Started", `pod/${podName}`, `Started container ${podName}`);
          } else {
            addEvent("Warning", "FailedCreatePodSandBox", `pod/${podName}`, `Failed to create pod sandbox: RuntimeClass "${runtimeClassName}" not found`);
          }

          updateDashboard();
          printHtml(`<span style="color: #7ee787;">pod/${podName} created</span>`);
        }
        return;
      }

      if (rawCmd.startsWith("kubectl get namespaces") || rawCmd.startsWith("kubectl get namespace") || rawCmd.startsWith("kubectl get ns")) {
        if (namespaces.length === 0) {
          printHtml(`<span style="color: #8b949e;">No namespaces found.</span>`);
          return;
        }

        let formattedOutput = `<span style="color: #79c0ff; font-weight: 600;">NAME              STATUS   AGE</span>\n`;

        for (const ns of namespaces) {
          formattedOutput += `${ns.name.padEnd(17)} <span style="color: #7ee787;">${ns.status.padEnd(8)}</span> ${ns.age}\n`;
        }
        printHtml(formattedOutput.trimEnd());
        return;
      }

      if (rawCmd.startsWith("kubectl get pods") || rawCmd.startsWith("kubectl get pod")) {
        const showLabels = tokens.includes("--show-labels");
        const showWide = tokens.includes("-o") && tokens[tokens.indexOf("-o") + 1] === "wide" || tokens.includes("-owide");
        const allNamespaces = tokens.includes("-A") || tokens.includes("--all-namespaces");
        
        let namespaceFilter = "default";
        for (let i = 0; i < tokens.length; i++) {
          if (tokens[i] === "-n" || tokens[i] === "--namespace") {
            if (tokens[i + 1]) namespaceFilter = tokens[i + 1];
          } else if (tokens[i].startsWith("-n") && tokens[i] !== "-node") {
            const sub = tokens[i].substring(2);
            if (sub) namespaceFilter = sub;
          } else if (tokens[i].startsWith("--namespace=")) {
            namespaceFilter = tokens[i].split("=")[1] || namespaceFilter;
          }
        }

        const filteredPods = pods.filter((p) => allNamespaces || p.namespace === namespaceFilter);

        if (filteredPods.length === 0) {
          printHtml(`<span style="color: #8b949e;">No resources found in ${allNamespaces ? "cluster" : namespaceFilter + " namespace"}.</span>`);
          return;
        }

        let header = "";
        if (allNamespaces) header += "NAMESPACE   ";
        header += "NAME        READY   STATUS    RESTARTS   AGE";
        if (showWide) header += "   IP            NODE";
        if (showLabels) header += "          LABELS";

        let formattedOutput = `<span style="color: #79c0ff; font-weight: 600;">${header}</span>\n`;

        for (const p of filteredPods) {
          let line = "";
          if (allNamespaces) line += `${p.namespace.padEnd(11)} `;
          
          const statusColor = p.status === "Running" ? "#7ee787" : "#d29922";
          
          line += `${p.name.padEnd(11)} ${p.status === "Running" ? "1/1" : "0/1"}     <span style="color: ${statusColor};">${p.status.padEnd(9)}</span> 0         ${p.age.padEnd(5)}`;
          if (showWide) line += ` ${(p.ip || "<none>").padEnd(13)} ${(p.node || "<none>").padEnd(10)}`;
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
        let targetNamespace = "default";

        const nsIndex = tokens.indexOf("-n");
        if (nsIndex !== -1 && tokens[nsIndex + 1]) {
          targetNamespace = tokens[nsIndex + 1];
        }

        const index = pods.findIndex((p) => p.name === name && p.namespace === targetNamespace);

        if (index === -1) {
          printHtml(`<span style="color: #f85149;">Error from server (NotFound): pods "${escapeHtml(name)}" not found in namespace "${escapeHtml(targetNamespace)}"</span>`);
          return;
        }

        pods.splice(index, 1);
        addEvent("Normal", "Killing", `pod/${name}`, `Stopping container in ${targetNamespace}`);
        addEvent("Normal", "Terminated", `pod/${name}`, `Pod ${name} deleted from ${targetNamespace}`);

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
