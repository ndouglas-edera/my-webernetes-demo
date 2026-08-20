import { BaseImage, Cluster, type ProcessContext } from "@ngrok/webernetes";

class WebServerImage extends BaseImage {
  static readonly imageName = "web-server";
  static readonly imageVersion = "1.0";
  readonly defaultCommand = ["server"];

  override async exec(
    ctx: ProcessContext,
    argv: readonly string[],
  ): Promise<number> {
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

interface EderaZone {
  name: string;
  uuid: string;
  state: "creating" | "ready" | "destroying" | "destroyed";
  ipv4: string;
  ipv6: string;
  minCpus: number;
  cpus: number;
  cores: number;
  workloads: string[];
}

interface EderaWorkload {
  name: string;
  uuid: string;
  zone: string;
  state: "creating" | "running" | "stopped" | "destroyed";
  image: string;
  command: string[];
  createdAt: number;
}

type PanelId = "pods" | "nodes" | "zones" | "events";

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
    html,
    body {
      margin: 0;
      padding: 0;
      background: #0d1117 !important;
      color: #c9d1d9;
      min-height: 100vh;
      width: 100%;
    }

    * {
      box-sizing: border-box;
    }

    #app {
      min-height: 100vh;
    }

    .dashboard-shell {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      color: #c9d1d9;
      padding: 24px;
      min-height: 100vh;
      background: #0d1117;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      border-bottom: 1px solid #30363d;
      padding-bottom: 16px;
    }

