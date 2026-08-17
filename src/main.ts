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

async function initTerminalDemo() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div style="font-family: monospace; background: #0d1117; color: #c9d1d9; padding: 20px; border-radius: 8px; max-width: 800px; margin: 40px auto; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
      <div id="output" style="white-space: pre-wrap; margin-bottom: 12px; min-height: 200px; max-height: 400px; overflow-y: auto;">Initializing Webernetes cluster...</div>
      <div style="display: flex; align-items: center; border-top: 1px solid #30363d; padding-top: 12px;">
        <span style="color: #58a6ff; margin-right: 8px;">user@webernetes:~$</span>
        <input id="cmd" type="text" placeholder="Type a command (e.g. kubectl get pods)..." style="flex: 1; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 14px; outline: none;" disabled />
      </div>
    </div>
  `;

  const output = document.querySelector<HTMLDivElement>("#output")!;
  const input = document.querySelector<HTMLInputElement>("#cmd")!;

  const print = (text: string) => {
    output.innerText += `\n${text}`;
    output.scrollTop = output.scrollHeight;
  };

  try {
    const cluster = new Cluster();
    cluster.registerImage(WebServerImage);
    await cluster.init();

    // 1. Deploy Pod
    await cluster.apply([
      {
        apiVersion: "v1",
        kind: "Pod",
        metadata: { name: "demo-pod", labels: { app: "demo" } },
        spec: {
          containers: [{ name: "web", image: "web-server:1.0" }],
        },
      },
    ]);

    // 2. Deploy NodePort Service
    await cluster.apply([
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

    output.innerText = "Webernetes cluster online! Available commands:\n  • kubectl get pods\n  • kubectl get services\n  • kubectl get nodes\n  • curl http://node-1:31000\n  • clear";
    input.disabled = false;
    input.focus();

    // Command line handler
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

      if (cmd === "kubectl get pods" || cmd === "kubectl get pod") {
        try {
          const pods: any = await cluster.list({ apiVersion: "v1", kind: "Pod" });
          const podList = Array.isArray(pods) ? pods : pods?.items || [];
          if (podList.length === 0) {
            print("No resources found in default namespace.");
            return;
          }
          let table = "NAME        READY   STATUS    RESTARTS   AGE\n";
          for (const pod of podList) {
            table += `${pod.metadata?.name || "unknown"}    1/1     Running   0          1m\n`;
          }
          print(table);
        } catch {
          print("demo-pod    1/1     Running   0          1m");
        }
      } else if (cmd === "kubectl get services" || cmd === "kubectl get svc") {
        print("NAME           TYPE       CLUSTER-IP   EXTERNAL-IP   PORT(S)        AGE\ndemo-service   NodePort   10.96.0.15   <none>        80:31000/TCP   1m");
      } else if (cmd === "kubectl get nodes" || cmd === "kubectl get node") {
        print("NAME     STATUS   ROLES    AGE   VERSION\nnode-1   Ready    control  1m    v1.30.0-webernetes\nnode-2   Ready    worker   1m    v1.30.0-webernetes\nnode-3   Ready    worker   1m    v1.30.0-webernetes");
      } else if (cmd.startsWith("curl ")) {
        const url = cmd.replace("curl ", "").trim();
        try {
          const res: any = await cluster.fetch(url);
          const text = typeof res?.text === "function" ? await res.text() : res?.body || res;
          print(String(text));
        } catch (err: any) {
          print(`curl: (7) Failed to connect: ${err.message}`);
        }
      } else {
        print(`command not found: ${cmd}. Try 'kubectl get pods' or 'curl http://node-1:31000'`);
      }
    });

  } catch (error: any) {
    output.innerText = `Error initializing cluster: ${error.message}`;
  }
}

initTerminalDemo();
