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
  status: string;
  age: string;
  image: string;
  ip: string;
  node: string;
}

interface LocalNode {
  name: string;
  status: string;
  role: string;
  age: string;
  version: string;
}

interface ClusterEvent {
  time: string;
  type: "Normal" | "Warning" | "Info";
  reason: string;
  object: string;
  message: string;
}

async function initTerminalDemo() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; color: #c9d1d9; padding: 24px; min-height: 100vh; background-color: #0d1117;">
      
      <!-- High-Contrast Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #30363d; padding-bottom: 16px;">
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">Webernetes Dashboard & Terminal</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #8b949e;">Browser-based Kubernetes cluster emulator</p>
        </div>
        <button id="toggle-events-btn" style="background: #21262d; border: 1px solid #30363d; color: #f0f6fc; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <span id="toggle-icon">▶</span> Lifecycle Events Panel
        </button>
      </div>

      <!-- Main Layout Grid -->
      <div style="display: flex; gap: 16px; align-items: flex-start;">
        
        <!-- Left Area: Cluster Visuals + Terminal -->
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

          <!-- Terminal UI -->
          <div style="font-family: monospace; background: #010409; border: 1px solid #30363d; padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            <div id="output" style="white-space: pre-wrap; margin-bottom: 12px; min-height: 240px; max-height: 360px; overflow-y: auto; font-size: 13px;">Initializing Webernetes cluster...</div>
            <div style="display: flex; align-items: center; border-top: 1px solid #30363d; padding-top: 12px;">
              <span style="color: #58a6ff; margin-right: 8px;">user@webernetes:~$</span>
              <input id="cmd" type="text" placeholder="Type 'help' or use Up/Down arrow keys for command history..." style="flex: 1; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 13px; outline: none;" disabled />
            </div>
          </div>
        </div>

        <!-- Right Side Panel: Lifecycle Events -->
        <div id="events-panel" style="width: 340px; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; transition: all 0.25s ease-in-out; display: flex; flex-direction: column; height: 600px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #30363d;">
            <h3 style="margin: 0; font-size: 14px; color: #f0f6fc; display: flex; align-items: center; gap: 6px;">
              ⚡ Lifecycle Events
            </h3>
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

  let pods: LocalPod[] = [
    { name: "demo-pod", status: "Running", age: "2m", image: "web-server:1.0", ip: "10.244.0.5", node: "node-2" }
  ];

  let nodes: LocalNode[] = [
    { name: "node-1", status: "Ready", role: "control-plane", age: "5m", version: "v1.30.0-webernetes" },
    { name: "node-2", status: "Ready", role: "worker", age: "5m", version: "v1.30.0-webernetes" },
    { name: "node-3", status: "Ready", role: "worker", age: "5m", version: "v1.30.0-webernetes" }
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
    const ev: ClusterEvent = { time, type, reason, object, message };
    clusterEvents.unshift(ev);
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

  const helpText = `Webernetes CLI Reference:

Available Commands:
  • help / kubectl --help                             Show this help message
  • history                                           Display command history
  • kubectl get [pods|nodes|events|svc]               List cluster resources
  • kubectl describe pod <name>                       Display pod details and events
  • kubectl run <name> --image=<image>                Deploy a new pod
  • kubectl create node <name> [--role=worker|controlplane]   Provision a new cluster node
  • kubectl delete pod <name>                         Remove a pod from the cluster
  • kubectl delete node <name>                        Remove a node from the cluster
  • curl <url>                                        Fetch endpoint (e.g. http://node-1:31000)
  • clear                                             Clear terminal screen`;

  const updateDashboard = () => {
    podCount.innerText = `${pods.length} ${pods.length === 1 ? "Pod" : "Pods"}`;
    if (pods.length === 0) {
      podGrid.innerHTML = `<div style="font-size: 12px; color: #8b949e; padding: 6px;">No pods running</div>`;
    } else {
      podGrid.innerHTML = pods.map((p) => `
        <div style="background: #0d1117; border: 1px solid #238636; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #58a6ff;">${p.name}</div>
            <div style="font-size: 11px; color: #8b949e;">${p.image} · ${p.node}</div>
          </div>
          <span style="font-size: 10px; background: #23863622; color: #3fb950; border: 1px solid #238636; padding: 2px 6px; border-radius: 4px;">${p.status}</span>
        </div>
      `).join("");
    }

    nodeCount.innerText = `${nodes.length} ${nodes.length === 1 ? "Node" : "Nodes"}`;
    if (nodes.length === 0) {
      nodeGrid.innerHTML = `<div style="font-size: 12px; color: #8b949e; padding: 6px;">No nodes available</div>`;
    } else {
      nodeGrid.innerHTML = nodes.map((n) => `
        <div style="background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #f0f6fc;">${n.name}</div>
            <div style="font-size: 11px; color: #8b949e;">${n.role}</div>
          </div>
          <span style="font-size: 10px; background: #388bfd15; color: #58a6ff; border: 1px solid #388bfd33; padding: 2px 6px; border-radius: 4px;">${n.status}</span>
        </div>
      `).join("");
    }

    podGrid.scrollTop = podGrid.scrollHeight;
    nodeGrid.scrollTop = nodeGrid.scrollHeight;
  };

  const print = (text: string) => {
    output.innerText += `\n${text}`;
    output.scrollTop = output.scrollHeight;
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

    await new Promise((r) => setTimeout(r, 1000));

    updateDashboard();
    output.innerText = `Webernetes cluster online!\n\n${helpText}`;
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

      const cmd = input.value.trim();
      input.value = "";
      historyIndex = -1;
      if (!cmd) return;

      commandHistory.push(cmd);
      print(`user@webernetes:~$ ${cmd}`);

      if (cmd === "clear") {
        output.innerText = "";
        return;
      }

      if (cmd === "help" || cmd === "kubectl --help" || cmd === "kubectl -h" || cmd === "kubectl help") {
        print(helpText);
      }
      else if (cmd === "history") {
        if (commandHistory.length === 0) {
          print("No command history.");
          return;
        }
        let list = "";
        commandHistory.forEach((c, idx) => {
          list += `  ${String(idx + 1).padStart(3, " ")}  ${c}\n`;
        });
        print(list.trimEnd());
      }
      // CREATE NODE functionality
      else if (cmd.startsWith("kubectl create node ") || cmd.startsWith("kubectl create nodes ")) {
        const parts = cmd.split(" ");
        const name = parts[3];
        const roleArg = parts.find((p) => p.startsWith("--role="));
        let role = roleArg ? roleArg.split("=")[1] : "worker";

        if (role === "controlplane") role = "control-plane";

        if (!name) {
          print("Error: node name required. Usage: kubectl create node <name> [--role=worker|control-plane]");
          addEvent("Warning", "FailedCreate", "node", "Node creation failed: missing node name");
          return;
        }

        if (nodes.some((n) => n.name === name)) {
          print(`Error from server (AlreadyExists): nodes "${name}" already exists`);
          addEvent("Warning", "AlreadyExists", `node/${name}`, `Node ${name} already exists in cluster`);
          return;
        }

        nodes.push({
          name,
          status: "Ready",
          role,
          age: "1s",
          version: "v1.30.0-webernetes"
        });

        addEvent("Info", "NodeRegistration", `node/${name}`, `Registering new node with role "${role}"`);
        addEvent("Normal", "NodeReady", `node/${name}`, `Node ${name} status is now Ready`);

        updateDashboard();
        print(`node/${name} created (${role})`);
      }
      else if (cmd.startsWith("kubectl run ")) {
        const parts = cmd.split(" ");
        const name = parts[2];
        const imageArg = parts.find((p) => p.startsWith("--image="));
        const image = imageArg ? imageArg.split("=")[1] : "web-server:1.0";
        const assignedNode = nodes.length > 0 ? nodes[Math.floor(Math.random() * nodes.length)].name : "unassigned";

        if (!name) {
          print("Error: pod name required. Usage: kubectl run <name> --image=<image>");
          addEvent("Warning", "FailedCreate", "pod", "Pod creation failed: missing name parameter");
          return;
        }

        if (pods.some((p) => p.name === name)) {
          print(`Error from server (AlreadyExists): pods "${name}" already exists`);
          addEvent("Warning", "AlreadyExists", `pod/${name}`, `Pod ${name} already exists in default namespace`);
          return;
        }

        pods.push({
          name,
          status: "Running",
          age: "1s",
          image,
          ip: `10.244.0.${Math.floor(Math.random() * 200 + 10)}`,
          node: assignedNode
        });

        addEvent("Info", "Scheduling", `pod/${name}`, `Binding pod to node ${assignedNode}`);
        addEvent("Normal", "Scheduled", `pod/${name}`, `Successfully assigned default/${name} to ${assignedNode}`);
        addEvent("Normal", "Pulled", `pod/${name}`, `Successfully pulled image "${image}"`);
        addEvent("Normal", "Created", `pod/${name}`, `Created container web`);
        addEvent("Normal", "Started", `pod/${name}`, `Started container web`);

        updateDashboard();
        print(`pod/${name} created`);
      }
      else if (cmd.startsWith("kubectl delete pod ") || cmd.startsWith("kubectl delete pods ")) {
        const parts = cmd.split(" ");
        const name = parts[3] || parts[2];
        const index = pods.findIndex((p) => p.name === name);

        if (index === -1) {
          print(`Error from server (NotFound): pods "${name}" not found`);
          addEvent("Warning", "NotFound", `pod/${name}`, `Delete operation failed: pod "${name}" not found`);
          return;
        }

        pods.splice(index, 1);
        addEvent("Normal", "Killing", `pod/${name}`, `Stopping container web`);
        addEvent("Normal", "Terminated", `pod/${name}`, `Pod ${name} deleted successfully`);

        updateDashboard();
        print(`pod "${name}" deleted`);
      }
      else if (cmd.startsWith("kubectl delete node ") || cmd.startsWith("kubectl delete nodes ")) {
        const parts = cmd.split(" ");
        const name = parts[3] || parts[2];
        const index = nodes.findIndex((n) => n.name === name);

        if (index === -1) {
          print(`Error from server (NotFound): nodes "${name}" not found`);
          addEvent("Warning", "NotFound", `node/${name}`, `Delete operation failed: node "${name}" not found`);
          return;
        }

        nodes.splice(index, 1);
        addEvent("Warning", "NodeDeleted", `node/${name}`, `Node ${name} removed from active cluster state`);

        pods.forEach((p) => {
          if (p.node === name) {
            const newNode = nodes[0]?.name || "unassigned";
            p.node = newNode;
            addEvent("Warning", "NodeEviction", `pod/${p.name}`, `Evicted from ${name}, rescheduled to ${newNode}`);
          }
        });

        updateDashboard();
        print(`node "${name}" deleted`);
      }
      else if (cmd === "kubectl get pods" || cmd === "kubectl get pod") {
        addEvent("Info", "ApiQuery", "pods", "GET /api/v1/namespaces/default/pods HTTP/1.1");
        if (pods.length === 0) {
          print("No resources found in default namespace.");
          return;
        }
        let table = "NAME        READY   STATUS    RESTARTS   AGE   IP            NODE\n";
        for (const p of pods) {
          table += `${p.name.padEnd(11)} 1/1     ${p.status.padEnd(9)} 0          ${p.age.padEnd(5)} ${p.ip.padEnd(13)} ${p.node}\n`;
        }
        print(table);
      }
      else if (cmd === "kubectl get nodes" || cmd === "kubectl get node") {
        addEvent("Info", "ApiQuery", "nodes", "GET /api/v1/nodes HTTP/1.1");
        if (nodes.length === 0) {
          print("No nodes found in cluster.");
          return;
        }
        let table = "NAME     STATUS   ROLES          AGE   VERSION\n";
        for (const n of nodes) {
          table += `${n.name.padEnd(8)} ${n.status.padEnd(8)} ${n.role.padEnd(14)} ${n.age.padEnd(5)} ${n.version}\n`;
        }
        print(table);
      }
      else if (cmd.startsWith("curl ")) {
        const url = cmd.replace("curl ", "").trim();
        addEvent("Info", "HttpRequest", "curl", `GET ${url}`);
        try {
          const res: any = await cluster.fetch(url);
          const text = typeof res?.text === "function" ? await res.text() : res?.body || res;
          print(String(text));
          addEvent("Normal", "HttpResponse", "curl", `200 OK from ${url}`);
        } catch (err: any) {
          print(`curl: (7) Failed to connect: ${err.message}`);
          addEvent("Warning", "HttpError", "curl", `Connection failed: ${err.message}`);
        }
      }
      else {
        print(`command not found: ${cmd}. Type 'help' or 'kubectl --help' to see supported commands.`);
        addEvent("Warning", "InvalidCommand", "cli", `Unknown command execution attempted: ${cmd}`);
      }
    });

  } catch (error: any) {
    output.innerText = `Error initializing cluster: ${error.message}`;
  }
}

initTerminalDemo();
