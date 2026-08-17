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
}

async function initTerminalDemo() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 40px auto; color: #c9d1d9;">
      <!-- Active Pods Visual Dashboard -->
      <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; color: #f0f6fc;">📦 Active Pods Preview</h3>
          <span id="pod-count" style="font-size: 12px; background: #21262d; padding: 2px 8px; border-radius: 12px; border: 1px solid #30363d;">1 Pod</span>
        </div>
        <div id="pod-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">
          <!-- Pod cards render here -->
        </div>
      </div>

      <!-- Terminal UI -->
      <div style="font-family: monospace; background: #0d1117; border: 1px solid #30363d; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        <div id="output" style="white-space: pre-wrap; margin-bottom: 12px; min-height: 200px; max-height: 350px; overflow-y: auto;">Initializing Webernetes cluster...</div>
        <div style="display: flex; align-items: center; border-top: 1px solid #30363d; padding-top: 12px;">
          <span style="color: #58a6ff; margin-right: 8px;">user@webernetes:~$</span>
          <input id="cmd" type="text" placeholder="Try 'kubectl run nginx --image=nginx' or 'kubectl delete pod demo-pod'..." style="flex: 1; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 14px; outline: none;" disabled />
        </div>
      </div>
    </div>
  `;

  const output = document.querySelector<HTMLDivElement>("#output")!;
  const input = document.querySelector<HTMLInputElement>("#cmd")!;
  const podGrid = document.querySelector<HTMLDivElement>("#pod-grid")!;
  const podCount = document.querySelector<HTMLSpanElement>("#pod-count")!;

  // Track active pods state
  let pods: LocalPod[] = [
    { name: "demo-pod", status: "Running", age: "1m", image: "web-server:1.0" }
  ];

  const updatePodPreview = () => {
    podCount.innerText = `${pods.length} ${pods.length === 1 ? "Pod" : "Pods"}`;
    if (pods.length === 0) {
      podGrid.innerHTML = `<div style="grid-column: 1 / -1; font-size: 13px; color: #8b949e; text-align: center; padding: 12px;">No running pods in default namespace</div>`;
      return;
    }

    podGrid.innerHTML = pods.map((p) => `
      <div style="background: #0d1117; border: 1px solid #238636; border-radius: 6px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-weight: 600; font-size: 13px; color: #58a6ff;">${p.name}</div>
          <div style="font-size: 11px; color: #8b949e;">${p.image}</div>
        </div>
        <span style="font-size: 10px; background: #23863622; color: #3fb950; border: 1px solid #238636; padding: 2px 6px; border-radius: 4px;">${p.status}</span>
      </div>
    `).join("");
  };

  const print = (text: string) => {
    output.innerText += `\n${text}`;
    output.scrollTop = output.scrollHeight;
  };

  try {
    const cluster = new Cluster();
    cluster.registerImage(WebServerImage);
    await cluster.init();

    // Initial deployment
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

    updatePodPreview();
    output.innerText = "Webernetes cluster online!\n\nAvailable commands:\n  • kubectl run <name> --image=<image>\n  • kubectl delete pod <name>\n  • kubectl get pods\n  • kubectl get services\n  • curl http://node-1:31000\n  • clear";
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

      // Handle kubectl run
      if (cmd.startsWith("kubectl run ")) {
        const parts = cmd.split(" ");
        const name = parts[2];
        const imageArg = parts.find((p) => p.startsWith("--image="));
        const image = imageArg ? imageArg.split("=")[1] : "web-server:1.0";

        if (!name) {
          print("Error: pod name required. Usage: kubectl run <name> --image=<image>");
          return;
        }

        if (pods.some((p) => p.name === name)) {
          print(`Error from server (AlreadyExists): pods "${name}" already exists`);
          return;
        }

        try {
          await cluster.apply([
            {
              apiVersion: "v1",
              kind: "Pod",
              metadata: { name, labels: { app: name } },
              spec: { containers: [{ name, image }] },
            },
          ]);
        } catch {
          // Fallback if client-side apply is simulated
        }

        pods.push({ name, status: "Running", age: "1s", image });
        updatePodPreview();
        print(`pod/${name} created`);
      }
      // Handle kubectl delete pod
      else if (cmd.startsWith("kubectl delete pod ") || cmd.startsWith("kubectl delete pods ")) {
        const parts = cmd.split(" ");
        const name = parts[3] || parts[2];

        const index = pods.findIndex((p) => p.name === name);
        if (index === -1) {
          print(`Error from server (NotFound): pods "${name}" not found`);
          return;
        }

        pods.splice(index, 1);
        updatePodPreview();
        print(`pod "${name}" deleted`);
      }
      // Handle kubectl get pods
      else if (cmd === "kubectl get pods" || cmd === "kubectl get pod") {
        if (pods.length === 0) {
          print("No resources found in default namespace.");
          return;
        }
        let table = "NAME        READY   STATUS    RESTARTS   AGE\n";
        for (const p of pods) {
          table += `${p.name.padEnd(12)} 1/1     ${p.status.padEnd(9)} 0          ${p.age}\n`;
        }
        print(table);
      }
      // Handle kubectl get services
      else if (cmd === "kubectl get services" || cmd === "kubectl get svc") {
        print("NAME           TYPE       CLUSTER-IP   EXTERNAL-IP   PORT(S)        AGE\ndemo-service   NodePort   10.96.0.15   <none>        80:31000/TCP   1m");
      }
      // Handle kubectl get nodes
      else if (cmd === "kubectl get nodes" || cmd === "kubectl get node") {
        print("NAME     STATUS   ROLES    AGE   VERSION\nnode-1   Ready    control  1m    v1.30.0-webernetes\nnode-2   Ready    worker   1m    v1.30.0-webernetes\nnode-3   Ready    worker   1m    v1.30.0-webernetes");
      }
      // Handle curl
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
        print(`command not found: ${cmd}. Try 'kubectl run test-pod --image=nginx' or 'kubectl delete pod demo-pod'`);
      }
    });

  } catch (error: any) {
    output.innerText = `Error initializing cluster: ${error.message}`;
  }
}

initTerminalDemo();
