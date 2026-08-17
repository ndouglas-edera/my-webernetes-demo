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

async function runCluster() {
  const app = document.querySelector<HTMLDivElement>("#app")!;

  try {
    app.innerText = "Initializing Webernetes cluster...";

    const cluster = new Cluster();
    cluster.registerImage(WebServerImage);
    await cluster.init();

    // 1. Apply Pod Manifest
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

    // 2. Apply NodePort Service Manifest
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

    // 3. Pause briefly for internal DNS/Endpoint reconciliation
    await new Promise((r) => setTimeout(r, 1000));

    // 4. Safely handle cluster response
    const res: any = await cluster.fetch("http://node-1:31000");
    const text = typeof res?.text === "function" ? await res.text() : res?.body || res;

    app.innerText = String(text);
  } catch (error: any) {
    app.innerText = `Error: ${error.message}`;
  }
}

runCluster();