    .dashboard-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
    }

    .dashboard-subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #8b949e;
    }

    .panel-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .toolbar-button,
    .panel-button {
      background: #21262d;
      border: 1px solid #30363d;
      color: #f0f6fc;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
    }

    .toolbar-button:hover,
    .panel-button:hover {
      background: #30363d;
      border-color: #484f58;
    }

    .hidden-panel-list {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .dashboard-panels {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: start;
      margin-bottom: 16px;
    }

    .dashboard-panel {
      min-width: 0;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      overflow: hidden;
      transition:
        opacity 0.15s ease,
        transform 0.15s ease,
        border-color 0.15s ease;
    }

    .dashboard-panel.dragging {
      opacity: 0.45;
      transform: scale(0.99);
      border-color: #58a6ff;
    }

    .dashboard-panel.drag-over {
      border-color: #58a6ff;
      box-shadow: 0 0 0 1px #58a6ff33;
    }

    .dashboard-panel.wide {
      grid-column: 1 / -1;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid #30363d;
    }

    .panel-header-left {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
    }

    .drag-handle {
      color: #6e7681;
      cursor: grab;
      user-select: none;
      font-size: 13px;
      letter-spacing: -2px;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .panel-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #f0f6fc;
      white-space: nowrap;
    }

    .panel-count {
      font-size: 10px;
      background: #21262d;
      padding: 2px 8px;
      border-radius: 12px;
      border: 1px solid #30363d;
      color: #c9d1d9;
    }

    .panel-body {
      padding: 12px 14px;
    }

    .resource-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 210px;
      overflow-y: auto;
    }

    .resource-card {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .resource-card.running {
      border-color: #238636;
    }

    .resource-card.pending {
      border-color: #d29922;
    }

    .resource-main {
      min-width: 0;
    }

    .resource-name {
      font-weight: 650;
      font-size: 13px;
      color: #58a6ff;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .resource-meta {
      margin-top: 2px;
      font-size: 11px;
      color: #8b949e;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-badge {
      flex: 0 0 auto;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid;
    }

    .status-ready,
    .status-running {
      color: #3fb950;
      background: #23863622;
      border-color: #238636;
    }

    .status-pending {
      color: #d29922;
      background: #bb800922;
      border-color: #d29922;
    }

    .status-info {
      color: #58a6ff;
      background: #388bfd15;
      border-color: #388bfd33;
    }

    .status-destroyed {
      color: #8b949e;
      background: #21262d;
      border-color: #30363d;
    }

    .empty-state {
      font-size: 12px;
      color: #8b949e;
      padding: 8px 0;
    }

    /* -------------------------------
       Terminal
       ------------------------------- */

    .terminal-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 16px;
      align-items: stretch;
    }

    .terminal-panel {
      min-width: 0;
      font-family:
        ui-monospace,
        SFMono-Regular,
        Menlo,
        Monaco,
        Consolas,
        "Liberation Mono",
        monospace;
      background: #010409;
      border: 1px solid #30363d;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }

    .terminal-output {
      display: block !important;
      width: 100%;
      min-height: 240px;
      max-height: 420px;
      overflow-y: auto;
      overflow-x: auto;
      padding: 16px;
      margin: 0;
      color: #c9d1d9;
      text-align: left !important;
      white-space: normal !important;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.45;
    }

    .terminal-line {
      display: block !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      text-align: left !important;
      white-space: pre-wrap !important;
      word-break: normal;
      overflow-wrap: anywhere;
    }

    .terminal-pre {
      display: block !important;
      width: max-content;
      min-width: 100%;
      margin: 0;
      padding: 0;
      text-align: left !important;
      white-space: pre;
      font-family: inherit;
      line-height: 1.45;
    }

    .terminal-input-row {
      display: flex;
      align-items: center;
      width: 100%;
      border-top: 1px solid #30363d;
      padding: 12px 16px;
      background: #010409;
    }

    .terminal-prompt {
      color: #58a6ff;
      margin-right: 8px;
      flex: 0 0 auto;
      white-space: nowrap;
    }

    .terminal-input {
      flex: 1 1 auto;
      min-width: 0;
      width: 100%;
      background: transparent;
      border: none;
      color: #fff;
      font-family: inherit;
      font-size: 13px;
      outline: none;
      text-align: left !important;
    }

    /* -------------------------------
       Lifecycle Events
       ------------------------------- */

    .events-panel {
      min-width: 0;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      min-height: 300px;
      max-height: 520px;
      overflow: hidden;
    }

    .events-stream {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family:
        ui-monospace,
        SFMono-Regular,
        Menlo,
        Monaco,
        Consolas,
        "Liberation Mono",
        monospace;
      font-size: 11px;
    }

    .event-card {
      background: #0d1117;
      border-left: 3px solid #238636;
      border-radius: 4px;
      padding: 8px;
    }

    .event-card.warning {
      border-left-color: #f85149;
    }

    .event-card.info {
      border-left-color: #388bfd;
    }

    .event-top {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }

    .event-time {
      color: #8b949e;
    }

    .event-type {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 700;
    }

    .event-type.normal {
      color: #3fb950;
      background: #23863622;
    }

    .event-type.warning {
      color: #f85149;
      background: #da363322;
    }

    .event-type.info {
      color: #58a6ff;
      background: #388bfd15;
    }

    .event-reason {
      color: #f0f6fc;
      font-weight: 650;
    }

    .event-object {
      color: #8b949e;
      font-weight: 400;
    }

    .event-message {
      color: #8b949e;
      margin-top: 2px;
      line-height: 1.35;
    }

    @media (max-width: 900px) {
      .terminal-row {
        grid-template-columns: 1fr;
      }

      .events-panel {
        max-height: 360px;
      }
    }

    @media (max-width: 700px) {
      .dashboard-shell {
        padding: 12px;
      }

      .dashboard-panels {
        grid-template-columns: 1fr;
      }

      .dashboard-panel.wide {
        grid-column: auto;
      }

      .dashboard-header {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(styleTag);

  const app = document.querySelector<HTMLDivElement>("#app")!;

  app.innerHTML = `
    <div class="dashboard-shell">

      <div class="dashboard-header">
        <div>
          <h1 class="dashboard-title">Webernetes Dashboard & Terminal</h1>
          <p class="dashboard-subtitle">
            Browser-based Kubernetes cluster emulator
          </p>
        </div>

        <button id="show-panels-btn" class="toolbar-button">
          Show hidden panels
        </button>
      </div>

      <div id="hidden-panels" class="panel-toolbar" style="display:none;">
        <span style="font-size:11px;color:#8b949e;">Hidden:</span>
        <div id="hidden-panel-list" class="hidden-panel-list"></div>
      </div>

      <div id="dashboard-panels" class="dashboard-panels">

        <section
          class="dashboard-panel"
          data-panel-id="pods"
          draggable="false"
        >
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="drag-handle" draggable="true" title="Drag to reorder">⋮⋮</span>
              <h3 class="panel-title">📦 Active Pods</h3>
              <span id="pod-count" class="panel-count">1 Pod</span>
            </div>
            <button class="panel-button" data-hide-panel="pods">Hide</button>
          </div>
          <div class="panel-body">
            <div id="pod-grid" class="resource-list"></div>
          </div>
        </section>

        <section
          class="dashboard-panel"
          data-panel-id="nodes"
          draggable="false"
        >
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="drag-handle" draggable="true" title="Drag to reorder">⋮⋮</span>
              <h3 class="panel-title">🖥️ Active Nodes</h3>
              <span id="node-count" class="panel-count">3 Nodes</span>
            </div>
            <button class="panel-button" data-hide-panel="nodes">Hide</button>
          </div>
          <div class="panel-body">
            <div id="node-grid" class="resource-list"></div>
          </div>
        </section>

        <section
          class="dashboard-panel wide"
          data-panel-id="zones"
          draggable="false"
        >
          <div class="panel-header">
            <div class="panel-header-left">
              <span class="drag-handle" draggable="true" title="Drag to reorder">⋮⋮</span>
              <h3 class="panel-title">🛡️ Edera Protect Zones</h3>
              <span id="zone-count" class="panel-count">0 Zones</span>
            </div>
            <button class="panel-button" data-hide-panel="zones">Hide</button>
          </div>
          <div class="panel-body">
            <div id="zone-grid" class="resource-list"></div>
          </div>
        </section>

      </div>

      <div class="terminal-row">

        <div class="terminal-panel" id="terminal-panel">
          <div
            id="output"
            class="terminal-output"
          >
            <div class="terminal-line">Initializing Webernetes cluster...</div>
          </div>

          <div class="terminal-input-row">
            <span class="terminal-prompt">user@webernetes:~$</span>
            <input
              id="cmd"
              class="terminal-input"
              type="text"
              placeholder="Type 'help' or use Up/Down arrow keys for command history..."
              disabled
            />
          </div>
        </div>

        <section class="events-panel" id="events-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span
                class="drag-handle"
                draggable="false"
                style="cursor:default;"
              >⚡</span>
              <h3 class="panel-title">Lifecycle Events</h3>
            </div>

            <div style="display:flex;gap:6px;">
              <button id="clear-events-btn" class="panel-button">
                Clear
              </button>
              <button id="hide-events-btn" class="panel-button">
                Hide
              </button>
            </div>
          </div>

          <div id="events-stream" class="events-stream"></div>
        </section>

      </div>

    </div>
  `;

  const output = document.querySelector<HTMLDivElement>("#output")!;
  const input = document.querySelector<HTMLInputElement>("#cmd")!;

  const podGrid = document.querySelector<HTMLDivElement>("#pod-grid")!;
  const podCount = document.querySelector<HTMLSpanElement>("#pod-count")!;

  const nodeGrid = document.querySelector<HTMLDivElement>("#node-grid")!;
  const nodeCount = document.querySelector<HTMLSpanElement>("#node-count")!;

  const zoneGrid = document.querySelector<HTMLDivElement>("#zone-grid")!;
  const zoneCount = document.querySelector<HTMLSpanElement>("#zone-count")!;

  const eventsPanel =
    document.querySelector<HTMLElement>("#events-panel")!;
  const eventsStream =
    document.querySelector<HTMLDivElement>("#events-stream")!;

  const clearEventsBtn =
    document.querySelector<HTMLButtonElement>("#clear-events-btn")!;

  const hideEventsBtn =
    document.querySelector<HTMLButtonElement>("#hide-events-btn")!;

  const showPanelsBtn =
    document.querySelector<HTMLButtonElement>("#show-panels-btn")!;

  const hiddenPanels =
    document.querySelector<HTMLDivElement>("#hidden-panels")!;

  const hiddenPanelList =
    document.querySelector<HTMLDivElement>("#hidden-panel-list")!;

  const dashboardPanels =
    document.querySelector<HTMLDivElement>("#dashboard-panels")!;

  const commandHistory: string[] = [];
  let historyIndex = -1;

  const localFiles: Record<string, string> = {
    "pod-nginx.yaml": NGINX_YAML_CONTENT,
    "runtimeclass-edera.yaml": RUNTIMECLASS_EDERA_YAML_CONTENT,
    "pod-hardened-vessel.yaml": HARDENED_VESSEL_YAML_CONTENT,
  };

  const activeRuntimeClasses = new Set<string>();

  const hiddenPanelIds = new Set<PanelId>();

  let draggedPanelId: PanelId | null = null;

  let namespaces: LocalNamespace[] = [
    { name: "default", status: "Active", age: "10m" },
    { name: "kube-system", status: "Active", age: "10m" },
    { name: "kube-public", status: "Active", age: "10m" },
    { name: "kube-node-lease", status: "Active", age: "10m" },
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
      labels: { app: "demo" },
    },
  ];

  let nodes: LocalNode[] = [
    {
      name: "node-1",
      status: "Ready",
      age: "5m",
      version: "v1.30.0-webernetes",
      labels: {
        "kubernetes.io/hostname": "node-1",
        "node-role.kubernetes.io/control-plane": "",
      },
    },
    {
      name: "node-2",
      status: "Ready",
      age: "5m",
      version: "v1.30.0-webernetes",
      labels: {
        "kubernetes.io/hostname": "node-2",
        "node-role.kubernetes.io/worker": "",
      },
    },
    {
      name: "node-3",
      status: "Ready",
      age: "5m",
      version: "v1.30.0-webernetes",
      labels: {
        "kubernetes.io/hostname": "node-3",
        "node-role.kubernetes.io/worker": "",
      },
    },
  ];

  let clusterEvents: ClusterEvent[] = [];

  let ederaZones: EderaZone[] = [];
  let ederaWorkloads: EderaWorkload[] = [];

  const panelNames: Record<PanelId, string> = {
    pods: "📦 Active Pods",
    nodes: "🖥️ Active Nodes",
    zones: "🛡️ Edera Protect Zones",
    events: "⚡ Lifecycle Events",
  };

  const escapeHtml = (str: string): string =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const makeUuid = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  };

  const nextZoneIpv4 = (): string => {
    const used = new Set(
      ederaZones
        .map((z) => z.ipv4)
        .filter(Boolean)
        .map((ip) => ip.split("/")[0]),
    );

    let octet = 2;

    while (used.has(`10.75.0.${octet}`)) {
      octet++;
    }

    return `10.75.0.${octet}/16`;
  };

  const nextZoneIpv6 = (): string => {
    const used = new Set(
      ederaZones
        .map((z) => z.ipv6)
        .filter(Boolean)
        .map((ip) => ip.split("/")[0]),
    );

    let octet = 2;

    while (used.has(`fdd4:1476:6c7e::${octet}`)) {
      octet++;
    }

    return `fdd4:1476:6c7e::${octet}/48`;
  };

  const addEvent = (
    type: "Normal" | "Warning" | "Info",
    reason: string,
    object: string,
    message: string,
  ) => {
    const time = new Date().toLocaleTimeString().split(" ")[0];

    clusterEvents.unshift({
      time,
      type,
      reason,
      object,
      message,
    });

    renderEvents();
  };

  const renderEvents = () => {
    if (clusterEvents.length === 0) {
      eventsStream.innerHTML = `
        <div class="empty-state" style="text-align:center;">
          No lifecycle events captured yet.
        </div>
      `;
      return;
    }

    eventsStream.innerHTML = clusterEvents
      .map((ev) => {
        const typeClass = ev.type.toLowerCase();

        return `
          <div class="event-card ${typeClass}">
            <div class="event-top">
              <span class="event-time">${escapeHtml(ev.time)}</span>
              <span class="event-type ${typeClass}">
                ${escapeHtml(ev.type.toUpperCase())}
              </span>
            </div>

            <div class="event-reason">
              ${escapeHtml(ev.reason)}
              <span class="event-object">
                (${escapeHtml(ev.object)})
              </span>
            </div>

            <div class="event-message">
              ${escapeHtml(ev.message)}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const printHtml = (htmlContent: string) => {
    const line = document.createElement("div");

    line.className = "terminal-line";
    line.innerHTML = htmlContent;

    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  };

  const printText = (text: string) => {
    const line = document.createElement("div");

    line.className = "terminal-line";
    line.textContent = text;

    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  };

  const printTable = (text: string) => {
    const pre = document.createElement("div");

    pre.className = "terminal-pre";
    pre.textContent = text;

    output.appendChild(pre);
    output.scrollTop = output.scrollHeight;
  };

  const clearTerminal = () => {
    output.innerHTML = "";
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

          return (
            `<span style="color:#79c0ff;font-weight:500;">${key}</span>` +
            `<span style="color:#8b949e;">:</span>` +
            `<span style="color:#a5d6ff;">${val}</span>`
          );
        }

        return `<span style="color:#c9d1d9;">${escaped}</span>`;
      })
      .join("\n");
  };

  const formatHelpText = (): string => `
<span style="color:#ffa657;">Webernetes CLI Reference

Available Commands:

  ls
      List files in current directory

  cat &lt;filename&gt;
      Print contents of a file

  kubectl run &lt;name&gt; [--image=&lt;img&gt;] [-n &lt;ns&gt;
      Create & run a pod

  kubectl create namespace &lt;name&gt;
      Create a namespace

  kubectl get pods
  kubectl get nodes
  kubectl get namespaces
      List Kubernetes resources

  kubectl label node &lt;node&gt; &lt;key&gt;=&lt;value&gt;
      Add a node label

  kubectl apply -f &lt;filename.yaml&gt;
      Apply a manifest

  kubectl delete pod &lt;name&gt;
  kubectl delete node &lt;name&gt;
      Remove a resource


Edera Protect Commands:

  protect zone launch -n &lt;name&gt; [options]
      Launch an Edera Protect zone

      --min-cpus &lt;n&gt;
      -C &lt;n&gt;
      -c &lt;n&gt;
      --wait

  protect zone list
      List Edera Protect zones

  protect zone destroy &lt;name&gt;
      Destroy a Protect zone

  protect workload launch --zone &lt;zone&gt; --name &lt;name&gt; &lt;image&gt; [command...]
      Launch a workload inside a Protect zone

  protect workload list
      List Protect workloads

  protect workload exec &lt;name&gt; -- &lt;command...&gt;
      Execute a command in a Protect workload

  protect workload destroy &lt;name&gt;
      Destroy a Protect workload

  curl &lt;url&gt;
      Fetch an HTTP endpoint

  clear
      Clear terminal

  history
      Show command history
</span>`;

  const formatLabels = (labels: Record<string, string>): string => {
    const entries = Object.entries(labels);

    if (entries.length === 0) {
      return "<none>";
    }

    return entries
      .map(([key, value]) => (value ? `${key}=${value}` : key))
      .join(",");
  };

  const getNodeRoles = (node: LocalNode): string => {
    const roles: string[] = [];

    Object.keys(node.labels).forEach((label) => {
      if (label.startsWith("node-role.kubernetes.io/")) {
        const role = label.replace("node-role.kubernetes.io/", "");

        if (role) {
          roles.push(role);
        }
      }
    });

    return roles.length > 0 ? roles.join(",") : "<none>";
  };

  const renderPods = () => {
    podCount.textContent = `${pods.length} ${
      pods.length === 1 ? "Pod" : "Pods"
    }`;

    if (pods.length === 0) {
      podGrid.innerHTML = `
        <div class="empty-state">No pods running</div>
      `;
      return;
    }

    podGrid.innerHTML = pods
      .map((p) => {
        const running = p.status === "Running";

        return `
          <div class="resource-card ${
            running ? "running" : "pending"
          }">
            <div class="resource-main">
              <div class="resource-name">
                ${escapeHtml(p.name)}
                <span style="font-size:10px;color:#8b949e;font-weight:400;">
                  (${escapeHtml(p.namespace)})
                </span>

                ${
                  p.runtimeClassName
                    ? `
                      <span style="
                        font-size:10px;
                        color:#c9d1d9;
                        background:#21262d;
                        border:1px solid #30363d;
                        padding:2px 5px;
                        border-radius:4px;
                        margin-left:4px;
                      ">
                        🛡️ ${escapeHtml(p.runtimeClassName)}
                      </span>
                    `
                    : ""
                }
              </div>

              <div class="resource-meta">
                ${escapeHtml(p.image)}
                ·
                ${escapeHtml(p.node || "<none>")}
              </div>
            </div>

            <span class="status-badge ${
              running ? "status-running" : "status-pending"
            }">
              ${escapeHtml(p.status)}
            </span>
          </div>
        `;
      })
      .join("");
  };

  const renderNodes = () => {
    nodeCount.textContent = `${nodes.length} ${
      nodes.length === 1 ? "Node" : "Nodes"
    }`;

    if (nodes.length === 0) {
      nodeGrid.innerHTML = `
        <div class="empty-state">No nodes available</div>
      `;
      return;
    }

    nodeGrid.innerHTML = nodes
      .map(
        (n) => `
          <div class="resource-card">
            <div class="resource-main">
              <div class="resource-name" style="color:#f0f6fc;">
                ${escapeHtml(n.name)}
              </div>

              <div class="resource-meta">
                ${escapeHtml(getNodeRoles(n))}
              </div>
            </div>

            <span class="status-badge status-info">
              ${escapeHtml(n.status)}
            </span>
          </div>
        `,
      )
      .join("");
  };

  const renderZones = () => {
    const visibleZones = ederaZones.filter(
      (zone) => zone.state !== "destroyed",
    );

    zoneCount.textContent = `${visibleZones.length} ${
      visibleZones.length === 1 ? "Zone" : "Zones"
    }`;

    if (visibleZones.length === 0) {
      zoneGrid.innerHTML = `
        <div class="empty-state">
          No Edera Protect zones have been launched.
        </div>
      `;
      return;
    }

    zoneGrid.innerHTML = visibleZones
      .map((zone) => {
        const stateClass =
          zone.state === "ready"
            ? "status-ready"
            : zone.state === "destroyed"
              ? "status-destroyed"
              : "status-info";

        return `
          <div class="resource-card">
            <div class="resource-main">
              <div class="resource-name">
                🛡️ ${escapeHtml(zone.name)}
              </div>

              <div class="resource-meta">
                ${escapeHtml(zone.uuid)}
              </div>

              <div class="resource-meta">
                IPv4: ${escapeHtml(zone.ipv4 || "<none>")}
                &nbsp; · &nbsp;
                CPUs: ${zone.cpus}
                &nbsp; · &nbsp;
                Workloads: ${zone.workloads.length}
              </div>
            </div>

            <span class="status-badge ${stateClass}">
              ${escapeHtml(zone.state)}
            </span>
          </div>
        `;
      })
      .join("");
  };

  const updateDashboard = () => {
    renderPods();
    renderNodes();
    renderZones();
    renderEvents();
  };

  const checkPendingPods = () => {
    pods.forEach((p) => {
      if (p.status !== "Pending") {
        return;
      }

      if (
        p.runtimeClassName &&
        !activeRuntimeClasses.has(p.runtimeClassName)
      ) {
        return;
      }

      let targetNode: LocalNode | undefined;

      if (p.nodeSelector) {
        targetNode = nodes.find((n) =>
          Object.entries(p.nodeSelector!).every(
            ([key, value]) => n.labels[key] === value,
          ),
        );
      } else {
        targetNode =
          nodes.find(
            (n) =>
              !n.labels["node-role.kubernetes.io/control-plane"],
          ) || nodes[0];
      }

      if (targetNode) {
        p.status = "Running";
        p.node = targetNode.name;
        p.ip = `10.244.0.${Math.floor(Math.random() * 200 + 10)}`;

        addEvent(
          "Normal",
          "Scheduled",
          `pod/${p.name}`,
          `Successfully assigned ${p.namespace}/${p.name} to ${targetNode.name}`,
        );

        addEvent(
          "Normal",
          "Started",
          `pod/${p.name}`,
          `Started container ${p.name}`,
        );
      }
    });
  };

  /* ---------------------------------------
     Panel hide/show
     --------------------------------------- */

  const updateHiddenPanels = () => {
    document
      .querySelectorAll<HTMLElement>("[data-panel-id]")
      .forEach((panel) => {
        const id = panel.dataset.panelId as PanelId;

        panel.style.display = hiddenPanelIds.has(id) ? "none" : "";
      });

    const hidden = Array.from(hiddenPanelIds);

    hiddenPanels.style.display =
      hidden.length > 0 ? "flex" : "none";

    hiddenPanelList.innerHTML = hidden
      .map(
        (id) => `
          <button
            class="panel-button"
            data-show-panel="${id}"
          >
            ${escapeHtml(panelNames[id])}
          </button>
        `,
      )
      .join("");

    showPanelsBtn.style.display =
      hidden.length > 0 ? "none" : "";
  };

  const hidePanel = (id: PanelId) => {
    hiddenPanelIds.add(id);
    updateHiddenPanels();
  };

  const showPanel = (id: PanelId) => {
    hiddenPanelIds.delete(id);
    updateHiddenPanels();
  };

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    const hideButton = target.closest<HTMLElement>(
      "[data-hide-panel]",
    );

    if (hideButton) {
      hidePanel(
        hideButton.dataset.hidePanel as PanelId,
      );
      return;
    }

    const showButton = target.closest<HTMLElement>(
      "[data-show-panel]",
    );

    if (showButton) {
      showPanel(
        showButton.dataset.showPanel as PanelId,
      );
    }
  });

  showPanelsBtn.addEventListener("click", () => {
    hiddenPanelIds.clear();
    updateHiddenPanels();
  });

  hideEventsBtn.addEventListener("click", () => {
    hiddenPanelIds.add("events");
    eventsPanel.style.display = "none";
    updateHiddenPanels();
  });

  clearEventsBtn.addEventListener("click", () => {
    clusterEvents = [];
    renderEvents();
  });

  /* ---------------------------------------
     Drag/drop dashboard panels
     --------------------------------------- */

  document
    .querySelectorAll<HTMLElement>(".drag-handle[draggable='true']")
    .forEach((handle) => {
      handle.addEventListener("dragstart", (event) => {
        const panel = handle.closest<HTMLElement>(
          "[data-panel-id]",
        );

        if (!panel) {
          return;
        }

        draggedPanelId =
          panel.dataset.panelId as PanelId;

        panel.classList.add("dragging");

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "text/plain",
            draggedPanelId,
          );
        }
      });

      handle.addEventListener("dragend", () => {
        document
          .querySelectorAll(".dashboard-panel")
          .forEach((panel) => {
            panel.classList.remove("dragging");
            panel.classList.remove("drag-over");
          });

        draggedPanelId = null;
      });
    });

  document
    .querySelectorAll<HTMLElement>(".dashboard-panel")
    .forEach((panel) => {
      panel.addEventListener("dragover", (event) => {
        if (!draggedPanelId) {
          return;
        }

        const targetId =
          panel.dataset.panelId as PanelId;

        if (targetId === draggedPanelId) {
          return;
        }

        event.preventDefault();

        panel.classList.add("drag-over");

        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
      });

      panel.addEventListener("dragleave", () => {
        panel.classList.remove("drag-over");
      });

      panel.addEventListener("drop", (event) => {
        event.preventDefault();

        if (!draggedPanelId) {
          return;
        }

        const targetPanel =
          event.currentTarget as HTMLElement;

        const draggedPanel =
          dashboardPanels.querySelector<HTMLElement>(
            `[data-panel-id="${draggedPanelId}"]`,
          );

        if (!draggedPanel || draggedPanel === targetPanel) {
          return;
        }

        const rect =
          targetPanel.getBoundingClientRect();

        const insertBefore =
          event.clientY < rect.top + rect.height / 2;

        if (insertBefore) {
          dashboardPanels.insertBefore(
            draggedPanel,
            targetPanel,
          );
        } else {
          dashboardPanels.insertBefore(
            draggedPanel,
            targetPanel.nextSibling,
          );
        }

        targetPanel.classList.remove("drag-over");
      });
    });

  /* ---------------------------------------
     Kubernetes commands
     --------------------------------------- */

  const handleKubectlCreateNamespace = (
    tokens: string[],
  ) => {
    const nsName =
      tokens[2] === "namespace" || tokens[2] === "ns"
        ? tokens[3]
        : undefined;

    if (!nsName || nsName.startsWith("-")) {
      printHtml(
        `<span style="color:#f85149;">Error: namespace name required. Usage: kubectl create namespace &lt;name&gt;</span>`,
      );

      addEvent(
        "Warning",
        "InvalidSyntax",
        "create",
        "Failed kubectl create namespace syntax",
      );

      return;
    }

    if (namespaces.some((ns) => ns.name === nsName)) {
      printHtml(
        `<span style="color:#f85149;">Error from server (AlreadyExists): namespaces "${escapeHtml(nsName)}" already exists</span>`,
      );

      return;
    }

    namespaces.push({
      name: nsName,
      status: "Active",
      age: "1s",
    });

    addEvent(
      "Normal",
      "Created",
      `namespace/${nsName}`,
      `namespace/${nsName} created`,
    );

    printHtml(
      `<span style="color:#7ee787;">namespace/${escapeHtml(nsName)} created</span>`,
    );
  };

  const handleKubectlRun = (
    tokens: string[],
  ) => {
    const podName = tokens[2];

    if (!podName || podName.startsWith("-")) {
      printHtml(
        `<span style="color:#f85149;">Error: pod name required. Usage: kubectl run &lt;pod-name&gt; [--image=&lt;image&gt;]</span>`,
      );
      return;
    }

    let imageName = podName;
    let targetNamespace = "default";

    const customLabels: Record<string, string> = {
      run: podName,
    };

    for (let i = 3; i < tokens.length; i++) {
      const arg = tokens[i];

      if (arg.startsWith("--image=")) {
        imageName =
          arg.split("=")[1] || imageName;
      } else if (
        arg.startsWith("--namespace=")
      ) {
        targetNamespace =
          arg.split("=")[1] || targetNamespace;
      } else if (
        arg === "-n" ||
        arg === "--namespace"
      ) {
        if (tokens[i + 1]) {
          targetNamespace = tokens[i + 1];
          i++;
        }
      } else if (arg.startsWith("-n")) {
        targetNamespace =
          arg.substring(2) || targetNamespace;
      } else if (arg.startsWith("--labels=")) {
        const labels =
          arg
            .replace("--labels=", "")
            .replace(/["']/g, "");

        labels.split(",").forEach((pair) => {
          const [key, value] =
            pair.split("=");

          if (key) {
            customLabels[key.trim()] =
              value ? value.trim() : "";
          }
        });
      }
    }

    if (
      !namespaces.some(
        (ns) => ns.name === targetNamespace,
      )
    ) {
      printHtml(
        `<span style="color:#f85149;">Error from server (NotFound): namespaces "${escapeHtml(targetNamespace)}" not found</span>`,
      );

      return;
    }

    if (
      pods.some(
        (p) =>
          p.name === podName &&
          p.namespace === targetNamespace,
      )
    ) {
      printHtml(
        `<span style="color:#f85149;">Error from server (AlreadyExists): pods "${escapeHtml(podName)}" already exists</span>`,
      );

      return;
    }

    const assignedNode =
      nodes.find(
        (n) =>
          !n.labels[
            "node-role.kubernetes.io/control-plane"
          ],
      ) || nodes[0];

    const newPod: LocalPod = {
      name: podName,
      namespace: targetNamespace,
      status: "Running",
      age: "1s",
      image: imageName,
      ip: `10.244.0.${Math.floor(
        Math.random() * 200 + 10,
      )}`,
      node: assignedNode?.name || "unassigned",
      labels: customLabels,
    };

    pods.push(newPod);

    addEvent(
      "Normal",
      "Created",
      `pod/${podName}`,
      `pod/${podName} created in namespace ${targetNamespace} via kubectl run`,
    );

    if (assignedNode) {
      addEvent(
        "Normal",
        "Scheduled",
        `pod/${podName}`,
        `Successfully assigned ${targetNamespace}/${podName} to ${assignedNode.name}`,
      );

      addEvent(
        "Normal",
        "Started",
        `pod/${podName}`,
        `Started container ${podName}`,
      );
    }

    updateDashboard();

    printHtml(
      `<span style="color:#7ee787;">pod/${escapeHtml(podName)} created</span>`,
    );
  };

  const handleKubectlLabelNode = (
    tokens: string[],
  ) => {
    const targetNode = tokens[3];
    const labelExpr = tokens[4];

    if (!targetNode || !labelExpr) {
      printHtml(
        `<span style="color:#f85149;">Error: invalid syntax. Usage: kubectl label node &lt;node-name&gt; &lt;key&gt;=&lt;value&gt;</span>`,
      );
      return;
    }

    const nodeObj = nodes.find(
      (n) => n.name === targetNode,
    );

    if (!nodeObj) {
      printHtml(
        `<span style="color:#f85149;">Error from server (NotFound): nodes "${escapeHtml(targetNode)}" not found</span>`,
      );
      return;
    }

    if (labelExpr.includes("=")) {
      const [key, ...rest] =
        labelExpr.split("=");

      nodeObj.labels[key] =
        rest.join("=");
    } else {
      nodeObj.labels[labelExpr] = "";
    }

    addEvent(
      "Normal",
      "Labeled",
      `node/${targetNode}`,
      `Node labeled with ${labelExpr}`,
    );

    printHtml(
      `<span style="color:#7ee787;">node/${escapeHtml(targetNode)} labeled</span>`,
    );

    checkPendingPods();
    updateDashboard();
  };

  const handleKubectlApply = (
    tokens: string[],
  ) => {
    const fileIndex = tokens.indexOf("-f");
    const fileName =
      fileIndex >= 0
        ? tokens[fileIndex + 1]
        : undefined;

    if (!fileName || !localFiles[fileName]) {
      printHtml(
        `<span style="color:#f85149;">error: the path "${escapeHtml(fileName || "")}" does not exist</span>`,
      );
      return;
    }

    let targetNamespace = "default";

    const nsIndex = tokens.indexOf("-n");

    if (
      nsIndex !== -1 &&
      tokens[nsIndex + 1]
    ) {
      targetNamespace =
        tokens[nsIndex + 1];
    }

    if (fileName === "pod-nginx.yaml") {
      const podName = "nginx";

      if (
        pods.some(
          (p) =>
            p.name === podName &&
            p.namespace === targetNamespace,
        )
      ) {
        printText(
          `pod/${podName} unchanged`,
        );
        return;
      }

      const nodeSelector = {
        disktype: "ssd",
      };

      const matchingNode = nodes.find(
        (n) => n.labels.disktype === "ssd",
      );

      const newPod: LocalPod = {
        name: podName,
        namespace: targetNamespace,
        status: matchingNode
          ? "Running"
          : "Pending",
        age: "1s",
        image: "nginx",
        ip: matchingNode
          ? `10.244.0.${Math.floor(
              Math.random() * 200 + 10,
            )}`
          : "<none>",
        node: matchingNode
          ? matchingNode.name
          : "<none>",
        labels: { env: "test" },
        nodeSelector,
      };

      pods.push(newPod);

      addEvent(
        "Normal",
        "Created",
        `pod/${podName}`,
        `pod/nginx created in ${targetNamespace} from manifest`,
      );

      if (matchingNode) {
        addEvent(
          "Normal",
          "Scheduled",
          `pod/${podName}`,
          `Successfully assigned ${targetNamespace}/${podName} to ${matchingNode.name}`,
        );

        addEvent(
          "Normal",
          "Started",
          `pod/${podName}`,
          `Started container ${podName}`,
        );
      } else {
        addEvent(
          "Warning",
          "FailedScheduling",
          `pod/${podName}`,
          "0/3 nodes are available: 3 node(s) didn't match Pod's node selector",
        );
      }

      updateDashboard();

      printHtml(
        `<span style="color:#7ee787;">pod/${podName} created</span>`,
      );

      return;
    }

    if (
      fileName ===
      "runtimeclass-edera.yaml"
    ) {
      activeRuntimeClasses.add("edera");

      addEvent(
        "Normal",
        "Created",
        "runtimeclass/edera",
        "runtimeclass.node.k8s.io/edera created",
      );

      printHtml(
        `<span style="color:#7ee787;">runtimeclass.node.k8s.io/edera created</span>`,
      );

      checkPendingPods();
      updateDashboard();

      return;
    }

    if (
      fileName ===
      "pod-hardened-vessel.yaml"
    ) {
      const podName = "hardened-vessel";

      if (
        pods.some(
          (p) =>
            p.name === podName &&
            p.namespace === targetNamespace,
        )
      ) {
        printText(
          `pod/${podName} unchanged`,
        );
        return;
      }

      const runtimeClassName = "edera";

      const runtimeClassExists =
        activeRuntimeClasses.has(
          runtimeClassName,
        );

      const assignedNode =
        runtimeClassExists
          ? nodes.find(
              (n) =>
                !n.labels[
                  "node-role.kubernetes.io/control-plane"
                ],
            ) || nodes[0]
          : undefined;

      const newPod: LocalPod = {
        name: podName,
        namespace: targetNamespace,
        status: runtimeClassExists
          ? "Running"
          : "Pending",
        age: "1s",
        image:
          "denhamparry/leaky-vessel:0.1",
        ip: assignedNode
          ? `10.244.0.${Math.floor(
              Math.random() * 200 + 10,
            )}`
          : "<none>",
        node: assignedNode
          ? assignedNode.name
          : "<none>",
        labels: {},
        runtimeClassName,
      };

      pods.push(newPod);

      addEvent(
        "Normal",
        "Created",
        `pod/${podName}`,
        `pod/hardened-vessel created in ${targetNamespace} from manifest`,
      );

      if (runtimeClassExists && assignedNode) {
        addEvent(
          "Normal",
          "Scheduled",
          `pod/${podName}`,
          `Successfully assigned ${targetNamespace}/${podName} to ${assignedNode.name}`,
        );

        addEvent(
          "Normal",
          "Started",
          `pod/${podName}`,
          `Started container ${podName}`,
        );
      } else {
        addEvent(
          "Warning",
          "FailedCreatePodSandBox",
          `pod/${podName}`,
          `Failed to create pod sandbox: RuntimeClass "${runtimeClassName}" not found`,
        );
      }

      updateDashboard();

      printHtml(
        `<span style="color:#7ee787;">pod/${podName} created</span>`,
      );
    }
  };

  /* ---------------------------------------
     Protect commands
     --------------------------------------- */

  const printProtectHelp = () => {
    printHtml(`
<span style="color:#ffa657;">Edera Protect CLI

Zone commands:

  protect zone launch -n &lt;name&gt; [options]
  protect zone list
  protect zone destroy &lt;name&gt;

Workload commands:

  protect workload launch --zone &lt;zone&gt; --name &lt;name&gt; &lt;image&gt; [command...]
  protect workload list
  protect workload exec &lt;name&gt; -- &lt;command...&gt;
  protect workload destroy &lt;name&gt;

Examples:

  protect zone launch -n test-zone --min-cpus 1 -C 2 -c 2 --wait

  protect zone list

  protect workload launch --zone test-zone --name alpine-long alpine:latest sleep 3600

  protect workload list

  protect workload exec alpine-long -- id

  protect workload destroy alpine-long

  protect zone destroy test-zone
</span>`);
  };

  const handleProtectZoneLaunch = async (
    tokens: string[],
  ) => {
    let name = "";
    let minCpus = 1;
    let cpus = 1;
    let cores = 1;
    let wait = false;

    for (let i = 3; i < tokens.length; i++) {
      const token = tokens[i];

      if (
        token === "-n" ||
        token === "--name"
      ) {
        name = tokens[++i] || "";
      } else if (
        token.startsWith("--name=")
      ) {
        name =
          token.substring("--name=".length);
      } else if (
        token === "--min-cpus"
      ) {
        minCpus = Number(tokens[++i]) || 1;
      } else if (
        token.startsWith("--min-cpus=")
      ) {
        minCpus =
          Number(
            token.substring(
              "--min-cpus=".length,
            ),
          ) || 1;
      } else if (token === "-C") {
        cpus = Number(tokens[++i]) || 1;
      } else if (token === "-c") {
        cores = Number(tokens[++i]) || 1;
      } else if (token === "--wait") {
        wait = true;
      }
    }

    if (!name) {
      printText(
        "Error: zone name required. Usage: protect zone launch -n <name>",
      );
      return;
    }

    if (
      ederaZones.some(
        (zone) =>
          zone.name === name &&
          zone.state !== "destroyed",
      )
    ) {
      printText(
        `Error: zone "${name}" already exists.`,
      );
      return;
    }

    const uuid = makeUuid();

    const zone: EderaZone = {
      name,
      uuid,
      state: "creating",
      ipv4: "",
      ipv6: "",
      minCpus,
      cpus,
      cores,
      workloads: [],
    };

    ederaZones.push(zone);

    addEvent(
      "Info",
      "ZoneCreating",
      `zone/${name}`,
      `Requested Edera zone ${name}`,
    );

    updateDashboard();

    await sleep(wait ? 450 : 250);

    zone.state = "ready";
    zone.ipv4 = nextZoneIpv4();
    zone.ipv6 = nextZoneIpv6();

    addEvent(
      "Normal",
      "ZoneReady",
      `zone/${name}`,
      `Edera zone ${name} is ready`,
    );

    updateDashboard();

    printText(uuid);
  };

  const handleProtectZoneList = () => {
    if (ederaZones.length === 0) {
      printText("No zones have been launched.");
      return;
    }

    const rows = [
      "NAME        UUID                                  STATE       IPV4           IPV6",
      "----------- ------------------------------------ ----------- -------------- --------------------------",
    ];

    ederaZones.forEach((zone) => {
      rows.push(
        [
          zone.name.padEnd(11),
          zone.uuid.padEnd(36),
          zone.state.padEnd(11),
          (zone.ipv4 || "").padEnd(14),
          zone.ipv6 || "",
        ].join(" "),
      );
    });

    printTable(rows.join("\n"));
  };

  const handleProtectZoneDestroy = async (
    tokens: string[],
  ) => {
    const name = tokens[3];

    if (!name) {
      printText(
        "Error: zone name required. Usage: protect zone destroy <name>",
      );
      return;
    }

    const zone = ederaZones.find(
      (z) =>
        z.name === name &&
        z.state !== "destroyed",
    );

    if (!zone) {
      printText(
        `Error: zone "${name}" not found.`,
      );
      return;
    }

    zone.state = "destroying";

    addEvent(
      "Info",
      "ZoneDestroying",
      `zone/${name}`,
      `Destruction requested for Edera zone ${name}`,
    );

    updateDashboard();

    await sleep(250);

    for (const workloadName of [
      ...zone.workloads,
    ]) {
      const workload =
        ederaWorkloads.find(
          (w) => w.name === workloadName,
        );

      if (workload) {
        workload.state = "destroyed";
      }
    }

    zone.workloads = [];
    zone.state = "destroyed";
    zone.ipv4 = "";
    zone.ipv6 = "";

    addEvent(
      "Normal",
      "ZoneDestroyed",
      `zone/${name}`,
      `Edera zone ${name} destroyed`,
    );

    updateDashboard();

    printText(
      `Destruction of zone ${zone.uuid} requested.`,
    );
  };

  const handleProtectWorkloadLaunch = async (
    tokens: string[],
  ) => {
    let zoneName = "";
    let name = "";

    let imageIndex = -1;

    for (let i = 3; i < tokens.length; i++) {
      const token = tokens[i];

      if (
        token === "--zone"
      ) {
        zoneName = tokens[++i] || "";
      } else if (
        token.startsWith("--zone=")
      ) {
        zoneName =
          token.substring(
            "--zone=".length,
          );
      } else if (
        token === "--name"
      ) {
        name = tokens[++i] || "";
      } else if (
        token.startsWith("--name=")
      ) {
        name =
          token.substring(
            "--name=".length,
          );
      } else if (
        token !== "--"
      ) {
        imageIndex = i;
        break;
      }
    }

    if (!zoneName) {
      printText(
        "Error: --zone is required.",
      );
      return;
    }

    if (!name) {
      printText(
        "Error: --name is required.",
      );
      return;
    }

    const image =
      imageIndex >= 0
        ? tokens[imageIndex]
        : "";

    if (!image) {
      printText(
        "Error: workload image is required.",
      );
      return;
    }

    const command =
      imageIndex >= 0
        ? tokens.slice(imageIndex + 1)
        : [];

    const zone = ederaZones.find(
      (z) =>
        z.name === zoneName &&
        z.state === "ready",
    );

    if (!zone) {
      printText(
        `Error: zone "${zoneName}" is not ready.`,
      );
      return;
    }

    if (
      ederaWorkloads.some(
        (w) =>
          w.name === name &&
          w.state !== "destroyed",
      )
    ) {
      printText(
        `Error: workload "${name}" already exists.`,
      );
      return;
    }

    const uuid = makeUuid();

    const workload: EderaWorkload = {
      name,
      uuid,
      zone: zone.uuid,
      state: "creating",
      image,
      command,
      createdAt: Date.now(),
    };

    ederaWorkloads.push(workload);
    zone.workloads.push(name);

    addEvent(
      "Info",
      "WorkloadCreating",
      `workload/${name}`,
      `Creating ${image} in Edera zone ${zoneName}`,
    );

    updateDashboard();

    await sleep(300);

    workload.state = "running";

    addEvent(
      "Normal",
      "WorkloadStarted",
      `workload/${name}`,
      `Started ${image} in Edera zone ${zoneName}`,
    );

    updateDashboard();

    printText(uuid);
  };

  const handleProtectWorkloadList = () => {
    const workloads =
      ederaWorkloads.filter(
        (w) => w.state !== "destroyed",
      );

    if (workloads.length === 0) {
      printText(
        "No workloads have been launched.",
      );
      return;
    }

    const rows = [
      "NAME          UUID                                  ZONE                                  STATE",
      "------------- ------------------------------------ ------------------------------------ -----------",
    ];

    workloads.forEach((workload) => {
      rows.push(
        [
          workload.name.padEnd(13),
          workload.uuid.padEnd(36),
          workload.zone.padEnd(36),
          workload.state,
        ].join(" "),
      );
    });

    printTable(rows.join("\n"));
  };

  const handleProtectWorkloadExec = (
    tokens: string[],
  ) => {
    const name = tokens[3];

    if (!name) {
      printText(
        "Error: workload name required. Usage: protect workload exec <name> -- <command>",
      );
      return;
    }

    const separatorIndex =
      tokens.indexOf("--");

    const command =
      separatorIndex >= 0
        ? tokens.slice(separatorIndex + 1)
        : tokens.slice(4);

    const workload =
      ederaWorkloads.find(
        (w) =>
          w.name === name &&
          w.state === "running",
      );

    if (!workload) {
      printText(
        `Error: workload "${name}" is not running.`,
      );
      return;
    }

    if (command.length === 0) {
      printText(
        `Connected to workload ${name}.`,
      );
      return;
    }

    const cmd = command.join(" ");

    addEvent(
      "Info",
      "WorkloadExec",
      `workload/${name}`,
      `Executed "${cmd}"`,
    );

    if (
      command.length === 1 &&
      command[0] === "id"
    ) {
      printText(
        "uid=0(root) gid=0(root) groups=0(root)",
      );
      return;
    }

    if (
      command.length === 1 &&
      command[0] === "hostname"
    ) {
      printText(
        `edera-${name}`,
      );
      return;
    }

    if (
      command[0] === "uname" &&
      command[1] === "-a"
    ) {
      printText(
        "Linux edera-workload 6.8.0-edera #1 SMP x86_64 GNU/Linux",
      );
      return;
    }

    if (
      command.length === 1 &&
      command[0] === "whoami"
    ) {
      printText("root");
      return;
    }

    if (
      command.length === 1 &&
      command[0] === "pwd"
    ) {
      printText("/root");
      return;
    }

    if (
      command.length === 2 &&
      command[0] === "cat" &&
      command[1] === "/etc/hostname"
    ) {
      printText(`edera-${name}`);
      return;
    }

    printText(
      `/bin/sh: ${cmd}: simulated command completed successfully`,
    );
  };

  const handleProtectWorkloadDestroy = async (
    tokens: string[],
  ) => {
    const name = tokens[3];

    if (!name) {
      printText(
        "Error: workload name required. Usage: protect workload destroy <name>",
      );
      return;
    }

    const workload =
      ederaWorkloads.find(
        (w) =>
          w.name === name &&
          w.state !== "destroyed",
      );

    if (!workload) {
      printText(
        `Error: workload "${name}" not found.`,
      );
      return;
    }

    workload.state = "destroyed";

    const zone =
      ederaZones.find(
        (z) => z.uuid === workload.zone,
      );

    if (zone) {
      zone.workloads =
        zone.workloads.filter(
          (w) => w !== name,
        );
    }

    addEvent(
      "Normal",
      "WorkloadDestroyed",
      `workload/${name}`,
      `Workload ${name} destroyed`,
    );

    updateDashboard();

    printText(
      `Destruction of workload ${workload.uuid} requested.`,
    );

    await sleep(100);
  };

  /* ---------------------------------------
     Main initialization
     --------------------------------------- */

  try {
    const cluster = new Cluster();

    cluster.registerImage(WebServerImage);

    await cluster.init();

    await cluster.apply([
      {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
          name: "demo-pod",
          labels: {
            app: "demo",
          },
        },
        spec: {
          containers: [
            {
              name: "web",
              image: "web-server:1.0",
            },
          ],
        },
      },
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: "demo-service",
        },
        spec: {
          type: "NodePort",
          ports: [
            {
              port: 80,
              targetPort: 8080,
              nodePort: 31000,
              protocol: "TCP",
            },
          ],
          selector: {
            app: "demo",
          },
        },
      },
    ]);

    addEvent(
      "Normal",
      "ClusterInitialized",
      "cluster",
      "Webernetes browser cluster online",
    );

    addEvent(
      "Normal",
      "Scheduled",
      "pod/demo-pod",
      "Assigned default/demo-pod to node-2",
    );

    addEvent(
      "Normal",
      "Started",
      "pod/demo-pod",
      "Started container web",
    );

    await sleep(500);

    updateDashboard();

    output.innerHTML = `
      <div class="terminal-line">
        Webernetes cluster online!
      </div>
    `;

    input.disabled = false;
    input.focus();

    /* ---------------------------------------
       Command input
       --------------------------------------- */

    input.addEventListener(
      "keydown",
      async (event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();

          if (
            commandHistory.length > 0 &&
            historyIndex <
              commandHistory.length - 1
          ) {
            historyIndex++;

            input.value =
              commandHistory[
                commandHistory.length -
                  1 -
                  historyIndex
              ];
          }

          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();

          if (historyIndex > 0) {
            historyIndex--;

            input.value =
              commandHistory[
                commandHistory.length -
                  1 -
                  historyIndex
              ];
          } else if (historyIndex === 0) {
            historyIndex = -1;
            input.value = "";
          }

          return;
        }

        if (event.key !== "Enter") {
          return;
        }

        const rawCmd =
          input.value.trim();

        input.value = "";
        historyIndex = -1;

        if (!rawCmd) {
          return;
        }

        commandHistory.push(rawCmd);

        printHtml(
          `<span style="color:#58a6ff;">user@webernetes:~$</span> ${escapeHtml(rawCmd)}`,
        );

        const tokens =
          rawCmd.split(/\s+/);

        const mainCmd = tokens[0];

        /* ---------------------------
           Basic shell
           --------------------------- */

        if (mainCmd === "clear") {
          clearTerminal();
          return;
        }

        if (mainCmd === "ls") {
          printHtml(
            Object.keys(localFiles)
              .map(
                (file) =>
                  `<span style="color:#56d364;font-weight:600;">${escapeHtml(file)}</span>`,
              )
              .join("  "),
          );

          return;
        }

        if (mainCmd === "cat") {
          const fileName = tokens[1];

          if (!fileName) {
            printHtml(
              `<span style="color:#f85149;">cat: missing file operand</span>`,
            );
          } else if (
            localFiles[fileName]
          ) {
            printHtml(
              highlightYaml(
                localFiles[fileName],
              ),
            );
          } else {
            printHtml(
              `<span style="color:#f85149;">cat: ${escapeHtml(fileName)}: No such file or directory</span>`,
            );
          }

          return;
        }

        if (
          mainCmd === "help" ||
          rawCmd === "kubectl --help" ||
          rawCmd === "kubectl -h" ||
          rawCmd === "--help"
        ) {
          printHtml(formatHelpText());
          return;
        }

        if (
          rawCmd === "protect --help" ||
          rawCmd === "protect -h"
        ) {
          printProtectHelp();
          return;
        }

        if (mainCmd === "history") {
          if (
            commandHistory.length === 0
          ) {
            printHtml(
              `<span style="color:#ffa657;">No command history.</span>`,
            );
            return;
          }

          const historyText =
            commandHistory
              .map(
                (command, index) =>
                  `${String(
                    index + 1,
                  ).padStart(
                    3,
                    " ",
                  )}  ${command}`,
              )
              .join("\n");

          printTable(historyText);
          return;
        }

        /* ---------------------------
           Protect CLI
           --------------------------- */

        if (
          tokens[0] === "protect"
        ) {
          if (
            tokens[1] === "zone"
          ) {
            if (
              tokens[2] === "launch"
            ) {
              await handleProtectZoneLaunch(
                tokens,
              );
              return;
            }

            if (
              tokens[2] === "list"
            ) {
              handleProtectZoneList();
              return;
            }

            if (
              tokens[2] === "destroy"
            ) {
              await handleProtectZoneDestroy(
                tokens,
              );
              return;
            }

            printText(
              "Unknown protect zone command.",
            );
            return;
          }

          if (
            tokens[1] === "workload"
          ) {
            if (
              tokens[2] === "launch"
            ) {
              await handleProtectWorkloadLaunch(
                tokens,
              );
              return;
            }

            if (
              tokens[2] === "list"
            ) {
              handleProtectWorkloadList();
              return;
            }

            if (
              tokens[2] === "exec"
            ) {
              handleProtectWorkloadExec(
                tokens,
              );
              return;
            }

            if (
              tokens[2] === "destroy"
            ) {
              await handleProtectWorkloadDestroy(
                tokens,
              );
              return;
            }

            printText(
              "Unknown protect workload command.",
            );
            return;
          }

          printProtectHelp();
          return;
        }

        /* ---------------------------
           kubectl create namespace
           --------------------------- */

        if (
          rawCmd.startsWith(
            "kubectl create namespace ",
          ) ||
          rawCmd.startsWith(
            "kubectl create ns ",
          )
        ) {
          handleKubectlCreateNamespace(
            tokens,
          );
          return;
        }

        /* ---------------------------
           kubectl run
           --------------------------- */

        if (
          rawCmd.startsWith(
            "kubectl run ",
          )
        ) {
          handleKubectlRun(tokens);
          return;
        }

        /* ---------------------------
           kubectl label node
           --------------------------- */

        if (
          rawCmd.startsWith(
            "kubectl label node ",
          ) ||
          rawCmd.startsWith(
            "kubectl label nodes ",
          )
        ) {
          handleKubectlLabelNode(
            tokens,
          );
          return;
        }

        /* ---------------------------
           kubectl apply
           --------------------------- */

        if (
          rawCmd.startsWith(
            "kubectl apply -f",
          )
        ) {
          handleKubectlApply(tokens);
          return;
        }

        /* ---------------------------
           kubectl get namespaces
           --------------------------- */

        if (
          rawCmd.startsWith(
            "kubectl get namespaces",
          ) ||
          rawCmd.startsWith(
            "kubectl get namespace",
          ) ||
          rawCmd.startsWith(
            "kubectl get ns",
          )
        ) {
          if (namespaces.length === 0) {
            printText(
              "No namespaces found.",
            );
            return;
          }

          const rows = [
            "NAME              STATUS   AGE",
            "----------------- -------- -----",
          ];

          namespaces.forEach(
            (ns) => {
              rows.push(
                `${ns.name.padEnd(
                  17,
                )} ${ns.status.padEnd(
                  8,
                )} ${ns.age}`,
              );
            },
          );

          printTable(
            rows.join("\n"),
          );

          return;
        }

        /* ---------------------------
           kubectl get pods
           --------------------------- */

        if (
          rawCmd.startsWith(
            "kubectl get pods",
          ) ||
          rawCmd.startsWith(
            "kubectl get pod",
          )
        ) {
          const showLabels =
            tokens.includes(
              "--show-labels",
            );

          const showWide =
            (tokens.includes("-o") &&
              tokens[
                tokens.indexOf("-o") + 1
              ] === "wide") ||
            tokens.includes("-owide");

          const allNamespaces =
            tokens.includes("-A") ||
            tokens.includes(
              "--all-namespaces",
            );

          let namespaceFilter =
            "default";

          for (
            let i = 0;
            i < tokens.length;
            i++
          ) {
            if (
              tokens[i] === "-n" ||
              tokens[i] ===
                "--namespace"
            ) {
              if (tokens[i + 1]) {
                namespaceFilter =
                  tokens[i + 1];
              }
            } else if (
              tokens[i].startsWith(
                "--namespace=",
              )
            ) {
              namespaceFilter =
                tokens[i].split(
                  "=",
                )[1] ||
                namespaceFilter;
            }
          }

          const filteredPods =
            pods.filter(
              (p) =>
                allNamespaces ||
                p.namespace ===
                  namespaceFilter,
            );

          if (
            filteredPods.length === 0
          ) {
            printText(
              `No resources found in ${
                allNamespaces
                  ? "cluster"
                  : namespaceFilter +
                    " namespace"
              }.`,
            );

            return;
          }

          let header =
            allNamespaces
              ? "NAMESPACE   "
              : "";

          header +=
            "NAME                 READY   STATUS     RESTARTS   AGE";

          if (showWide) {
            header +=
              "   IP             NODE";
          }

          if (showLabels) {
            header +=
              "          LABELS";
          }

          const rows = [header];

          filteredPods.forEach(
            (p) => {
              let line =
                allNamespaces
                  ? `${p.namespace.padEnd(
                      11,
                    )} `
                  : "";

              line +=
                `${p.name.padEnd(
                  20,
                )} ` +
                `${(
                  p.status === "Running"
                    ? "1/1"
                    : "0/1"
                ).padEnd(
                  7,
                )} ` +
                `${p.status.padEnd(
                  10,
                )} ` +
                `0         ` +
                `${p.age.padEnd(
                  5,
                )}`;

              if (showWide) {
                line +=
                  ` ${(
                    p.ip || "<none>"
                  ).padEnd(
                    14,
                  )} ${p.node || "<none>"}`;
              }

              if (showLabels) {
                line +=
                  `  ${formatLabels(
                    p.labels,
                  )}`;
              }

              rows.push(line);
            },
          );

          printTable(
            rows.join("\n"),
          );

          return;
        }

        /* ---------------------------
           kubectl get nodes
           --------------------------- */

        if (
          rawCmd.startsWith(
            "kubectl get nodes",
          ) ||
          rawCmd.startsWith(
            "kubectl get node",
          )
        ) {
          const showLabels =
            tokens.includes(
              "--show-labels",
            );

          if (nodes.length === 0) {
            printText(
              "No nodes found in cluster.",
            );
            return;
          }

          let header =
            "NAME       STATUS   ROLES          AGE   VERSION";

          if (showLabels) {
            header += "          LABELS";
          }

          const rows = [header];

          nodes.forEach((n) => {
            let line =
              `${n.name.padEnd(
                10,
              )} ` +
              `${n.status.padEnd(
                8,
              )} ` +
              `${getNodeRoles(
                n,
              ).padEnd(
                14,
              )} ` +
              `${n.age.padEnd(
                5,
              )} ` +
              n.version.padEnd(
                20,
              );

            if (showLabels) {
              line +=
                ` ${formatLabels(
                  n.labels,
                )}`;
            }

            rows.push(line);
          });

          printTable(
            rows.join("\n"),
          );

          return;
        }

        /* ---------------------------
           kubectl delete pod
           --------------------------- */

        if (
          rawCmd.startsWith(
            "kubectl delete pod ",
          ) ||
          rawCmd.startsWith(
            "kubectl delete pods ",
          )
        ) {
          const name =
            tokens[3] || tokens[2];

          let targetNamespace =
            "default";

          const nsIndex =
            tokens.indexOf("-n");

          if (
            nsIndex !== -1 &&
            tokens[nsIndex + 1]
          ) {
            targetNamespace =
              tokens[
                nsIndex + 1
              ];
          }

          const index =
            pods.findIndex(
              (p) =>
                p.name === name &&
                p.namespace ===
                  targetNamespace,
            );

          if (index === -1) {
            printText(
              `Error from server (NotFound): pods "${name}" not found in namespace "${targetNamespace}"`,
            );
            return;
          }

          pods.splice(index, 1);

          addEvent(
            "Normal",
            "Killing",
            `pod/${name}`,
            `Stopping container in ${targetNamespace}`,
          );

          addEvent(
            "Normal",
            "Terminated",
            `pod/${name}`,
            `Pod ${name} deleted from ${targetNamespace}`,
          );

          updateDashboard();

          printHtml(
            `<span style="color:#7ee787;">pod "${escapeHtml(name)}" deleted</span>`,
          );

          return;
        }

        /* ---------------------------
           kubectl delete node
           --------------------------- */

        if (
          rawCmd.startsWith(
            "kubectl delete node ",
          ) ||
          rawCmd.startsWith(
            "kubectl delete nodes ",
          )
        ) {
          const name =
            tokens[3] || tokens[2];

          const index =
            nodes.findIndex(
              (n) => n.name === name,
            );

          if (index === -1) {
            printText(
              `Error from server (NotFound): nodes "${name}" not found`,
            );
            return;
          }

          nodes.splice(index, 1);

          addEvent(
            "Warning",
            "NodeDeleted",
            `node/${name}`,
            `Node ${name} removed from cluster`,
          );

          pods.forEach((p) => {
            if (p.node === name) {
              const newNode =
                nodes[0]?.name ||
                "unassigned";

              p.node = newNode;

              addEvent(
                "Warning",
                "NodeEviction",
                `pod/${p.name}`,
                `Rescheduled to ${newNode}`,
              );
            }
          });

          updateDashboard();

          printHtml(
            `<span style="color:#7ee787;">node "${escapeHtml(name)}" deleted</span>`,
          );

          return;
        }

        /* ---------------------------
           curl
           --------------------------- */

        if (
          rawCmd.startsWith(
            "curl ",
          )
        ) {
          const url =
            rawCmd
              .replace(
                "curl ",
                "",
              )
              .trim();

          addEvent(
            "Info",
            "HttpRequest",
            "curl",
            `GET ${url}`,
          );

          try {
            const res: any =
              await cluster.fetch(
                url,
              );

            const text =
              typeof res?.text ===
              "function"
                ? await res.text()
                : res?.body || res;

            printText(
              String(text),
            );

            addEvent(
              "Normal",
              "HttpResponse",
              "curl",
              `200 OK from ${url}`,
            );
          } catch (err: any) {
            printHtml(
              `<span style="color:#f85149;">curl: (7) Failed to connect: ${escapeHtml(err?.message || String(err))}</span>`,
            );

            addEvent(
              "Warning",
              "HttpError",
              "curl",
              `Connection failed: ${
                err?.message ||
                String(err)
              }`,
            );
          }

          return;
        }

        /* ---------------------------
           Unknown command
           --------------------------- */

        printHtml(
          `<span style="color:#f85149;">command not found: ${escapeHtml(rawCmd)}. Type 'help' or 'protect --help' to see supported commands.</span>`,
        );

        addEvent(
          "Warning",
          "InvalidCommand",
          "cli",
          `Unknown command execution attempted: ${rawCmd}`,
        );
      },
    );
  } catch (error: any) {
    output.innerHTML = `
      <div class="terminal-line" style="color:#f85149;">
        Error initializing cluster: ${escapeHtml(
          error?.message ||
            String(error),
        )}
      </div>
    `;
  }
}

initTerminalDemo();
