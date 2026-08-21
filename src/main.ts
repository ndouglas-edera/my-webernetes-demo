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
  ownerDeployment?: string;
}

interface LocalDeployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  image: string;
  runtimeClassName?: string;
  selector: string;
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

interface ProtectZone {
  name: string;
  uuid: string;
  state: "creating" | "ready" | "destroying" | "destroyed";
  ipv4: string;
  ipv6: string;
  minCpus: number;
  maxCpus: number;
  targetCpus: number;
}

interface ProtectWorkload {
  name: string;
  uuid: string;
  zone: string;
  state: "creating" | "running" | "stopped" | "destroying" | "destroyed";
  image: string;
  command: string[];
  sourcePodName?: string;
}

interface DemoStep {
  id: string;
  title: string;
  description: string;
  command: string;
  optional?: boolean;
}

const NGINX_YAML_CONTENT = `apiVersion: v1
kind: Pod
metadata:
  name: edera-protect-pod
  namespace: default
  labels:
    env: test
spec:
  runtimeClassName: edera
  containers:
  - name: nginx
    image: nginx
    imagePullPolicy: IfNotPresent`;

const RUNTIMECLASS_EDERA_YAML_CONTENT = `apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: edera
handler: edera`;

const NGINX_DEPLOYMENT_YAML_CONTENT = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
  namespace: default
