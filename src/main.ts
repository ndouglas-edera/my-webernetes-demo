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

interface ProtectZone {
  name: string;
  uuid: string;
  state: "creating" | "ready" | "destroying" | "destroyed";
  ipv4: string;
  ipv6: string;
  minCpus: number;
  cpuCount: number;
  vcpuCount: number;
  workloads: string[];
}

interface ProtectWorkload {
  name: string;
  uuid: string;
  zone: string;
  state: "creating" | "running" | "stopped";
  image: string;
  command: string[];
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

    * {
      box-sizing: border-box;
    }

    .dashboard-panel {
      transition:
        opacity 0.18s ease,
        transform 0.18s ease,
        border-color 0.18s ease;
    }

    .dashboard-panel.dragging {
      opacity: 0.45;
      transform: scale(0.985);
    }

    .dashboard-panel.drag-over {
      border-color: #58a6ff !important;
      box-shadow: 0 0 0 1px #58a6ff33;
    }

    .panel-drag-handle {
      cursor: grab;
      user-select: none;
      color: #8b949e;
      font-size: 12px;
      padding: 3px 5px;
    }

    .panel-drag-handle:active {
      cursor: grabbing;
    }

    .panel-toggle {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 5px 8px;
      border-radius: 5px;
      font-size: 10px;
      cursor: pointer;
    }

    .panel-toggle:hover {
      background: #30363d;
      color: #fff;
    }

    .protect-card {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px 12px;
    }

    .protect-card:hover {
      border-color: #484f58;
    }

    .terminal-table {
      display: block;
      width: 100%;
      overflow-x: auto;
      white-space: pre;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.6;
    }

    .terminal-table-line {
      display: block;
      min-width: max-content;
    }

    .terminal-header {
      color: #79c0ff;
      font-weight: 700;
    }

    .terminal-muted {
      color: #8b949e;
    }

    .terminal-green {
      color: #7ee787;
    }

    .terminal-yellow {
      color: #d29922;
    }

    .terminal-red {
      color: #f85149;
    }

    .terminal-blue {
      color: #58a6ff;
    }

    .terminal-cyan {
      color: #56d4dd;
    }

    .panel-hidden {
      display: none !important;
    }
  `;

  document.head.appendChild(styleTag);

  const app = document.querySelector<HTMLDivElement>("#app")!;

  app.innerHTML = `
    <div
      style="
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 1200px;
        margin: 0 auto;
        color: #c9d1d9;
        padding: 24px;
        min-height: 100vh;
        background-color: #0d1117;
      "
    >

      <!-- Header -->
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid #30363d;
          padding-bottom: 16px;
          gap: 16px;
        "
      >
        <div>
          <h1
            style="
              margin: 0;
              font-size: 22px;
              font-weight: 700;
              color: #ffffff;
            "
          >
            Webernetes Dashboard & Terminal
          </h1>

          <p
            style="
              margin: 4px 0 0 0;
              font-size: 13px;
              color: #8b949e;
            "
          >
            Browser-based Kubernetes cluster emulator
          </p>
        </div>

        <div
          style="
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-end;
          "
        >
          <span
            style="
              font-size: 10px;
              color: #8b949e;
              background: #161b22;
              border: 1px solid #30363d;
              padding: 5px 8px;
              border-radius: 5px;
            "
          >
            Drag panels to reorder
          </span>

          <button
            id="toggle-events-btn"
            style="
              background: #21262d;
              border: 1px solid #30363d;
              color: #f0f6fc;
              padding: 8px 14px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            ⚡ Panels
          </button>
        </div>
      </div>

      <!-- Dashboard -->
      <div
        id="dashboard-panels"
        style="
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 16px;
        "
      >

        <!-- Resource row -->
        <div
          id="resource-panels-row"
          style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          "
        >

          <!-- Active Pods -->
          <section
            id="panel-pods"
            class="dashboard-panel"
            draggable="true"
            style="
              background: #161b22;
              border: 1px solid #30363d;
              border-radius: 8px;
              padding: 16px;
            "
          >
            <div
              class="panel-header"
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
              "
            >
              <div style="display: flex; align-items: center; gap: 7px;">
                <span class="panel-drag-handle" title="Drag to reorder">⋮⋮</span>
                <h3
                  style="
                    margin: 0;
                    font-size: 14px;
                    color: #f0f6fc;
                  "
                >
                  📦 Active Pods
                </h3>
              </div>

              <div style="display: flex; align-items: center; gap: 7px;">
                <span
                  id="pod-count"
                  style="
                    font-size: 11px;
                    background: #21262d;
                    padding: 2px 8px;
                    border-radius: 12px;
                    border: 1px solid #30363d;
                  "
                >
                  1 Pod
                </span>

                <button
                  class="panel-toggle"
                  data-panel-toggle="panel-pods"
                  title="Hide Active Pods"
                >
                  Hide
                </button>
              </div>
            </div>

            <div
              id="pod-grid"
              style="
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 220px;
                overflow-y: auto;
                padding-right: 4px;
              "
            ></div>
          </section>

          <!-- Active Nodes -->
          <section
            id="panel-nodes"
            class="dashboard-panel"
            draggable="true"
            style="
              background: #161b22;
              border: 1px solid #30363d;
              border-radius: 8px;
              padding: 16px;
            "
          >
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
              "
            >
              <div style="display: flex; align-items: center; gap: 7px;">
                <span class="panel-drag-handle" title="Drag to reorder">⋮⋮</span>

                <h3
                  style="
                    margin: 0;
                    font-size: 14px;
                    color: #f0f6fc;
                  "
                >
                  🖥️ Active Nodes
                </h3>
              </div>

              <div style="display: flex; align-items: center; gap: 7px;">
                <span
                  id="node-count"
                  style="
                    font-size: 11px;
                    background: #21262d;
                    padding: 2px 8px;
                    border-radius: 12px;
                    border: 1px solid #30363d;
                  "
                >
                  3 Nodes
                </span>

                <button
                  class="panel-toggle"
                  data-panel-toggle="panel-nodes"
                  title="Hide Active Nodes"
                >
                  Hide
                </button>
              </div>
            </div>

            <div
              id="node-grid"
              style="
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 220px;
                overflow-y: auto;
                padding-right: 4px;
              "
            ></div>
          </section>
        </div>

        <!-- Edera Protect Zones -->
        <section
          id="panel-protect"
          class="dashboard-panel"
          draggable="true"
          style="
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 16px;
          "
        >
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;
              padding-bottom: 10px;
              border-bottom: 1px solid #30363d;
            "
          >
            <div style="display: flex; align-items: center; gap: 7px;">
              <span class="panel-drag-handle" title="Drag to reorder">⋮⋮</span>

              <div>
                <h3
                  style="
                    margin: 0;
                    font-size: 14px;
                    color: #f0f6fc;
                  "
                >
                  🛡️ Edera Protect Zones
                </h3>

                <div
                  style="
                    margin-top: 3px;
                    font-size: 11px;
                    color: #8b949e;
                  "
                >
                  Simulated Protect isolation boundaries
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 7px;">
              <span
                id="protect-zone-count"
                style="
                  font-size: 11px;
                  background: #21262d;
                  padding: 2px 8px;
                  border-radius: 12px;
                  border: 1px solid #30363d;
                "
              >
                0 Zones
              </span>

              <button
                class="panel-toggle"
                data-panel-toggle="panel-protect"
                title="Hide Edera Protect Zones"
              >
                Hide
              </button>
            </div>
          </div>

          <div
            id="protect-zone-grid"
            style="
              display: flex;
              flex-direction: column;
              gap: 8px;
              max-height: 280px;
              overflow-y: auto;
              padding-right: 4px;
            "
          ></div>
        </section>

        <!-- Terminal / Events -->
        <div
          id="terminal-events-row"
          style="
            display: grid;
            grid-template-columns: minmax(0, 1fr) 340px;
            gap: 16px;
            align-items: stretch;
          "
        >

          <!-- Terminal -->
          <section
            id="panel-terminal"
            class="dashboard-panel"
            style="
              min-width: 0;
              font-family: monospace;
              background: #010409;
              border: 1px solid #30363d;
              padding: 16px;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            "
          >
            <div
              id="output"
              style="
                white-space: pre-wrap;
                margin-bottom: 12px;
                min-height: 240px;
                max-height: 420px;
                overflow-y: auto;
                font-size: 13px;
                line-height: 1.4;
              "
            >
              Initializing Webernetes cluster...
            </div>

            <div
              style="
                display: flex;
                align-items: center;
                border-top: 1px solid #30363d;
                padding-top: 12px;
              "
            >
              <span
                style="
                  color: #58a6ff;
                  margin-right: 8px;
                  white-space: nowrap;
                "
              >
                user@webernetes:~$
              </span>

