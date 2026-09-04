import { BaseImage, Cluster, type ProcessContext } from "@ngrok/webernetes";
import "./style.css";

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
  internalIp: string;
  externalIp: string;
  osImage: string;
  kernelVersion: string;
  containerRuntime: string;
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
  device?: string;
  kernelVariant?: string;
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
handler: edera
scheduling:
  nodeSelector:
    runtime: edera`;

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
    id: "edera-node-label",
    title: "Label the Edera node",
    description:
      "Label node-2 with runtime=edera. The Edera RuntimeClass uses this label to schedule Edera-protected workloads onto the correct node.",
    command: "kubectl label node node-2 runtime=edera",
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

  /*
   * GPU passthrough is intentionally not part of the guided demo flow.
   * The GPU commands remain available in the terminal for manual exploration.
   */
];

async function initTerminalDemo() {

  const app = document.querySelector<HTMLDivElement>("#app")!;

  app.innerHTML = `
    <div class="demo-shell">

      <header class="top-header">
        <a href="https://edera.dev" class="logo-link">EDERA</a>
        <div>
          <h1>Webernetes × Edera</h1>
          <p>Secure workload execution, directly in your browser.</p>
        </div>
      </header>

      <section class="brand-hero" aria-labelledby="hero-title">
        <div class="hero-eyebrow">ARE YOU READY TO CYA?</div>
        <h2 id="hero-title">CONTAIN YOUR<br />WORKLOADS</h2>
        <p>
          Edera is the secure execution platform for all software — built so every
          untrusted workload runs trusted, and free to move at the speed of your business.
        </p>
        <button id="hero-run-btn" class="hero-cta" type="button">Try it Out</button>
      </section>

      <div class="demo-kicker">Web­ernetes × Edera - interactive isolation demo</div>

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
            <div class="panel-subtitle">Simulated Edera isolation boundaries</div>
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
        <span>Made with love by the team at <a href="https://edera.dev/love" target="_blank" rel="noopener noreferrer">Edera</a></span>
      </div>

      <!-- Lab completion modal -->
      <div
        id="completion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-title"
        style="position:fixed;inset:0;z-index:1000;display:none;place-items:center;padding:24px;"
      >
        <div
          id="completion-modal-backdrop"
          aria-hidden="true"
          style="position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);"
        ></div>
        <div
          style="position:relative;width:min(520px,100%);padding:42px;border:1px solid rgba(184,255,60,.35);border-radius:20px;background:#081716;box-shadow:0 24px 80px rgba(0,0,0,.5);text-align:center;"
        >
          <button
            id="completion-close"
            type="button"
            aria-label="Close completion message"
            style="position:absolute;top:12px;right:16px;border:0;background:transparent;color:#a8cfca;font-size:28px;line-height:1;cursor:pointer;"
          >×</button>
          <div style="width:64px;height:64px;margin:0 auto 20px;display:grid;place-items:center;border-radius:50%;background:#b8ff3c;color:#081716;font-size:32px;font-weight:800;">✓</div>
          <div style="margin-bottom:10px;color:#00e5d4;font-size:12px;font-weight:800;letter-spacing:.16em;">LAB COMPLETE</div>
          <h2 id="completion-title" style="margin:0 0 14px;color:#f8fffd;font-size:30px;">Thank you for completing the lab!</h2>
          <p style="margin:0 0 28px;color:#a8cfca;line-height:1.6;">You've completed the Edera isolation walkthrough. Ready to try Edera for yourself?</p>
          <div class="completion-actions">
            <button id="restart-demo-btn" type="button" class="completion-restart-btn">Start a new session</button>
            <a href="https://on.edera.dev" target="_blank" rel="noopener noreferrer" class="completion-license-link">Sign up for a free Edera license →</a>
          </div>
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

  // Mobile layout is handled entirely in style.css.

  const rootShell =
    document.querySelector<HTMLElement>(".demo-shell") || app;
  const mainLayout =
    document.querySelector<HTMLElement>(".main-layout")!;
  const guidePanel =
    document.querySelector<HTMLElement>("#guide-panel")!;
  const eventsPanel =
    document.querySelector<HTMLElement>("#events-panel")!;

  const syncMobilePanelOrder = () => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if (isMobile) {
      // Mobile: Terminal -> Edera Demo Guide -> Lifecycle Events.
      if (eventsPanel.parentElement !== rootShell ||
          eventsPanel.previousElementSibling !== guidePanel) {
        rootShell.insertBefore(eventsPanel, guidePanel.nextSibling);
      }
    } else {
      // Desktop: restore the original Terminal + Lifecycle Events layout.
      if (eventsPanel.parentElement !== mainLayout) {
        mainLayout.appendChild(eventsPanel);
      }
    }
  };

  syncMobilePanelOrder();

  const mobileLayoutMediaQuery = window.matchMedia("(max-width: 768px)");
  const handleMobileLayoutChange = () => syncMobilePanelOrder();

  if (typeof mobileLayoutMediaQuery.addEventListener === "function") {
    mobileLayoutMediaQuery.addEventListener("change", handleMobileLayoutChange);
  } else {
    mobileLayoutMediaQuery.addListener(handleMobileLayoutChange);
  }

  window.addEventListener("resize", syncMobilePanelOrder);

  const completionModal =
    document.querySelector<HTMLDivElement>("#completion-modal")!;

  const completionClose =
    document.querySelector<HTMLButtonElement>("#completion-close")!;

  const completionModalBackdrop =
    document.querySelector<HTMLDivElement>("#completion-modal-backdrop")!;
  const restartDemoBtn =
    document.querySelector<HTMLButtonElement>("#restart-demo-btn")!;
  // Keep completion state in memory so each fresh page load can complete the lab again.
  let completionModalShown = false;

  const closeCompletionModal = () => {
    completionModal.hidden = true;
    completionModal.style.display = "none";
  };

  let cluster: Cluster;

  const localFiles: Record<string, string> = {
    "pod-nginx.yaml": NGINX_YAML_CONTENT,
    "runtimeclass-edera.yaml": RUNTIMECLASS_EDERA_YAML_CONTENT,
    "pod-hardened-vessel.yaml": HARDENED_VESSEL_YAML_CONTENT,
    "nginx-deployment.yaml": NGINX_DEPLOYMENT_YAML_CONTENT,
  };

  /*
   * GPU passthrough is simulated independently of the existing Kubernetes
   * state. The values mirror the NVIDIA Tesla T4 example used by the GPU lab.
   */
  const GPU_PCI_LOCATION = "0000:18:00.0";
  const GPU_PCI_ID = "10de:1eb8";
  const GPU_GUEST_PCI_LOCATION = "0000:00:07.0";
  const NVIDIA_KERNEL_VARIANT =
    "ghcr.io/edera-dev/zone-nvidiagpu-kernel:6.18.38-nvidia-610.43.02@sha256:dc968f8664d41abb75e44aa7bb3eb12e02d928c1358e5f1a8435c51d1d30f239";

  const GPU_DAEMON_TOML = `[pci.devices]
[pci.devices.gpu0]
locations = [
  "${GPU_PCI_LOCATION}",
]
permissive = true
msi_translate = false
power_management = true
rdm_reserve_policy = "relaxed"

[zone.kernel-variants]
nvidia = "${NVIDIA_KERNEL_VARIANT}"`;

  const GPU_VFIO_MODPROBE = `options vfio_iommu_type1 allow_unsafe_interrupts
options vfio_pci ids=${GPU_PCI_ID}`;

  const GPU_MODULES_LOAD = `vfio_iommu_type1
vfio_pci`;

  const GPU_LSPCI_UNBOUND = `0000:18:00.0 3D controller [0302]: NVIDIA Corporation TU104GL [Tesla T4] [10de:1eb8] (rev a1)
    Subsystem: NVIDIA Corporation Device [10de:12a2]`;

  const GPU_LSPCI_VFIO = `${GPU_LSPCI_UNBOUND}
    Kernel driver in use: vfio-pci`;

  const NVIDIA_ZONE_LOGS = `[2026-07-16T16:32:21.011030Z INFO  edera_protect_zone::hooks] running setup hook: load modules [nvidia, nvidia_drm, nvidia_uvm] and execute [/usr/bin/nvidia-smi, -pm, 1]
[    1.403876] nvidia: loading out-of-tree module taints kernel.
[    1.515369] nvidia-nvlink: Nvlink Core is being initialized, major device number 239
[    1.516039]
[    1.568563] NVRM: loading NVIDIA UNIX Open Kernel Module for x86_64  610.43.02  Release Build  (build@01c4f9ab348e)  Mon Jul 13 01:02:13 UTC 2026
[    1.619087] nvidia-modeset: Loading NVIDIA UNIX Open Kernel Mode Setting Driver for x86_64  610.43.02  Release Build  (build@01c4f9ab348e)  Mon Jul 13 01:02:08 UTC 2026
[    1.676402] [drm] [nvidia-drm] [GPU ID 0x00000007] Loading driver
[    3.362604] [drm] Initialized nvidia-drm 0.0.0 for 0000:00:07.0 on minor 0`;

  const NVIDIA_WORKLOAD_LSPCI = `0000:00:07.0 3D controller [0302]: NVIDIA Corporation TU104GL [Tesla T4] [10de:1eb8] (rev a1)
    Subsystem: NVIDIA Corporation Device [10de:12a2]
    Kernel driver in use: nvidia`;

  const NVIDIA_SMI_OUTPUT = `+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI 610.43.02              KMD Version: 610.43.02     CUDA UMD Version: 13.3     |
+-----------------------------------------+------------------------+----------------------+
| GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC |
| Fan  Temp   Perf          Pwr:Usage/Cap |           Memory-Usage | GPU-Util  Compute M. |
|                                         |                        |               MIG M. |
|=========================================+========================+======================|
|   0  Tesla T4                       On  |   00000000:00:07.0 Off |                    0 |
| N/A   32C    P8             11W /   70W |       0MiB /  15360MiB |      0%      Default |
|                                         |                        |                  N/A |
+-----------------------------------------+------------------------+----------------------+

+-----------------------------------------------------------------------------------------+
| Processes:                                                                              |
|  GPU   GI   CI              PID   Type   Process name                        GPU Memory |
|        ID   ID                                                               Usage      |
|=========================================================================================|
|  No running processes found                                                             |
+-----------------------------------------------------------------------------------------+`;

  /*
   * The demo filesystem is intentionally read-only.
   *
   * These files can still be read with `cat` and consumed by supported
   * operations such as `kubectl apply -f`, but terminal editors and other
   * write-oriented commands must not modify the in-memory manifests.
   */
  const localFileMetadata: Record<
    string,
    { size: number; modified: string }
  > = {
    "pod-nginx.yaml": {
      size: NGINX_YAML_CONTENT.length,
      modified: "Apr  9 07:48",
    },
    "runtimeclass-edera.yaml": {
      size: RUNTIMECLASS_EDERA_YAML_CONTENT.length,
      modified: "Apr  9 07:48",
    },
    "pod-hardened-vessel.yaml": {
      size: HARDENED_VESSEL_YAML_CONTENT.length,
      modified: "Apr  9 07:48",
    },
    "nginx-deployment.yaml": {
      size: NGINX_DEPLOYMENT_YAML_CONTENT.length,
      modified: "Apr  9 07:47",
    },
  };

  const READ_ONLY_FILE_MODE = "-r--r--r--";
  const READ_ONLY_DIRECTORY_MODE = "dr-xr-xr-x";

  const startNewDemoSession = () => {
    // Reset the demo walkthrough and the in-memory UI state.
    completedDemoSteps = new Set<string>();
    selectedDemoStepIndex = null;
    completionModalShown = false;
    commandHistory.length = 0;
    historyIndex = -1;

    // Rebuild the simulated cluster so every lab starts from a clean state.
    protectZones = [];
    protectWorkloads = [];
    clusterEvents = [];
    gpuVfioBound = false;
    protectDaemonRestarted = false;

    closeCompletionModal();

    // A full reload is the safest way to restore all simulator state,
    // including the Webernetes cluster, pods, terminal output, and guide.
    window.location.reload();
  };

  let gpuVfioBound = false;
  let protectDaemonRestarted = false;

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
      internalIp: "172.31.28.21",
      externalIp: "<none>",
      osImage: "Webernetes Linux",
      kernelVersion: "6.18.44-edera-host",
      containerRuntime: "containerd://1.7.18",
      labels: {
        "beta.kubernetes.io/arch": "amd64",
        "beta.kubernetes.io/os": "linux",
        "kubernetes.io/arch": "amd64",
        "kubernetes.io/hostname": "node-1",
        "kubernetes.io/os": "linux",
        "node-role.kubernetes.io/control-plane": "",
        "node.kubernetes.io/exclude-from-external-load-balancers": "",
      },
    },
    {
      name: "node-2",
      status: "Ready",
      age: "5m",
      version: "v1.30.0-webernetes",
      internalIp: "172.31.28.22",
      externalIp: "<none>",
      osImage: "Webernetes Linux",
      kernelVersion: "6.18.44-edera-host",
      containerRuntime: "containerd://1.7.18",
      labels: {
        "beta.kubernetes.io/arch": "amd64",
        "beta.kubernetes.io/os": "linux",
        "kubernetes.io/arch": "amd64",
        "kubernetes.io/hostname": "node-2",
        "kubernetes.io/os": "linux",
        "node-role.kubernetes.io/worker": "",
      },
    },
    {
      name: "node-3",
      status: "Ready",
      age: "5m",
      version: "v1.30.0-webernetes",
      internalIp: "172.31.28.23",
      externalIp: "<none>",
      osImage: "Webernetes Linux",
      kernelVersion: "6.18.44-edera-host",
      containerRuntime: "containerd://1.7.18",
      labels: {
        "beta.kubernetes.io/arch": "amd64",
        "beta.kubernetes.io/os": "linux",
        "kubernetes.io/arch": "amd64",
        "kubernetes.io/hostname": "node-3",
        "kubernetes.io/os": "linux",
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

  // GPU passthrough is supported by the terminal simulator, but it is
  // intentionally not part of the core demo guide. The guided flow ends
  // after the existing zone-lifecycle verification.
  const REQUIRED_DEMO_STEP_IDS = PROTECT_DEMO_STEPS
    .filter((step) => !step.optional)
    .map((step) => step.id);

  const isDemoComplete = (): boolean =>
    REQUIRED_DEMO_STEP_IDS.every((stepId) =>
      completedDemoSteps.has(stepId),
    );

  const showCompletionModal = () => {
    if (completionModalShown || !isDemoComplete()) {
      return;
    }

    completionModalShown = true;

    completionModal.hidden = false;
    completionModal.style.display = "grid";
    completionClose.focus();
  };

  const hideCompletionModal = () => {
    closeCompletionModal();
  };

  // Always start with the modal closed. This protects against browsers or
  // dev servers restoring the previous DOM state after a refresh.
  closeCompletionModal();

  completionClose.addEventListener("click", hideCompletionModal);
  completionModalBackdrop.addEventListener("click", hideCompletionModal);
  restartDemoBtn.addEventListener("click", startNewDemoSession);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !completionModal.hidden) {
      hideCompletionModal();
    }
  });

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
                <span style="color:#a8cfca;font-weight:400;font-size:10px;">
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
              <div style="font-weight:600;font-size:13px;color:#f8fffd;">
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

        const isDestroyed = zone.state === "destroyed";

        return `
          <div class="zone-card${isDestroyed ? " zone-card-destroyed" : ""}">
            <div class="zone-top">
              <div>
                <div class="zone-name${isDestroyed ? " zone-name-destroyed" : ""}">
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
    const wasComplete = isDemoComplete();

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

    // Only trigger the popup on the transition from incomplete -> complete.
    // This prevents unrelated/repeated commands from opening it again.
    if (!wasComplete && isDemoComplete()) {
      requestAnimationFrame(() => {
        showCompletionModal();
      });
    }
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

  document
    .querySelector<HTMLButtonElement>("#hero-run-btn")!
    .addEventListener("click", () => {
      document
        .querySelector<HTMLElement>("#guide-panel")!
        .scrollIntoView({ behavior: "smooth", block: "start" });

      input.focus();
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
          ? deployment.runtimeClassName === "edera"
            ? nodes.find(
                (node) => node.labels["runtime"] === "edera",
              )
            : nodes.find(
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
    device?: string,
    kernelVariant?: string,
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
      device,
      kernelVariant,
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
      `<span style="color:#b8ff3c;">${escapeHtml(uuid)}</span>`,
    );
  };

  const renderProtectZoneList = () => {
    if (protectZones.length === 0) {
      printHtml(
        `<span style="color:#a8cfca;">No zones have been launched.</span>`,
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

    let html = `<span style="color:#00e5d4;font-weight:700;">${header}</span>\n`;
    html += `<span style="color:#08736d;">${divider}</span>\n`;

    for (const zone of protectZones) {
      const stateColor =
        zone.state === "ready"
          ? "#b8ff3c"
          : zone.state === "destroyed"
            ? "#a8cfca"
            : "#ffd166";

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
      `<span style="color:#dff7f0;">Destruction of zone ${escapeHtml(
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
        `<span style="color:#ff7373;">Invalid selector "${escapeHtml(
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
        `<span style="color:#a8cfca;">No active zones matched "${escapeHtml(
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
        `<span style="color:#b8ff3c;">Destroyed ${destroyedCount} zones matching "${escapeHtml(
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
        `<span style="color:#ff7373;">Error: zone "${escapeHtml(
          zoneIdentifier,
        )}" not found.</span>`,
      );
      return;
    }

    if (zone.state !== "ready") {
      printHtml(
        `<span style="color:#ff7373;">Error: zone "${escapeHtml(
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
        `<span style="color:#ff7373;">Error: workload "${escapeHtml(
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
      `<span style="color:#b8ff3c;">${escapeHtml(uuid)}</span>`,
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
        `<span style="color:#a8cfca;">No workloads have been launched.</span>`,
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

    let html = `<span style="color:#00e5d4;font-weight:700;">${header}</span>\n`;
    html += `<span style="color:#08736d;">${divider}</span>\n`;

    for (const workload of protectWorkloads) {
      const stateColor =
        workload.state === "running"
          ? "#b8ff3c"
          : workload.state === "destroyed"
            ? "#a8cfca"
            : "#ffd166";

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
        `<span style="color:#ff7373;">Error: workload "${escapeHtml(
          identifier,
        )}" not found.</span>`,
      );
      return;
    }

    if (workload.state === "destroyed") {
      printHtml(
        `<span style="color:#a8cfca;">Workload "${escapeHtml(
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
      `<span style="color:#b8ff3c;">Workload "${escapeHtml(
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
        `<span style="color:#ff7373;">Error: workload "${escapeHtml(
          identifier,
        )}" not found.</span>`,
      );
      return;
    }

    if (workload.state !== "running") {
      printHtml(
        `<span style="color:#ff7373;">Error: workload "${escapeHtml(
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

    if (/\blspci\b.*-Dknn|\b-Dknn\b.*\blspci\b/i.test(commandText)) {
      printPre(
        `<span style="color:#dff7f0;">${escapeHtml(
          NVIDIA_WORKLOAD_LSPCI,
        )}</span>`,
      );
      markDemoStepComplete("gpu-workload-pci");
    } else if (/\bnvidia-smi\b/i.test(commandText)) {
      printPre(
        `<span style="color:#dff7f0;">${escapeHtml(
          NVIDIA_SMI_OUTPUT,
        )}</span>`,
      );
      markDemoStepComplete("gpu-nvidia-smi");
    } else if (
      /\buname\s+-r\b/i.test(commandText) &&
      /grep.*edera|edera.*grep/i.test(commandText)
    ) {
      const kernelVersion = "6.18.44-edera-zone";

      printPre(
        `<span style="color:#b8ff3c;">${kernelVersion}</span>`,
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
        `<span style="color:#b8ff3c;">${kernelVersion}</span>`,
      );
    } else if (
      commandText.includes("echo Hello from inside Edera") ||
      commandText.includes("echo")
    ) {
      printHtml(
        `<span style="color:#dff7f0;">Hello from inside Edera</span>`,
      );
    } else if (
      commandText.includes("ls") ||
      commandText.includes("pwd")
    ) {
      printPre(
        `<span style="color:#dff7f0;">/bin\n/dev\n/etc\n/home\n/proc\n/root\n/tmp\n/usr\n/var</span>`,
      );
    } else {
      printHtml(
        `<span style="color:#a8cfca;">Executed inside ${escapeHtml(
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
            <code>ls -la</code>
            <span>Show all local demo files with read-only permissions and metadata.</span>
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
            <span>Show detailed simulated Pod config, status, events, and runtimeClass.</span>
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
            <code>kubectl label pod &lt;pod&gt; &lt;key&gt;=&lt;value&gt;</code>
            <span>Add or update a label on a simulated pod.</span>
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

          <div class="cli-help-command">
            <code>sudo lspci -Dknn -d ::03xx</code>
            <span>Inspect simulated GPU PCI devices and their current driver binding.</span>
          </div>

          <div class="cli-help-command">
            <code>sudo cat /var/lib/edera/protect/daemon.toml</code>
            <span>Inspect the simulated Protect GPU and NVIDIA kernel-variant configuration.</span>
          </div>

          <div class="cli-help-command">
            <code>sudo protect image list-kernel-variants</code>
            <span>Verify that the NVIDIA kernel variant is resolvable.</span>
          </div>

          <div class="cli-help-command">
            <code>sudo systemctl restart protect-daemon</code>
            <span>Restart the simulated Protect daemon after configuration changes.</span>
          </div>

          <div class="cli-help-command">
            <code>sudo modprobe vfio_iommu_type1 && sudo modprobe vfio_pci</code>
            <span>Simulate loading VFIO modules for KVM GPU passthrough.</span>
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
          Use <code style="color:#b8ff3c;">protect &lt;resource&gt; &lt;command&gt;</code>
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
            <span>Filter matches using the <code style="color:#b8ff3c;">status.state</code> field.</span>
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

          <div class="cli-help-command">
            <code>protect zone logs &lt;zone&gt;</code>
            <span>Show simulated zone boot and NVIDIA driver logs.</span>
          </div>

          <div class="cli-help-command">
            <code>protect image list-kernel-variants</code>
            <span>List configured zone kernel variants and their resolved images.</span>
          </div>
        </div>

        <div class="cli-help-section">
          <div class="cli-help-section-title">GPU passthrough</div>

          <div class="cli-help-command">
            <code>--device gpu0</code>
            <span>Attach the GPU named gpu0 in daemon.toml to a zone.</span>
          </div>

          <div class="cli-help-command">
            <code>--kernel-variant nvidia</code>
            <span>Launch the NVIDIA-enabled zone kernel variant.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload exec &lt;workload&gt; nvidia-smi</code>
            <span>Verify Tesla T4 access from inside a GPU workload.</span>
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
            <span>Alias for <code style="color:#b8ff3c;">protect --help</code>.</span>
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

    if (tokens[1] === "image") {
      if (tokens[2] === "list-kernel-variants") {
        printPre(
          `<span style="color:#dff7f0;">nvidia    ${escapeHtml(
            NVIDIA_KERNEL_VARIANT,
          )}    resolvable</span>`,
        );

        addEvent(
          "Normal",
          "KernelVariantResolved",
          "image/nvidia",
          "NVIDIA kernel variant is resolvable",
        );

        markDemoStepComplete("gpu-kernel-variant");
        return true;
      }

      printHtml(
        `<span style="color:#ff7373;">Unknown protect image command: ${escapeHtml(
          tokens.slice(2).join(" "),
        )}</span>`,
      );
      return true;
    }

    if (tokens[1] === "zone") {
      const subcommand = tokens[2];

      if (subcommand === "logs") {
        const zoneIdentifier = tokens[3];

        const zone = protectZones.find(
          (item) =>
            item.name === zoneIdentifier ||
            item.uuid === zoneIdentifier,
        );

        if (!zone) {
          printHtml(
            `<span style="color:#ff7373;">Error: zone "${escapeHtml(
              zoneIdentifier || "",
            )}" not found.</span>`,
          );
          return true;
        }

        if (zone.name !== "zone-gpu" || zone.kernelVariant !== "nvidia") {
          printHtml(
            `<span style="color:#a8cfca;">No NVIDIA driver logs are available for zone "${escapeHtml(
              zone.name,
            )}".</span>`,
          );
          return true;
        }

        printPre(
          `<span style="color:#dff7f0;">${escapeHtml(
            NVIDIA_ZONE_LOGS,
          )}</span>`,
        );

        addEvent(
          "Normal",
          "NvidiaDriverVerified",
          `zone/${zone.name}`,
          "NVIDIA driver initialized successfully",
        );

        markDemoStepComplete("gpu-zone-logs");
        return true;
      }

      if (subcommand === "list") {
        renderProtectZoneList();

        const hasDestroyedZone = protectZones.some(
          (zone) => zone.state === "destroyed",
        );

        markDemoStepComplete(
          hasDestroyedZone ? "final-list" : "zone-list",
        );

        if (protectZones.some((zone) => zone.name === "zone-gpu")) {
          markDemoStepComplete("gpu-zone-list");
        }

        return true;
      }

      if (subcommand === "launch") {
        let name = "";
        let minCpus = 1;
        let maxCpus = 2;
        let targetCpus = 2;
        let device = "";
        let kernelVariant = "";

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
          } else if (token === "--device") {
            device = tokens[++i] || "";
          } else if (token.startsWith("--device=")) {
            device = token.slice("--device=".length);
          } else if (token === "--kernel-variant") {
            kernelVariant = tokens[++i] || "";
          } else if (token.startsWith("--kernel-variant=")) {
            kernelVariant = token.slice("--kernel-variant=".length);
          }
        }

        if (!name) {
          printHtml(
            `<span style="color:#ff7373;">Error: zone name required. Usage: protect zone launch -n &lt;name&gt;</span>`,
          );
          return true;
        }

        if (device) {
          if (device !== "gpu0") {
            printHtml(
              `<span style="color:#ff7373;">Error: PCI device "${escapeHtml(
                device,
              )}" is not configured.</span>`,
            );
            return true;
          }

          if (!protectDaemonRestarted) {
            printHtml(
              `<span style="color:#ff7373;">Error: Protect daemon configuration has not been restarted. Run: sudo systemctl restart protect-daemon</span>`,
            );
            return true;
          }

          if (!gpuVfioBound) {
            printHtml(
              `<span style="color:#ff7373;">Error: GPU ${GPU_PCI_LOCATION} is not bound to vfio-pci. Complete the KVM VFIO setup first.</span>`,
            );
            return true;
          }

          if (kernelVariant !== "nvidia") {
            printHtml(
              `<span style="color:#ff7373;">Error: GPU zones require --kernel-variant nvidia.</span>`,
            );
            return true;
          }
        }

        launchProtectZone(
          name,
          minCpus,
          maxCpus,
          targetCpus,
          device || undefined,
          kernelVariant || undefined,
        );

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
            <span style="color:#ff7373;">Usage: protect zone destroy [OPTIONS] &lt;ZONE&gt;</span>
          `);
          return true;
        }

        destroyProtectZones(
          identifier,
          all,
          wait,
          selector || undefined,
        );

        if (identifier === "zone-gpu") {
          markDemoStepComplete("gpu-zone-destroy");
        }

        markDemoStepComplete("zone-destroy");

        return true;
      }

      printHtml(
        `<span style="color:#ff7373;">Unknown protect zone command: ${escapeHtml(
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

        if (protectWorkloads.some((workload) => workload.name === "workload-gpu")) {
          markDemoStepComplete("gpu-workload-list");
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
            <span style="color:#ff7373;">Usage:
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

        if (name === "workload-gpu" && zone === "zone-gpu") {
          addEvent(
            "Normal",
            "GpuWorkloadStarted",
            `workload/${name}`,
            "CUDA workload started with gpu0 attached",
          );
          markDemoStepComplete("gpu-workload-launch");
        }

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
            <span style="color:#ff7373;">Usage:
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
            `<span style="color:#ff7373;">Usage: protect workload destroy &lt;workload&gt; [--wait]</span>`,
          );
          return true;
        }

        destroyProtectWorkload(identifier);

        if (identifier === "workload-gpu") {
          markDemoStepComplete("gpu-workload-destroy");
        }

        markDemoStepComplete("workload-destroy");

        return true;
      }

      printHtml(
        `<span style="color:#ff7373;">Unknown protect workload command: ${escapeHtml(
          tokens.slice(2).join(" "),
        )}</span>`,
      );

      return true;
    }

    printHtml(
      `<span style="color:#ff7373;">Unknown protect command. Type "protect --help".</span>`,
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
          `<span style="color:#ff7373;">Error: pod name required.</span>`,
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
          `<span style="color:#ff7373;">Error from server (NotFound): namespaces "${escapeHtml(
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
          `<span style="color:#ff7373;">Error from server (AlreadyExists): pods "${escapeHtml(
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
        `<span style="color:#b8ff3c;">pod/${escapeHtml(
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
          `<span style="color:#ff7373;">Error: namespace name required.</span>`,
        );
        return true;
      }

      if (
        namespaces.some(
          (namespace) => namespace.name === namespaceName,
        )
      ) {
        printHtml(
          `<span style="color:#ff7373;">Error from server (AlreadyExists): namespaces "${escapeHtml(
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
        `<span style="color:#b8ff3c;">namespace/${escapeHtml(
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
          `<span style="color:#ff7373;">error: the path "${escapeHtml(
            fileName || "",
          )}" does not exist</span>`,
        );
        return true;
      }

      if (fileName === "nginx-deployment.yaml") {
        const deploymentName = "nginx";
        const runtimeReady = activeRuntimeClasses.has("edera");
        const existing = deployments.find((deployment) => deployment.name === deploymentName);

        if (existing) {
          printHtml(`<span style="color:#a8cfca;">deployment.apps/${deploymentName} unchanged</span>`);
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
        printHtml(`<span style="color:#b8ff3c;">deployment.apps/${deploymentName} created</span>`);
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
              `<span style="color:#b8ff3c;">pod/${escapeHtml(podName)} re-applied and recovered</span>`,
            );
          } else {
            printHtml(
              `<span style="color:#a8cfca;">pod/${escapeHtml(podName)} unchanged</span>`,
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
          `<span style="color:#b8ff3c;">pod/${podName} created</span>`,
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
          `<span style="color:#b8ff3c;">runtimeclass.node.k8s.io/edera created</span>`,
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
              `<span style="color:#b8ff3c;">pod/${podName} re-applied and recovered</span>`,
            );
          } else {
            printHtml(
              `<span style="color:#a8cfca;">pod/${podName} unchanged</span>`,
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
          `<span style="color:#b8ff3c;">pod/${podName} created</span>`,
        );

        return true;
      }

      return true;
    }

    /*
     * kubectl describe
     *
     * Keep this output as real preformatted terminal text. The previous
     * implementation mixed block HTML elements into <pre>, which caused large
     * vertical gaps and made the result look much looser than kubectl.
     */
    if (tokens[1] === "describe") {
      const resource = tokens[2];
      const name = tokens[3];

      if (!resource || !name) {
        printHtml(
          `<span style="color:#ff7373;">Usage: kubectl describe pod|node &lt;name&gt;</span>`,
        );
        return true;
      }

      if (resource === "pod" || resource === "pods") {
        const pod = pods.find(
          (item) => item.name === name && item.namespace === "default",
        );

        if (!pod) {
          printHtml(
            `<span style="color:#ff7373;">Error from server (NotFound): pods "${escapeHtml(
              name,
            )}" not found</span>`,
          );
          return true;
        }

        const podEvents = clusterEvents.filter(
          (event) => event.object === `pod/${pod.name}`,
        );
        const workload = protectWorkloads.find(
          (item) =>
            item.sourcePodName === pod.name &&
            item.state !== "destroyed",
        );

        const ready = pod.status === "Running";
        const containerName =
          pod.name === "demo-pod"
            ? "web"
            : pod.image.split("/").pop()?.split(":")[0] || pod.name;

        const nodeName =
          pod.node && pod.node !== "<none>" ? pod.node : "<none>";
        const podIp =
          pod.ip && pod.ip !== "<none>" ? pod.ip : "<none>";
        const runtimeClass = pod.runtimeClassName || "<none>";
        const workloadText = workload
          ? `${workload.name} (zone ${workload.zone})`
          : "<none>";

        const lines = [
          `Name:             ${pod.name}`,
          `Namespace:        ${pod.namespace}`,
          `Priority:         0`,
          `Service Account:  default`,
          `Node:             ${nodeName}`,
          `Start Time:       Thu, 09 Apr 2026 07:48:00 +0000`,
          `Labels:           ${formatLabels(pod.labels)}`,
          `Annotations:      <none>`,
          `Status:           ${pod.status}`,
          `IP:               ${podIp}`,
          `IPs:`,
          `  IP:  ${podIp}`,
          `Controlled By:     ${pod.ownerDeployment ? `Deployment/${pod.ownerDeployment}` : "<none>"}`,
          `RuntimeClass:     ${runtimeClass}`,
          `Edera Workload:   ${workloadText}`,
          `Containers:`,
          `  ${containerName}:`,
          `    Container ID:   containerd://webernetes-${pod.name}`,
          `    Image:          ${pod.image}`,
          `    Image ID:       ${pod.image}`,
          `    Port:           8080/TCP`,
          `    Host Port:      0/TCP`,
          `    State:          ${ready ? "Running" : pod.status}`,
          ready
            ? `      Started:      Thu, 09 Apr 2026 07:48:03 +0000`
            : `      Reason:       ${pod.status}`,
          `    Ready:          ${ready}`,
          `    Restart Count:  0`,
          `    Environment:    <none>`,
          `    Mounts:`,
          `      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access (ro)`,
          `Conditions:`,
          `  Type                        Status`,
          `  Initialized                 True`,
          `  Ready                       ${ready}`,
          `  ContainersReady             ${ready}`,
          `  PodScheduled                ${pod.status === "Pending" ? "False" : "True"}`,
          `Volumes:`,
          `  kube-api-access:`,
          `    Type:                    Projected (a volume that contains injected data from multiple sources)`,
          `    TokenExpirationSeconds:  3607`,
          `    ConfigMapName:           kube-root-ca.crt`,
          `    Optional:                false`,
          `    DownwardAPI:             true`,
          `QoS Class:                   Burstable`,
          `Node-Selectors:              <none>`,
          `Tolerations:                  node.kubernetes.io/not-ready:NoExecute op=Exists for 300s`,
          `                              node.kubernetes.io/unreachable:NoExecute op=Exists for 300s`,
          `Events:`,
          `  Type     Reason      Age   From     Message`,
          `  ----     ------      ----  ----     -------`,
          ...(podEvents.length > 0
            ? podEvents
                .slice(0, 8)
                .map(
                  (event) =>
                    `  ${event.type.padEnd(8)} ${event.reason.padEnd(12)} 1m    kubelet  ${event.message}`,
                )
            : [
                `  Normal   Scheduled   2m    kubelet  Successfully assigned ${pod.namespace}/${pod.name} to ${nodeName}`,
                `  Normal   Pulled      2m    kubelet  Container image "${pod.image}" already present`,
                `  Normal   Created     2m    kubelet  Created container ${containerName}`,
                `  Normal   Started     2m    kubelet  Started container ${containerName}`,
              ]),
        ];

        printPre(escapeHtml(lines.join("\n")));
        return true;
      }

      if (resource === "node" || resource === "nodes") {
        const node = nodes.find((item) => item.name === name);

        if (!node) {
          printHtml(
            `<span style="color:#ff7373;">Error from server (NotFound): nodes "${escapeHtml(
              name,
            )}" not found</span>`,
          );
          return true;
        }

        const nodePods = pods.filter((pod) => pod.node === node.name);
        const roles = getNodeRoles(node);
        const nodeEvents = clusterEvents.filter(
          (event) => event.object === `node/${node.name}`,
        );

        const lines = [
          `Name:               ${node.name}`,
          `Roles:              ${roles}`,
          `Labels:             ${formatLabels(node.labels)}`,
          `Annotations:        <none>`,
          `CreationTimestamp:  Thu, 09 Apr 2026 07:42:00 +0000`,
          `Taints:             <none>`,
          `Unschedulable:      false`,
          `Conditions:`,
          `  Type             Status  LastHeartbeatTime`,
          `  Ready            True    Thu, 09 Apr 2026 07:53:00 +0000`,
          `Addresses:`,
          `  InternalIP:  172.31.28.${node.name.replace("node-", "2")}`,
          `Capacity:`,
          `  cpu:                2`,
          `  memory:             4Gi`,
          `  pods:               110`,
          `Allocatable:`,
          `  cpu:                2`,
          `  memory:             4Gi`,
          `  pods:               110`,
          `System Info:`,
          `  Kernel Version:             6.18.44-edera-host`,
          `  Kubelet Version:            ${node.version}`,
          `Non-terminated Pods:          (${nodePods.length} in total)`,
          ...(nodePods.length > 0
            ? nodePods.map(
                (pod) =>
                  `  Namespace  Name                 Status`,
              ).slice(0, 1)
                .concat(
                  nodePods.map(
                    (pod) =>
                      `  ${pod.namespace.padEnd(10)} ${pod.name.padEnd(20)} ${pod.status}`,
                  ),
                )
            : [`  No pods assigned.`]),
          `Events:`,
          `  Type     Reason      Age   From     Message`,
          `  ----     ------      ----  ----     -------`,
          ...(nodeEvents.length > 0
            ? nodeEvents.slice(0, 8).map(
                (event) =>
                  `  ${event.type.padEnd(8)} ${event.reason.padEnd(12)} 1m    kubelet  ${event.message}`,
              )
            : [`  Normal   Ready       5m    kubelet  Node ${node.name} is Ready`]),
        ];

        printPre(escapeHtml(lines.join("\n")));
        return true;
      }

      printHtml(
        `<span style="color:#ff7373;">Error: describe for resource "${escapeHtml(
          resource,
        )}" is not supported.</span>`,
      );
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

        /*
         * Match kubectl's standard pod output modes independently:
         *
         *   kubectl get pods
         *   kubectl get pods --show-labels
         *   kubectl get pods -o wide
         *   kubectl get pods -A --show-labels
         *   kubectl get pods -A -o wide --show-labels
         *
         * NODE must only appear in wide output. LABELS must only appear when
         * explicitly requested.
         */
        const showLabels = tokens.includes("--show-labels");

        const outputFormatIndex = tokens.findIndex(
          (token) => token === "-o" || token === "--output",
        );
        const outputFormat =
          outputFormatIndex >= 0
            ? (tokens[outputFormatIndex + 1] || "")
            : "";

        const wide =
          outputFormat === "wide" ||
          tokens.includes("-o=wide") ||
          tokens.includes("--output=wide");

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
            `<span style="color:#a8cfca;">No resources found.</span>`,
          );
          return true;
        }

        const nameWidth = Math.max(
          21,
          ...filtered.map((pod) => pod.name.length + 2),
        );
        const namespaceWidth = Math.max(
          11,
          ...filtered.map((pod) => pod.namespace.length + 2),
        );
        const readyWidth = 8;
        const statusWidth = 11;
        const restartsWidth = 10;
        const ageWidth = Math.max(
          6,
          ...filtered.map((pod) => pod.age.length + 2),
        );
        const ipWidth = Math.max(
          16,
          ...filtered.map((pod) => (pod.ip || "<none>").length + 2),
        );
        const nodeWidth = Math.max(
          16,
          ...filtered.map(
            (pod) => (pod.node || "<none>").length + 2,
          ),
        );
        const nominatedNodeWidth = 17;
        const readinessGatesWidth = 17;
        const labelWidth = Math.max(
          24,
          ...filtered.map(
            (pod) => formatLabels(pod.labels).length + 2,
          ),
        );

        const headerColumns: string[] = [];

        if (allNamespaces) {
          headerColumns.push("NAMESPACE".padEnd(namespaceWidth));
        }

        headerColumns.push(
          "NAME".padEnd(nameWidth),
          "READY".padEnd(readyWidth),
          "STATUS".padEnd(statusWidth),
          "RESTARTS".padEnd(restartsWidth),
          "AGE".padEnd(ageWidth),
        );

        if (wide) {
          headerColumns.push(
            "IP".padEnd(ipWidth),
            "NODE".padEnd(nodeWidth),
            "NOMINATED NODE".padEnd(nominatedNodeWidth),
            "READINESS GATES".padEnd(readinessGatesWidth),
          );
        }

        if (showLabels) {
          headerColumns.push("LABELS".padEnd(labelWidth));
        }

        let html =
          `<span style="color:#00e5d4;font-weight:700;">` +
          headerColumns.join("") +
          `</span>\n`;

        const tableWidth =
          (allNamespaces ? namespaceWidth : 0) +
          nameWidth +
          readyWidth +
          statusWidth +
          restartsWidth +
          ageWidth +
          (wide
            ? ipWidth +
              nodeWidth +
              nominatedNodeWidth +
              readinessGatesWidth
            : 0) +
          (showLabels ? labelWidth : 0);

        html += `<span style="color:#08736d;">${"─".repeat(
          Math.max(70, tableWidth),
        )}</span>\n`;

        for (const pod of filtered) {
          const statusColor =
            pod.status === "Running"
              ? "#b8ff3c"
              : pod.status === "Failed"
                ? "#ff7373"
                : "#ffd166";

          const rowParts: string[] = [];

          if (allNamespaces) {
            rowParts.push(
              escapeHtml(
                pod.namespace.padEnd(namespaceWidth),
              ),
            );
          }

          rowParts.push(
            escapeHtml(pod.name.padEnd(nameWidth)),
            `${pod.status === "Running" ? "1/1" : "0/1"}`.padEnd(readyWidth),
            `<span style="color:${statusColor};">${escapeHtml(
              pod.status.padEnd(statusWidth),
            )}</span>`,
            "0".padEnd(restartsWidth),
            escapeHtml(pod.age.padEnd(ageWidth)),
          );

          if (wide) {
            rowParts.push(
              escapeHtml((pod.ip || "<none>").padEnd(ipWidth)),
              escapeHtml(
                (pod.node || "<none>").padEnd(nodeWidth),
              ),
              "<none>".padEnd(nominatedNodeWidth),
              "<none>".padEnd(readinessGatesWidth),
            );
          }

          if (showLabels) {
            rowParts.push(
              escapeHtml(formatLabels(pod.labels)),
            );
          }

          html += `${rowParts.join("")}\n`;
        }

        printPre(html.trimEnd());

        return true;
      }

      if (
        resource === "nodes" ||
        resource === "node"
      ) {
        /*
         * Support the same output modifiers people expect from a real
         * `kubectl get nodes` command:
         *
         *   kubectl get nodes
         *   kubectl get nodes -o wide
         *   kubectl get nodes --show-labels
         *   kubectl get nodes -o wide --show-labels
         */
        const showLabels = tokens.includes("--show-labels");

        const outputFormatIndex = tokens.findIndex(
          (token) => token === "-o" || token === "--output",
        );
        const outputFormat =
          outputFormatIndex >= 0
            ? (tokens[outputFormatIndex + 1] || "")
            : "";

        const wide =
          outputFormat === "wide" ||
          tokens.includes("-o=wide") ||
          tokens.includes("--output=wide");

        const nameWidth = Math.max(
          11,
          ...nodes.map((node) => node.name.length + 2),
        );
        const statusWidth = Math.max(
          11,
          ...nodes.map((node) => node.status.length + 2),
        );
        const rolesWidth = Math.max(
          15,
          ...nodes.map((node) => getNodeRoles(node).length + 2),
        );
        const ageWidth = Math.max(
          7,
          ...nodes.map((node) => node.age.length + 2),
        );
        const versionWidth = Math.max(
          20,
          ...nodes.map((node) => node.version.length + 2),
        );
        const internalIpWidth = Math.max(
          16,
          ...nodes.map((node) => node.internalIp.length + 2),
        );
        const externalIpWidth = Math.max(
          16,
          ...nodes.map((node) => node.externalIp.length + 2),
        );
        const osImageWidth = Math.max(
          18,
          ...nodes.map((node) => node.osImage.length + 2),
        );
        const kernelWidth = Math.max(
          22,
          ...nodes.map((node) => node.kernelVersion.length + 2),
        );
        const runtimeWidth = Math.max(
          22,
          ...nodes.map((node) => node.containerRuntime.length + 2),
        );
        const labelWidth = Math.max(
          40,
          ...nodes.map(
            (node) => formatLabels(node.labels).length + 2,
          ),
        );

        const headerColumns = [
          "NAME".padEnd(nameWidth),
          "STATUS".padEnd(statusWidth),
          "ROLES".padEnd(rolesWidth),
          "AGE".padEnd(ageWidth),
          "VERSION".padEnd(versionWidth),
        ];

        if (wide) {
          headerColumns.push(
            "INTERNAL-IP".padEnd(internalIpWidth),
            "EXTERNAL-IP".padEnd(externalIpWidth),
            "OS-IMAGE".padEnd(osImageWidth),
            "KERNEL-VERSION".padEnd(kernelWidth),
            "CONTAINER-RUNTIME".padEnd(runtimeWidth),
          );
        }

        if (showLabels) {
          headerColumns.push("LABELS".padEnd(labelWidth));
        }

        let html =
          `<span style="color:#00e5d4;font-weight:700;">` +
          headerColumns.join("") +
          `</span>\n`;

        const tableWidth =
          nameWidth +
          statusWidth +
          rolesWidth +
          ageWidth +
          versionWidth +
          (wide
            ? internalIpWidth +
              externalIpWidth +
              osImageWidth +
              kernelWidth +
              runtimeWidth
            : 0) +
          (showLabels ? labelWidth : 0);

        html += `<span style="color:#08736d;">${"─".repeat(
          Math.max(70, tableWidth),
        )}</span>\n`;

        for (const node of nodes) {
          const rowParts = [
            escapeHtml(node.name.padEnd(nameWidth)),
            `<span style="color:#b8ff3c;">${escapeHtml(
              node.status.padEnd(statusWidth),
            )}</span>`,
            escapeHtml(getNodeRoles(node).padEnd(rolesWidth)),
            escapeHtml(node.age.padEnd(ageWidth)),
            escapeHtml(node.version.padEnd(versionWidth)),
          ];

          if (wide) {
            rowParts.push(
              escapeHtml(node.internalIp.padEnd(internalIpWidth)),
              escapeHtml(node.externalIp.padEnd(externalIpWidth)),
              escapeHtml(node.osImage.padEnd(osImageWidth)),
              escapeHtml(node.kernelVersion.padEnd(kernelWidth)),
              escapeHtml(node.containerRuntime.padEnd(runtimeWidth)),
            );
          }

          if (showLabels) {
            rowParts.push(
              escapeHtml(formatLabels(node.labels)),
            );
          }

          html += `${rowParts.join("")}\n`;
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
          printHtml(`<span style="color:#a8cfca;">No resources found.</span>`);
          return true;
        }

        let html = `<span style="color:#00e5d4;font-weight:700;">NAME                 READY   UP-TO-DATE   AVAILABLE</span>\n`;
        html += `<span style="color:#08736d;">${"─".repeat(65)}</span>\n`;

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
          `<span style="color:#00e5d4;font-weight:700;">` +
          `NAME                  STATUS     AGE` +
          `</span>\n`;

        html += `<span style="color:#08736d;">${"─".repeat(
          45,
        )}</span>\n`;

        for (const namespace of namespaces) {
          html +=
            `${escapeHtml(
              namespace.name.padEnd(22),
            )}` +
            `<span style="color:#b8ff3c;">${escapeHtml(
              namespace.status.padEnd(11),
            )}</span>` +
            `${escapeHtml(namespace.age)}\n`;
        }

        printPre(html.trimEnd());

        return true;
      }
    }

    /*
     * kubectl label pod
     */
    if (
      tokens[1] === "label" &&
      (tokens[2] === "pod" ||
        tokens[2] === "pods")
    ) {
      const podName = tokens[3];
      const labelExpression = tokens[4];

      const pod = pods.find(
        (item) => item.name === podName,
      );

      if (!pod) {
        printHtml(
          `<span style="color:#ff7373;">Error from server (NotFound): pods "${escapeHtml(
            podName || "",
          )}" not found</span>`,
        );
        return true;
      }

      if (!labelExpression) {
        printHtml(
          `<span style="color:#ff7373;">Error: label required.</span>`,
        );
        return true;
      }

      if (!pod.labels) {
        pod.labels = {};
      }

      if (labelExpression.includes("=")) {
        const [key, ...valueParts] =
          labelExpression.split("=");

        pod.labels[key] = valueParts.join("=") || "";
      } else {
        pod.labels[labelExpression] = "";
      }

      addEvent(
        "Normal",
        "Labeled",
        `pod/${pod.name}`,
        `Pod labeled with ${labelExpression}`,
      );

      printHtml(
        `<span style="color:#b8ff3c;">pod/${escapeHtml(
          pod.name,
        )} labeled</span>`,
      );

      updateDashboard();

      return true;
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
          `<span style="color:#ff7373;">Error from server (NotFound): nodes "${escapeHtml(
            nodeName || "",
          )}" not found</span>`,
        );
        return true;
      }

      if (!labelExpression) {
        printHtml(
          `<span style="color:#ff7373;">Error: label required.</span>`,
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
        `<span style="color:#b8ff3c;">node/${escapeHtml(
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
          `<span style="color:#ff7373;">error: the path "${escapeHtml(
            fileName || "",
          )}" does not exist</span>`,
        );
        return true;
      }

      if (fileName === "runtimeclass-edera.yaml") {
        if (!activeRuntimeClasses.has("edera")) {
          printHtml(
            `<span style="color:#a8cfca;">runtimeclass.node.k8s.io/edera not found</span>`,
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
          `<span style="color:#b8ff3c;">runtimeclass.node.k8s.io/edera deleted</span>`,
        );

        if (affectedPods.length > 0) {
          printHtml(
            `<span style="color:#ffd166;">${affectedPods.length} Edera pod${
              affectedPods.length === 1 ? "" : "s"
            } moved to Failed because RuntimeClass "edera" is no longer available. Recreate the RuntimeClass to recover the pod, or re-apply its manifest.</span>`,
          );
        }

        updateDashboard();
        return true;
      }

      if (fileName === "nginx-deployment.yaml") {
        const deploymentName = "nginx";
        const index = deployments.findIndex((deployment) => deployment.name === deploymentName);
        if (index === -1) {
          printHtml(`<span style="color:#a8cfca;">deployment.apps/${deploymentName} not found</span>`);
          return true;
        }
        const ownedPods = pods.filter((pod) => pod.ownerDeployment === deploymentName);
        pods = pods.filter((pod) => pod.ownerDeployment !== deploymentName);
        deployments.splice(index, 1);
        protectWorkloads = protectWorkloads.filter((workload) => !ownedPods.some((pod) => pod.name === workload.sourcePodName));
        addEvent("Normal", "Deleted", `deployment/${deploymentName}`, `deployment.apps/${deploymentName} deleted`);
        updateDashboard();
        printHtml(`<span style="color:#b8ff3c;">deployment.apps/${deploymentName} deleted</span>`);
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
            `<span style="color:#a8cfca;">pod/${escapeHtml(
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
          `<span style="color:#b8ff3c;">pod/${escapeHtml(
            deletedPod.name,
          )} deleted</span>`,
        );

        return true;
      }

      printHtml(
        `<span style="color:#ff7373;">error: delete for "${escapeHtml(
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
          `<span style="color:#ff7373;">Error from server (NotFound): pods "${escapeHtml(
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
        `<span style="color:#b8ff3c;">pod "${escapeHtml(
          podName,
        )}" deleted</span>`,
      );

      if (owningDeployment) {
        printHtml(
          `<span style="color:#00e5d4;">Deployment ${escapeHtml(
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
          `<span style="color:#ff7373;">Error from server (NotFound): nodes "${escapeHtml(
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
        `<span style="color:#b8ff3c;">node "${escapeHtml(
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
        <div style="color:#f8fffd;">
          Webernetes cluster online!
        </div>

        <div style="color:#a8cfca;margin-top:5px;">
          Try the suggested Edera command below,
          or type <span style="color:#b8ff3c;">help</span>.
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

        let tokens = tokenize(rawCmd);

        // The real commands in the GPU walkthrough are documented with sudo.
        // Keep sudo visible in command history/output while simulating the
        // underlying command itself.
        if (tokens[0] === "sudo") {
          tokens = tokens.slice(1);
        }

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
              `<span style="color:#a8cfca;">No command history.</span>`,
            );
            return;
          }

          const historyHtml = commandHistory
            .map(
              (command, index) =>
                `<span style="color:#a8cfca;">${String(
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
         * Read-only editor protection
         *
         * The demo exposes manifests as immutable local files. They may be
         * read or applied, but interactive editors are explicitly blocked.
         */
        if (tokens[0] === "vi" || tokens[0] === "nano") {
          const editor = escapeHtml(tokens[0]);

          printHtml(
            `<span style="color:#ff7373;">${editor}: this demo filesystem is read-only; editing local files is not permitted.</span>`,
          );

          addEvent(
            "Warning",
            "ReadOnlyFilesystem",
            "terminal",
            `${tokens[0]} attempted to modify a read-only demo file`,
          );

          return;
        }

        /*
         * GPU / host utilities
         *
         * These commands are simulated so the browser demo can demonstrate
         * the complete GPU passthrough workflow without touching the user's
         * actual host or filesystem.
         */
        if (
          tokens[0] === "lspci" &&
          tokens.includes("-Dknn") &&
          tokens.includes("-d") &&
          tokens.includes("::03xx")
        ) {
          printPre(
            `<span style="color:#dff7f0;">${escapeHtml(
              gpuVfioBound ? GPU_LSPCI_VFIO : GPU_LSPCI_UNBOUND,
            )}</span>`,
          );

          addEvent(
            "Normal",
            "GpuPciInspected",
            "pci/gpu0",
            gpuVfioBound
              ? `GPU ${GPU_PCI_LOCATION} is bound to vfio-pci`
              : `GPU ${GPU_PCI_LOCATION} detected with vendor/device ID ${GPU_PCI_ID}`,
          );

          markDemoStepComplete("gpu-lspci");
          if (gpuVfioBound) {
            markDemoStepComplete("gpu-vfio-verify");
          }

          return;
        }

        if (
          tokens[0] === "systemctl" &&
          tokens[1] === "restart" &&
          tokens[2] === "protect-daemon"
        ) {
          protectDaemonRestarted = true;

          printHtml(
            `<span style="color:#b8ff3c;">Protect daemon restarted successfully.</span>`,
          );

          addEvent(
            "Normal",
            "ProtectDaemonRestarted",
            "protect-daemon",
            "Protect daemon restarted with the current GPU configuration",
          );

          markDemoStepComplete("gpu-daemon-restart");
          return;
        }

        if (
          tokens[0] === "modprobe" &&
          (tokens.includes("vfio_pci") || tokens.includes("vfio-pci"))
        ) {
          gpuVfioBound = true;

          printHtml(
            `<span style="color:#b8ff3c;">vfio_pci loaded; ${GPU_PCI_LOCATION} bound to vfio-pci.</span>`,
          );

          addEvent(
            "Normal",
            "VfioBound",
            `pci/${GPU_PCI_LOCATION}`,
            `NVIDIA GPU ${GPU_PCI_ID} is now bound to vfio-pci`,
          );

          markDemoStepComplete("gpu-vfio-load");
          return;
        }

        /*
         * ls
         *
         * `ls` keeps the existing compact listing.
         * `ls -l` and `ls -la` expose a realistic long listing showing that
         * all demo manifests are readable but not writable.
         */
        if (tokens[0] === "ls") {
          const requestedFlags = tokens.slice(1);
          const supportedLongListing =
            requestedFlags.length > 0 &&
            requestedFlags.every(
              (flag) =>
                flag === "-l" ||
                flag === "-a" ||
                flag === "-la" ||
                flag === "-al",
            ) &&
            requestedFlags.some(
              (flag) =>
                flag === "-l" ||
                flag === "-la" ||
                flag === "-al",
            );

          if (requestedFlags.length === 0) {
            const files = Object.keys(localFiles)
              .map(
                (file) =>
                  `<span style="color:#5e9f2d;font-weight:600;">${escapeHtml(
                    file,
                  )}</span>`,
              )
              .join("  ");

            printHtml(files);
            return;
          }

          if (supportedLongListing) {
            const fileNames = Object.keys(localFiles);

            const totalSize = fileNames.reduce(
              (sum, file) =>
                sum + (localFileMetadata[file]?.size || localFiles[file].length),
              0,
            );

            const longListing = [
              `total ${totalSize}`,
              `${READ_ONLY_DIRECTORY_MODE} 1 user 197609        0 Apr  9 07:53 ./`,
              `dr-xr-xr-x 1 user 197609        0 Apr  9 07:42 ../`,
              ...fileNames.map((file) => {
                const metadata = localFileMetadata[file] || {
                  size: localFiles[file].length,
                  modified: "Apr  9 07:48",
                };

                return `${READ_ONLY_FILE_MODE} 1 user 197609 ${String(
                  metadata.size,
                ).padStart(8, " ")} ${metadata.modified} ${file}`;
              }),
            ].join("\n");

            printPre(
              `<span style="color:#dff7f0;">${escapeHtml(
                longListing,
              )}</span>`,
            );

            return;
          }

          printHtml(
            `<span style="color:#ff7373;">ls: unsupported option. Try: ls or ls -la</span>`,
          );

          return;
        }

        /*
         * cat
         */
        if (tokens[0] === "cat") {
          const fileName = tokens[1];

          if (fileName === "/var/lib/edera/protect/daemon.toml") {
            printPre(
              `<span style="color:#dff7f0;">${escapeHtml(
                GPU_DAEMON_TOML,
              )}</span>`,
            );

            markDemoStepComplete("gpu-daemon-config");
            return;
          }

          if (fileName === "/etc/modprobe.d/gpu-vfio.conf") {
            printPre(
              `<span style="color:#dff7f0;">${escapeHtml(
                GPU_VFIO_MODPROBE,
              )}</span>`,
            );

            markDemoStepComplete("gpu-vfio-config");
            return;
          }

          if (fileName === "/etc/modules-load.d/gpu-vfio.conf") {
            printPre(
              `<span style="color:#dff7f0;">${escapeHtml(
                GPU_MODULES_LOAD,
              )}</span>`,
            );

            markDemoStepComplete("gpu-vfio-config");
            return;
          }

          if (!fileName) {
            printHtml(
              `<span style="color:#ff7373;">cat: missing file operand</span>`,
            );
          } else if (localFiles[fileName]) {
            printPre(
              escapeHtml(localFiles[fileName]),
            );
          } else {
            printHtml(
              `<span style="color:#ff7373;">cat: ${escapeHtml(
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
              `<span style="color:#b8ff3c;">${hostKernelVersion}</span>`,
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
              `<span style="color:#ff7373;">uname: unsupported option. Try: uname -r</span>`,
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
              `<span style="color:#dff7f0;">${escapeHtml(
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
              `<span style="color:#ff7373;">curl: (7) Failed to connect: ${escapeHtml(
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
          `<span style="color:#ff7373;">command not found: ${escapeHtml(
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
      <div style="color:#ff7373;">
        Error initializing cluster:
        ${escapeHtml(error?.message || String(error))}
      </div>
    `;
  }
}

initTerminalDemo();
