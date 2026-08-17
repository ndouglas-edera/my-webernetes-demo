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
  lastSeen: string;
  type: string;
  reason: string;
  object: string;
  message: string;
}

async function initTerminalDemo() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 850px; margin: 30px auto; color: #c9d1d9;">
      <!-- Cluster State Visual Dashboard -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: #f0f6fc;">📦 Active Pods</h3>
            <span id="pod-count" style="font-size: 11px; background: #21262d; padding: 2px 8px; border-radius: 12px; border: 1px solid #30363d;">1 Pod</span>
          </div>
          <div id="pod-grid" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>

        <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: #f0f6fc;">🖥️ Active Nodes</h3>
            <span id="node-count" style="font-size: 11px; background: #21262d; padding: 2px 8px; border-radius: 12px; border: 1px solid #30363d;">3 Nodes</span>
          </div>
          <div id="node-grid" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
      </div>

      <!-- Terminal UI -->
      <div style="font-family: monospace; background: #0d1117; border: 1px solid #30363d; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        <div id="output" style="white-space: pre-wrap; margin-bottom: 12px; min-height: 220px; max-height: 380px; overflow-y: auto;">Initializing Webernetes cluster...</div>
        <div style="display: flex; align-items: center; border-top: 1px solid #30363d; padding-top: 12px;">
          <span style="color: #58a6ff; margin-right: 8px;">user@webernetes:~$</span>
          <input id="cmd" type="text" placeholder="Try 'kubectl describe pod demo-pod' or 'kubectl delete node node-3'..." style="flex: 1; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 14px; outline: none;" disabled />
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

  let pods: LocalPod[] = [
    { name: "demo-pod", status: "Running", age: "2m", image: "web-server:1.0", ip: "10.244.0.5", node: "node-2" }
  ];

  let nodes: LocalNode[] = [
    { name: "node-1", status: "Ready", role: "control-plane", age: "5m", version: "v1.30.0-webernetes" },
    { name: "node-2", status: "Ready", role: "worker", age: "5m", version: "v1.30.0-webernetes" },
    { name: "node-3", status: "Ready", role: "worker", age: "5m", version: "v1.30.0-webernetes" }
  ];

  let events: ClusterEvent[] = [
    { lastSeen: "2m", type: "Normal", reason: "Scheduled", object: "pod/demo-pod", message: "Successfully assigned default/demo-pod to node-2" },
    { lastSeen: "2m", type: "Normal", reason: "Created", object: "pod/demo-pod", message: "Created container web" },
    { lastSeen: "2m", type: "Normal", reason: "Started", object: "pod/demo-pod", message: "Started container web" }
  ];

  const updateDashboard = () => {
    podCount.innerText = `${pods.length} ${pods.length === 1 ? "Pod" : "Pods"}`;
    if (pods.length === 0) {
      podGrid.innerHTML = `<div style="font-size: 12px; color: #8b949e; padding: 6px;">No pods running</div>`;
    } else {
      podGrid.innerHTML = pods.map((p) => `
        <div style="background: #0d1117; border: 1px solid #238636; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
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
        <div style="background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-weight: 600; font-size: 13px; color: #f0f6fc;">${n.name}</div>
            <div style="font-size: 11px; color: #8b949e;">${n.role}</div>
          </div>
          <span style="font-size: 10px; background: #388bfd15; color: #58a6ff; border: 1px solid #388bfd33; padding: 2px 6px; border-radius: 4px;">${n.status}</span>
        </div>
      `).join("");
    }
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

    await new Promise((r) => setTimeout(r, 1000));

    updateDashboard();
    output.innerText = "Webernetes cluster online!\n\nCommands to try:\n  • kubectl get pods / nodes / events / services\n  • kubectl describe pod <name>\n  • kubectl run <name> --image=<image>\n  • kubectl delete pod <name>\n  • kubectl delete node <name>\n  • curl http://node-1:31000";
    input.disabled = false;
    input.focus();

    input.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const cmd = input.value.trim();
      input.value = "";
      if (!cmd) return;

      print(`user@webernetes:~$ ${cmd}`);

      if (cmd === "clear") {
        output.innerText = "";
        return;
      }

      // kubectl describe pod
      if (cmd.startsWith("kubectl describe pod ") || cmd.startsWith("kubectl describe pods ")) {
        const parts = cmd.split(" ");
        const name = parts[3] || parts[2];
        const pod = pods.find((p) => p.name === name);

        if (!pod) {
          print(`Error from server (NotFound): pods "${name}" not found`);
          return;
        }

        print(
`Name:         ${pod.name}
Namespace:    default
Node:         ${pod.node}/10.0.0.1
Start Time:   Mon, 17 Aug 2026 09:45:00 GMT
Labels:       app=${pod.name}
Status:       ${pod.status}
IP:           ${pod.ip}
Containers:
  web:
    Container ID:   webernetes://${pod.name}-web
    Image:          ${pod.image}
    State:          Running
      Started:      Mon, 17 Aug 2026 09:45:01 GMT
    Ready:          True
    Restart Count:  0
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  ${pod.age}   default-scheduler  Successfully assigned default/${pod.name} to ${pod.node}
  Normal  Started    ${pod.age}   kubelet, ${pod.node}   Started container web`
        );
      }
      // kubectl get events
      else if (cmd === "kubectl get events" || cmd === "kubectl get event") {
        if (events.length === 0) {
          print("No events found in default namespace.");
          return;
        }
        let table = "LAST SEEN   TYPE     REASON      OBJECT         MESSAGE\n";
        for (const ev of events) {
          table += `${ev.lastSeen.padEnd(11)} ${ev.type.padEnd(8)} ${ev.reason.padEnd(11)} ${ev.object.padEnd(14)} ${ev.message}\n`;
        }
        print(table);
      }
      // kubectl delete node
      else if (cmd.startsWith("kubectl delete node ") || cmd.startsWith("kubectl delete nodes ")) {
        const parts = cmd.split(" ");
        const name = parts[3] || parts[2];
        const index = nodes.findIndex((n) => n.name === name);

        if (index === -1) {
          print(`Error from server (NotFound): nodes "${name}" not found`);
          return;
        }

        nodes.splice(index, 1);
        events.unshift({
          lastSeen: "1s",
          type: "Warning",
          reason: "NodeDeleted",
          object: `node/${name}`,
          message: `Node ${name} removed from cluster state`
        });

        // Reassign affected pods if their node was deleted
        pods.forEach((p) => {
          if (p.node === name) {
            p.node = nodes[0]?.name || "unassigned";
          }
        });

        updateDashboard();
        print(`node "${name}" deleted`);
      }
      // kubectl run
      else if (cmd.startsWith("kubectl run ")) {
        const parts = cmd.split(" ");
        const name = parts[2];
        const imageArg = parts.find((p) => p.startsWith("--image="));
        const image = imageArg ? imageArg.split("=")[1] : "web-server:1.0";
        const assignedNode = nodes.length > 0 ? nodes[Math.floor(Math.random() * nodes.length)].name : "unassigned";

        if (!name) {
          print("Error: pod name required. Usage: kubectl run <name> --image=<image>");
          return;
        }

        if (pods.some((p) => p.name === name)) {
          print(`Error from server (AlreadyExists): pods "${name}" already exists`);
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

        events.unshift({
          lastSeen: "1s",
          type: "Normal",
          reason: "Scheduled",
          object: `pod/${name}`,
          message: `Successfully assigned default/${name} to ${assignedNode}`
        });

        updateDashboard();
        print(`pod/${name} created`);
      }
      // kubectl delete pod
      else if (cmd.startsWith("kubectl delete pod ") || cmd.startsWith("kubectl delete pods ")) {
        const parts = cmd.split(" ");
        const name = parts[3] || parts[2];
        const index = pods.findIndex((p) => p.name === name);

        if (index === -1) {
          print(`Error from server (NotFound): pods "${name}" not found`);
          return;
        }

        pods.splice(index, 1);
        events.unshift({
          lastSeen: "1s",
          type: "Normal",
          reason: "Killing",
          object: `pod/${name}`,
          message: `Stopping container web in pod ${name}`
        });

        updateDashboard();
        print(`pod "${name}" deleted`);
      }
      // kubectl get pods
      else if (cmd === "kubectl get pods" || cmd === "kubectl get pod") {
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
      // kubectl get nodes
      else if (cmd === "kubectl get nodes" || cmd === "kubectl get node") {
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
      // kubectl get services
      else if (cmd === "kubectl get services" || cmd === "kubectl get svc") {
        print("NAME           TYPE       CLUSTER-IP   EXTERNAL-IP   PORT(S)        AGE\ndemo-service   NodePort   10.96.0.15   <none>        80:31000/TCP   2m");
      }
      // curl
      else if (cmd.startsWith("curl ")) {
        const url = cmd.replace("curl ", "").trim();
        try {
          const res: any = await cluster.fetch(url);
          const text = typeof res?.text === "function" ? await res.text() : res?.body || res;
          print(String(text));
        } catch (err: any) {
          print(`curl: (7) Failed to connect: ${err.message}`);
        }
      }
      else {
        print(`command not found: ${cmd}. Try 'kubectl describe pod demo-pod' or 'kubectl get events'`);
      }
    });

  } catch (error: any) {
    output.innerText = `Error initializing cluster: ${error.message}`;
  }
}

initTerminalDemo();