              <input
                id="cmd"
                type="text"
                placeholder="Type 'help' or use Up/Down arrow keys for command history..."
                style="
                  flex: 1;
                  min-width: 0;
                  background: transparent;
                  border: none;
                  color: #fff;
                  font-family: inherit;
                  font-size: 13px;
                  outline: none;
                "
                disabled
              />
            </div>
          </section>

          <!-- Lifecycle Events -->
          <section
            id="panel-events"
            class="dashboard-panel"
            style="
              width: 340px;
              background: #161b22;
              border: 1px solid #30363d;
              border-radius: 8px;
              padding: 16px;
              display: flex;
              flex-direction: column;
              min-height: 520px;
            "
          >
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #30363d;
              "
            >
              <div style="display: flex; align-items: center; gap: 7px;">
                <span class="panel-drag-handle" title="Drag to reorder">⋮⋮</span>

                <h3
                  style="
                    margin: 0;
                    font-size: 14px;
                    color: #f0f6fc;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                  "
                >
                  ⚡ Lifecycle Events
                </h3>
              </div>

              <div style="display: flex; gap: 7px;">
                <button
                  id="clear-events-btn"
                  class="panel-toggle"
                >
                  Clear
                </button>

                <button
                  class="panel-toggle"
                  data-panel-toggle="panel-events"
                >
                  Hide
                </button>
              </div>
            </div>

            <div
              id="events-stream"
              style="
                flex: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
                font-family: monospace;
                font-size: 11px;
              "
            ></div>
          </section>
        </div>
      </div>

      <!-- Hidden panels launcher -->
      <div
        id="hidden-panels-bar"
        style="
          display: none;
          margin-bottom: 16px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 10px 12px;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        "
      >
        <span
          style="
            font-size: 11px;
            color: #8b949e;
            margin-right: 4px;
          "
        >
          Hidden panels:
        </span>
      </div>
    </div>
  `;

  const output = document.querySelector<HTMLDivElement>("#output")!;
  const input = document.querySelector<HTMLInputElement>("#cmd")!;

  const podGrid =
    document.querySelector<HTMLDivElement>("#pod-grid")!;
  const podCount =
    document.querySelector<HTMLSpanElement>("#pod-count")!;

  const nodeGrid =
    document.querySelector<HTMLDivElement>("#node-grid")!;
  const nodeCount =
    document.querySelector<HTMLSpanElement>("#node-count")!;

  const protectZoneGrid =
    document.querySelector<HTMLDivElement>("#protect-zone-grid")!;

  const protectZoneCount =
    document.querySelector<HTMLSpanElement>("#protect-zone-count")!;

  const eventsStream =
    document.querySelector<HTMLDivElement>("#events-stream")!;

  const clearEventsBtn =
    document.querySelector<HTMLButtonElement>("#clear-events-btn")!;

  const hiddenPanelsBar =
    document.querySelector<HTMLDivElement>("#hidden-panels-bar")!;

  const panelNames: Record<string, string> = {
    "panel-pods": "Active Pods",
    "panel-nodes": "Active Nodes",
    "panel-protect": "Edera Protect Zones",
    "panel-events": "Lifecycle Events",
  };

  const panelElements = Object.keys(panelNames)
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el);

  const commandHistory: string[] = [];
  let historyIndex = -1;

  const localFiles: Record<string, string> = {
    "pod-nginx.yaml": NGINX_YAML_CONTENT,
    "runtimeclass-edera.yaml": RUNTIMECLASS_EDERA_YAML_CONTENT,
    "pod-hardened-vessel.yaml": HARDENED_VESSEL_YAML_CONTENT,
  };

  const activeRuntimeClasses = new Set<string>();

  let namespaces: LocalNamespace[] = [
    {
      name: "default",
      status: "Active",
      age: "10m",
    },
    {
      name: "kube-system",
      status: "Active",
      age: "10m",
    },
    {
      name: "kube-public",
      status: "Active",
      age: "10m",
    },
    {
      name: "kube-node-lease",
      status: "Active",
      age: "10m",
    },
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
      labels: {
        app: "demo",
      },
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

  let protectZones: ProtectZone[] = [];
  let protectWorkloads: ProtectWorkload[] = [];

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const randomUuid = (): string => {
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

  const addEvent = (
    type: "Normal" | "Warning" | "Info",
    reason: string,
    object: string,
    message: string,
  ) => {
    const time = new Date()
      .toLocaleTimeString()
      .split(" ")[0];

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
        <div
          style="
            color: #8b949e;
            text-align: center;
            margin-top: 20px;
          "
        >
          No lifecycle events captured yet.
        </div>
      `;