spec:
  selector:
    matchLabels:
      app: nginx
  replicas: 2
  template:
    metadata:
      labels:
        app: nginx
    spec:
      runtimeClassName: edera
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80`;

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

const PROTECT_DEMO_STEPS: DemoStep[] = [
  {
    id: "zone-launch",
    title: "Create an isolated Edera zone",
    description:
      "Launch a lightweight Edera zone. The --wait flag waits until the zone is ready.",
    command:
      "protect zone launch -n test-zone --min-cpus 1 -C 2 -c 2 --wait",
  },
  {
    id: "zone-list",
    title: "Inspect the zone",
    description:
      "List the zones managed by Edera and inspect its networking information.",
    command: "protect zone list",
  },
  {
    id: "edera-pod-apply",
    title: "Deploy the Edera-protected pod",
    description:
      "Apply the nginx manifest. It requests runtimeClassName: edera, but the Edera RuntimeClass is not defined yet, so the pod should remain Pending.",
    command: "kubectl apply -f pod-nginx.yaml",
  },
  {
    id: "edera-runtimeclass-apply",
    title: "Enable the Edera RuntimeClass",
    description:
      "Create the Edera RuntimeClass. The Pending pod can now be scheduled, transition to Running, and attach to the ready Edera zone.",
    command: "kubectl apply -f runtimeclass-edera.yaml",
  },
  {
    id: "edera-workload-list",
    title: "Prove the pod is Edera protected",
    description:
      "Before destroying the zone, list Edera workloads and verify edera-protect-pod appears as a running workload attached to test-zone.",
    command: "protect workload list",
  },
  {
    id: "deployment-apply",
    title: "Deploy an Edera-backed Deployment",
    description:
      "Apply an apps/v1 Deployment with two nginx replicas. The pod template uses runtimeClassName: edera, so both replicas remain Pending until the Edera RuntimeClass is available.",
    command: "kubectl apply -f nginx-deployment.yaml",
  },
  {
    id: "deployment-list",
    title: "Inspect the Deployment",
    description:
      "List the Deployment and verify its two replicas become ready once the Edera RuntimeClass is enabled.",
    command: "kubectl get deployments",
  },
  {
    id: "workload-launch",
    title: "Launch a workload inside the zone",
    description:
      "Start an Alpine container inside the isolated test-zone.",
    command:
      "protect workload launch --zone test-zone --name alpine-long -- docker.io/library/alpine:latest sleep 3600",
  },
  {
    id: "workload-list",
    title: "Inspect the workload",
    description:
      "List workloads and see which Edera zone contains the Alpine container.",
    command: "protect workload list",
  },
  {
    id: "workload-exec",
    title: "Verify the Edera zone kernel",
    description:
      "Exec into the Alpine workload and run `uname -r | grep 'edera'`. Expected output: 6.18.44-edera-zone. This demonstrates that the workload is using the dedicated kernel booted for the isolated Edera zone rather than the shared host kernel. In a traditional container, `uname -r` would normally report the host kernel because containers share one kernel.",
    command:
      "protect workload exec alpine-long /bin/sh -c \"uname -r | grep 'edera'\"",
    optional: true,
  },
  {
    id: "host-kernel",
    title: "Compare the host kernel",
    description:
      "After exiting the workload, run `uname -r` on the host. Expected output: 6.18.44-edera-host. The different kernel suffix proves the workload is not using the host's shared kernel; the Edera zone is running its own isolated kernel in the simulator.",
    command: "uname -r",
    optional: true,
  },
  {
    id: "workload-destroy",
    title: "Destroy the workload",
    description:
      "Remove the workload from the Edera zone.",
    command: "protect workload destroy alpine-long --wait",
  },
  {
    id: "zone-destroy",
    title: "Destroy the zone",
    description:
      "Tear down the isolated Edera zone.",
    command: "protect zone destroy test-zone",
  },
  {
    id: "final-list",
    title: "Verify the zone lifecycle",
    description:
      "List the zones one final time and observe the destroyed tombstone.",
    command: "protect zone list",
  },
];

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

    button {
      font-family: inherit;
    }

    .demo-shell {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      color: #c9d1d9;
      padding: 24px;
      min-height: 100vh;
      background: #0d1117;
    }

    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #30363d;
      padding-bottom: 16px;
    }

    .top-header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #fff;
    }

    .top-header p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #8b949e;
    }

    .panel {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-bottom: 1px solid #30363d;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 14px;
      color: #f0f6fc;
    }

    .drag-handle {
      color: #484f58;
      cursor: grab;
      user-select: none;
      font-size: 14px;
    }

    .panel-subtitle {
      font-size: 11px;
      color: #8b949e;
      margin-left: 4px;
    }

    .panel-count {
      margin-left: auto;
      font-size: 10px;
      color: #8b949e;
      background: #21262d;
      border: 1px solid #30363d;
      padding: 3px 7px;
      border-radius: 10px;
    }

    .hide-btn {
      margin-left: 6px;
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      border-radius: 5px;
      padding: 4px 8px;
      font-size: 10px;
      cursor: pointer;
    }

    .hide-btn:hover {
      background: #30363d;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .resource-body {
      padding: 10px 14px 14px;
      min-height: 92px;
    }

    .resource-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .resource-card {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .resource-card.running {
      border-color: #238636;
    }

    .resource-card.pending {
      border-color: #d29922;
    }

    .resource-name {
      color: #58a6ff;
      font-size: 13px;
      font-weight: 600;
    }

    .resource-meta {
      color: #8b949e;
      font-size: 11px;
      margin-top: 2px;
    }

    .status-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid;
      white-space: nowrap;
    }

    .status-ready {
      color: #3fb950;
      background: #23863622;
      border-color: #238636;
    }

    .status-pending {
      color: #d29922;
      background: #bb800922;
      border-color: #d29922;
    }

    .status-destroyed {
      color: #8b949e;
      background: #21262d;
      border-color: #30363d;
    }

    .protect-panel {
      margin-bottom: 16px;
    }

    .protect-body {
      padding: 10px 14px 14px;
    }

    .zone-card {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 8px;
    }

    .zone-card:last-child {
      margin-bottom: 0;
    }

    .zone-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .zone-name {
      color: #58a6ff;
      font-size: 13px;
      font-weight: 700;
    }

    .zone-uuid {
      color: #8b949e;
      font-size: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin-top: 2px;
    }

    .zone-meta {
      color: #8b949e;
      font-size: 10px;
      margin-top: 7px;
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    .main-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 16px;
      align-items: stretch;
    }

    .terminal-panel {
      background: #010409;
      border: 1px solid #30363d;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      min-width: 0;
      overflow: hidden;
    }

    .terminal-output {
      height: 430px;
      max-height: 430px;
      overflow: auto;
      padding: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.45;
      color: #c9d1d9;
      white-space: normal;
    }

    .terminal-block {
      margin: 0 0 12px;
    }

    .terminal-command {
      color: #c9d1d9;
      white-space: pre-wrap;
      word-break: break-word;
      margin-bottom: 5px;
    }

    .terminal-prompt {
      color: #58a6ff;
    }

    .terminal-pre {
      margin: 4px 0 0;
      padding: 0;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      white-space: pre;
      overflow-x: auto;
    }

    .cli-help {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 100%;
      padding: 2px 0 4px;
    }

    .cli-help-header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px 12px;
    }

    .cli-help-title {
      color: #f0f6fc;
      font-size: 16px;
      font-weight: 700;
    }

    .cli-help-version {
      color: #8b949e;
      font-size: 11px;
    }

    .cli-help-description {
      color: #8b949e;
      font-size: 11px;
      line-height: 1.5;
    }

    .cli-help-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cli-help-section-title {
      color: #79c0ff;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding-bottom: 4px;
      border-bottom: 1px solid #21262d;
    }

    .cli-help-command {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, 0.95fr);
      gap: 16px;
      align-items: start;
      padding: 7px 0;
      border-bottom: 1px solid #161b22;
    }

    .cli-help-command:last-child {
      border-bottom: none;
    }

    .cli-help-command code {
      color: #7ee787;
      font: inherit;
      font-weight: 600;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .cli-help-command span {
      color: #8b949e;
      font-size: 11px;
      line-height: 1.45;
    }

    .cli-help-tip {
      color: #8b949e;
      font-size: 10px;
      line-height: 1.45;
      padding-top: 2px;
    }

    @media (max-width: 720px) {
      .cli-help-command {
        grid-template-columns: 1fr;
        gap: 3px;
      }
    }

    .terminal-input-row {
      display: flex;
      align-items: center;
      border-top: 1px solid #30363d;
      padding: 12px 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .terminal-input-row span {
      color: #58a6ff;
      margin-right: 8px;
      white-space: nowrap;
      font-size: 13px;
    }

    .terminal-input-row input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: none;
      color: #fff;
      outline: none;
      font: inherit;
    }

    .terminal-input-row input::placeholder {
      color: #484f58;
    }

    .events-panel {
      height: 462px;
      display: flex;
      flex-direction: column;
    }

    .events-stream {
      flex: 1;
      overflow-y: auto;
      padding: 10px 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
    }

    .event-card {
      background: #0d1117;
      border-left: 3px solid #238636;
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 7px;
    }

    .event-card.warning {
      border-left-color: #f85149;
    }

    .event-card.info {
      border-left-color: #388bfd;
    }

    .event-time {
      color: #8b949e;
    }

    .event-badge {
      float: right;
      font-size: 8px;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 700;
    }

    .event-normal .event-badge {
      color: #3fb950;
      background: #23863622;
    }

    .event-warning .event-badge {
      color: #f85149;
      background: #da363322;
    }

    .event-info .event-badge {
      color: #58a6ff;
      background: #388bfd15;
    }

    .event-reason {
      color: #f0f6fc;
      font-weight: 600;
      margin-top: 4px;
    }

    .event-object {
      color: #8b949e;
      font-weight: normal;
    }

    .event-message {
      color: #8b949e;
      margin-top: 2px;
    }

    .guide-panel {
      margin-top: 16px;
      background: linear-gradient(180deg, #161b22 0%, #11161d 100%);
      border: 1px solid #30363d;
      border-radius: 8px;
      overflow: hidden;
    }

    .guide-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-bottom: 1px solid #30363d;
    }

    .guide-title {
      font-size: 14px;
      font-weight: 700;
      color: #f0f6fc;
    }

    .guide-subtitle {
      color: #8b949e;
      font-size: 11px;
      margin-left: 2px;
    }

    .guide-progress {
      margin-left: auto;
      display: flex;
      gap: 4px;
    }

    .progress-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #30363d;
    }

    .progress-dot.done {
      background: #3fb950;
    }

    .progress-dot.current {
      background: #58a6ff;
      box-shadow: 0 0 0 3px #388bfd22;
    }

    .guide-body {
      padding: 14px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 16px;
    }

    .guide-current {
      min-width: 0;
    }

    .guide-label {
      color: #8b949e;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }

    .guide-step-title {
      color: #f0f6fc;
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 5px;
    }

    .guide-description {
      color: #8b949e;
      font-size: 12px;
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .suggested-command {
      display: flex;
      align-items: stretch;
      background: #010409;
      border: 1px solid #30363d;
      border-radius: 6px;
      overflow: hidden;
    }

    .suggested-command code {
      flex: 1;
      padding: 11px 12px;
      color: #7ee787;
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      overflow-x: auto;
      white-space: pre;
    }

    .use-command-btn {
      border: none;
      border-left: 1px solid #30363d;
      background: #21262d;
      color: #f0f6fc;
      padding: 0 14px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .use-command-btn:hover {
      background: #30363d;
    }

    .guide-side {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px 12px;
    }

    .guide-side-title {
      color: #f0f6fc;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .guide-step-mini {
      width: 100%;
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 7px 4px;
      margin: 0;
      border: 0;
      border-bottom: 1px solid #21262d;
      background: transparent;
      color: #8b949e;
      font: inherit;
      font-size: 10px;
      text-align: left;
      cursor: pointer;
      border-radius: 4px;
      transition: background 120ms ease, color 120ms ease;
    }

    .guide-step-mini:hover {
      background: #161b22;
      color: #f0f6fc;
    }

    .guide-step-mini:focus-visible {
      outline: 1px solid #58a6ff;
      outline-offset: -1px;
    }

    .guide-step-mini:last-child {
      border-bottom: none;
    }

    .mini-number {
      color: #58a6ff;
      min-width: 15px;
    }

    .guide-step-mini.done {
      color: #3fb950;
    }

    .guide-step-mini.current,
    .guide-step-mini.selected {
      color: #f0f6fc;
      font-weight: 600;
      background: #161b22;
    }

    .guide-step-mini.selected {
      box-shadow: inset 2px 0 0 #58a6ff;
    }

    .optional-badge {
      color: #d29922;
      font-size: 9px;
      margin-left: 4px;
    }

    .empty-state {
      color: #8b949e;
      font-size: 11px;
      padding: 8px 0;
    }

    .edera-footer {
      margin-top: 18px;
      padding: 14px 0 8px;
      border-top: 1px solid #21262d;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #8b949e;
      font-size: 11px;
      text-align: center;
    }

    .edera-footer img {
      width: 32px;
      height: 32px;
      object-fit: cover;
      border-radius: 50%;
      border: 1px solid #30363d;
      flex: 0 0 auto;
    }

    .edera-footer a {
      color: #58a6ff;
      text-decoration: none;
    }

    .edera-footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 900px) {
      .main-layout,
      .guide-body {
        grid-template-columns: 1fr;
      }

      .events-panel {
        height: 320px;
      }
    }

    @media (max-width: 700px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }

      .demo-shell {
        padding: 12px;
      }
    }
  `;

  document.head.appendChild(styleTag);

  const app = document.querySelector<HTMLDivElement>("#app")!;

  app.innerHTML = `
    <div class="demo-shell">

      <div class="top-header">
        <div>
          <h1>Webernetes Dashboard & Terminal</h1>
          <p>Browser-based Kubernetes cluster emulator with simulated Edera</p>
        </div>
      </div>

      <div class="dashboard-grid">

        <div class="panel" id="pods-panel">
          <div class="panel-header">
            <span class="drag-handle">⋮⋮</span>
            <h3>📦 Active Pods</h3>
            <span id="pod-count" class="panel-count">0 Pods</span>
            <button class="hide-btn" id="hide-pods-btn">Hide</button>
          </div>
          <div class="resource-body" id="pods-body">
            <div id="pod-grid" class="resource-list"></div>
          </div>
        </div>

        <div class="panel" id="nodes-panel">
          <div class="panel-header">
            <span class="drag-handle">⋮⋮</span>
            <h3>🖥️ Active Nodes</h3>
            <span id="node-count" class="panel-count">3 Nodes</span>
            <button class="hide-btn" id="hide-nodes-btn">Hide</button>
          </div>
          <div class="resource-body" id="nodes-body">
            <div id="node-grid" class="resource-list"></div>
          </div>
        </div>

      </div>

      <div class="panel protect-panel" id="protect-panel">
        <div class="panel-header">
          <span class="drag-handle">⋮⋮</span>
          <div>
            <h3>🛡️ Edera Zones</h3>
            <div class="panel-subtitle">Simulated Protect isolation boundaries</div>
          </div>
          <span id="zone-count" class="panel-count">0 Zones</span>
          <button class="hide-btn" id="hide-protect-btn">Hide</button>
        </div>
        <div class="protect-body" id="protect-body">
          <div id="zone-grid"></div>
        </div>
      </div>

      <div class="main-layout">

        <div class="terminal-panel">
          <div
            id="output"
            class="terminal-output"
            aria-live="polite"
          ></div>

          <div class="terminal-input-row">
            <span>user@webernetes:~$</span>
            <input
              id="cmd"
              type="text"
              placeholder="Type 'help' or use Up/Down arrow keys for command history..."
              disabled
              autocomplete="off"
              spellcheck="false"
            />
          </div>
        </div>

        <div class="panel events-panel" id="events-panel">
          <div class="panel-header">
            <span class="drag-handle">⋮⋮</span>
            <h3>⚡ Lifecycle Events</h3>
            <button class="hide-btn" id="clear-events-btn">Clear</button>
            <button class="hide-btn" id="hide-events-btn">Hide</button>
          </div>
          <div id="events-stream" class="events-stream"></div>
        </div>

      </div>

      <div class="guide-panel" id="guide-panel">

        <div class="guide-header">
          <span class="drag-handle">⋮⋮</span>
          <div>
            <div class="guide-title">🧭 Edera Demo Guide</div>
            <div class="guide-subtitle">
              Run each command below to walk through the isolation lifecycle
            </div>
          </div>

          <div id="guide-progress" class="guide-progress"></div>

          <button class="hide-btn" id="hide-guide-btn">Hide</button>
        </div>

        <div class="guide-body" id="guide-body">

          <div class="guide-current">
            <div class="guide-label">Suggested next command</div>
            <div id="guide-step-title" class="guide-step-title"></div>
            <div id="guide-description" class="guide-description"></div>

            <div class="suggested-command">
              <code id="suggested-command"></code>
              <button id="use-command-btn" class="use-command-btn">
                Use command
              </button>
            </div>
          </div>

          <div class="guide-side">
            <div class="guide-side-title">Demo flow</div>
            <div id="guide-step-list"></div>
          </div>

        </div>
      </div>

      <div class="edera-footer">
        <img
          src="https://docs.edera.dev/Ivy%20Headphones.png"
          alt="Ivy from Edera"
          loading="lazy"
        />
        <span>Made with love by the team at <a href="https://edera.dev/" target="_blank" rel="noopener noreferrer">Edera</a></span>
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

  const eventsStream =
    document.querySelector<HTMLDivElement>("#events-stream")!;

  const guideStepTitle =
    document.querySelector<HTMLDivElement>("#guide-step-title")!;

  const guideDescription =
    document.querySelector<HTMLDivElement>("#guide-description")!;

  const suggestedCommand =
    document.querySelector<HTMLElement>("#suggested-command")!;

  const guideStepList =
    document.querySelector<HTMLDivElement>("#guide-step-list")!;

  const guideProgress =
    document.querySelector<HTMLDivElement>("#guide-progress")!;

  const useCommandBtn =
    document.querySelector<HTMLButtonElement>("#use-command-btn")!;

  let cluster: Cluster;

  const localFiles: Record<string, string> = {
    "pod-nginx.yaml": NGINX_YAML_CONTENT,
    "runtimeclass-edera.yaml": RUNTIMECLASS_EDERA_YAML_CONTENT,
    "pod-hardened-vessel.yaml": HARDENED_VESSEL_YAML_CONTENT,
    "nginx-deployment.yaml": NGINX_DEPLOYMENT_YAML_CONTENT,
  };

  const activeRuntimeClasses = new Set<string>();

  let namespaces: LocalNamespace[] = [
    { name: "default", status: "Active", age: "10m" },
    { name: "kube-system", status: "Active", age: "10m" },
    { name: "kube-public", status: "Active", age: "10m" },
    { name: "kube-node-lease", status: "Active", age: "10m" },
  ];

  let deployments: LocalDeployment[] = [];

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

  let protectZones: ProtectZone[] = [];
  let protectWorkloads: ProtectWorkload[] = [];

  let clusterEvents: ClusterEvent[] = [];

  const commandHistory: string[] = [];
  let historyIndex = -1;

  /*
   * We track the highest completed step rather than simply advancing
   * whenever any protect command is typed. That means the guide remains
   * useful even if someone explores commands out of order.
   */
  let completedDemoSteps = new Set<string>();

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const tokenize = (command: string): string[] => {
    const tokens: string[] = [];
    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;

    let match: RegExpExecArray | null;

    while ((match = regex.exec(command)) !== null) {
      tokens.push(match[1] ?? match[2] ?? match[3]);
    }

    return tokens;
  };

  const printHtml = (htmlContent: string) => {
    const block = document.createElement("div");
    block.className = "terminal-block";
    block.innerHTML = htmlContent;
    output.appendChild(block);
    output.scrollTop = output.scrollHeight;
  };

  const printPre = (htmlContent: string) => {
    printHtml(`<pre class="terminal-pre">${htmlContent}</pre>`);
  };

  const printCommand = (command: string) => {
    printHtml(
      `<div class="terminal-command"><span class="terminal-prompt">user@webernetes:~$</span> ${escapeHtml(command)}</div>`,
    );
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
        <div class="empty-state">
          No lifecycle events captured yet.
        </div>
      `;
      return;
    }

    eventsStream.innerHTML = clusterEvents
      .map((ev) => {
        const className =
          ev.type === "Warning"
            ? "warning event-warning"
            : ev.type === "Info"
              ? "info event-info"
              : "event-normal";

        return `
          <div class="event-card ${className}">
            <span class="event-time">${escapeHtml(ev.time)}</span>
            <span class="event-badge">${ev.type.toUpperCase()}</span>

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

  const formatLabels = (labels: Record<string, string>): string => {
    const entries = Object.entries(labels);

    if (entries.length === 0) {
      return "<none>";
    }

    return entries
      .map(([key, value]) => (value ? `${key}=${value}` : key))
      .join(",");
  };

  const renderPods = () => {
    podCount.innerText =
      `${pods.length} ${pods.length === 1 ? "Pod" : "Pods"}`;

    if (pods.length === 0) {
      podGrid.innerHTML = `
        <div class="empty-state">No pods running</div>
      `;
      return;
    }

    podGrid.innerHTML = pods
      .map((pod) => {
        const pending = pod.status === "Pending";
        const failed = pod.status === "Failed";
        const cardStateClass = failed
          ? "pending"
          : pending
            ? "pending"
            : "running";

        return `
          <div class="resource-card ${cardStateClass}">
            <div>
              <div class="resource-name">
                ${escapeHtml(pod.name)}
                <span style="color:#8b949e;font-weight:400;font-size:10px;">
                  (${escapeHtml(pod.namespace)})
                </span>
              </div>

              <div class="resource-meta">
                ${escapeHtml(pod.image)} ·
                ${escapeHtml(pod.node || "unassigned")}
              </div>
            </div>

            <span class="status-badge ${
              failed || pending ? "status-pending" : "status-ready"
            }">
              ${escapeHtml(pod.status)}
            </span>
          </div>
        `;
      })
      .join("");
  };

  const renderNodes = () => {
    nodeCount.innerText =
      `${nodes.length} ${nodes.length === 1 ? "Node" : "Nodes"}`;

    if (nodes.length === 0) {
      nodeGrid.innerHTML = `
        <div class="empty-state">No nodes available</div>
      `;
      return;
    }

    nodeGrid.innerHTML = nodes
      .map(
        (node) => `
          <div class="resource-card">
            <div>
              <div style="font-weight:600;font-size:13px;color:#f0f6fc;">
                ${escapeHtml(node.name)}
              </div>

              <div class="resource-meta">
                ${escapeHtml(getNodeRoles(node))}
              </div>
            </div>

            <span class="status-badge status-ready">
              ${escapeHtml(node.status)}
            </span>
          </div>
        `,
      )
      .join("");
  };

  const renderProtectZones = () => {
    zoneCount.innerText =
      `${protectZones.length} ${protectZones.length === 1 ? "Zone" : "Zones"}`;

    if (protectZones.length === 0) {
      zoneGrid.innerHTML = `
        <div class="empty-state">
          No Edera zones have been launched.
        </div>
      `;
      return;
    }

    zoneGrid.innerHTML = protectZones
      .map((zone) => {
        const workloadCount = protectWorkloads.filter(
          (workload) => workload.zone === zone.uuid,
        ).length;

        const statusClass =
          zone.state === "ready"
            ? "status-ready"
            : zone.state === "destroyed"
              ? "status-destroyed"
              : "status-pending";

        return `
          <div class="zone-card">
            <div class="zone-top">
              <div>
                <div class="zone-name">
                  🛡️ ${escapeHtml(zone.name)}
                </div>

                <div class="zone-uuid">
                  ${escapeHtml(zone.uuid)}
                </div>
              </div>

              <span class="status-badge ${statusClass}">
                ${escapeHtml(zone.state)}
              </span>
            </div>

            <div class="zone-meta">
              <span>IPv4: ${escapeHtml(zone.ipv4 || "—")}</span>
              <span>CPUs: ${zone.targetCpus}</span>
              <span>Workloads: ${workloadCount}</span>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const updateDashboard = () => {
    renderPods();
    renderNodes();
    renderProtectZones();
  };

  let selectedDemoStepIndex: number | null = null;

  const getNextDemoStepIndex = (): number => {
    const index = PROTECT_DEMO_STEPS.findIndex(
      (step) => !completedDemoSteps.has(step.id),
    );

    return index === -1 ? PROTECT_DEMO_STEPS.length - 1 : index;
  };

  const getSelectedDemoStepIndex = (): number => {
    if (
      selectedDemoStepIndex !== null &&
      selectedDemoStepIndex >= 0 &&
      selectedDemoStepIndex < PROTECT_DEMO_STEPS.length
    ) {
      return selectedDemoStepIndex;
    }

    return getNextDemoStepIndex();
  };

  const selectDemoStep = (index: number) => {
    if (index < 0 || index >= PROTECT_DEMO_STEPS.length) {
      return;
    }

    selectedDemoStepIndex = index;
    renderGuide();
  };

  const renderGuide = () => {
    const currentIndex = getSelectedDemoStepIndex();
    const currentStep = PROTECT_DEMO_STEPS[currentIndex];

    guideProgress.innerHTML = PROTECT_DEMO_STEPS.map((step, index) => {
      const done = completedDemoSteps.has(step.id);
      const current = index === currentIndex && !done;

      return `
        <span
          class="progress-dot ${
            done ? "done" : current ? "current" : ""
          }"
          title="${escapeHtml(step.title)}"
        ></span>
      `;
    }).join("");

    guideStepTitle.innerHTML =
      `${escapeHtml(currentStep.title)}${
        currentStep.optional
          ? `<span class="optional-badge">OPTIONAL</span>`
          : ""
      }`;

    guideDescription.innerText = currentStep.description;
    suggestedCommand.innerText = currentStep.command;

    guideStepList.innerHTML = PROTECT_DEMO_STEPS.map((step, index) => {
      const done = completedDemoSteps.has(step.id);
      const current = index === currentIndex && !done;
      const selected = index === currentIndex;

      return `
        <button
          type="button"
          class="guide-step-mini ${
            done ? "done" : current ? "current" : ""
          } ${selected ? "selected" : ""}"
          data-step-index="${index}"
          title="${escapeHtml(step.title)} — click to select this task"
        >
          <span class="mini-number">${index + 1}.</span>
          <span>
            ${escapeHtml(step.title)}
            ${
              step.optional
                ? `<span class="optional-badge">optional</span>`
                : ""
            }
          </span>
        </button>
      `;
    }).join("");
  };

  const markDemoStepComplete = (stepId: string) => {
    completedDemoSteps.add(stepId);

    // Once the selected step has completed, advance the selection to the next
    // incomplete task so the guide remains useful as a linear walkthrough.
    const selectedStep =
      selectedDemoStepIndex === null
        ? undefined
        : PROTECT_DEMO_STEPS[selectedDemoStepIndex];

    if (selectedStep?.id === stepId) {
      const nextIndex = PROTECT_DEMO_STEPS.findIndex(
        (step) => !completedDemoSteps.has(step.id),
      );

      selectedDemoStepIndex =
        nextIndex === -1 ? PROTECT_DEMO_STEPS.length - 1 : nextIndex;
    }

    renderGuide();
  };

  guideStepList.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>("button[data-step-index]");

    if (!button) {
      return;
    }

    const index = Number(button.dataset.stepIndex);
    if (Number.isFinite(index)) {
      selectDemoStep(index);
    }
  });

  useCommandBtn.addEventListener("click", () => {
    const index = getSelectedDemoStepIndex();
    const step = PROTECT_DEMO_STEPS[index];

    input.value = step.command;
    input.focus();

    input.setSelectionRange(input.value.length, input.value.length);
  });

  const hidePanel = (
    panelId: string,
    bodyId: string,
    buttonId: string,
  ) => {
    const panel = document.querySelector<HTMLElement>(panelId)!;
    const body = document.querySelector<HTMLElement>(bodyId)!;
    const button = document.querySelector<HTMLButtonElement>(buttonId)!;

    let hidden = false;

    button.addEventListener("click", () => {
      hidden = !hidden;

      body.style.display = hidden ? "none" : "";
      button.innerText = hidden ? "Show" : "Hide";

      if (hidden) {
        panel.style.opacity = "0.65";
      } else {
        panel.style.opacity = "1";
      }
    });
  };

  hidePanel("#pods-panel", "#pods-body", "#hide-pods-btn");
  hidePanel("#nodes-panel", "#nodes-body", "#hide-nodes-btn");
  hidePanel("#protect-panel", "#protect-body", "#hide-protect-btn");
  hidePanel("#guide-panel", "#guide-body", "#hide-guide-btn");

  document
    .querySelector<HTMLButtonElement>("#hide-events-btn")!
    .addEventListener("click", () => {
      const eventsPanel =
        document.querySelector<HTMLElement>("#events-panel")!;

      const stream =
        document.querySelector<HTMLElement>("#events-stream")!;

      const button =
        document.querySelector<HTMLButtonElement>("#hide-events-btn")!;

      const hidden = stream.style.display === "none";

      stream.style.display = hidden ? "" : "none";
      button.innerText = hidden ? "Hide" : "Show";
      eventsPanel.style.opacity = hidden ? "1" : "0.65";
    });

  document
    .querySelector<HTMLButtonElement>("#clear-events-btn")!
    .addEventListener("click", () => {
      clusterEvents = [];
      renderEvents();
    });

  const checkPendingPods = () => {
    pods.forEach((pod) => {
      const recoverableRuntimeClassPod =
        pod.status === "Failed" &&
        pod.runtimeClassName &&
        activeRuntimeClasses.has(pod.runtimeClassName);

      if (pod.status !== "Pending" && !recoverableRuntimeClassPod) {
        return;
      }

      if (
        pod.runtimeClassName &&
        !activeRuntimeClasses.has(pod.runtimeClassName)
      ) {
        return;
      }

      if (recoverableRuntimeClassPod) {
        pod.status = "Pending";
        addEvent(
          "Info",
          "RuntimeClassRecovered",
          `pod/${pod.name}`,
          `RuntimeClass "${pod.runtimeClassName}" is available again; attempting to reschedule ${pod.name}`,
        );
      }

      let targetNode: LocalNode | undefined;

      if (pod.nodeSelector) {
        targetNode = nodes.find((node) =>
          Object.entries(pod.nodeSelector!).every(
            ([key, value]) => node.labels[key] === value,
          ),
        );
      } else {
        targetNode =
          nodes.find(
            (node) =>
              !node.labels["node-role.kubernetes.io/control-plane"],
          ) || nodes[0];
      }

      if (targetNode) {
        pod.status = "Running";
        pod.node = targetNode.name;
        pod.ip = `10.244.0.${Math.floor(Math.random() * 200 + 10)}`;

        addEvent(
          "Normal",
          "Scheduled",
          `pod/${pod.name}`,
          `Successfully assigned ${pod.namespace}/${pod.name} to ${targetNode.name}`,
        );

        addEvent(
          "Normal",
          "Started",
          `pod/${pod.name}`,
          `Started container ${pod.name}`,
        );
      }
    });
  };

  const reconcileDeployments = () => {
    for (const deployment of deployments) {
      const managedPods = pods.filter(
        (pod) =>
          pod.ownerDeployment === deployment.name &&
          pod.status !== "Failed",
      );

      while (
        managedPods.length < deployment.replicas
      ) {
        const podName = `${deployment.name}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;

        const runtimeReady = activeRuntimeClasses.has(
          deployment.runtimeClassName || "",
        );

        const assignedNode = runtimeReady
          ? nodes.find(
              (node) =>
                !node.labels[
                  "node-role.kubernetes.io/control-plane"
                ],
            ) || nodes[0]
          : undefined;

        const pod: LocalPod = {
          name: podName,
          namespace: deployment.namespace,
          status: runtimeReady ? "Running" : "Pending",
          age: "1s",
          image: deployment.image,
          ip: assignedNode
            ? `10.244.0.${Math.floor(
                Math.random() * 200 + 10,
              )}`
            : "<none>",
          node: assignedNode?.name || "<none>",
          labels: { app: "nginx" },
          runtimeClassName: deployment.runtimeClassName,
          ownerDeployment: deployment.name,
        };

        pods.push(pod);
        managedPods.push(pod);

        addEvent(
          "Normal",
          "Created",
          `pod/${pod.name}`,
          `Created replacement pod ${pod.name} for Deployment ${deployment.name}`,
        );

        if (!runtimeReady) {
          addEvent(
            "Warning",
            "FailedCreatePodSandBox",
            `pod/${pod.name}`,
            `Waiting for RuntimeClass "${deployment.runtimeClassName || ""}" to become available`,
          );
        }
      }

      checkPendingPods();
      deployment.readyReplicas = pods.filter(
        (pod) =>
          pod.ownerDeployment === deployment.name &&
          pod.status === "Running",
      ).length;
    }

    syncEderaPodsToProtectWorkloads();
  };

  /*
   * -----------------------------------------------------------------------
   * EDERA PROTECT SIMULATION
   * -----------------------------------------------------------------------
   */

  const nextZoneIp = () => {
    const used = new Set(
      protectZones
        .map((zone) => zone.ipv4)
        .filter(Boolean)
        .map((ip) => ip.split(".")[3]?.split("/")[0]),
    );

    for (let i = 2; i < 250; i++) {
      if (!used.has(String(i))) {
        return `10.75.0.${i}/16`;
      }
    }

    return `10.75.0.${Math.floor(Math.random() * 200 + 20)}/16`;
  };

  const nextZoneIpv6 = () => {
    const id = protectZones.length + 2;

    return `fdd4:1476:6c7e::${id}/48`;
  };

  const launchProtectZone = (
    name: string,
    minCpus = 1,
    maxCpus = 2,
    targetCpus = 2,
  ) => {
    // Zone names are labels, not unique identifiers. Multiple zones may
    // legitimately share the same name; the UUID uniquely identifies each
    // zone instance.
    const uuid = crypto.randomUUID();

    const zone: ProtectZone = {
      name,
      uuid,
      state: "creating",
      ipv4: "",
      ipv6: "",
      minCpus,
      maxCpus,
      targetCpus,
    };

    protectZones.push(zone);

    addEvent(
      "Info",
      "ZoneCreating",
      `zone/${name}`,
      `Requested Edera zone ${name}`,
    );

    zone.state = "ready";
    zone.ipv4 = nextZoneIp();
    zone.ipv6 = nextZoneIpv6();

    addEvent(
      "Normal",
      "ZoneReady",
      `zone/${name}`,
      `Edera zone ${name} is ready`,
    );

    syncEderaPodsToProtectWorkloads();
    updateDashboard();

    printHtml(
      `<span style="color:#7ee787;">${escapeHtml(uuid)}</span>`,
    );
  };

  const renderProtectZoneList = () => {
    if (protectZones.length === 0) {
      printHtml(
        `<span style="color:#8b949e;">No zones have been launched.</span>`,
      );
      return;
    }

    const nameWidth = 15;
    const uuidWidth = 38;
    const stateWidth = 13;
    const ipv4Width = 18;

    const header =
      "NAME".padEnd(nameWidth) +
      "UUID".padEnd(uuidWidth) +
      "STATE".padEnd(stateWidth) +
      "IPV4".padEnd(ipv4Width) +
      "IPV6";

    const divider =
      "─".repeat(nameWidth) +
      "─".repeat(uuidWidth) +
      "─".repeat(stateWidth) +
      "─".repeat(ipv4Width) +
      "─".repeat(28);

    let html = `<span style="color:#79c0ff;font-weight:700;">${header}</span>\n`;
    html += `<span style="color:#30363d;">${divider}</span>\n`;

    for (const zone of protectZones) {
      const stateColor =
        zone.state === "ready"
          ? "#7ee787"
          : zone.state === "destroyed"
            ? "#8b949e"
            : "#d29922";

      html +=
        `${escapeHtml(zone.name.padEnd(nameWidth))}` +
        `${escapeHtml(zone.uuid.padEnd(uuidWidth))}` +
        `<span style="color:${stateColor};">${escapeHtml(
          zone.state.padEnd(stateWidth),
        )}</span>` +
        `${escapeHtml((zone.ipv4 || "").padEnd(ipv4Width))}` +
        `${escapeHtml(zone.ipv6 || "")}` +
        "\n";
    }

    printPre(html.trimEnd());
  };

  const destroyProtectZoneInstance = (zone: ProtectZone, wait = false) => {
    if (zone.state === "destroyed") {
      return false;
    }

    zone.state = "destroying";

    addEvent(
      "Info",
      "ZoneDestroying",
      `zone/${zone.name}`,
      `Destruction requested for zone ${zone.name}`,
    );

    const attached = protectWorkloads.filter(
      (workload) => workload.zone === zone.uuid,
    );

    for (const workload of attached) {
      addEvent(
        "Normal",
        "WorkloadTerminated",
        `workload/${workload.name}`,
        `Workload ${workload.name} removed with zone ${zone.name}`,
      );
    }

    protectWorkloads = protectWorkloads.filter(
      (workload) => workload.zone !== zone.uuid,
    );

    zone.state = "destroyed";
    zone.ipv4 = "";
    zone.ipv6 = "";

    addEvent(
      "Normal",
      "ZoneDestroyed",
      `zone/${zone.name}`,
      `Zone ${zone.name} destroyed`,
    );

    printHtml(
      `<span style="color:#c9d1d9;">Destruction of zone ${escapeHtml(
        zone.uuid,
      )} ${wait ? "completed" : "requested"}.</span>`,
    );

    return true;
  };

  const normalizeZoneSelector = (selector: string): string | null => {
    const match = selector.trim().match(/^status\.state\s*=\s*([^\s]+)$/i);
    if (!match) {
      return null;
    }

    const rawState = match[1].toLowerCase();
    const normalized = rawState.startsWith("zone_state_")
      ? rawState.slice("zone_state_".length)
      : rawState;

    const supportedStates = new Set([
      "creating",
      "created",
      "ready",
      "exited",
      "destroying",
      "destroyed",
      "failed",
    ]);

    return supportedStates.has(normalized) ? normalized : null;
  };

  const destroyProtectZones = (
    identifier: string,
    all = false,
    wait = false,
    selector?: string,
  ) => {
    const normalizedSelector = selector
      ? normalizeZoneSelector(selector)
      : undefined;

    if (selector && !normalizedSelector) {
      printHtml(
        `<span style="color:#f85149;">Invalid selector "${escapeHtml(
          selector,
        )}". Supported form: status.state=&lt;STATE&gt;.</span>`,
      );
      return;
    }

    let matches = protectZones.filter((zone) => {
      if (zone.state === "destroyed") {
        return false;
      }

      const identifierMatches =
        zone.uuid === identifier || zone.name === identifier;
      if (!identifierMatches) {
        return false;
      }

      if (!normalizedSelector) {
        return true;
      }

      const state = normalizedSelector === "created"
        ? "ready"
        : normalizedSelector;

      return zone.state === state;
    });

    // Without --all, a duplicate name targets the newest active zone.
    // With --all, every matching active zone is destroyed.
    if (!all && matches.length > 1) {
      matches = [matches[matches.length - 1]];
    }

    if (matches.length === 0) {
      printHtml(
        `<span style="color:#8b949e;">No active zones matched "${escapeHtml(
          identifier,
        )}".</span>`,
      );
      return;
    }

    let destroyedCount = 0;
    for (const zone of matches) {
      if (destroyProtectZoneInstance(zone, wait)) {
        destroyedCount += 1;
      }
    }

    if (all && destroyedCount > 1) {
      printHtml(
        `<span style="color:#7ee787;">Destroyed ${destroyedCount} zones matching "${escapeHtml(
          identifier,
        )}".</span>`,
      );
    }

    updateDashboard();
  };

  const launchProtectWorkload = (
    zoneIdentifier: string,
    name: string,
    image: string,
    command: string[],
  ) => {
    const zone = protectZones.find(
      (item) =>
        item.name === zoneIdentifier ||
        item.uuid === zoneIdentifier,
    );

    if (!zone) {
      printHtml(
        `<span style="color:#f85149;">Error: zone "${escapeHtml(
          zoneIdentifier,
        )}" not found.</span>`,
      );
      return;
    }

    if (zone.state !== "ready") {
      printHtml(
        `<span style="color:#f85149;">Error: zone "${escapeHtml(
          zone.name,
        )}" is not ready.</span>`,
      );
      return;
    }

    if (
      protectWorkloads.some(
        (workload) =>
          workload.name === name && workload.state !== "destroyed",
      )
    ) {
      printHtml(
        `<span style="color:#f85149;">Error: workload "${escapeHtml(
          name,
        )}" already exists.</span>`,
      );
      return;
    }

    const uuid = crypto.randomUUID();

    const workload: ProtectWorkload = {
      name,
      uuid,
      zone: zone.uuid,
      state: "creating",
      image,
      command,
    };

    protectWorkloads.push(workload);

    addEvent(
      "Info",
      "WorkloadCreating",
      `workload/${name}`,
      `Creating ${image} in Edera zone ${zone.name}`,
    );

    workload.state = "running";

    addEvent(
      "Normal",
      "WorkloadStarted",
      `workload/${name}`,
      `Started ${image} in Edera zone ${zone.name}`,
    );

    printHtml(
      `<span style="color:#7ee787;">${escapeHtml(uuid)}</span>`,
    );

    updateDashboard();
  };

  const syncEderaPodsToProtectWorkloads = () => {
    const readyZones = protectZones.filter(
      (zone) => zone.state === "ready",
    );

    if (readyZones.length === 0) {
      return;
    }

    // In the simulator, a runtimeClassName: edera pod attaches to
    // the most recently launched ready Edera zone.
    const targetZone = readyZones[readyZones.length - 1];

    for (const pod of pods) {
      if (
        pod.runtimeClassName !== "edera" ||
        pod.status !== "Running"
      ) {
        continue;
      }

      const alreadyAttached = protectWorkloads.some(
        (workload) =>
          workload.sourcePodName === pod.name &&
          workload.state !== "destroyed",
      );

      if (alreadyAttached) {
        continue;
      }

      const conflictingWorkload = protectWorkloads.find(
        (workload) =>
          workload.name === pod.name &&
          workload.state !== "destroyed",
      );

      if (conflictingWorkload) {
        addEvent(
          "Warning",
          "WorkloadNameConflict",
          `pod/${pod.name}`,
          `Cannot attach pod/${pod.name} to Edera zone: Edera workload name already exists`,
        );
        continue;
      }

      const workload: ProtectWorkload = {
        name: pod.name,
        uuid: crypto.randomUUID(),
        zone: targetZone.uuid,
        state: "running",
        image: pod.image,
        command: [],
        sourcePodName: pod.name,
      };

      protectWorkloads.push(workload);

      addEvent(
        "Info",
        "WorkloadAttached",
        `workload/${workload.name}`,
        `Attached pod/${pod.name} to Edera zone ${targetZone.name}`,
      );
    }

    updateDashboard();
  };

  const renderProtectWorkloadList = () => {
    if (protectWorkloads.length === 0) {
      printHtml(
        `<span style="color:#8b949e;">No workloads have been launched.</span>`,
      );
      return;
    }

    const nameWidth = 18;
    const uuidWidth = 38;
    const zoneWidth = 38;
    const stateWidth = 14;

    const header =
      "NAME".padEnd(nameWidth) +
      "UUID".padEnd(uuidWidth) +
      "ZONE".padEnd(zoneWidth) +
      "STATE";

    const divider =
      "─".repeat(nameWidth) +
      "─".repeat(uuidWidth) +
      "─".repeat(zoneWidth) +
      "─".repeat(stateWidth);

    let html = `<span style="color:#79c0ff;font-weight:700;">${header}</span>\n`;
    html += `<span style="color:#30363d;">${divider}</span>\n`;

    for (const workload of protectWorkloads) {
      const stateColor =
        workload.state === "running"
          ? "#7ee787"
          : workload.state === "destroyed"
            ? "#8b949e"
            : "#d29922";

      html +=
        `${escapeHtml(workload.name.padEnd(nameWidth))}` +
        `${escapeHtml(workload.uuid.padEnd(uuidWidth))}` +
        `${escapeHtml(workload.zone.padEnd(zoneWidth))}` +
        `<span style="color:${stateColor};">${escapeHtml(
          workload.state,
        )}</span>\n`;
    }

    printPre(html.trimEnd());
  };

  const destroyProtectWorkload = (identifier: string) => {
    const workload = protectWorkloads.find(
      (item) =>
        item.name === identifier ||
        item.uuid === identifier,
    );

    if (!workload) {
      printHtml(
        `<span style="color:#f85149;">Error: workload "${escapeHtml(
          identifier,
        )}" not found.</span>`,
      );
      return;
    }

    if (workload.state === "destroyed") {
      printHtml(
        `<span style="color:#8b949e;">Workload "${escapeHtml(
          identifier,
        )}" is already destroyed.</span>`,
      );
      return;
    }

    workload.state = "destroying";

    addEvent(
      "Info",
      "WorkloadDestroying",
      `workload/${workload.name}`,
      `Destroying workload ${workload.name}`,
    );

    workload.state = "destroyed";

    addEvent(
      "Normal",
      "WorkloadDestroyed",
      `workload/${workload.name}`,
      `Workload ${workload.name} destroyed`,
    );

    protectWorkloads = protectWorkloads.filter(
      (item) => item.uuid !== workload.uuid,
    );

    printHtml(
      `<span style="color:#7ee787;">Workload "${escapeHtml(
        workload.name,
      )}" destroyed.</span>`,
    );

    updateDashboard();
  };

  const execProtectWorkload = (
    identifier: string,
    command: string[],
  ) => {
    const workload = protectWorkloads.find(
      (item) =>
        item.name === identifier ||
        item.uuid === identifier,
    );

    if (!workload) {
      printHtml(
        `<span style="color:#f85149;">Error: workload "${escapeHtml(
          identifier,
        )}" not found.</span>`,
      );
      return;
    }

    if (workload.state !== "running") {
      printHtml(
        `<span style="color:#f85149;">Error: workload "${escapeHtml(
          workload.name,
        )}" is not running.</span>`,
      );
      return;
    }

    const commandText = command.join(" ");

    addEvent(
      "Info",
      "WorkloadExec",
      `workload/${workload.name}`,
      `Executing "${commandText}"`,
    );

    if (
      /\buname\s+-r\b/i.test(commandText) &&
      /grep.*edera|edera.*grep/i.test(commandText)
    ) {
      const kernelVersion = "6.18.44-edera-zone";

      printPre(
        `<span style="color:#7ee787;">${kernelVersion}</span>`,
      );

      addEvent(
        "Normal",
        "KernelVerified",
        `workload/${workload.name}`,
        `uname -r reported dedicated Edera kernel ${kernelVersion}`,
      );
    } else if (
      /\buname\s+-r\b/i.test(commandText)
    ) {
      const kernelVersion = "6.18.44-edera-zone";
      printPre(
        `<span style="color:#7ee787;">${kernelVersion}</span>`,
      );
    } else if (
      commandText.includes("echo Hello from inside Edera") ||
      commandText.includes("echo")
    ) {
      printHtml(
        `<span style="color:#a5d6ff;">Hello from inside Edera</span>`,
      );
    } else if (
      commandText.includes("ls") ||
      commandText.includes("pwd")
    ) {
      printPre(
        `<span style="color:#c9d1d9;">/bin\n/dev\n/etc\n/home\n/proc\n/root\n/tmp\n/usr\n/var</span>`,
      );
    } else {
      printHtml(
        `<span style="color:#8b949e;">Executed inside ${escapeHtml(
          workload.name,
        )}: ${escapeHtml(commandText)}</span>`,
      );
    }

    addEvent(
      "Normal",
      "WorkloadExecComplete",
      `workload/${workload.name}`,
      `Command completed successfully`,
    );
  };

  /*
   * -----------------------------------------------------------------------
   * KUBERNETES / WEBERNETES COMMANDS
   * -----------------------------------------------------------------------
   */

  const formatHelpText = () => {
    return `
      <div class="cli-help">
        <div class="cli-help-header">
          <div class="cli-help-title">🖥️ Webernetes CLI</div>
          <div class="cli-help-version">Browser-based Kubernetes environment</div>
        </div>

        <div class="cli-help-description">
          Explore the simulated Kubernetes cluster, local manifests, Edera zones,
          and the terminal utilities available in this demo.
        </div>

        <div class="cli-help-section">
          <div class="cli-help-section-title">Kubernetes</div>

          <div class="cli-help-command">
            <code>ls</code>
            <span>List the local manifest files available in the demo.</span>
          </div>

          <div class="cli-help-command">
            <code>cat &lt;filename&gt;</code>
            <span>Display the contents of a local manifest file.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl run &lt;name&gt; [--image=&lt;img&gt;] [-n &lt;ns&gt;]</code>
            <span>Create a simulated pod directly from the command line.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl create namespace &lt;name&gt;</code>
            <span>Create a simulated Kubernetes namespace.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl get pods</code>
            <span>List pods in the current cluster.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl get nodes</code>
            <span>List the simulated cluster nodes and their status.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl get namespaces</code>
            <span>List the available Kubernetes namespaces.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl get deployments</code>
            <span>List simulated Deployment resources and replica status.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl describe pod &lt;name&gt;</code>
            <span>Show detailed simulated Pod configuration, status, events, runtime class, and networking.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl describe node &lt;name&gt;</code>
            <span>Show detailed simulated Node configuration, labels, roles, and workloads.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl label node &lt;node&gt; &lt;key&gt;=&lt;value&gt;</code>
            <span>Add or update a label on a simulated node.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl apply -f &lt;filename.yaml&gt;</code>
            <span>Apply one of the local Kubernetes manifests.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl delete -f &lt;filename.yaml&gt;</code>
            <span>Delete the resources represented by a local manifest.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl delete pod &lt;name&gt;</code>
            <span>Delete a pod from the simulated cluster.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl delete node &lt;name&gt;</code>
            <span>Remove a simulated node from the cluster.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl apply -f nginx-deployment.yaml</code>
            <span>Create an Edera-backed Deployment with two replicas.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl delete -f nginx-deployment.yaml</code>
            <span>Delete the Edera-backed Deployment and its managed pods.</span>
          </div>
        </div>

        <div class="cli-help-section">
          <div class="cli-help-section-title">Edera</div>

          <div class="cli-help-command">
            <code>protect zone launch -n &lt;name&gt; [options]</code>
            <span>Create a new isolated Edera zone.</span>
          </div>

          <div class="cli-help-command">
            <code>protect zone list</code>
            <span>List Edera zones and their networking/state information.</span>
          </div>

          <div class="cli-help-command">
            <code>protect zone destroy [OPTIONS] &lt;ZONE&gt;</code>
            <span>Destroy an Edera zone by name or UUID.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload launch --zone &lt;zone&gt; --name &lt;name&gt; &lt;image&gt; [command]</code>
            <span>Start a workload inside an existing ready Edera zone.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload list</code>
            <span>List workloads and the Edera zones that contain them.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload exec &lt;workload&gt; &lt;command&gt;</code>
            <span>Execute a command inside a running workload.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload destroy &lt;workload&gt; --wait</code>
            <span>Remove a workload from its Edera zone.</span>
          </div>
        </div>

        <div class="cli-help-section">
          <div class="cli-help-section-title">Utilities</div>

          <div class="cli-help-command">
            <code>curl &lt;url&gt;</code>
            <span>Send a simulated HTTP GET request through the cluster.</span>
          </div>

          <div class="cli-help-command">
            <code>clear</code>
            <span>Clear the terminal output.</span>
          </div>

          <div class="cli-help-command">
            <code>history</code>
            <span>Show previously entered terminal commands.</span>
          </div>

          <div class="cli-help-command">
            <code>uname -r</code>
            <span>Show the simulated host kernel version; Edera workloads report their isolated zone kernel when executed inside the workload.</span>
          </div>
        </div>

        <div class="cli-help-tip">
          Tip: use the Edera Demo Guide below the terminal to walk through
          the isolation lifecycle step-by-step.
        </div>
      </div>
    `;
  };

  const formatProtectHelpText = () => {
    return `
      <div class="cli-help">
        <div class="cli-help-header">
          <div class="cli-help-title">🛡️ Edera CLI</div>
          <div class="cli-help-version">Simulated Edera environment</div>
        </div>

        <div class="cli-help-description">
          Manage isolated zones and the workloads running inside them.
          Use <code style="color:#7ee787;">protect &lt;resource&gt; &lt;command&gt;</code>
          to work with a zone or workload.
        </div>

        <div class="cli-help-section">
          <div class="cli-help-section-title">Zones</div>

          <div class="cli-help-command">
            <code>protect zone launch -n &lt;name&gt; [options]</code>
            <span>Create a new isolated Edera zone.</span>
          </div>

          <div class="cli-help-command">
            <code>protect zone list</code>
            <span>List Edera zones and their networking/state information.</span>
          </div>

          <div class="cli-help-command">
            <code>protect zone destroy [OPTIONS] &lt;ZONE&gt;</code>
            <span>Destroy a zone by name or UUID.</span>
          </div>

          <div class="cli-help-command">
            <code>-W, --wait</code>
            <span>Wait for the destruction of the zone to complete.</span>
          </div>

          <div class="cli-help-command">
            <code>-A, --all</code>
            <span>Destroy all zones matching the input.</span>
          </div>

          <div class="cli-help-command">
            <code>-l, --selector &lt;SELECTOR&gt;</code>
            <span>Filter matches using the <code style="color:#7ee787;">status.state</code> field.</span>
          </div>
        </div>

        <div class="cli-help-section">
          <div class="cli-help-section-title">Workloads</div>

          <div class="cli-help-command">
            <code>protect workload launch --zone &lt;zone&gt; --name &lt;name&gt; &lt;image&gt; [command]</code>
            <span>Start a workload inside an existing ready zone.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload list</code>
            <span>List workloads and the Edera zones that contain them.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload exec &lt;workload&gt; &lt;command&gt;</code>
            <span>Execute a command inside a running workload.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload destroy &lt;workload&gt; --wait</code>
            <span>Remove a workload from its Edera zone.</span>
          </div>
        </div>

        <div class="cli-help-section">
          <div class="cli-help-section-title">Help</div>

          <div class="cli-help-command">
            <code>protect --help</code>
            <span>Show this command reference.</span>
          </div>

          <div class="cli-help-command">
            <code>protect -h</code>
            <span>Alias for <code style="color:#7ee787;">protect --help</code>.</span>
          </div>
        </div>

        <div class="cli-help-tip">
          Tip: use the Edera Demo Guide below the terminal to walk through
          the isolation lifecycle step-by-step.
        </div>
      </div>
    `;
  };

  const handleProtectCommand = async (
    rawCmd: string,
    tokens: string[],
  ): Promise<boolean> => {
    if (tokens[0] !== "protect") {
      return false;
    }

    /*
     * protect --help
     */
    if (
      tokens.length === 1 ||
      tokens[1] === "--help" ||
      tokens[1] === "-h"
    ) {
      printHtml(formatProtectHelpText());

      return true;
    }

    if (tokens[1] === "zone") {
      const subcommand = tokens[2];

      if (subcommand === "list") {
        renderProtectZoneList();
        markDemoStepComplete("zone-list");
        return true;
      }

      if (subcommand === "launch") {
        let name = "";
        let minCpus = 1;
        let maxCpus = 2;
        let targetCpus = 2;

        for (let i = 3; i < tokens.length; i++) {
          const token = tokens[i];

          if (token === "-n" || token === "--name") {
            name = tokens[++i] || "";
          } else if (token.startsWith("--name=")) {
            name = token.split("=")[1] || "";
          } else if (token === "--min-cpus") {
            minCpus = Number(tokens[++i]) || 1;
          } else if (token.startsWith("--min-cpus=")) {
            minCpus = Number(token.split("=")[1]) || 1;
          } else if (token === "-C") {
            maxCpus = Number(tokens[++i]) || 2;
          } else if (token === "-c") {
            targetCpus = Number(tokens[++i]) || 2;
          }
        }

        if (!name) {
          printHtml(
            `<span style="color:#f85149;">Error: zone name required. Usage: protect zone launch -n &lt;name&gt;</span>`,
          );
          return true;
        }

        launchProtectZone(name, minCpus, maxCpus, targetCpus);

        markDemoStepComplete("zone-launch");

        return true;
      }

      if (subcommand === "destroy") {
        let identifier = "";
        let all = false;
        let wait = false;
        let selector = "";

        for (let i = 3; i < tokens.length; i++) {
          const token = tokens[i];

          if (token === "-W" || token === "--wait") {
            wait = true;
          } else if (token === "-A" || token === "--all") {
            all = true;
          } else if (token === "-l" || token === "--selector") {
            selector = tokens[++i] || "";
          } else if (token.startsWith("--selector=")) {
            selector = token.slice("--selector=".length);
          } else if (!identifier) {
            identifier = token;
          }
        }

        if (!identifier) {
          printHtml(`
            <span style="color:#f85149;">Usage: protect zone destroy [OPTIONS] &lt;ZONE&gt;</span>
          `);
          return true;
        }

        destroyProtectZones(
          identifier,
          all,
          wait,
          selector || undefined,
        );

        markDemoStepComplete("zone-destroy");

        return true;
      }

      printHtml(
        `<span style="color:#f85149;">Unknown protect zone command: ${escapeHtml(
          tokens.slice(2).join(" "),
        )}</span>`,
      );

      return true;
    }

    if (tokens[1] === "workload") {
      const subcommand = tokens[2];

      if (subcommand === "list") {
        renderProtectWorkloadList();

        if (!completedDemoSteps.has("edera-workload-list")) {
          markDemoStepComplete("edera-workload-list");
        } else {
          markDemoStepComplete("workload-list");
        }

        return true;
      }

      if (subcommand === "launch") {
        let zone = "";
        let name = "";

        let imageIndex = -1;

        for (let i = 3; i < tokens.length; i++) {
          const token = tokens[i];

          if (token === "--zone" || token === "-z") {
            zone = tokens[++i] || "";
          } else if (token.startsWith("--zone=")) {
            zone = token.split("=")[1] || "";
          } else if (token === "--name" || token === "-n") {
            name = tokens[++i] || "";
          } else if (token.startsWith("--name=")) {
            name = token.split("=")[1] || "";
          } else if (token === "--") {
            imageIndex = i + 1;
            break;
          }
        }

        if (imageIndex === -1) {
          for (let i = 3; i < tokens.length; i++) {
            if (
              !tokens[i].startsWith("-") &&
              tokens[i] !== zone &&
              tokens[i] !== name
            ) {
              imageIndex = i;
              break;
            }
          }
        }

        const image =
          imageIndex >= 0 ? tokens[imageIndex] : "";

        const command =
          imageIndex >= 0 ? tokens.slice(imageIndex + 1) : [];

        if (!zone || !name || !image) {
          printHtml(`
            <span style="color:#f85149;">Usage:
  protect workload launch --zone &lt;zone&gt; --name &lt;name&gt; &lt;image&gt; [command...]</span>
          `);

          return true;
        }

        launchProtectWorkload(
          zone,
          name,
          image,
          command,
        );

        markDemoStepComplete("workload-launch");

        return true;
      }

      if (subcommand === "exec") {
        let identifier = "";
        let commandStart = 3;

        if (tokens[3] === "--tty" || tokens[3] === "-t") {
          identifier = tokens[4] || "";
          commandStart = 5;
        } else {
          identifier = tokens[3] || "";
        }

        if (!identifier || tokens.length <= commandStart) {
          printHtml(`
            <span style="color:#f85149;">Usage:
  protect workload exec &lt;workload&gt; &lt;command&gt; [args...]</span>
          `);

          return true;
        }

        execProtectWorkload(
          identifier,
          tokens.slice(commandStart),
        );

        markDemoStepComplete("workload-exec");

        return true;
      }

      if (subcommand === "destroy") {
        const identifier = tokens[3];

        if (!identifier) {
          printHtml(
            `<span style="color:#f85149;">Usage: protect workload destroy &lt;workload&gt; [--wait]</span>`,
          );
          return true;
        }

        destroyProtectWorkload(identifier);

        markDemoStepComplete("workload-destroy");

        return true;
      }

      printHtml(
        `<span style="color:#f85149;">Unknown protect workload command: ${escapeHtml(
          tokens.slice(2).join(" "),
        )}</span>`,
      );

      return true;
    }

    printHtml(
      `<span style="color:#f85149;">Unknown protect command. Type "protect --help".</span>`,
    );

    return true;
  };

  const handleKubectlCommand = async (
    rawCmd: string,
    tokens: string[],
  ): Promise<boolean> => {
    if (tokens[0] !== "kubectl") {
      return false;
    }

    /*
     * kubectl run
     */
    if (tokens[1] === "run") {
      const podName = tokens[2];

      if (!podName || podName.startsWith("-")) {
        printHtml(
          `<span style="color:#f85149;">Error: pod name required.</span>`,
        );
        return true;
      }

      let imageName = podName;
      let targetNamespace = "default";

      const customLabels: Record<string, string> = {
        run: podName,
      };

      for (let i = 3; i < tokens.length; i++) {
        const arg = tokens[i];

        if (arg.startsWith("--image=")) {
          imageName = arg.split("=")[1] || imageName;
        } else if (arg === "--image") {
          imageName = tokens[++i] || imageName;
        } else if (arg === "-n" || arg === "--namespace") {
          targetNamespace = tokens[++i] || targetNamespace;
        } else if (arg.startsWith("--namespace=")) {
          targetNamespace =
            arg.split("=")[1] || targetNamespace;
        } else if (arg.startsWith("--labels=")) {
          const rawLabels = arg
            .replace("--labels=", "")
            .replace(/["']/g, "");

          rawLabels.split(",").forEach((pair) => {
            const [key, value] = pair.split("=");

            if (key) {
              customLabels[key.trim()] = value?.trim() || "";
            }
          });
        }
      }

      if (
        !namespaces.some(
          (namespace) => namespace.name === targetNamespace,
        )
      ) {
        printHtml(
          `<span style="color:#f85149;">Error from server (NotFound): namespaces "${escapeHtml(
            targetNamespace,
          )}" not found</span>`,
        );
        return true;
      }

      if (
        pods.some(
          (pod) =>
            pod.name === podName &&
            pod.namespace === targetNamespace,
        )
      ) {
        printHtml(
          `<span style="color:#f85149;">Error from server (AlreadyExists): pods "${escapeHtml(
            podName,
          )}" already exists</span>`,
        );
        return true;
      }

      const assignedNode =
        nodes.find(
          (node) =>
            !node.labels[
              "node-role.kubernetes.io/control-plane"
            ],
        ) || nodes[0];

      pods.push({
        name: podName,
        namespace: targetNamespace,
        status: "Running",
        age: "1s",
        image: imageName,
        ip: `10.244.0.${Math.floor(Math.random() * 200 + 10)}`,
        node: assignedNode?.name || "node-2",
        labels: customLabels,
      });

      addEvent(
        "Normal",
        "Created",
        `pod/${podName}`,
        `pod/${podName} created in namespace ${targetNamespace}`,
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
        `<span style="color:#7ee787;">pod/${escapeHtml(
          podName,
        )} created</span>`,
      );

      return true;
    }

    /*
     * kubectl create namespace
     */
    if (
      tokens[1] === "create" &&
      (tokens[2] === "namespace" ||
        tokens[2] === "ns")
    ) {
      const namespaceName = tokens[3];

      if (!namespaceName) {
        printHtml(
          `<span style="color:#f85149;">Error: namespace name required.</span>`,
        );
        return true;
      }

      if (
        namespaces.some(
          (namespace) => namespace.name === namespaceName,
        )
      ) {
        printHtml(
          `<span style="color:#f85149;">Error from server (AlreadyExists): namespaces "${escapeHtml(
            namespaceName,
          )}" already exists</span>`,
        );
        return true;
      }

      namespaces.push({
        name: namespaceName,
        status: "Active",
        age: "1s",
      });

      addEvent(
        "Normal",
        "Created",
        `namespace/${namespaceName}`,
        `namespace/${namespaceName} created`,
      );

      printHtml(
        `<span style="color:#7ee787;">namespace/${escapeHtml(
          namespaceName,
        )} created</span>`,
      );

      return true;
    }

    /*
     * kubectl apply
     */
    if (tokens[1] === "apply" && tokens[2] === "-f") {
      const fileName = tokens[3];

      if (!fileName || !localFiles[fileName]) {
        printHtml(
          `<span style="color:#f85149;">error: the path "${escapeHtml(
            fileName || "",
          )}" does not exist</span>`,
        );
        return true;
      }

      if (fileName === "nginx-deployment.yaml") {
        const deploymentName = "nginx-deployment";
        const runtimeReady = activeRuntimeClasses.has("edera");
        const existing = deployments.find((deployment) => deployment.name === deploymentName);

        if (existing) {
          printHtml(`<span style="color:#8b949e;">deployment.apps/${deploymentName} unchanged</span>`);
          return true;
        }

        const deployment: LocalDeployment = {
          name: deploymentName,
          namespace: "default",
          replicas: 2,
          readyReplicas: 0,
          image: "nginx:1.14.2",
          runtimeClassName: "edera",
          selector: "app=nginx",
        };
        deployments.push(deployment);

        for (let i = 1; i <= deployment.replicas; i++) {
          const podName = `${deploymentName}-${String(i).padStart(5, "0")}`;
          const assignedNode = runtimeReady
            ? nodes.find((node) => !node.labels["node-role.kubernetes.io/control-plane"]) || nodes[0]
            : undefined;
          pods.push({
            name: podName,
            namespace: "default",
            status: runtimeReady ? "Running" : "Pending",
            age: "1s",
            image: deployment.image,
            ip: assignedNode ? `10.244.0.${Math.floor(Math.random() * 200 + 10)}` : "<none>",
            node: assignedNode?.name || "<none>",
            labels: { app: "nginx" },
            runtimeClassName: "edera",
            ownerDeployment: deploymentName,
          });
        }

        addEvent("Normal", "Created", `deployment/${deploymentName}`, `deployment.apps/${deploymentName} created`);
        if (runtimeReady) {
          checkPendingPods();
          syncEderaPodsToProtectWorkloads();
          deployment.readyReplicas = pods.filter((pod) => pod.ownerDeployment === deploymentName && pod.status === "Running").length;
        } else {
          addEvent("Warning", "ReplicaSetCreate", `deployment/${deploymentName}`, `Created ${deployment.replicas} Pending pods waiting for RuntimeClass "edera"`);
        }

        updateDashboard();
        printHtml(`<span style="color:#7ee787;">deployment.apps/${deploymentName} created</span>`);
        markDemoStepComplete("deployment-apply");
        return true;
      }

      if (fileName === "pod-nginx.yaml") {
        const podName = "edera-protect-pod";
        const runtimeReady = activeRuntimeClasses.has("edera");

        const existingPod = pods.find(
          (pod) =>
            pod.name === podName &&
            pod.namespace === "default",
        );

        if (existingPod) {
          if (existingPod.status === "Failed" && runtimeReady) {
            existingPod.status = "Pending";
            existingPod.node = "<none>";
            existingPod.ip = "<none>";
            checkPendingPods();
            syncEderaPodsToProtectWorkloads();
            updateDashboard();
            printHtml(
              `<span style="color:#7ee787;">pod/${escapeHtml(podName)} re-applied and recovered</span>`,
            );
          } else {
            printHtml(
              `<span style="color:#8b949e;">pod/${escapeHtml(podName)} unchanged</span>`,
            );
          }
          markDemoStepComplete("edera-pod-apply");
          return true;
        }

        const assignedNode = runtimeReady
          ? nodes.find(
              (node) =>
                !node.labels[
                  "node-role.kubernetes.io/control-plane"
                ],
            ) || nodes[0]
          : undefined;

        pods.push({
          name: podName,
          namespace: "default",
          status: runtimeReady ? "Running" : "Pending",
          age: "1s",
          image: "nginx",
          ip: assignedNode
            ? `10.244.0.${Math.floor(Math.random() * 200 + 10)}`
            : "<none>",
          node: assignedNode?.name || "<none>",
          labels: { env: "test" },
          runtimeClassName: "edera",
        });

        addEvent(
          "Normal",
          "Created",
          `pod/${podName}`,
          `pod/${podName} created from manifest`,
        );

        if (runtimeReady && assignedNode) {
          addEvent(
            "Normal",
            "Scheduled",
            `pod/${podName}`,
            `Successfully assigned default/${podName} to ${assignedNode.name}`,
          );

          addEvent(
            "Normal",
            "Started",
            `pod/${podName}`,
            `Started container nginx`,
          );
        } else {
          addEvent(
            "Warning",
            "FailedCreatePodSandBox",
            `pod/${podName}`,
            `Failed to create pod sandbox: RuntimeClass "edera" not found`,
          );
        }

        if (runtimeReady && assignedNode) {
          syncEderaPodsToProtectWorkloads();
        }

        updateDashboard();

        printHtml(
          `<span style="color:#7ee787;">pod/${podName} created</span>`,
        );

        markDemoStepComplete("edera-pod-apply");
        return true;
      }

      if (fileName === "runtimeclass-edera.yaml") {
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
        syncEderaPodsToProtectWorkloads();
        for (const deployment of deployments) {
          deployment.readyReplicas = pods.filter((pod) => pod.ownerDeployment === deployment.name && pod.status === "Running").length;
        }
        updateDashboard();

        markDemoStepComplete("edera-runtimeclass-apply");
        return true;
      }

      if (fileName === "pod-hardened-vessel.yaml") {
        const podName = "hardened-vessel";

        const runtimeReady =
          activeRuntimeClasses.has("edera");

        const existingPod = pods.find(
          (pod) =>
            pod.name === podName &&
            pod.namespace === "default",
        );

        if (existingPod) {
          if (existingPod.status === "Failed" && runtimeReady) {
            existingPod.status = "Pending";
            existingPod.node = "<none>";
            existingPod.ip = "<none>";
            checkPendingPods();
            syncEderaPodsToProtectWorkloads();
            updateDashboard();
            printHtml(
              `<span style="color:#7ee787;">pod/${podName} re-applied and recovered</span>`,
            );
          } else {
            printHtml(
              `<span style="color:#8b949e;">pod/${podName} unchanged</span>`,
            );
          }
          return true;
        }

        const assignedNode = runtimeReady
          ? nodes.find(
              (node) =>
                !node.labels[
                  "node-role.kubernetes.io/control-plane"
                ],
            ) || nodes[0]
          : undefined;

        pods.push({
          name: podName,
          namespace: "default",
          status: runtimeReady ? "Running" : "Pending",
          age: "1s",
          image: "denhamparry/leaky-vessel:0.1",
          ip: assignedNode
            ? `10.244.0.${Math.floor(Math.random() * 200 + 10)}`
            : "<none>",
          node: assignedNode?.name || "<none>",
          labels: {},
          runtimeClassName: "edera",
        });

        addEvent(
          "Normal",
          "Created",
          `pod/${podName}`,
          `pod/${podName} created from manifest`,
        );

        if (runtimeReady && assignedNode) {
          addEvent(
            "Normal",
            "Scheduled",
            `pod/${podName}`,
            `Successfully assigned default/${podName} to ${assignedNode.name}`,
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
            `Failed to create pod sandbox: RuntimeClass "edera" not found`,
          );
        }

        updateDashboard();

        printHtml(
          `<span style="color:#7ee787;">pod/${podName} created</span>`,
        );

        return true;
      }

      return true;
    }

    /*
     * kubectl describe
     */
    if (tokens[1] === "describe") {
      const resource = tokens[2];
      const name = tokens[3];

      if (!resource || !name) {
        printHtml(`<span style="color:#f85149;">Usage: kubectl describe pod|node &lt;name&gt;</span>`);
        return true;
      }

      if (resource === "pod" || resource === "pods") {
        const pod = pods.find(
          (item) => item.name === name && item.namespace === "default",
        );

        if (!pod) {
          printHtml(
            `<span style="color:#f85149;">Error from server (NotFound): pods "${escapeHtml(name)}" not found</span>`,
          );
          return true;
        }

        const podEvents = clusterEvents.filter((ev) => ev.object === `pod/${pod.name}`);
        const workload = protectWorkloads.find((item) => item.sourcePodName === pod.name);
        const conditions = pod.status === "Running" ? "Ready=True\nContainersReady=True" :
          pod.status === "Pending" ? "Ready=False\nContainersReady=False" :
          "Ready=False\nContainersReady=False";

        const html = `
          <div style="color:#8b949e;">Name:</div> ${escapeHtml(pod.name)}
          <div style="color:#8b949e;">Namespace:</div> ${escapeHtml(pod.namespace)}
          <div style="color:#8b949e;">Status:</div> <span style="color:${pod.status === "Running" ? "#7ee787" : "#d29922"};">${escapeHtml(pod.status)}</span>
          <div style="color:#8b949e;">Node:</div> ${escapeHtml(pod.node || "&lt;none>")}
          <div style="color:#8b949e;">Pod IP:</div> ${escapeHtml(pod.ip || "&lt;none>")}
          <div style="color:#8b949e;">Image:</div> ${escapeHtml(pod.image)}
          <div style="color:#8b949e;">RuntimeClass:</div> ${escapeHtml(pod.runtimeClassName || "&lt;none>")}
          <div style="color:#8b949e;">Labels:</div> ${escapeHtml(formatLabels(pod.labels))}
          <div style="color:#8b949e;">Edera workload:</div> ${workload ? escapeHtml(`${workload.name} → zone ${workload.zone}`) : "&lt;none>"}

          <div style="color:#79c0ff;font-weight:700;">Conditions</div>
          ${escapeHtml(conditions)}

          <div style="color:#79c0ff;font-weight:700;">Events</div>
          ${podEvents.length ? podEvents.slice(-8).map((ev) => `${escapeHtml(ev.type)}   ${escapeHtml(ev.reason)}   ${escapeHtml(ev.message)}`).join("\n") : "No events."}
        `;

        printPre(html.trim());
        return true;
      }

      if (resource === "node" || resource === "nodes") {
        const node = nodes.find((item) => item.name === name);

        if (!node) {
          printHtml(
            `<span style="color:#f85149;">Error from server (NotFound): nodes "${escapeHtml(name)}" not found</span>`,
          );
          return true;
        }

        const nodePods = pods.filter((pod) => pod.node === node.name);
        const roles = getNodeRoles(node);
        const nodeEvents = clusterEvents.filter((ev) => ev.object === `node/${node.name}`);

        const html = `
          <div style="color:#8b949e;">Name:</div> ${escapeHtml(node.name)}
          <div style="color:#8b949e;">Roles:</div> ${escapeHtml(roles)}
          <div style="color:#8b949e;">Status:</div> <span style="color:#7ee787;">${escapeHtml(node.status)}</span>
          <div style="color:#8b949e;">Kubelet Version:</div> ${escapeHtml(node.version)}
          <div style="color:#8b949e;">Labels:</div> ${escapeHtml(formatLabels(node.labels))}

          <div style="color:#79c0ff;font-weight:700;">Pods</div>
          ${nodePods.length ? nodePods.map((pod) => `${escapeHtml(pod.namespace)}/${escapeHtml(pod.name)}   ${escapeHtml(pod.status)}`).join("\n") : "No pods assigned."}

          <div style="color:#79c0ff;font-weight:700;">Events</div>
          ${nodeEvents.length ? nodeEvents.slice(-8).map((ev) => `${escapeHtml(ev.type)}   ${escapeHtml(ev.reason)}   ${escapeHtml(ev.message)}`).join("\n") : "No events."}
        `;

        printPre(html.trim());
        return true;
      }

      printHtml(`<span style="color:#f85149;">Error: describe for resource "${escapeHtml(resource)}" is not supported.</span>`);
      return true;
    }

    /*
     * kubectl get
     */
    if (tokens[1] === "get") {
      const resource = tokens[2];

      if (
        resource === "pods" ||
        resource === "pod"
      ) {
        const allNamespaces =
          tokens.includes("-A") ||
          tokens.includes("--all-namespaces");

        let namespaceFilter = "default";

        for (let i = 0; i < tokens.length; i++) {
          if (
            tokens[i] === "-n" ||
            tokens[i] === "--namespace"
          ) {
            namespaceFilter = tokens[i + 1] || namespaceFilter;
          }

          if (tokens[i].startsWith("--namespace=")) {
            namespaceFilter =
              tokens[i].split("=")[1] || namespaceFilter;
          }
        }

        const filtered = pods.filter(
          (pod) =>
            allNamespaces ||
            pod.namespace === namespaceFilter,
        );

        if (filtered.length === 0) {
          printHtml(
            `<span style="color:#8b949e;">No resources found.</span>`,
          );
          return true;
        }

        let html =
          `<span style="color:#79c0ff;font-weight:700;">` +
          `${allNamespaces ? "NAMESPACE   " : ""}` +
          `NAME                 READY   STATUS     NODE` +
          `</span>\n`;

        html += `<span style="color:#30363d;">${"─".repeat(
          70,
        )}</span>\n`;

        for (const pod of filtered) {
          const statusColor =
            pod.status === "Running"
              ? "#7ee787"
              : "#d29922";

          html +=
            `${allNamespaces ? escapeHtml(
              pod.namespace.padEnd(11),
            ) : ""}` +
            `${escapeHtml(pod.name.padEnd(21))}` +
            `${pod.status === "Running" ? "1/1" : "0/1"}     ` +
            `<span style="color:${statusColor};">${escapeHtml(
              pod.status.padEnd(10),
            )}</span>` +
            `${escapeHtml(pod.node || "<none>")}\n`;
        }

        printPre(html.trimEnd());

        return true;
      }

      if (
        resource === "nodes" ||
        resource === "node"
      ) {
        let html =
          `<span style="color:#79c0ff;font-weight:700;">` +
          `NAME       STATUS     ROLES          VERSION` +
          `</span>\n`;

        html += `<span style="color:#30363d;">${"─".repeat(
          60,
        )}</span>\n`;

        for (const node of nodes) {
          html +=
            `${escapeHtml(node.name.padEnd(11))}` +
            `<span style="color:#7ee787;">${escapeHtml(
              node.status.padEnd(11),
            )}</span>` +
            `${escapeHtml(
              getNodeRoles(node).padEnd(15),
            )}` +
            `${escapeHtml(node.version)}\n`;
        }

        printPre(html.trimEnd());

        return true;
      }

      if (
        resource === "deployments" ||
        resource === "deployment" ||
        resource === "deploy"
      ) {
        if (deployments.length === 0) {
          printHtml(`<span style="color:#8b949e;">No resources found.</span>`);
          return true;
        }

        let html = `<span style="color:#79c0ff;font-weight:700;">NAME                 READY   UP-TO-DATE   AVAILABLE</span>\n`;
        html += `<span style="color:#30363d;">${"─".repeat(65)}</span>\n`;

        for (const deployment of deployments) {
          html += `${escapeHtml(deployment.name.padEnd(21))}${deployment.readyReplicas}/${deployment.replicas}     ${String(deployment.replicas).padEnd(11)}${deployment.readyReplicas}\n`;
        }

        printPre(html.trimEnd());
        markDemoStepComplete("deployment-list");
        return true;
      }

      if (
        resource === "namespaces" ||
        resource === "namespace" ||
        resource === "ns"
      ) {
        let html =
          `<span style="color:#79c0ff;font-weight:700;">` +
          `NAME                  STATUS     AGE` +
          `</span>\n`;

        html += `<span style="color:#30363d;">${"─".repeat(
          45,
        )}</span>\n`;

        for (const namespace of namespaces) {
          html +=
            `${escapeHtml(
              namespace.name.padEnd(22),
            )}` +
            `<span style="color:#7ee787;">${escapeHtml(
              namespace.status.padEnd(11),
            )}</span>` +
            `${escapeHtml(namespace.age)}\n`;
        }

        printPre(html.trimEnd());

        return true;
      }
    }

    /*
     * kubectl label node
     */
    if (
      tokens[1] === "label" &&
      (tokens[2] === "node" ||
        tokens[2] === "nodes")
    ) {
      const nodeName = tokens[3];
      const labelExpression = tokens[4];

      const node = nodes.find(
        (item) => item.name === nodeName,
      );

      if (!node) {
        printHtml(
          `<span style="color:#f85149;">Error from server (NotFound): nodes "${escapeHtml(
            nodeName || "",
          )}" not found</span>`,
        );
        return true;
      }

      if (!labelExpression) {
        printHtml(
          `<span style="color:#f85149;">Error: label required.</span>`,
        );
        return true;
      }

      if (labelExpression.includes("=")) {
        const [key, value] =
          labelExpression.split("=");

        node.labels[key] = value || "";
      } else {
        node.labels[labelExpression] = "";
      }

      addEvent(
        "Normal",
        "Labeled",
        `node/${node.name}`,
        `Node labeled with ${labelExpression}`,
      );

      printHtml(
        `<span style="color:#7ee787;">node/${escapeHtml(
          node.name,
        )} labeled</span>`,
      );

      checkPendingPods();
      updateDashboard();

      return true;
    }

    /*
     * kubectl delete -f
     */
    if (tokens[1] === "delete" && tokens[2] === "-f") {
      const fileName = tokens[3];

      if (!fileName || !localFiles[fileName]) {
        printHtml(
          `<span style="color:#f85149;">error: the path "${escapeHtml(
            fileName || "",
          )}" does not exist</span>`,
        );
        return true;
      }

      if (fileName === "runtimeclass-edera.yaml") {
        if (!activeRuntimeClasses.has("edera")) {
          printHtml(
            `<span style="color:#8b949e;">runtimeclass.node.k8s.io/edera not found</span>`,
          );
          return true;
        }

        activeRuntimeClasses.delete("edera");

        addEvent(
          "Normal",
          "Deleted",
          "runtimeclass/edera",
          "runtimeclass.node.k8s.io/edera deleted",
        );

        // A Pod that is already running with runtimeClassName: edera cannot
        // continue using that runtime once the RuntimeClass is gone in this
        // simulator. Model the unavailable runtime as a terminal Failed pod
        // rather than leaving it incorrectly marked Running.
        const affectedPods = pods.filter(
          (pod) =>
            pod.runtimeClassName === "edera" &&
            pod.status === "Running",
        );

        for (const pod of affectedPods) {
          const attachedWorkloads = protectWorkloads.filter(
            (workload) => workload.sourcePodName === pod.name,
          );

          protectWorkloads = protectWorkloads.filter(
            (workload) => workload.sourcePodName !== pod.name,
          );

          pod.status = "Failed";
          pod.node = "<none>";
          pod.ip = "<none>";

          addEvent(
            "Warning",
            "RuntimeClassUnavailable",
            `pod/${pod.name}`,
            `Pod ${pod.name} failed: RuntimeClass "edera" is no longer available`,
          );

          for (const workload of attachedWorkloads) {
            addEvent(
              "Normal",
              "WorkloadTerminated",
              `workload/${workload.name}`,
              `Workload ${workload.name} removed because RuntimeClass "edera" was deleted`,
            );
          }
        }

        for (const deployment of deployments) {
          const deploymentPods = pods.filter((pod) => pod.ownerDeployment === deployment.name && pod.status === "Running");
          for (const pod of deploymentPods) {
            pod.status = "Failed";
            pod.node = "<none>";
            pod.ip = "<none>";
            const attachedWorkloads = protectWorkloads.filter((workload) => workload.sourcePodName === pod.name);
            protectWorkloads = protectWorkloads.filter((workload) => workload.sourcePodName !== pod.name);
            addEvent("Warning", "RuntimeClassUnavailable", `pod/${pod.name}`, `Pod ${pod.name} failed: RuntimeClass "edera" is no longer available`);
            for (const workload of attachedWorkloads) {
              addEvent("Normal", "WorkloadTerminated", `workload/${workload.name}`, `Workload ${workload.name} removed because RuntimeClass "edera" was deleted`);
            }
          }
          deployment.readyReplicas = 0;
        }

        printHtml(
          `<span style="color:#7ee787;">runtimeclass.node.k8s.io/edera deleted</span>`,
        );

        if (affectedPods.length > 0) {
          printHtml(
            `<span style="color:#d29922;">${affectedPods.length} Edera pod${
              affectedPods.length === 1 ? "" : "s"
            } moved to Failed because RuntimeClass "edera" is no longer available. Recreate the RuntimeClass to recover the pod, or re-apply its manifest.</span>`,
          );
        }

        updateDashboard();
        return true;
      }

      if (fileName === "nginx-deployment.yaml") {
        const deploymentName = "nginx-deployment";
        const index = deployments.findIndex((deployment) => deployment.name === deploymentName);
        if (index === -1) {
          printHtml(`<span style="color:#8b949e;">deployment.apps/${deploymentName} not found</span>`);
          return true;
        }
        const ownedPods = pods.filter((pod) => pod.ownerDeployment === deploymentName);
        pods = pods.filter((pod) => pod.ownerDeployment !== deploymentName);
        deployments.splice(index, 1);
        protectWorkloads = protectWorkloads.filter((workload) => !ownedPods.some((pod) => pod.name === workload.sourcePodName));
        addEvent("Normal", "Deleted", `deployment/${deploymentName}`, `deployment.apps/${deploymentName} deleted`);
        updateDashboard();
        printHtml(`<span style="color:#7ee787;">deployment.apps/${deploymentName} deleted</span>`);
        return true;
      }

      const manifestPodName =
        fileName === "pod-nginx.yaml"
          ? "edera-protect-pod"
          : fileName === "pod-hardened-vessel.yaml"
            ? "hardened-vessel"
            : null;

      if (manifestPodName) {
        const index = pods.findIndex(
          (pod) =>
            pod.name === manifestPodName &&
            pod.namespace === "default",
        );

        if (index === -1) {
          printHtml(
            `<span style="color:#8b949e;">pod/${escapeHtml(
              manifestPodName,
            )} not found</span>`,
          );
          return true;
        }

        const [deletedPod] = pods.splice(index, 1);

        const attachedWorkloads = protectWorkloads.filter(
          (workload) => workload.sourcePodName === manifestPodName,
        );

        protectWorkloads = protectWorkloads.filter(
          (workload) => workload.sourcePodName !== manifestPodName,
        );

        addEvent(
          "Normal",
          "Deleted",
          `pod/${manifestPodName}`,
          `pod/${manifestPodName} deleted from manifest`,
        );

        for (const workload of attachedWorkloads) {
          addEvent(
            "Normal",
            "WorkloadTerminated",
            `workload/${workload.name}`,
            `Workload ${workload.name} removed with pod ${manifestPodName}`,
          );
        }

        updateDashboard();

        printHtml(
          `<span style="color:#7ee787;">pod/${escapeHtml(
            deletedPod.name,
          )} deleted</span>`,
        );

        return true;
      }

      printHtml(
        `<span style="color:#f85149;">error: delete for "${escapeHtml(
          fileName,
        )}" is not supported by this simulator</span>`,
      );
      return true;
    }

    /*
     * kubectl delete pod
     */
    if (
      tokens[1] === "delete" &&
      (tokens[2] === "pod" ||
        tokens[2] === "pods")
    ) {
      const podName = tokens[3];

      const index = pods.findIndex(
        (pod) =>
          pod.name === podName &&
          pod.namespace === "default",
      );

      if (index === -1) {
        printHtml(
          `<span style="color:#f85149;">Error from server (NotFound): pods "${escapeHtml(
            podName || "",
          )}" not found</span>`,
        );
        return true;
      }

      const deletedPod = pods[index];
      const owningDeployment = deletedPod.ownerDeployment;

      pods.splice(index, 1);

      const attachedWorkloads = protectWorkloads.filter(
        (workload) => workload.sourcePodName === podName,
      );

      protectWorkloads = protectWorkloads.filter(
        (workload) => workload.sourcePodName !== podName,
      );

      addEvent(
        "Normal",
        "Terminated",
        `pod/${podName}`,
        `Pod ${podName} deleted`,
      );

      for (const workload of attachedWorkloads) {
        addEvent(
          "Normal",
          "WorkloadTerminated",
          `workload/${workload.name}`,
          `Workload ${workload.name} removed with pod ${podName}`,
        );
      }

      if (owningDeployment) {
        reconcileDeployments();

        const replacement = pods.find(
          (pod) =>
            pod.ownerDeployment === owningDeployment &&
            pod.name !== podName &&
            pod.status === "Running",
        );

        if (replacement) {
          addEvent(
            "Normal",
            "ReplicaCreated",
            `deployment/${owningDeployment}`,
            `Deployment ${owningDeployment} recreated a replacement pod ${replacement.name}`,
          );
        }
      }

      updateDashboard();

      printHtml(
        `<span style="color:#7ee787;">pod "${escapeHtml(
          podName,
        )}" deleted</span>`,
      );

      if (owningDeployment) {
        printHtml(
          `<span style="color:#58a6ff;">Deployment ${escapeHtml(
            owningDeployment,
          )} reconciled its desired replica count.</span>`,
        );
      }

      return true;
    }

    /*
     * kubectl delete node
     */
    if (
      tokens[1] === "delete" &&
      (tokens[2] === "node" ||
        tokens[2] === "nodes")
    ) {
      const nodeName = tokens[3];

      const index = nodes.findIndex(
        (node) => node.name === nodeName,
      );

      if (index === -1) {
        printHtml(
          `<span style="color:#f85149;">Error from server (NotFound): nodes "${escapeHtml(
            nodeName || "",
          )}" not found</span>`,
        );
        return true;
      }

      nodes.splice(index, 1);

      addEvent(
        "Warning",
        "NodeDeleted",
        `node/${nodeName}`,
        `Node ${nodeName} removed from cluster`,
      );

      pods.forEach((pod) => {
        if (pod.node === nodeName) {
          pod.node =
            nodes.find(
              (node) =>
                !node.labels[
                  "node-role.kubernetes.io/control-plane"
                ],
            )?.name || "unassigned";

          addEvent(
            "Warning",
            "NodeEviction",
            `pod/${pod.name}`,
            `Rescheduled to ${pod.node}`,
          );
        }
      });

      for (const deployment of deployments) {
        deployment.readyReplicas = pods.filter((pod) => pod.ownerDeployment === deployment.name && pod.status === "Running").length;
      }

      updateDashboard();

      printHtml(
        `<span style="color:#7ee787;">node "${escapeHtml(
          nodeName,
        )}" deleted</span>`,
      );

      return true;
    }

    if (
      tokens[1] === "--help" ||
      tokens[1] === "-h" ||
      tokens.length === 1
    ) {
      printHtml(formatHelpText());
      return true;
    }

    return false;
  };

  /*
   * -----------------------------------------------------------------------
   * TERMINAL COMMAND LOOP
   * -----------------------------------------------------------------------
   */

  try {
    cluster = new Cluster();

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

    await new Promise((resolve) =>
      setTimeout(resolve, 500),
    );

    updateDashboard();
    renderEvents();
    renderGuide();

    output.innerHTML = `
      <div class="terminal-block">
        <div style="color:#f0f6fc;">
          Webernetes cluster online!
        </div>

        <div style="color:#8b949e;margin-top:5px;">
          Try the suggested Edera command below,
          or type <span style="color:#7ee787;">help</span>.
        </div>
      </div>
    `;

    input.disabled = false;
    input.focus();

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

        const rawCmd = input.value.trim();

        input.value = "";
        historyIndex = -1;

        if (!rawCmd) {
          return;
        }

        commandHistory.push(rawCmd);

        printCommand(rawCmd);

        const tokens = tokenize(rawCmd);

        /*
         * clear
         */
        if (tokens[0] === "clear") {
          output.innerHTML = "";
          return;
        }

        /*
         * history
         */
        if (tokens[0] === "history") {
          if (commandHistory.length === 0) {
            printHtml(
              `<span style="color:#8b949e;">No command history.</span>`,
            );
            return;
          }

          const historyHtml = commandHistory
            .map(
              (command, index) =>
                `<span style="color:#8b949e;">${String(
                  index + 1,
                ).padStart(3, " ")}</span>  ${escapeHtml(
                  command,
                )}`,
            )
            .join("\n");

          printPre(historyHtml);

          return;
        }

        /*
         * ls
         */
        if (tokens[0] === "ls") {
          const files = Object.keys(localFiles)
            .map(
              (file) =>
                `<span style="color:#56d364;font-weight:600;">${escapeHtml(
                  file,
                )}</span>`,
            )
            .join("  ");

          printHtml(files);

          return;
        }

        /*
         * cat
         */
        if (tokens[0] === "cat") {
          const fileName = tokens[1];

          if (!fileName) {
            printHtml(
              `<span style="color:#f85149;">cat: missing file operand</span>`,
            );
          } else if (localFiles[fileName]) {
            printPre(
              escapeHtml(localFiles[fileName]),
            );
          } else {
            printHtml(
              `<span style="color:#f85149;">cat: ${escapeHtml(
                fileName,
              )}: No such file or directory</span>`,
            );
          }

          return;
        }

        /*
         * uname
         */
        if (tokens[0] === "uname") {
          const requestsRelease =
            tokens.length === 1 ||
            tokens.includes("-r") ||
            tokens.includes("--release");

          if (requestsRelease) {
            const hostKernelVersion = "6.18.44-edera-host";
            printPre(
              `<span style="color:#7ee787;">${hostKernelVersion}</span>`,
            );
            addEvent(
              "Normal",
              "HostKernelVerified",
              "host",
              `uname -r reported host kernel ${hostKernelVersion}`,
            );

            markDemoStepComplete("host-kernel");
          } else {
            printHtml(
              `<span style="color:#f85149;">uname: unsupported option. Try: uname -r</span>`,
            );
          }

          return;
        }

        /*
         * help
         */
        if (
          tokens[0] === "help" ||
          rawCmd === "kubectl --help" ||
          rawCmd === "kubectl -h"
        ) {
          printHtml(formatHelpText());
          return;
        }

        /*
         * Protect
         */
        if (tokens[0] === "protect") {
          await handleProtectCommand(
            rawCmd,
            tokens,
          );
          return;
        }

        /*
         * Kubernetes
         */
        if (tokens[0] === "kubectl") {
          const handled =
            await handleKubectlCommand(
              rawCmd,
              tokens,
            );

          if (handled) {
            return;
          }
        }

        /*
         * curl
         */
        if (tokens[0] === "curl") {
          const url = rawCmd
            .replace(/^curl\s+/, "")
            .trim();

          addEvent(
            "Info",
            "HttpRequest",
            "curl",
            `GET ${url}`,
          );

          try {
            const response: any =
              await cluster.fetch(url);

            const text =
              typeof response?.text === "function"
                ? await response.text()
                : response?.body || response;

            printHtml(
              `<span style="color:#a5d6ff;">${escapeHtml(
                String(text),
              )}</span>`,
            );

            addEvent(
              "Normal",
              "HttpResponse",
              "curl",
              `200 OK from ${url}`,
            );
          } catch (error: any) {
            printHtml(
              `<span style="color:#f85149;">curl: (7) Failed to connect: ${escapeHtml(
                error?.message || String(error),
              )}</span>`,
            );

            addEvent(
              "Warning",
              "HttpError",
              "curl",
              `Connection failed`,
            );
          }

          return;
        }

        /*
         * Unknown command
         */
        printHtml(
          `<span style="color:#f85149;">command not found: ${escapeHtml(
            rawCmd,
          )}. Type 'help' to see supported commands.</span>`,
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
      <div style="color:#f85149;">
        Error initializing cluster:
        ${escapeHtml(error?.message || String(error))}
      </div>
    `;
  }
}

initTerminalDemo();