      return;
    }

    eventsStream.innerHTML = clusterEvents
      .map((ev) => {
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
          <div
            style="
              background: #0d1117;
              border-left: 3px solid ${border};
              border-radius: 4px;
              padding: 8px;
              margin-bottom: 4px;
            "
          >
            <div
              style="
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
              "
            >
              <span style="color: #8b949e;">
                ${escapeHtml(ev.time)}
              </span>

              <span
                style="
                  font-size: 9px;
                  background: ${badgeBg};
                  color: ${badgeColor};
                  padding: 1px 5px;
                  border-radius: 3px;
                  font-weight: bold;
                "
              >
                ${ev.type.toUpperCase()}
              </span>
            </div>

            <div
              style="
                color: #f0f6fc;
                font-weight: 600;
              "
            >
              ${escapeHtml(ev.reason)}
              <span
                style="
                  color: #8b949e;
                  font-weight: normal;
                "
              >
                (${escapeHtml(ev.object)})
              </span>
            </div>

            <div
              style="
                color: #8b949e;
                margin-top: 2px;
              "
            >
              ${escapeHtml(ev.message)}
            </div>
          </div>
        `;
      })
      .join("");
  };

  clearEventsBtn.addEventListener("click", () => {
    clusterEvents = [];
    renderEvents();
  });

  const printHtml = (htmlContent: string) => {
    output.innerHTML += `\n${htmlContent}`;
    output.scrollTop = output.scrollHeight;
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

          return `
            <span style="color: #79c0ff; font-weight: 500;">
              ${key}
            </span><span style="color: #8b949e;">:</span><span style="color: #a5d6ff;">${val}</span>
          `;
        }

        return `<span style="color: #c9d1d9;">${escaped}</span>`;
      })
      .join("\n");
  };

  const formatLabels = (
    labels: Record<string, string>,
  ): string => {
    const entries = Object.entries(labels);

    if (entries.length === 0) {
      return "<none>";
    }

    return entries
      .map(([k, v]) => (v ? `${k}=${v}` : k))
      .join(",");
  };

  const getNodeRoles = (node: LocalNode): string => {
    const roles: string[] = [];

    Object.keys(node.labels).forEach((label) => {
      if (label.startsWith("node-role.kubernetes.io/")) {
        const role = label.replace(
          "node-role.kubernetes.io/",
          "",
        );

        if (role) {
          roles.push(role);
        }
      }
    });

    return roles.length > 0
      ? roles.join(",")
      : "<none>";
  };

  /*
   * --------------------------------------------------------------------------
   * EDERA PROTECT
   * --------------------------------------------------------------------------
   */

  const findProtectZone = (
    nameOrUuid: string,
  ): ProtectZone | undefined => {
    return protectZones.find(
      (zone) =>
        zone.name === nameOrUuid ||
        zone.uuid === nameOrUuid,
    );
  };

  const protectZoneIpv4 = (
    index: number,
  ): string => {
    return `10.75.0.${index + 2}/16`;
  };

  const protectZoneIpv6 = (
    index: number,
  ): string => {
    return `fdd4:1476:6c7e::${index + 2}/48`;
  };

  const renderProtectZones = () => {
    protectZoneCount.innerText =
      `${protectZones.length} ${
        protectZones.length === 1
          ? "Zone"
          : "Zones"
      }`;

    if (protectZones.length === 0) {
      protectZoneGrid.innerHTML = `
        <div
          style="
            font-size: 12px;
            color: #8b949e;
            padding: 8px 4px;
          "
        >
          No Edera Protect zones have been launched.
        </div>
      `;

      return;
    }

    protectZoneGrid.innerHTML = protectZones
      .map((zone) => {
        const stateColor =
          zone.state === "ready"
            ? "#3fb950"
            : zone.state === "destroyed"
              ? "#8b949e"
              : "#d29922";

        const workloadCount =
          protectWorkloads.filter(
            (w) => w.zone === zone.uuid,
          ).length;

        return `
          <div class="protect-card">
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
              "
            >
              <div style="min-width: 0;">
                <div
                  style="
                    color: #f0f6fc;
                    font-weight: 650;
                    font-size: 13px;
                  "
                >
                  🛡️ ${escapeHtml(zone.name)}
                </div>

                <div
                  style="
                    color: #8b949e;
                    font-family: monospace;
                    font-size: 10px;
                    margin-top: 3px;
                    overflow-wrap: anywhere;
                  "
                >
                  ${escapeHtml(zone.uuid)}
                </div>
              </div>

              <span
                style="
                  flex-shrink: 0;
                  font-size: 10px;
                  background: ${stateColor}18;
                  color: ${stateColor};
                  border: 1px solid ${stateColor}55;
                  padding: 2px 7px;
                  border-radius: 4px;
                "
              >
                ${escapeHtml(zone.state)}
              </span>
            </div>

            <div
              style="
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 8px;
                font-size: 10px;
                color: #8b949e;
              "
            >
              <span>
                IPv4:
                <strong style="color:#c9d1d9;">
                  ${escapeHtml(zone.ipv4)}
                </strong>
              </span>

              <span>
                CPUs:
                <strong style="color:#c9d1d9;">
                  ${zone.cpuCount}
                </strong>
              </span>

              <span>
                Workloads:
                <strong style="color:#c9d1d9;">
                  ${workloadCount}
                </strong>
              </span>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderProtectWorkloadSummary = () => {
    renderProtectZones();
  };

  const padRight = (
    value: string,
    width: number,
  ): string => {
    return value.length >= width
      ? value.substring(0, width)
      : value.padEnd(width, " ");
  };

  const protectZoneTable = (): string => {
    if (protectZones.length === 0) {
      return `<span class="terminal-muted">No zones have been launched.</span>`;
    }

    const nameWidth = Math.max(
      4,
      ...protectZones.map((z) => z.name.length),
    ) + 2;

    const uuidWidth = 38;
    const stateWidth = 11;
    const ipv4Width = 18;
    const ipv6Width = 28;

    let html = `
      <div class="terminal-table">
        <div class="terminal-table-line terminal-header">
${escapeHtml(
  padRight("NAME", nameWidth) +
    padRight("UUID", uuidWidth) +
    padRight("STATE", stateWidth) +
    padRight("IPV4", ipv4Width) +
    padRight("IPV6", ipv6Width),
)}
        </div>
    `;

    for (const zone of protectZones) {
      html += `
        <div class="terminal-table-line">
<span class="terminal-blue">${escapeHtml(
  padRight(zone.name, nameWidth),
)}</span><span class="terminal-muted">${escapeHtml(
        padRight(zone.uuid, uuidWidth),
      )}</span><span class="${
        zone.state === "ready"
          ? "terminal-green"
          : zone.state === "destroyed"
            ? "terminal-muted"
            : "terminal-yellow"
      }">${escapeHtml(
        padRight(zone.state, stateWidth),
      )}</span><span class="terminal-cyan">${escapeHtml(
        padRight(
          zone.state === "destroyed"
            ? ""
            : zone.ipv4,
          ipv4Width,
        ),
      )}</span><span class="terminal-muted">${escapeHtml(
        padRight(
          zone.state === "destroyed"
            ? ""
            : zone.ipv6,
          ipv6Width,
        ),
      )}</span>
        </div>
      `;
    }

    html += `</div>`;

    return html;
  };

  const protectWorkloadTable = (): string => {
    if (protectWorkloads.length === 0) {
      return `<span class="terminal-muted">No workloads have been launched.</span>`;
    }

    const nameWidth =
      Math.max(
        4,
        ...protectWorkloads.map(
          (w) => w.name.length,
        ),
      ) + 2;

    const uuidWidth = 38;

    const zoneWidth =
      Math.max(
        4,
        ...protectWorkloads.map((w) => {
          const zone = findProtectZone(w.zone);
          return zone?.name.length ?? w.zone.length;
        }),
      ) + 2;

    const stateWidth = 11;

    let html = `
      <div class="terminal-table">
        <div class="terminal-table-line terminal-header">
${escapeHtml(
  padRight("NAME", nameWidth) +
    padRight("UUID", uuidWidth) +
    padRight("ZONE", zoneWidth) +
    padRight("STATE", stateWidth),
)}
        </div>
    `;

    for (const workload of protectWorkloads) {
      const zone = findProtectZone(workload.zone);
      const zoneDisplay =
        zone?.name ?? workload.zone;

      html += `
        <div class="terminal-table-line">
<span class="terminal-blue">${escapeHtml(
  padRight(workload.name, nameWidth),
)}</span><span class="terminal-muted">${escapeHtml(
        padRight(workload.uuid, uuidWidth),
      )}</span><span class="terminal-cyan">${escapeHtml(
        padRight(zoneDisplay, zoneWidth),
      )}</span><span class="${
        workload.state === "running"
          ? "terminal-green"
          : "terminal-yellow"
      }">${escapeHtml(
        padRight(workload.state, stateWidth),
      )}</span>
        </div>
      `;
    }

    html += `</div>`;

    return html;
  };

  const handleProtectZoneLaunch = (
    tokens: string[],
  ) => {
    let name = "";
    let minCpus = 1;
    let cpuCount = 1;
    let vcpuCount = 1;
    let wait = false;

    for (let i = 3; i < tokens.length; i++) {
      const token = tokens[i];

      if (
        token === "-n" ||
        token === "--name"
      ) {
        name = tokens[++i] || "";
      } else if (token.startsWith("--name=")) {
        name = token.substring(7);
      } else if (token === "--min-cpus") {
        minCpus = Number(tokens[++i] || "1");
      } else if (
        token.startsWith("--min-cpus=")
      ) {
        minCpus = Number(
          token.substring("--min-cpus=".length),
        );
      } else if (token === "-C") {
        cpuCount = Number(tokens[++i] || "1");
      } else if (token.startsWith("-C")) {
        cpuCount = Number(
          token.substring(2) || "1",
        );
      } else if (token === "-c") {
        vcpuCount = Number(tokens[++i] || "1");
      } else if (token.startsWith("-c")) {
        vcpuCount = Number(
          token.substring(2) || "1",
        );
      } else if (token === "--wait") {
        wait = true;
      }
    }

    if (!name) {
      printHtml(`
        <span class="terminal-red">
          Error: zone name required.
          Usage: protect zone launch -n &lt;name&gt;
        </span>
      `);

      addEvent(
        "Warning",
        "InvalidSyntax",
        "protect/zone",
        "Zone launch failed: name is required",
      );

      return;
    }

    if (protectZones.some((z) => z.name === name)) {
      printHtml(`
        <span class="terminal-red">
          Error: zone "${escapeHtml(name)}" already exists.
        </span>
      `);

      addEvent(
        "Warning",
        "AlreadyExists",
        `zone/${name}`,
        `Zone ${name} already exists`,
      );

      return;
    }

    const index = protectZones.length;

    const zone: ProtectZone = {
      name,
      uuid: randomUuid(),
      state: "creating",
      ipv4: protectZoneIpv4(index),
      ipv6: protectZoneIpv6(index),
      minCpus,
      cpuCount,
      vcpuCount,
      workloads: [],
    };

    protectZones.push(zone);

    addEvent(
      "Info",
      "ZoneCreating",
      `zone/${name}`,
      `Requested Edera zone ${name}`,
    );

    renderProtectZones();

    if (wait) {
      zone.state = "ready";

      addEvent(
        "Normal",
        "ZoneReady",
        `zone/${name}`,
        `Edera zone ${name} is ready`,
      );
    } else {
      /*
       * A real Protect CLI can return before readiness unless
       * --wait is supplied. We still transition the simulated
       * zone to ready shortly afterwards so the demo behaves
       * naturally.
       */
      setTimeout(() => {
        if (zone.state !== "creating") {
          return;
        }

        zone.state = "ready";

        addEvent(
          "Normal",
          "ZoneReady",
          `zone/${name}`,
          `Edera zone ${name} is ready`,
        );

        renderProtectZones();
      }, 500);
    }

    renderProtectZones();

    printHtml(`
      <span class="terminal-green">
        ${escapeHtml(zone.uuid)}
      </span>
    `);
  };

  const handleProtectZoneList = () => {
    printHtml(protectZoneTable());
  };

  const handleProtectZoneDestroy = (
    tokens: string[],
  ) => {
    const zoneName = tokens[3] || tokens[2];

    if (!zoneName) {
      printHtml(`
        <span class="terminal-red">
          Error: zone name required.
          Usage: protect zone destroy &lt;name&gt;
        </span>
      `);

      return;
    }

    const zone = findProtectZone(zoneName);

    if (!zone) {
      printHtml(`
        <span class="terminal-red">
          Error: zone "${escapeHtml(zoneName)}" not found.
        </span>
      `);

      addEvent(
        "Warning",
        "NotFound",
        `zone/${zoneName}`,
        `Zone ${zoneName} not found`,
      );

      return;
    }

    if (zone.state === "destroyed") {
      printHtml(`
        <span class="terminal-muted">
          Zone ${escapeHtml(zone.name)} is already destroyed.
        </span>
      `);

      return;
    }

    zone.state = "destroying";

    addEvent(
      "Info",
      "ZoneDestroying",
      `zone/${zone.name}`,
      `Destruction requested for Edera zone ${zone.name}`,
    );

    const attachedWorkloads =
      protectWorkloads.filter(
        (w) => w.zone === zone.uuid,
      );

    for (const workload of attachedWorkloads) {
      workload.state = "stopped";

      addEvent(
        "Warning",
        "WorkloadStopped",
        `workload/${workload.name}`,
        `Workload stopped because zone ${zone.name} is being destroyed`,
      );
    }

    zone.workloads = [];

    setTimeout(() => {
      zone.state = "destroyed";
      zone.ipv4 = "";
      zone.ipv6 = "";

      addEvent(
        "Normal",
        "ZoneDestroyed",
        `zone/${zone.name}`,
        `Edera zone ${zone.name} destroyed`,
      );

      renderProtectZones();
    }, 250);

    printHtml(`
      Destruction of zone
      <span class="terminal-blue">
        ${escapeHtml(zone.uuid)}
      </span>
      requested.
    `);

    renderProtectZones();
  };

  const handleProtectWorkloadLaunch = (
    tokens: string[],
  ) => {
    let zoneName = "";
    let workloadName = "";
    let image = "";
    let command: string[] = [];

    let separatorIndex = tokens.indexOf("--");

    const preArgs =
      separatorIndex === -1
        ? tokens
        : tokens.slice(0, separatorIndex);

    for (let i = 3; i < preArgs.length; i++) {
      const token = preArgs[i];

      if (
        token === "--zone"
      ) {
        zoneName = preArgs[++i] || "";
      } else if (
        token.startsWith("--zone=")
      ) {
        zoneName = token.substring(7);
      } else if (
        token === "--name"
      ) {
        workloadName = preArgs[++i] || "";
      } else if (
        token.startsWith("--name=")
      ) {
        workloadName = token.substring(7);
      } else if (
        !token.startsWith("-") &&
        !image
      ) {
        image = token;
      }
    }

    if (separatorIndex !== -1) {
      const commandArgs =
        tokens.slice(separatorIndex + 1);

      if (commandArgs.length > 0) {
        if (!image) {
          image = commandArgs[0];
          command = commandArgs.slice(1);
        } else {
          command = commandArgs;
        }
      }
    } else {
      /*
       * Supports the style shown in your demo:
       *
       * protect workload launch
       *   --zone test-zone
       *   --name alpine-long
       *   alpine:latest sleep 3600
       */
      const positional = preArgs.slice(3)
        .filter((t) => !t.startsWith("--"))
        .filter((t) => t !== "-n");

      if (!image && positional.length > 0) {
        image = positional[0];
        command = positional.slice(1);
      }
    }

    if (!zoneName) {
      printHtml(`
        <span class="terminal-red">
          Error: --zone is required.
          Usage:
          protect workload launch --zone &lt;zone&gt; --name &lt;name&gt; &lt;image&gt; [command...]
        </span>
      `);

      return;
    }

    if (!workloadName) {
      printHtml(`
        <span class="terminal-red">
          Error: --name is required.
        </span>
      `);

      return;
    }

    if (!image) {
      printHtml(`
        <span class="terminal-red">
          Error: container image is required.
        </span>
      `);

      return;
    }

    const zone = findProtectZone(zoneName);

    if (!zone || zone.state === "destroyed") {
      printHtml(`
        <span class="terminal-red">
          Error: zone "${escapeHtml(zoneName)}" not found.
        </span>
      `);

      addEvent(
        "Warning",
        "NotFound",
        `zone/${zoneName}`,
        `Workload launch failed: zone ${zoneName} not found`,
      );

      return;
    }

    if (zone.state !== "ready") {
      printHtml(`
        <span class="terminal-yellow">
          Error: zone "${escapeHtml(zoneName)}" is not ready.
        </span>
      `);

      addEvent(
        "Warning",
        "ZoneNotReady",
        `zone/${zoneName}`,
        `Workload launch requested before zone was ready`,
      );

      return;
    }

    if (
      protectWorkloads.some(
        (w) => w.name === workloadName,
      )
    ) {
      printHtml(`
        <span class="terminal-red">
          Error: workload "${escapeHtml(workloadName)}" already exists.
        </span>
      `);

      return;
    }

    const workload: ProtectWorkload = {
      name: workloadName,
      uuid: randomUuid(),
      zone: zone.uuid,
      state: "creating",
      image,
      command,
    };

    protectWorkloads.push(workload);
    zone.workloads.push(workload.uuid);

    addEvent(
      "Info",
      "WorkloadCreating",
      `workload/${workloadName}`,
      `Creating ${image} in Edera zone ${zone.name}`,
    );

    renderProtectWorkloadSummary();

    setTimeout(() => {
      workload.state = "running";

      addEvent(
        "Normal",
        "WorkloadStarted",
        `workload/${workloadName}`,
        `Started ${image} in Edera zone ${zone.name}`,
      );

      renderProtectWorkloadSummary();
    }, 250);

    printHtml(`
      <span class="terminal-green">
        ${escapeHtml(workload.uuid)}
      </span>
    `);
  };

  const handleProtectWorkloadList = () => {
    printHtml(protectWorkloadTable());
  };

  const formatHelpText = (): string => {
    return `
<span style="color: #ffa657;">Webernetes CLI Reference:

Available Commands:

  ls
      List files in current directory

  cat &lt;filename&gt;
      Print contents of a file

  kubectl run &lt;name&gt; [--image=&lt;img&gt;] [-n &lt;ns&gt;
      Create & run a pod

  kubectl create namespace &lt;name&gt;
      Create a new namespace

  kubectl get [pods|nodes|namespaces|ns]
      List Kubernetes resources

      -n &lt;namespace&gt;
      -A / --all-namespaces
      -o wide
      --show-labels

  kubectl label node &lt;node-name&gt; &lt;key&gt;=&lt;value&gt;
      Add label to a node

  kubectl apply -f &lt;filename.yaml&gt;
      Apply manifest file

  kubectl delete [pod|node] &lt;name&gt;
      Remove resource


Edera Protect Commands:

  protect zone launch -n &lt;name&gt;
      Launch an Edera Protect zone

      --min-cpus &lt;n&gt;
      -C &lt;n&gt;
      -c &lt;n&gt;
      --wait

  protect zone list
      List Edera Protect zones

  protect zone destroy &lt;name&gt;
      Destroy an Edera Protect zone

  protect workload launch
      --zone &lt;zone&gt;
      --name &lt;name&gt;
      &lt;image&gt; [command...]

      Example:
      protect workload launch --zone test-zone --name alpine-long alpine:latest sleep 3600

  protect workload list
      List Edera Protect workloads


Other:

  curl &lt;url&gt;
      Fetch HTTP endpoint

  clear
      Clear terminal

  history
      Show command history

  help
      Show this help</span>`;
  };

  const formatProtectHelp = (): string => {
    return `
<span style="color: #ffa657;">Edera Protect CLI Reference:

protect zone launch -n &lt;name&gt; [options]
protect zone list
protect zone destroy &lt;name&gt;

protect workload launch
  --zone &lt;zone&gt;
  --name &lt;name&gt;
  &lt;image&gt; [command...]

protect workload list

Options:
  --min-cpus &lt;n&gt;
  -C &lt;n&gt;
  -c &lt;n&gt;
  --wait</span>`;
  };

  /*
   * --------------------------------------------------------------------------
   * DASHBOARD RENDERING
   * --------------------------------------------------------------------------
   */

  const updateDashboard = () => {
    podCount.innerText =
      `${pods.length} ${
        pods.length === 1
          ? "Pod"
          : "Pods"
      }`;

    if (pods.length === 0) {
      podGrid.innerHTML = `
        <div
          style="
            font-size: 12px;
            color: #8b949e;
            padding: 6px;
          "
        >
          No pods running
        </div>
      `;
    } else {
      podGrid.innerHTML = pods
        .map((p) => {
          const isPending =
            p.status === "Pending";

          const badgeColor =
            isPending
              ? "#d29922"
              : "#3fb950";

          const badgeBg =
            isPending
              ? "#bb800922"
              : "#23863622";

          const borderColor =
            isPending
              ? "#d29922"
              : "#238636";

          return `
            <div
              style="
                background: #0d1117;
                border: 1px solid ${borderColor};
                border-radius: 6px;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
                gap: 10px;
              "
            >
              <div style="min-width: 0;">
                <div
                  style="
                    font-weight: 600;
                    font-size: 13px;
                    color: #58a6ff;
                  "
                >
                  ${escapeHtml(p.name)}

                  <span
                    style="
                      font-size: 10px;
                      color: #8b949e;
                      font-weight: normal;
                    "
                  >
                    (${escapeHtml(p.namespace)})
                  </span>

                  ${
                    p.runtimeClassName
                      ? `
                        <span
                          style="
                            display: inline-block;
                            margin-left: 5px;
                            font-size: 9px;
                            color: #d8b4fe;
                            background: #8b5cf61c;
                            border: 1px solid #8b5cf655;
                            padding: 1px 4px;
                            border-radius: 3px;
                          "
                        >
                          🛡 ${escapeHtml(
                            p.runtimeClassName,
                          )}
                        </span>
                      `
                      : ""
                  }
                </div>

                <div
                  style="
                    font-size: 11px;
                    color: #8b949e;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  "
                >
                  ${escapeHtml(p.image)}
                  ·
                  ${escapeHtml(p.node || "unassigned")}
                </div>
              </div>

              <span
                style="
                  flex-shrink: 0;
                  font-size: 10px;
                  background: ${badgeBg};
                  color: ${badgeColor};
                  border: 1px solid ${borderColor};
                  padding: 2px 6px;
                  border-radius: 4px;
                "
              >
                ${escapeHtml(p.status)}
              </span>
            </div>
          `;
        })
        .join("");
    }

    nodeCount.innerText =
      `${nodes.length} ${
        nodes.length === 1
          ? "Node"
          : "Nodes"
      }`;

    if (nodes.length === 0) {
      nodeGrid.innerHTML = `
        <div
          style="
            font-size: 12px;
            color: #8b949e;
            padding: 6px;
          "
        >
          No nodes available
        </div>
      `;
    } else {
      nodeGrid.innerHTML = nodes
        .map(
          (n) => `
            <div
              style="
                background: #0d1117;
                border: 1px solid #30363d;
                border-radius: 6px;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
              "
            >
              <div>
                <div
                  style="
                    font-weight: 600;
                    font-size: 13px;
                    color: #f0f6fc;
                  "
                >
                  ${escapeHtml(n.name)}
                </div>

                <div
                  style="
                    font-size: 11px;
                    color: #8b949e;
                  "
                >
                  ${escapeHtml(getNodeRoles(n))}
                </div>
              </div>

              <span
                style="
                  font-size: 10px;
                  background: #388bfd15;
                  color: #58a6ff;
                  border: 1px solid #388bfd33;
                  padding: 2px 6px;
                  border-radius: 4px;
                "
              >
                ${escapeHtml(n.status)}
              </span>
            </div>
          `,
        )
        .join("");
    }

    renderProtectZones();
  };

  /*
   * --------------------------------------------------------------------------
   * KUBERNETES SCHEDULING
   * --------------------------------------------------------------------------
   */

  const checkPendingPods = () => {
    pods.forEach((p) => {
      if (p.status !== "Pending") {
        return;
      }

      if (
        p.runtimeClassName &&
        !activeRuntimeClasses.has(
          p.runtimeClassName,
        )
      ) {
        return;
      }

      let targetNode: LocalNode | undefined;

      if (p.nodeSelector) {
        targetNode = nodes.find((n) =>
          Object.entries(
            p.nodeSelector!,
          ).every(
            ([k, v]) => n.labels[k] === v,
          ),
        );
      } else {
        targetNode =
          nodes.find(
            (n) =>
              !n.labels[
                "node-role.kubernetes.io/control-plane"
              ],
          ) || nodes[0];
      }

      if (targetNode) {
        p.status = "Running";
        p.node = targetNode.name;
        p.ip =
          `10.244.0.${Math.floor(
            Math.random() * 200 + 10,
          )}`;

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

  /*
   * --------------------------------------------------------------------------
   * PANEL VISIBILITY
   * --------------------------------------------------------------------------
   */

  const updateHiddenPanelsBar = () => {
    const hiddenIds = Object.keys(panelNames).filter(
      (id) =>
        document
          .getElementById(id)
          ?.classList.contains(
            "panel-hidden",
          ),
    );

    hiddenPanelsBar.innerHTML = `
      <span
        style="
          font-size: 11px;
          color: #8b949e;
          margin-right: 4px;
        "
      >
        Hidden panels:
      </span>
    `;

    hiddenIds.forEach((id) => {
      const button =
        document.createElement("button");

      button.className = "panel-toggle";
      button.innerText =
        `Show ${panelNames[id]}`;

      button.addEventListener(
        "click",
        () => {
          showPanel(id);
        },
      );

      hiddenPanelsBar.appendChild(button);
    });

    hiddenPanelsBar.style.display =
      hiddenIds.length > 0
        ? "flex"
        : "none";
  };

  const hidePanel = (panelId: string) => {
    const panel =
      document.getElementById(panelId);

    if (!panel) {
      return;
    }

    panel.classList.add("panel-hidden");

    document
      .querySelectorAll<HTMLButtonElement>(
        `[data-panel-toggle="${panelId}"]`,
      )
      .forEach((button) => {
        button.innerText = "Show";
      });

    updateHiddenPanelsBar();
  };

  const showPanel = (panelId: string) => {
    const panel =
      document.getElementById(panelId);

    if (!panel) {
      return;
    }

    panel.classList.remove(
      "panel-hidden",
    );

    document
      .querySelectorAll<HTMLButtonElement>(
        `[data-panel-toggle="${panelId}"]`,
      )
      .forEach((button) => {
        button.innerText = "Hide";
      });

    updateHiddenPanelsBar();
  };

  document
    .querySelectorAll<HTMLButtonElement>(
      "[data-panel-toggle]",
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();

          const panelId =
            button.dataset.panelToggle;

          if (!panelId) {
            return;
          }

          const panel =
            document.getElementById(panelId);

          if (!panel) {
            return;
          }

          if (
            panel.classList.contains(
              "panel-hidden",
            )
          ) {
            showPanel(panelId);
          } else {
            hidePanel(panelId);
          }
        },
      );
    });

  /*
   * --------------------------------------------------------------------------
   * DRAG / DROP PANEL REORDERING
   * --------------------------------------------------------------------------
   */

  let draggedPanel: HTMLElement | null =
    null;

  panelElements.forEach((panel) => {
    panel.addEventListener(
      "dragstart",
      (event) => {
        draggedPanel = panel;
        panel.classList.add("dragging");

        if (
          event.dataTransfer
        ) {
          event.dataTransfer.effectAllowed =
            "move";

          event.dataTransfer.setData(
            "text/plain",
            panel.id,
          );
        }
      },
    );

    panel.addEventListener(
      "dragend",
      () => {
        panel.classList.remove(
          "dragging",
        );

        panelElements.forEach((p) =>
          p.classList.remove(
            "drag-over",
          ),
        );

        draggedPanel = null;
      },
    );

    panel.addEventListener(
      "dragover",
      (event) => {
        event.preventDefault();

        if (
          !draggedPanel ||
          draggedPanel === panel
        ) {
          return;
        }

        panel.classList.add(
          "drag-over",
        );

        if (
          event.dataTransfer
        ) {
          event.dataTransfer.dropEffect =
            "move";
        }
      },
    );

    panel.addEventListener(
      "dragleave",
      () => {
        panel.classList.remove(
          "drag-over",
        );
      },
    );

    panel.addEventListener(
      "drop",
      (event) => {
        event.preventDefault();

        panel.classList.remove(
          "drag-over",
        );

        if (
          !draggedPanel ||
          draggedPanel === panel
        ) {
          return;
        }

        const parent =
          panel.parentElement;

        if (!parent) {
          return;
        }

        const rect =
          panel.getBoundingClientRect();

        const before =
          event.clientY <
          rect.top +
            rect.height / 2;

        if (before) {
          parent.insertBefore(
            draggedPanel,
            panel,
          );
        } else {
          parent.insertBefore(
            draggedPanel,
            panel.nextSibling,
          );
        }
      },
    );
  });

  /*
   * --------------------------------------------------------------------------
   * TERMINAL COMMAND HANDLER
   * --------------------------------------------------------------------------
   */

  try {
    const cluster = new Cluster();

    cluster.registerImage(
      WebServerImage,
    );

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

    await new Promise((r) =>
      setTimeout(r, 500),
    );

    updateDashboard();

    output.innerText =
      "Webernetes cluster online!";

    input.disabled = false;
    input.focus();

    input.addEventListener(
      "keydown",
      async (e) => {
        /*
         * Command history
         */
        if (e.key === "ArrowUp") {
          e.preventDefault();

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

        if (e.key === "ArrowDown") {
          e.preventDefault();

          if (historyIndex > 0) {
            historyIndex--;

            input.value =
              commandHistory[
                commandHistory.length -
                  1 -
                  historyIndex
              ];
          } else if (
            historyIndex === 0
          ) {
            historyIndex = -1;
            input.value = "";
          }

          return;
        }

        if (e.key !== "Enter") {
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

        printHtml(`
          <span style="color: #58a6ff;">
            user@webernetes:~$
          </span>
          ${escapeHtml(rawCmd)}
        `);

        const tokens =
          rawCmd.split(/\s+/);

        const mainCmd =
          tokens[0];

        /*
         * CLEAR
         */
        if (mainCmd === "clear") {
          output.innerText = "";
          return;
        }

        /*
         * LS
         */
        if (mainCmd === "ls") {
          const fileList =
            Object.keys(localFiles)
              .map(
                (f) =>
                  `<span style="color: #56d364; font-weight: 600;">${escapeHtml(f)}</span>`,
              )
              .join("  ");

          printHtml(fileList);
          return;
        }

        /*
         * CAT
         */
        if (mainCmd === "cat") {
          const fileName =
            tokens[1];

          if (!fileName) {
            printHtml(`
              <span class="terminal-red">
                cat: missing file operand
              </span>
            `);
          } else if (
            localFiles[fileName]
          ) {
            printHtml(
              highlightYaml(
                localFiles[fileName],
              ),
            );
          } else {
            printHtml(`
              <span class="terminal-red">
                cat: ${escapeHtml(fileName)}:
                No such file or directory
              </span>
            `);
          }

          return;
        }

        /*
         * HELP
         */
        if (
          mainCmd === "help" ||
          rawCmd ===
            "kubectl --help" ||
          rawCmd ===
            "kubectl -h" ||
          rawCmd === "--help"
        ) {
          printHtml(
            formatHelpText(),
          );

          return;
        }

        if (
          mainCmd === "protect" &&
          (tokens[1] === "--help" ||
            tokens[1] === "-h" ||
            !tokens[1])
        ) {
          printHtml(
            formatProtectHelp(),
          );

          return;
        }

        /*
         * HISTORY
         */
        if (mainCmd === "history") {
          if (
            commandHistory.length === 0
          ) {
            printHtml(`
              <span class="terminal-yellow">
                No command history.
              </span>
            `);

            return;
          }

          const formattedHistory =
            commandHistory
              .map(
                (c, i) =>
                  `<span style="color: #8b949e;">${String(
                    i + 1,
                  ).padStart(
                    3,
                    " ",
                  )}</span>  ${escapeHtml(c)}`,
              )
              .join("\n");

          printHtml(`
            <span style="color: #ffa657;">
              ${formattedHistory}
            </span>
          `);

          return;
        }

        /*
         * --------------------------------------------------------------------
         * PROTECT ZONE
         * --------------------------------------------------------------------
         */

        if (
          tokens[0] === "protect" &&
          tokens[1] === "zone"
        ) {
          const action =
            tokens[2];

          if (
            action === "launch"
          ) {
            handleProtectZoneLaunch(
              tokens,
            );

            return;
          }

          if (
            action === "list"
          ) {
            handleProtectZoneList();
            return;
          }

          if (
            action === "destroy"
          ) {
            handleProtectZoneDestroy(
              tokens,
            );

            return;
          }

          printHtml(`
            <span class="terminal-red">
              Unknown protect zone command.
            </span>
          `);

          return;
        }

        /*
         * --------------------------------------------------------------------
         * PROTECT WORKLOAD
         * --------------------------------------------------------------------
         */

        if (
          tokens[0] === "protect" &&
          tokens[1] === "workload"
        ) {
          const action =
            tokens[2];

          if (
            action === "launch"
          ) {
            handleProtectWorkloadLaunch(
              tokens,
            );

            return;
          }

          if (
            action === "list"
          ) {
            handleProtectWorkloadList();
            return;
          }

          printHtml(`
            <span class="terminal-red">
              Unknown protect workload command.
            </span>
          `);

          return;
        }

        /*
         * --------------------------------------------------------------------
         * KUBECTL CREATE NAMESPACE
         * --------------------------------------------------------------------
         */

        if (
          rawCmd.startsWith(
            "kubectl create namespace ",
          ) ||
          rawCmd.startsWith(
            "kubectl create ns ",
          )
        ) {
          const nsName =
            tokens[3] ||
            tokens[2];

          if (
            !nsName ||
            nsName.startsWith("-")
          ) {
            printHtml(`
              <span class="terminal-red">
                Error: namespace name required.
                Usage: kubectl create namespace &lt;name&gt;
              </span>
            `);

            addEvent(
              "Warning",
              "InvalidSyntax",
              "create",
              "Failed kubectl create namespace syntax",
            );

            return;
          }

          if (
            namespaces.some(
              (ns) =>
                ns.name ===
                nsName,
            )
          ) {
            printHtml(`
              <span class="terminal-red">
                Error from server (AlreadyExists):
                namespaces "${escapeHtml(
                  nsName,
                )}" already exists
              </span>
            `);

            addEvent(
              "Warning",
              "AlreadyExists",
              `namespace/${nsName}`,
              `Create failed: namespace ${nsName} already exists`,
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

          printHtml(`
            <span class="terminal-green">
              namespace/${escapeHtml(
                nsName,
              )} created
            </span>
          `);

          return;
        }

        /*
         * --------------------------------------------------------------------
         * KUBECTL RUN
         * --------------------------------------------------------------------
         */

        if (
          rawCmd.startsWith(
            "kubectl run ",
          )
        ) {
          const podName =
            tokens[2];

          if (
            !podName ||
            podName.startsWith("-")
          ) {
            printHtml(`
              <span class="terminal-red">
                Error: pod name required.
                Usage:
                kubectl run &lt;pod-name&gt;
                [--image=&lt;image&gt;]
                [-n &lt;namespace&gt;]
              </span>
            `);

            addEvent(
              "Warning",
              "InvalidSyntax",
              "run",
              "Failed kubectl run command syntax",
            );

            return;
          }

          let imageName =
            podName;

          let targetNamespace =
            "default";

          const customLabels: Record<
            string,
            string
          > = {
            run: podName,
          };

          for (
            let i = 3;
            i < tokens.length;
            i++
          ) {
            const arg =
              tokens[i];

            if (
              arg.startsWith(
                "--image=",
              )
            ) {
              imageName =
                arg.split(
                  "=",
                )[1] ||
                imageName;
            } else if (
              arg.startsWith(
                "--namespace=",
              )
            ) {
              targetNamespace =
                arg.split(
                  "=",
                )[1] ||
                targetNamespace;
            } else if (
              arg === "-n" ||
              arg === "--namespace"
            ) {
              if (
                tokens[i + 1]
              ) {
                targetNamespace =
                  tokens[i + 1];

                i++;
              }
            } else if (
              arg.startsWith(
                "-n",
              )
            ) {
              targetNamespace =
                arg.substring(
                  2,
                ) ||
                targetNamespace;
            } else if (
              arg.startsWith(
                "--labels=",
              )
            ) {
              const rawLabelsStr =
                arg
                  .replace(
                    "--labels=",
                    "",
                  )
                  .replace(
                    /["']/g,
                    "",
                  );

              rawLabelsStr
                .split(",")
                .forEach(
                  (pair) => {
                    const [
                      k,
                      v,
                    ] =
                      pair.split(
                        "=",
                      );

                    if (k) {
                      customLabels[
                        k.trim()
                      ] = v
                        ? v.trim()
                        : "";
                    }
                  },
                );
            }
          }

          if (
            !namespaces.some(
              (ns) =>
                ns.name ===
                targetNamespace,
            )
          ) {
            printHtml(`
              <span class="terminal-red">
                Error from server (NotFound):
                namespaces "${escapeHtml(
                  targetNamespace,
                )}" not found
              </span>
            `);

            addEvent(
              "Warning",
              "NotFound",
              `namespace/${targetNamespace}`,
              `Run failed: namespace ${targetNamespace} not found`,
            );

            return;
          }

          if (
            pods.some(
              (p) =>
                p.name ===
                  podName &&
                p.namespace ===
                  targetNamespace,
            )
          ) {
            printHtml(`
              <span class="terminal-red">
                Error from server (AlreadyExists):
                pods "${escapeHtml(
                  podName,
                )}" already exists in namespace
                "${escapeHtml(
                  targetNamespace,
                )}"
              </span>
            `);

            addEvent(
              "Warning",
              "AlreadyExists",
              `pod/${podName}`,
              `Run failed: pod ${podName} already exists in ${targetNamespace}`,
            );

            return;
          }

          const assignedNode =
            nodes.find(
              (n) =>
                !n.labels[
                  "node-role.kubernetes.io/control-plane"
                ],
            ) ||
            nodes[0];

          const newPod: LocalPod =
            {
              name: podName,
              namespace:
                targetNamespace,
              status: "Running",
              age: "1s",
              image: imageName,
              ip: `10.244.0.${Math.floor(
                Math.random() *
                  200 +
                  10,
              )}`,
              node:
                assignedNode
                  ? assignedNode.name
                  : "node-2",
              labels:
                customLabels,
            };

          pods.push(newPod);

          addEvent(
            "Normal",
            "Created",
            `pod/${podName}`,
            `pod/${podName} created in namespace ${targetNamespace} via kubectl run`,
          );

          if (
            assignedNode
          ) {
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

          printHtml(`
            <span class="terminal-green">
              pod/${escapeHtml(
                podName,
              )} created
            </span>
          `);

          return;
        }

        /*
         * --------------------------------------------------------------------
         * KUBECTL LABEL NODE
         * --------------------------------------------------------------------
         */

        if (
          rawCmd.startsWith(
            "kubectl label node ",
          ) ||
          rawCmd.startsWith(
            "kubectl label nodes ",
          )
        ) {
          const isPlural =
            tokens[1] ===
              "label" &&
            (
              tokens[2] ===
                "node" ||
              tokens[2] ===
                "nodes"
            );

          const nodeOffset =
            isPlural
              ? 3
              : 2;

          const targetNode =
            tokens[nodeOffset];

          const labelExpr =
            tokens[
              nodeOffset + 1
            ];

          if (
            !targetNode ||
            !labelExpr
          ) {
            printHtml(`
              <span class="terminal-red">
                Error: invalid syntax.
                Usage:
                kubectl label node &lt;node-name&gt;
                &lt;key&gt;=&lt;value&gt;
              </span>
            `);

            addEvent(
              "Warning",
              "InvalidSyntax",
              "label",
              "Failed label command syntax",
            );

            return;
          }

          const nodeObj =
            nodes.find(
              (n) =>
                n.name ===
                targetNode,
            );

          if (!nodeObj) {
            printHtml(`
              <span class="terminal-red">
                Error from server (NotFound):
                nodes "${escapeHtml(
                  targetNode,
                )}" not found
              </span>
            `);

            addEvent(
              "Warning",
              "NotFound",
              `node/${targetNode}`,
              `Label failed: node ${targetNode} not found`,
            );

            return;
          }

          if (
            labelExpr.includes("=")
          ) {
            const [
              key,
              val,
            ] =
              labelExpr.split(
                "=",
              );

            nodeObj.labels[
              key
            ] = val;
          } else {
            nodeObj.labels[
              labelExpr
            ] = "";
          }

          addEvent(
            "Normal",
            "Labeled",
            `node/${targetNode}`,
            `Node labeled with ${labelExpr}`,
          );

          printHtml(`
            <span class="terminal-green">
              node/${escapeHtml(
                targetNode,
              )} labeled
            </span>
          `);

          checkPendingPods();
          updateDashboard();

          return;
        }

        /*
         * --------------------------------------------------------------------
         * KUBECTL APPLY
         * --------------------------------------------------------------------
         */

        if (
          rawCmd.startsWith(
            "kubectl apply -f",
          )
        ) {
          const fileIndex =
            tokens.indexOf("-f");

          const fileName =
            fileIndex !== -1
              ? tokens[
                  fileIndex + 1
                ]
              : undefined;

          if (
            !fileName ||
            !localFiles[fileName]
          ) {
            printHtml(`
              <span class="terminal-red">
                error: the path "${escapeHtml(
                  fileName ||
                    "",
                )}" does not exist
              </span>
            `);

            addEvent(
              "Warning",
              "FileNotFound",
              "manifest",
              `Apply failed: file ${fileName} not found`,
            );

            return;
          }

          let targetNamespace =
            "default";

          const nsIndex =
            tokens.indexOf(
              "-n",
            );

          if (
            nsIndex !== -1 &&
            tokens[
              nsIndex + 1
            ]
          ) {
            targetNamespace =
              tokens[
                nsIndex + 1
              ];
          }

          if (
            fileName ===
            "pod-nginx.yaml"
          ) {
            const podName =
              "nginx";

            if (
              pods.some(
                (p) =>
                  p.name ===
                    podName &&
                  p.namespace ===
                    targetNamespace,
              )
            ) {
              printHtml(`
                <span class="terminal-muted">
                  pod/${podName} unchanged
                </span>
              `);

              return;
            }

            const nodeSelector = {
              disktype: "ssd",
            };

            const matchingNode =
              nodes.find(
                (n) =>
                  n.labels
                    .disktype ===
                  "ssd",
              );

            const newPod: LocalPod =
              {
                name: podName,
                namespace:
                  targetNamespace,
                status:
                  matchingNode
                    ? "Running"
                    : "Pending",
                age: "1s",
                image: "nginx",
                ip: matchingNode
                  ? `10.244.0.${Math.floor(
                      Math.random() *
                        200 +
                        10,
                    )}`
                  : "<none>",
                node:
                  matchingNode
                    ? matchingNode.name
                    : "<none>",
                labels: {
                  env: "test",
                },
                nodeSelector,
              };

            pods.push(newPod);

            addEvent(
              "Normal",
              "Created",
              `pod/${podName}`,
              `pod/nginx created in ${targetNamespace} from manifest`,
            );

            if (
              matchingNode
            ) {
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

            printHtml(`
              <span class="terminal-green">
                pod/${podName} created
              </span>
            `);
          } else if (
            fileName ===
            "runtimeclass-edera.yaml"
          ) {
            activeRuntimeClasses.add(
              "edera",
            );

            addEvent(
              "Normal",
              "Created",
              "runtimeclass/edera",
              "runtimeclass.node.k8s.io/edera created",
            );

            printHtml(`
              <span class="terminal-green">
                runtimeclass.node.k8s.io/edera created
              </span>
            `);

            checkPendingPods();
            updateDashboard();
          } else if (
            fileName ===
            "pod-hardened-vessel.yaml"
          ) {
            const podName =
              "hardened-vessel";

            if (
              pods.some(
                (p) =>
                  p.name ===
                    podName &&
                  p.namespace ===
                    targetNamespace,
              )
            ) {
              printHtml(`
                <span class="terminal-muted">
                  pod/${podName} unchanged
                </span>
              `);

              return;
            }

            const runtimeClassName =
              "edera";

            const runtimeClassExists =
              activeRuntimeClasses.has(
                runtimeClassName,
              );

            const assignedNode =
              runtimeClassExists
                ? nodes.find(
                    (n) =>
                      !n
                        .labels[
                        "node-role.kubernetes.io/control-plane"
                      ],
                  ) ||
                  nodes[0]
                : undefined;

            const newPod: LocalPod =
              {
                name: podName,
                namespace:
                  targetNamespace,
                status:
                  runtimeClassExists
                    ? "Running"
                    : "Pending",
                age: "1s",
                image:
                  "denhamparry/leaky-vessel:0.1",
                ip: assignedNode
                  ? `10.244.0.${Math.floor(
                      Math.random() *
                        200 +
                        10,
                    )}`
                  : "<none>",
                node:
                  assignedNode
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

            if (
              runtimeClassExists &&
              assignedNode
            ) {
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

            printHtml(`
              <span class="terminal-green">
                pod/${podName} created
              </span>
            `);
          }

          return;
        }

        /*
         * --------------------------------------------------------------------
         * KUBECTL GET NAMESPACES
         * --------------------------------------------------------------------
         */

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
          if (
            namespaces.length ===
            0
          ) {
            printHtml(`
              <span class="terminal-muted">
                No namespaces found.
              </span>
            `);

            return;
          }

          let formattedOutput = `
<span class="terminal-header">NAME              STATUS   AGE</span>
`;

          for (const ns of namespaces) {
            formattedOutput +=
              `${escapeHtml(
                ns.name.padEnd(
                  17,
                  " ",
                ),
              )} <span class="terminal-green">${escapeHtml(
                ns.status.padEnd(
                  8,
                  " ",
                ),
              )}</span> ${escapeHtml(
                ns.age,
              )}\n`;
          }

          printHtml(
            formattedOutput.trimEnd(),
          );

          return;
        }

        /*
         * --------------------------------------------------------------------
         * KUBECTL GET PODS
         * --------------------------------------------------------------------
         */

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
            (
              tokens.includes(
                "-o",
              ) &&
              tokens[
                tokens.indexOf(
                  "-o",
                ) + 1
              ] === "wide"
            ) ||
            tokens.includes(
              "-owide",
            );

          const allNamespaces =
            tokens.includes(
              "-A",
            ) ||
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
              tokens[i] ===
                "-n" ||
              tokens[i] ===
                "--namespace"
            ) {
              if (
                tokens[i + 1]
              ) {
                namespaceFilter =
                  tokens[
                    i + 1
                  ];
              }
            } else if (
              tokens[i].startsWith(
                "-n",
              ) &&
              tokens[i] !==
                "-node"
            ) {
              const sub =
                tokens[i].substring(
                  2,
                );

              if (sub) {
                namespaceFilter =
                  sub;
              }
            } else if (
              tokens[
                i
              ].startsWith(
                "--namespace=",
              )
            ) {
              namespaceFilter =
                tokens[
                  i
                ].split(
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
            filteredPods.length ===
            0
          ) {
            printHtml(`
              <span class="terminal-muted">
                No resources found in
                ${
                  allNamespaces
                    ? "cluster"
                    : `${escapeHtml(
                        namespaceFilter,
                      )} namespace`
                }.
              </span>
            `);

            return;
          }

          let header =
            allNamespaces
              ? "NAMESPACE   "
              : "";

          header +=
            "NAME        READY   STATUS    RESTARTS   AGE";

          if (showWide) {
            header +=
              "   IP            NODE";
          }

          if (showLabels) {
            header +=
              "          LABELS";
          }

          let formattedOutput = `
<div class="terminal-table">
  <div class="terminal-table-line terminal-header">
    ${escapeHtml(header)}
  </div>
`;

          for (
            const p of filteredPods
          ) {
            let line = "";

            if (
              allNamespaces
            ) {
              line +=
                `${p.namespace.padEnd(
                  11,
                )} `;
            }

            line +=
              `${p.name.padEnd(
                11,
              )} `;

            line +=
              p.status ===
              "Running"
                ? "1/1     "
                : "0/1     ";

            const statusClass =
              p.status ===
              "Running"
                ? "terminal-green"
                : "terminal-yellow";

            line +=
              `<span class="${statusClass}">${escapeHtml(
                p.status.padEnd(
                  9,
                ),
              )}</span> `;

            line +=
              `0         ${escapeHtml(
                p.age.padEnd(
                  5,
                ),
              )}`;

            formattedOutput += `
  <div class="terminal-table-line">
    ${line}
  </div>
`;

            if (showWide) {
              /*
               * Wide output is appended separately so the
               * browser doesn't wrap the table.
               */
              const wideLine =
                ` ${(p.ip || "<none>").padEnd(
                  13,
                )} ${(p.node || "<none>").padEnd(
                  10,
                )}`;

              formattedOutput =
                formattedOutput.replace(
                  `</div>\n\n  <div`,
                  `${escapeHtml(
                    wideLine,
                  )}</div>\n\n  <div`,
                );
            }

            if (showLabels) {
              formattedOutput += `
  <span class="terminal-muted">
    ${escapeHtml(
      formatLabels(
        p.labels,
      ),
    )}
  </span>
`;
            }
          }

          formattedOutput +=
            `</div>`;

          printHtml(
            formattedOutput,
          );

          return;
        }

        /*
         * --------------------------------------------------------------------
         * KUBECTL GET NODES
         * --------------------------------------------------------------------
         */

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

          if (
            nodes.length === 0
          ) {
            printHtml(`
              <span class="terminal-muted">
                No nodes found in cluster.
              </span>
            `);

            return;
          }

          let header =
            "NAME     STATUS   ROLES          AGE   VERSION";

          if (showLabels) {
            header +=
              "          LABELS";
          }

          let formattedOutput = `
<div class="terminal-table">
  <div class="terminal-table-line terminal-header">
    ${escapeHtml(header)}
  </div>
`;

          for (const n of nodes) {
            const roles =
              getNodeRoles(n);

            let line =
              `${n.name.padEnd(
                8,
              )} `;

            line +=
              `<span class="terminal-green">${escapeHtml(
                n.status.padEnd(
                  8,
                ),
              )}</span> `;

            line +=
              `${escapeHtml(
                roles.padEnd(
                  14,
                ),
              )} `;

            line +=
              `${escapeHtml(
                n.age.padEnd(
                  5,
                ),
              )} `;

            line +=
              `${escapeHtml(
                n.version.padEnd(
                  16,
                ),
              )}`;

            if (showLabels) {
              line +=
                ` <span class="terminal-muted">${escapeHtml(
                  formatLabels(
                    n.labels,
                  ),
                )}</span>`;
            }

            formattedOutput += `
  <div class="terminal-table-line">
    ${line}
  </div>
`;
          }

          formattedOutput +=
            `</div>`;

          printHtml(
            formattedOutput,
          );

          return;
        }

        /*
         * --------------------------------------------------------------------
         * KUBECTL DELETE POD
         * --------------------------------------------------------------------
         */

        if (
          rawCmd.startsWith(
            "kubectl delete pod ",
          ) ||
          rawCmd.startsWith(
            "kubectl delete pods ",
          )
        ) {
          const name =
            tokens[3] ||
            tokens[2];

          let targetNamespace =
            "default";

          const nsIndex =
            tokens.indexOf(
              "-n",
            );

          if (
            nsIndex !== -1 &&
            tokens[
              nsIndex + 1
            ]
          ) {
            targetNamespace =
              tokens[
                nsIndex + 1
              ];
          }

          const index =
            pods.findIndex(
              (p) =>
                p.name ===
                  name &&
                p.namespace ===
                  targetNamespace,
            );

          if (
            index === -1
          ) {
            printHtml(`
              <span class="terminal-red">
                Error from server (NotFound):
                pods "${escapeHtml(
                  name,
                )}" not found in namespace
                "${escapeHtml(
                  targetNamespace,
                )}"
              </span>
            `);

            return;
          }

          pods.splice(
            index,
            1,
          );

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

          printHtml(`
            <span class="terminal-green">
              pod "${escapeHtml(
                name,
              )}" deleted
            </span>
          `);

          return;
        }

        /*
         * --------------------------------------------------------------------
         * KUBECTL DELETE NODE
         * --------------------------------------------------------------------
         */

        if (
          rawCmd.startsWith(
            "kubectl delete node ",
          ) ||
          rawCmd.startsWith(
            "kubectl delete nodes ",
          )
        ) {
          const name =
            tokens[3] ||
            tokens[2];

          const index =
            nodes.findIndex(
              (n) =>
                n.name ===
                name,
            );

          if (
            index === -1
          ) {
            printHtml(`
              <span class="terminal-red">
                Error from server (NotFound):
                nodes "${escapeHtml(
                  name,
                )}" not found
              </span>
            `);

            return;
          }

          nodes.splice(
            index,
            1,
          );

          addEvent(
            "Warning",
            "NodeDeleted",
            `node/${name}`,
            `Node ${name} removed from cluster`,
          );

          pods.forEach(
            (p) => {
              if (
                p.node ===
                name
              ) {
                const newNode =
                  nodes[0]
                    ?.name ||
                  "unassigned";

                p.node =
                  newNode;

                addEvent(
                  "Warning",
                  "NodeEviction",
                  `pod/${p.name}`,
                  `Rescheduled to ${newNode}`,
                );
              }
            },
          );

          updateDashboard();

          printHtml(`
            <span class="terminal-green">
              node "${escapeHtml(
                name,
              )}" deleted
            </span>
          `);

          return;
        }

        /*
         * --------------------------------------------------------------------
         * CURL
         * --------------------------------------------------------------------
         */

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
                : res?.body ||
                  res;

            printHtml(`
              <span style="color: #a5d6ff;">
                ${escapeHtml(
                  String(text),
                )}
              </span>
            `);

            addEvent(
              "Normal",
              "HttpResponse",
              "curl",
              `200 OK from ${url}`,
            );
          } catch (
            err: any
          ) {
            printHtml(`
              <span class="terminal-red">
                curl: (7) Failed to connect:
                ${escapeHtml(
                  err.message,
                )}
              </span>
            `);

            addEvent(
              "Warning",
              "HttpError",
              "curl",
              `Connection failed: ${err.message}`,
            );
          }

          return;
        }

        /*
         * UNKNOWN COMMAND
         */

        printHtml(`
          <span class="terminal-red">
            command not found:
            ${escapeHtml(rawCmd)}.
            Type 'help' or '--help'
            to see supported commands.
          </span>
        `);

        addEvent(
          "Warning",
          "InvalidCommand",
          "cli",
          `Unknown command execution attempted: ${rawCmd}`,
        );
      },
    );
  } catch (error: any) {
    output.innerText =
      `Error initializing cluster: ${error.message}`;
  }
}

initTerminalDemo();
