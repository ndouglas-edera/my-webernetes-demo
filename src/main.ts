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
  nodeSelector?: Record<string, string>;
  volumeClaimName?: string;
  volumeMode?: "Filesystem" | "Block";
  volumeTargetPath?: string;
}

interface LocalPersistentVolumeClaim {
  name: string;
  namespace: string;
  status: "Pending" | "Bound";
  volumeName: string;
  capacity: string;
  accessModes: string;
  volumeMode: "Filesystem" | "Block";
  storageClassName?: string;
  formatted: boolean;
}

interface LocalPersistentVolume {
  name: string;
  status: "Available" | "Bound";
  claimName?: string;
  capacity: string;
  accessModes: string;
  volumeMode: "Filesystem" | "Block";
  storageClassName?: string;
  source: "CSI" | "Local";
  devicePath?: string;
  nodeAffinity?: string;
  formatted: boolean;
}

interface LocalJob {
  name: string;
  namespace: string;
  completions: number;
  succeeded: number;
  status: "Running" | "Complete";
  image: string;
  runtimeClassName?: string;
  targetDevice?: string;
  claimName?: string;
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
  annotations:
    dev.edera/cpu: "4"
spec:
  runtimeClassName: edera
  containers:
  - name: nginx
    image: nginx
    imagePullPolicy: IfNotPresent
    resources:
      requests:
        cpu: "4"`;

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
  namespace: edera
spec:
  runtimeClassName: edera
  containers:
  - name: hardened-vessel
    image: denhamparry/leaky-vessel:0.1
    imagePullPolicy: Always
    env:
    - name: SUPER_ORCHESTRATOR_SECRET
      value: "this-is-fine-hardened"`;

const CSI_BLOCK_PVC_YAML_CONTENT = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-app-data
spec:
  volumeMode: Block
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: gp3`;

const FORMAT_BLOCK_DEVICE_YAML_CONTENT = `apiVersion: batch/v1
kind: Job
metadata:
  name: format-block-device
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: formatter
        image: alpine:latest
        command: ["/bin/sh", "-c"]
        args:
          - |
            apk add --no-cache e2fsprogs
            echo "Formatting block device to ext4..."
            mkfs.ext4 /dev/data
            echo "Format complete."
        volumeDevices:
        - name: data
          devicePath: /dev/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: my-app-data`;

const CSI_BLOCK_DEPLOYMENT_YAML_CONTENT = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      annotations:
        dev.edera/resource-policy: "static"
    spec:
      runtimeClassName: edera
      containers:
      - name: app
        image: my-app:latest
        volumeDevices:
        - name: data
          devicePath: /var/lib/my-app/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: my-app-data`;

const FILESYSTEM_PVC_YAML_CONTENT = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-app-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: gp3`;

const FILESYSTEM_DEPLOYMENT_YAML_CONTENT = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      annotations:
        dev.edera/resource-policy: "static"
    spec:
      runtimeClassName: edera
      containers:
      - name: app
        image: my-app:latest
        volumeMounts:
        - name: data
          mountPath: /var/lib/my-app/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: my-app-data`;

const LOCAL_NVME_PV_YAML_CONTENT = `kind: PersistentVolume
apiVersion: v1
metadata:
  name: local-raw-pv
spec:
  volumeMode: Block
  capacity:
    storage: 5Gi
  local:
    path: /dev/nvme0n1
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Delete
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values:
                - my-host`;

const LOCAL_NVME_PVC_YAML_CONTENT = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: local-block-pvc
spec:
  accessModes:
    - ReadWriteOnce
  volumeMode: Block
  resources:
    requests:
      storage: 5Gi`;

const LOCAL_NVME_DEPLOYMENT_YAML_CONTENT = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      annotations:
        dev.edera/resource-policy: "static"
    spec:
      runtimeClassName: edera
      nodeSelector:
        kubernetes.io/hostname: my-host
      containers:
      - name: app
        image: my-app:latest
        volumeDevices:
        - name: data
          devicePath: /mnt/high-perf-storage
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: local-block-pvc`;

const FALCO_EDERA_CONFIG_YAML = `plugins:
  - name: container
    library_path: libcontainer.so
    init_config:
      label_max_len: 100
      with_size: false
  - name: edera
    library_path: /var/lib/edera/protect/falco/libedera_falco_plugin.so
load_plugins: [edera]`;

const FALCO_EDERA_RULES_YAML = `- rule: Edera Proc Environ Read
  desc: >
    Detect reads of /proc/*/environ inside an Edera zone.
    Credential harvesting via procfs is a common post-exploitation
    technique for extracting secrets from neighboring workloads.
  source: edera_zone
  output: >
    Credential harvesting attempt in zone
    (zone_id=%edera.zone.id proc=%proc.exe file=%fd.name)
  priority: WARNING
  condition: >
    evt.pluginname == "edera" and
    evt.type in (open, openat) and
    fd.name glob /proc/*/environ

- rule: Edera Reverse Shell Tool
  desc: >
    Detect execution of common reverse shell tools inside an Edera zone.
    Legitimate workloads rarely invoke netcat, socat, or similar tools.
  source: edera_zone
  output: >
    Reverse shell tool executed in zone
    (zone_id=%edera.zone.id proc=%proc.exe cmdline=%proc.cmdline)
  priority: CRITICAL
  condition: >
    evt.pluginname == "edera" and
    evt.type in (execve, execveat) and
    proc.name in (nc, ncat, netcat, socat, telnet)

- rule: Edera Namespace Escape Attempt
  desc: >
    Detect nsenter execution inside an Edera zone.
    nsenter is commonly used in container escape and privilege
    escalation attacks to enter host or other container namespaces.
  source: edera_zone
  output: >
    Namespace escape attempt in zone
    (zone_id=%edera.zone.id proc=%proc.exe cmdline=%proc.cmdline)
  priority: CRITICAL
  condition: >
    evt.pluginname == "edera" and
    evt.type in (execve, execveat) and
    proc.name == nsenter

- rule: Edera Sensitive File Read
  desc: >
    Detect reads of sensitive system files inside an Edera zone,
    including credential stores and security-critical configuration.
  source: edera_zone
  output: >
    Sensitive file read in zone
    (zone_id=%edera.zone.id proc=%proc.exe file=%fd.name)
  priority: WARNING
  condition: >
    evt.pluginname == "edera" and
    evt.type in (open, openat) and
    (fd.name startswith /etc/shadow or
     fd.name startswith /etc/kubernetes or
     fd.name startswith /run/secrets)

- rule: Edera Outbound Connection
  desc: Detect outbound network connections from Edera zones
  source: edera_zone
  output: >
    Outbound connection from zone
    (zone_id=%edera.zone.id proc=%proc.exe dest=%fd.rip:%fd.rport
    proto=%fd.l4proto)
  priority: NOTICE
  condition: >
    evt.pluginname == "edera" and
    evt.type == connect and
    fd.type == ipv4`;

const FALCO_HELM_VALUES_YAML = `# Mount Edera plugin and daemon socket from host into Falco pods
mounts:
  volumes:
    - name: edera-plugin
      hostPath:
        path: /var/lib/edera/protect/falco
    - name: edera-daemon-socket
      hostPath:
        path: /var/lib/edera/protect

  volumeMounts:
    - name: edera-plugin
      mountPath: /var/lib/edera/protect/falco
      readOnly: true
    - name: edera-daemon-socket
      mountPath: /var/lib/edera/protect
      readOnly: false

falco:
  plugins:
    - name: edera
      library_path: /var/lib/edera/protect/falco/libedera_falco_plugin.so

  load_plugins: [edera]

customRules:
  edera-rules.yaml: |-
    - rule: Edera Proc Environ Read
      desc: >
        Detect reads of /proc/*/environ inside an Edera zone.
        Credential harvesting via procfs is a common post-exploitation
        technique for extracting secrets from neighboring workloads.
      source: edera_zone
      output: >
        Credential harvesting attempt in zone
        (zone_id=%edera.zone.id proc=%proc.exe file=%fd.name)
      priority: WARNING
      condition: >
        evt.pluginname == "edera" and
        evt.type in (open, openat) and
        fd.name glob /proc/*/environ

    - rule: Edera Process Execution
      desc: Logs process executions inside Edera zones
      source: edera_zone
      output: >
        Process executed in zone
        (zone_id=%edera.zone.id proc=%proc.exe cmdline=%proc.cmdline)
      priority: NOTICE
      condition: >
        evt.pluginname == "edera" and
        evt.type in (execve, execveat)`;

const PROTECT_DEMO_STEPS: DemoStep[] = [
  {
    id: "zone-launch",
    title: "Create an isolated Edera zone",
    description:
      "Launch a lightweight Edera <code class='guide-code'>Zone</code>. The <code class='guide-code'>--wait</code> flag waits until the zone is <code class='guide-code'>READY</code>.",
    command:
      "protect zone launch -n test-zone --min-cpus 1 -C 2 -c 2 --wait",
  },
  {
    id: "zone-list",
    title: "Inspect the zone",
    description:
      "List the <code class='guide-code'>Zones</code> managed by Edera and inspect its networking information.",
    command: "protect zone list",
  },
  {
    id: "edera-runtimeclass-apply",
    title: "Apply the Edera RuntimeClass",
    description:
      "Create the Edera <code class='guide-code'>RuntimeClass</code> so Kubernetes recognises the <code class='guide-code'>edera</code> runtime.",
    command: "kubectl apply -f edera/runtimeclass-edera.yaml",
  },
  {
    id: "edera-runtimeclass-list",
    title: "Verify the Edera RuntimeClass",
    description:
      "List <code class='guide-code'>RuntimeClass</code> names and confirm that <code class='guide-code'>edera</code> is available.",
    command: "kubectl get runtimeclass",
  },
  {
    id: "edera-node-label",
    title: "Label the Edera node",
    description:
      "Label <code class='guide-code'>node-3</code> with <code class='guide-code'>runtime=edera</code>. The Edera <code class='guide-code'>RuntimeClass</code> uses this node selector to schedule Edera-protected workloads onto the correct node.",
    command: "kubectl label node node-3 runtime=edera",
  },
  {
    id: "edera-pod-apply",
    title: "Deploy the CPU-configured Edera pod",
    description:
      "Apply the <code class='guide-code'>nginx</code> manifest. It uses <code class='guide-code'>runtimeClassName: edera</code> and requests 4 CPUs with the matching <code class='guide-code'>dev.edera/cpu</code> annotation.",
    command: "kubectl apply -f edera/pod-nginx.yaml",
  },
  {
    id: "edera-pod-runtimeclass",
    title: "Verify the pod RuntimeClass",
    description:
      "Confirm that the <code class='guide-code'>edera-protect-pod</code> is using the Edera <code class='guide-code'>RuntimeClass</code>.",
    command: "kubectl get pod edera-protect-pod -o jsonpath='{.spec.runtimeClassName}'",
  },
  {
    id: "edera-workload-list",
    title: "Prove the pod is Edera protected",
    description:
      "List the Edera workloads and verify <code class='guide-code'>edera-protect-pod</code> appears as a running workload attached to <code class='guide-code'>test-zone</code>.",
    command: "protect workload list",
  },
  {
    id: "deployment-apply",
    title: "Deploy an Edera-backed Deployment",
    description:
      "Apply an <code class='guide-code'>apps/v1</code> Deployment with two <code class='guide-code'>nginx</code> replicas. The pod template uses <code class='guide-code'>runtimeClassName: edera</code>, so both replicas remain <code class='guide-code'>Pending</code> until the Edera <code class='guide-code'>RuntimeClass</code> is available.",
    command: "kubectl apply -f edera/nginx-deployment.yaml",
  },
  {
    id: "deployment-list",
    title: "Inspect the Deployment",
    description:
      "List the Deployment and verify its two replicas become <code class='guide-code'>READY</code> once the Edera <code class='guide-code'>RuntimeClass</code> is enabled.",
    command: "kubectl get deployments",
  },
  {
    id: "workload-launch",
    title: "Launch a workload inside the zone",
    description:
      "Start an Alpine container inside the isolated <code class='guide-code'>test-zone</code>.",
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
      "Exec into the <code class='guide-code'>Alpine</code> workload and run <code class='guide-code'>uname -r | grep 'edera'</code>. Expected output: <code class='guide-code'>6.18.44-edera-zone</code>. This demonstrates that the workload is using the dedicated kernel booted for the isolated Edera <code class='guide-code'>Zone</code> rather than the shared host kernel. In a traditional container, <code class='guide-code'>uname -r</code> would normally report the host kernel because containers share one kernel.",
    command:
      "protect workload exec alpine-long /bin/sh -c \"uname -r | grep 'edera'\"",
    optional: true,
  },
  {
    id: "host-kernel",
    title: "Compare the host kernel",
    description:
      "After exiting the workload, run <code class='guide-code'>uname -r</code> on the host. Expected output: <code class='guide-code'>6.18.44-edera-host</code>. The different kernel suffix proves the workload is not using the host's shared kernel; the Edera <code class='guide-code'>Zone</code> is running its own isolated kernel in the simulator.",
    command: "uname -r",
    optional: true,
  },
  {
    id: "workload-destroy",
    title: "Destroy the workload",
    description:
      "Remove the workload from the Edera <code class='guide-code'>Zone</code>.",
    command: "protect workload destroy alpine-long --wait",
  },
  {
    id: "zone-destroy",
    title: "Destroy the zone",
    description:
      "Tear down the isolated Edera <code class='guide-code'>Zone</code>.",
    command: "protect zone destroy test-zone",
  },
  {
    id: "final-list",
    title: "Verify the zone lifecycle",
    description:
      "List the <code class='guide-code'>Zones</code> one final time and observe the destroyed tombstone.",
    command: "protect zone list",
  },
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
        <div class="hero-eyebrow">ARE YOU READY TO CYW?</div>
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
            <span id="terminal-prompt">user@webernetes:~$</span>
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
  const terminalPrompt =
    document.querySelector<HTMLSpanElement>("#terminal-prompt")!;

  const updateTerminalPrompt = () => {
    terminalPrompt.innerText = `user@webernetes:${virtualDisplayPath(currentDirectory)}$`;
  };

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
  const guideCodeStyle = document.createElement("style");
  guideCodeStyle.textContent = `.guide-code { background: #fff3a3; font-weight: 700; padding: 0.08em 0.3em; border-radius: 4px; }`;
  document.head.appendChild(guideCodeStyle);
  const suggestedCommand =
    document.querySelector<HTMLElement>("#suggested-command")!;
  const guideStepList =
    document.querySelector<HTMLDivElement>("#guide-step-list")!;
  const guideProgress =
    document.querySelector<HTMLDivElement>("#guide-progress")!;
  const useCommandBtn =
    document.querySelector<HTMLButtonElement>("#use-command-btn")!;
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
      if (eventsPanel.parentElement !== rootShell ||
          eventsPanel.previousElementSibling !== guidePanel) {
        rootShell.insertBefore(eventsPanel, guidePanel.nextSibling);
      }
    } else {
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
  let completionModalShown = false;

  const closeCompletionModal = () => {
    completionModal.hidden = true;
    completionModal.style.display = "none";
  };

  let cluster: Cluster;

  // The demo exposes a small read-only virtual filesystem for manifests. Keeping
  // paths here (rather than making the terminal itself aware of every manifest)
  // lets `ls`, `cd`, `cat`, and `kubectl -f` all share the same path resolution.
  const localFiles: Record<string, string> = {
    "/edera/pod-nginx.yaml": NGINX_YAML_CONTENT,
    "/edera/runtimeclass-edera.yaml": RUNTIMECLASS_EDERA_YAML_CONTENT,
    "/edera/pod-hardened-vessel.yaml": HARDENED_VESSEL_YAML_CONTENT,
    "/edera/nginx-deployment.yaml": NGINX_DEPLOYMENT_YAML_CONTENT,

    "/etc/falco/config.d/falco-edera-config.yaml": FALCO_EDERA_CONFIG_YAML,
    "/etc/falco/rules.d/falco-edera-rules.yaml": FALCO_EDERA_RULES_YAML,
    "/falco-edera-values.yaml": FALCO_HELM_VALUES_YAML,

    "/storage/csi/csi-block-pvc.yaml": CSI_BLOCK_PVC_YAML_CONTENT,
    "/storage/csi/format-block-device.yaml": FORMAT_BLOCK_DEVICE_YAML_CONTENT,
    "/storage/csi/csi-block-deployment.yaml": CSI_BLOCK_DEPLOYMENT_YAML_CONTENT,

    "/storage/filesystem/filesystem-pvc.yaml": FILESYSTEM_PVC_YAML_CONTENT,
    "/storage/filesystem/filesystem-deployment.yaml": FILESYSTEM_DEPLOYMENT_YAML_CONTENT,

    "/storage/local-nvme/local-nvme-pv.yaml": LOCAL_NVME_PV_YAML_CONTENT,
    "/storage/local-nvme/local-nvme-pvc.yaml": LOCAL_NVME_PVC_YAML_CONTENT,
    "/storage/local-nvme/local-nvme-deployment.yaml": LOCAL_NVME_DEPLOYMENT_YAML_CONTENT,
  };
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


  const localFileMetadata: Record<
    string,
    { size: number; modified: string }
  > = {
    "/edera/pod-nginx.yaml": {
      size: NGINX_YAML_CONTENT.length,
      modified: "Apr  9 07:48",
    },
    "/edera/runtimeclass-edera.yaml": {
      size: RUNTIMECLASS_EDERA_YAML_CONTENT.length,
      modified: "Apr  9 07:48",
    },
    "/edera/pod-hardened-vessel.yaml": {
      size: HARDENED_VESSEL_YAML_CONTENT.length,
      modified: "Apr  9 07:48",
    },
    "/edera/nginx-deployment.yaml": {
      size: NGINX_DEPLOYMENT_YAML_CONTENT.length,
      modified: "Apr  9 07:47",
    },
    "/etc/falco/config.d/falco-edera-config.yaml": {
      size: FALCO_EDERA_CONFIG_YAML.length,
      modified: "Sep  8 09:00",
    },
    "/etc/falco/rules.d/falco-edera-rules.yaml": {
      size: FALCO_EDERA_RULES_YAML.length,
      modified: "Sep  8 09:00",
    },
    "/falco-edera-values.yaml": {
      size: FALCO_HELM_VALUES_YAML.length,
      modified: "Sep  8 09:00",
    },
    "/storage/csi/csi-block-pvc.yaml": { size: CSI_BLOCK_PVC_YAML_CONTENT.length, modified: "Sep  6 09:00" },
    "/storage/csi/format-block-device.yaml": { size: FORMAT_BLOCK_DEVICE_YAML_CONTENT.length, modified: "Sep  6 09:00" },
    "/storage/csi/csi-block-deployment.yaml": { size: CSI_BLOCK_DEPLOYMENT_YAML_CONTENT.length, modified: "Sep  6 09:00" },
    "/storage/filesystem/filesystem-pvc.yaml": { size: FILESYSTEM_PVC_YAML_CONTENT.length, modified: "Sep  6 09:00" },
    "/storage/filesystem/filesystem-deployment.yaml": { size: FILESYSTEM_DEPLOYMENT_YAML_CONTENT.length, modified: "Sep  6 09:00" },
    "/storage/local-nvme/local-nvme-pv.yaml": { size: LOCAL_NVME_PV_YAML_CONTENT.length, modified: "Sep  6 09:00" },
    "/storage/local-nvme/local-nvme-pvc.yaml": { size: LOCAL_NVME_PVC_YAML_CONTENT.length, modified: "Sep  6 09:00" },
    "/storage/local-nvme/local-nvme-deployment.yaml": { size: LOCAL_NVME_DEPLOYMENT_YAML_CONTENT.length, modified: "Sep  6 09:00" },
  };

  const READ_ONLY_FILE_MODE = "-r--r--r--";
  const READ_ONLY_DIRECTORY_MODE = "dr-xr-xr-x";

  let currentDirectory = "/";

  const normalizeVirtualPath = (path: string): string => {
    const parts = path.split("/");
    const normalized: string[] = [];

    for (const part of parts) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        normalized.pop();
        continue;
      }
      normalized.push(part);
    }

    return normalized.length > 0 ? `/${normalized.join("/")}` : "/";
  };

  const resolveVirtualPath = (path: string): string => {
    if (!path || path === "~") {
      return currentDirectory;
    }

    if (path === "~/" || path.startsWith("~/")) {
      return normalizeVirtualPath(
        path === "~/" ? "/" : `/${path.slice(2)}`,
      );
    }

    return normalizeVirtualPath(
      path.startsWith("/") ? path : `${currentDirectory}/${path}`,
    );
  };

  const virtualBasename = (path: string): string => {
    const normalized = normalizeVirtualPath(path);
    if (normalized === "/") {
      return "/";
    }
    return normalized.split("/").pop() || "/";
  };

  const virtualDisplayPath = (path: string): string => {
    const normalized = normalizeVirtualPath(path);
    return normalized === "/"
      ? "~"
      : `~${normalized}`;
  };

  const isVirtualDirectory = (path: string): boolean => {
    const normalized = normalizeVirtualPath(path);
    if (normalized === "/") {
      return true;
    }

    const prefix = `${normalized}/`;
    return Object.keys(localFiles).some((file) => file.startsWith(prefix));
  };

  const getVirtualFile = (path: string): string | undefined =>
    localFiles[normalizeVirtualPath(path)];

  const listVirtualDirectory = (path: string): Array<{
    name: string;
    path: string;
    isDirectory: boolean;
  }> => {
    const directory = normalizeVirtualPath(path);
    const prefix = directory === "/" ? "/" : `${directory}/`;
    const entries = new Map<string, { path: string; isDirectory: boolean }>();

    for (const filePath of Object.keys(localFiles)) {
      if (!filePath.startsWith(prefix)) {
        continue;
      }

      const remainder = filePath.slice(prefix.length);
      const slashIndex = remainder.indexOf("/");

      if (slashIndex === -1) {
        entries.set(remainder, {
          path: filePath,
          isDirectory: false,
        });
      } else {
        const directoryName = remainder.slice(0, slashIndex);
        const childPath = normalizeVirtualPath(`${prefix}${directoryName}`);
        entries.set(directoryName, {
          path: childPath,
          isDirectory: true,
        });
      }
    }

    return [...entries.entries()]
      .map(([name, entry]) => ({
        name,
        path: entry.path,
        isDirectory: entry.isDirectory,
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  };

  const startNewDemoSession = () => {
    completedDemoSteps = new Set<string>();
    selectedDemoStepIndex = null;
    completionModalShown = false;
    commandHistory.length = 0;
    historyIndex = -1;
    protectZones = [];
    protectWorkloads = [];
    persistentVolumeClaims = [];
    persistentVolumes = [];
    jobs = [];
    clusterEvents = [];
    gpuVfioBound = false;
    protectDaemonRestarted = false;
    falcoInstalled = false;
    falcoConfigured = false;
    falcoRulesLoaded = false;
    falcoRunning = false;
    ederaFalcoPluginLoaded = false;
    falcoLogLines = [];
    falcoStreamMode = null;

    closeCompletionModal();
    window.location.reload();
  };

  let gpuVfioBound = false;
  let protectDaemonRestarted = false;
  let falcoInstalled = false;
  let falcoConfigured = false;
  let falcoRulesLoaded = false;
  let falcoRunning = false;
  let ederaFalcoPluginLoaded = false;
  let falcoLogLines: string[] = [];
  let falcoStreamMode: "node" | "helm" | null = null;

  const activeRuntimeClasses = new Set<string>();

  let namespaces: LocalNamespace[] = [
    { name: "default", status: "Active", age: "10m" },
    { name: "kube-system", status: "Active", age: "10m" },
    { name: "kube-public", status: "Active", age: "10m" },
    { name: "kube-node-lease", status: "Active", age: "10m" },
  ];

  let deployments: LocalDeployment[] = [];
  let persistentVolumeClaims: LocalPersistentVolumeClaim[] = [];
  let persistentVolumes: LocalPersistentVolume[] = [];
  let jobs: LocalJob[] = [];

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
  let cachedProtectImages = new Set<string>([
    "nginx:latest",
    "docker.io/library/alpine:latest",
  ]);
  let clusterEvents: ClusterEvent[] = [];
  const commandHistory: string[] = [];
  let historyIndex = -1;
  let completedDemoSteps = new Set<string>();
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
      `<div class="terminal-command"><span class="terminal-prompt">user@webernetes:${escapeHtml(virtualDisplayPath(currentDirectory))}$</span> ${escapeHtml(command)}</div>`,
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
    .map((node) => {
      const usesEderaRuntime =
        node.labels.runtime === "edera";

      return `
        <div class="resource-card">
          <div>
            <div class="resource-name">
              <span>${escapeHtml(node.name)}</span>
            </div>

            <div class="resource-meta">
              ${escapeHtml(getNodeRoles(node))}
            </div>
          </div>

          <div
            style="
              display: flex;
              align-items: center;
              gap: 8px;
              flex-shrink: 0;
            "
          >
            ${
              usesEderaRuntime
                ? `
                  <span class="runtimeclass-badge">
                    runtimeClassName: edera
                  </span>
                `
                : ""
            }

            <span class="status-badge status-ready">
              ${escapeHtml(node.status)}
            </span>
          </div>
        </div>
      `;
    })
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
    guideDescription.innerHTML = currentStep.description;
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
    const selectedStep =
      selectedDemoStepIndex === null
        ? undefined
        : PROTECT_DEMO_STEPS[selectedDemoStepIndex];
    if (selectedStep === undefined || selectedStep.id === stepId) {
      const nextIndex = PROTECT_DEMO_STEPS.findIndex(
        (step) => !completedDemoSteps.has(step.id),
      );
      selectedDemoStepIndex =
        nextIndex === -1 ? PROTECT_DEMO_STEPS.length - 1 : nextIndex;
    }
    renderGuide();
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
  const findSchedulableNode = (pod: LocalPod): LocalNode | undefined => {
    const effectiveNodeSelector: Record<string, string> = {
      ...(pod.nodeSelector || {}),
    };
    if (pod.runtimeClassName === "edera") {
      effectiveNodeSelector.runtime = "edera";
    }
    const selectorEntries = Object.entries(effectiveNodeSelector);
    if (selectorEntries.length > 0) {
      return nodes.find((node) =>
        node.status === "Ready" &&
        selectorEntries.every(
          ([key, value]) => node.labels[key] === value,
        ),
      );
    }
    return (
      nodes.find(
        (node) =>
          node.status === "Ready" &&
          !node.labels["node-role.kubernetes.io/control-plane"],
      ) || nodes.find((node) => node.status === "Ready")
    );
  };
  const checkPendingPods = () => {
    for (const pod of pods) {
      const recoverableRuntimeClassPod =
        pod.status === "Failed" &&
        pod.runtimeClassName &&
        activeRuntimeClasses.has(pod.runtimeClassName);
      if (pod.status !== "Pending" && !recoverableRuntimeClassPod) {
        continue;
      }
      if (
        pod.runtimeClassName &&
        !activeRuntimeClasses.has(pod.runtimeClassName)
      ) {
        continue;
      }
      if (pod.ownerDeployment) {
        const deployment = deployments.find((item) => item.name === pod.ownerDeployment);
        if (deployment?.volumeClaimName && deployment.volumeMode && !storageReadyForDeployment(deployment.volumeClaimName, deployment.volumeMode)) {
          continue;
        }
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

      const targetNode = findSchedulableNode(pod);

      if (!targetNode) {
        continue;
      }

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

    syncEderaPodsToProtectWorkloads();
    for (const deployment of deployments) {
      deployment.readyReplicas = pods.filter(
        (pod) =>
          pod.ownerDeployment === deployment.name &&
          pod.status === "Running",
      ).length;
    }

    updateDashboard();
  };

  const reconcileDeployments = () => {
    for (const deployment of deployments) {
      const managedPods = pods.filter(
        (pod) =>
          pod.ownerDeployment === deployment.name &&
          pod.status !== "Failed",
      );

      while (managedPods.length < deployment.replicas) {
        const podName = `${deployment.name}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;

        const runtimeReady = deployment.runtimeClassName
          ? activeRuntimeClasses.has(deployment.runtimeClassName)
          : true;

        const pod: LocalPod = {
          name: podName,
          namespace: deployment.namespace,
          status: "Pending",
          age: "1s",
          image: deployment.image,
          ip: "<none>",
          node: "<none>",
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
    }

    syncEderaPodsToProtectWorkloads();
    updateDashboard();
  };
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
  const renderProtectZoneList = (zones = protectZones) => {
    if (zones.length === 0) {
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

    for (const zone of zones) {
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

  const renderProtectWorkloadList = (workloads = protectWorkloads) => {
    if (workloads.length === 0) {
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

    for (const workload of workloads) {
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

  const getFalcoZoneForWorkload = (workload: ProtectWorkload) =>
    protectZones.find((zone) => zone.uuid === workload.zone);

  const getFalcoTimestamp = () =>
    new Date().toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      year: "numeric",
    });

  const getFalcoStartupLines = (zone: ProtectZone | undefined) => {
    if (!zone) {
      return [
        `${getFalcoTimestamp()}: [libs]: edera: [INFO] waiting for zones`,
      ];
    }

    return [
      `${getFalcoTimestamp()}: [libs]: edera: [INFO] waiting for zones`,
      `${getFalcoTimestamp()}: [libs]: edera: [INFO] got zone ZoneMetadata { domid: 3, uuid: ${zone.uuid} }`,
      `${getFalcoTimestamp()}: [libs]: edera: [INFO] pushing handle for zone ${zone.uuid}`,
      `${getFalcoTimestamp()}: [libs]: edera: [INFO] starting zone event pump for zone ${zone.uuid}`,
      `${getFalcoTimestamp()}: [libs]: edera: [INFO] Listening for kernel events from zone ${zone.uuid}`,
    ];
  };

  const getFalcoDetectionLine = (
    severity: "Notice" | "Warning" | "Critical",
    rule: string,
    zone: ProtectZone,
    details: string,
  ) =>
    `${getFalcoTimestamp()}: Falco Detection [${severity.toUpperCase()}] ${rule} | zone_id=${zone.uuid} ${details}`;

  const renderFalcoDebugOutput = (mode: "node" | "helm" = "node") => {
    if (!falcoRunning || !ederaFalcoPluginLoaded) {
      printHtml(
        `<span style="color:#ff7373;">Falco is not running with the Edera plugin loaded. Run: sudo systemctl restart falco</span>`,
      );
      return;
    }

    falcoStreamMode = mode;

    const zone = protectZones.find((item) => item.state === "ready");
    const lines = [...getFalcoStartupLines(zone), ...falcoLogLines];

    printPre(
      `<span style="color:#dff7f0;">${escapeHtml(lines.join("\n"))}</span>`,
    );
  };

  const emitFalcoEvent = (
    type: "Notice" | "Warning" | "Critical",
    rule: string,
    zone: ProtectZone,
    details: string,
  ) => {
    if (!falcoRunning || !ederaFalcoPluginLoaded) return;

    const lifecycleType =
      type === "Critical" ? "Warning" : type === "Warning" ? "Warning" : "Info";
    const detectionLine = getFalcoDetectionLine(type, rule, zone, details);

    falcoLogLines.push(detectionLine);

    addEvent(
      lifecycleType,
      `FalcoDetection: ${rule}`,
      `zone/${zone.name}`,
      `${details} (zone_id=${zone.uuid})`,
    );

    printPre(
      `<span style="color:${type === "Critical" ? "#ff7373" : type === "Warning" ? "#ffd166" : "#00e5d4"};">` +
        `${escapeHtml(type)} EDERA Event | zone_id=${escapeHtml(zone.uuid)} ${escapeHtml(details)}` +
        `</span>`,
    );

    if (falcoStreamMode) {
      printPre(
        `<span style="color:#ff9f43;">${escapeHtml(detectionLine)}</span>`,
      );
    }
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
    const falcoZone = getFalcoZoneForWorkload(workload);

    if (falcoRunning && ederaFalcoPluginLoaded && falcoZone) {
      const lowerCommand = commandText.toLowerCase();
      const processName = command[0]?.split("/").pop() || "sh";

      if (lowerCommand.includes("/proc/") && lowerCommand.includes("/environ")) {
        emitFalcoEvent(
          "Warning",
          "Edera Proc Environ Read",
          falcoZone,
          `evt.type=open proc.exe=${processName} file=${commandText.match(/\/proc\/[^ ]+\/environ/)?.[0] || "/proc/1/environ"}`,
        );
      } else if (/(^|\s)(nc|ncat|netcat|socat|telnet)(\s|$)/i.test(commandText)) {
        emitFalcoEvent(
          "Critical",
          "Edera Reverse Shell Tool",
          falcoZone,
          `evt.type=execve proc.exe=${processName} cmdline=${commandText}`,
        );
      } else if (/(^|\s|\/)nsenter(\s|$)/i.test(commandText)) {
        emitFalcoEvent(
          "Critical",
          "Edera Namespace Escape Attempt",
          falcoZone,
          `evt.type=execve proc.exe=nsenter cmdline=${commandText}`,
        );
      } else if (
        lowerCommand.includes("/etc/shadow") ||
        lowerCommand.includes("/etc/kubernetes") ||
        lowerCommand.includes("/run/secrets")
      ) {
        emitFalcoEvent(
          "Warning",
          "Edera Sensitive File Read",
          falcoZone,
          `evt.type=open proc.exe=${processName} file=${commandText}`,
        );
      }

      if (lowerCommand.includes("connect") || lowerCommand.includes("curl ")) {
        emitFalcoEvent(
          "Notice",
          "Edera Outbound Connection",
          falcoZone,
          `evt.type=connect proc.exe=${processName} dest=203.0.113.10:443 proto=tcp`,
        );
      }
    }

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
            <code>kubectl get pvc|pv|jobs</code>
            <span>Inspect simulated PersistentVolumeClaims, PersistentVolumes, and Jobs.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl wait --for=condition=complete job/&lt;name&gt;</code>
            <span>Wait for a simulated Job to complete and update storage state.</span>
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
            <code>kubectl apply -f edera/nginx-deployment.yaml</code>
            <span>Create an Edera-backed Deployment with two replicas.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl delete -f edera/nginx-deployment.yaml</code>
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
            <code>protect zone list [ZONE] [--output json-pretty]</code>
            <span>List Edera zones, or inspect one zone with JSON output.</span>
          </div>

          <div class="cli-help-command">
            <code>protect zone watch</code>
            <span>Watch simulated zone state changes in real time.</span>
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
            <code>protect workload list [--selector status.state=running]</code>
            <span>List workloads and optionally filter them by state.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload stop &lt;workload&gt;</code>
            <span>Stop a running workload.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload start &lt;workload&gt;</code>
            <span>Start a stopped workload.</span>
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

          <div class="cli-help-command">
            <code>sudo cat /etc/falco/config.d/falco-edera-config.yaml</code>
            <span>Inspect the simulated node-based Edera Falco plugin configuration.</span>
          </div>

          <div class="cli-help-command">
            <code>sudo cat /etc/falco/rules.d/falco-edera-rules.yaml</code>
            <span>Inspect simulated Edera Falco detection rules.</span>
          </div>

          <div class="cli-help-command">
            <code>sudo systemctl restart falco</code>
            <span>Restart the simulated Falco service with the Edera plugin.</span>
          </div>

          <div class="cli-help-command">
            <code>sudo falco -o "log_level=debug"</code>
            <span>Show simulated Falco plugin discovery and zone events.</span>
          </div>

          <div class="cli-help-command">
            <code>helm upgrade falco falcosecurity/falco -n falco -f falco-edera-values.yaml</code>
            <span>Simulate upgrading a Helm-based Falco deployment with Edera configuration.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl get pods -n falco</code>
            <span>List simulated Falco pods.</span>
          </div>

          <div class="cli-help-command">
            <code>kubectl logs -n falco -l app.kubernetes.io/name=falco -f</code>
            <span>Stream simulated Falco logs.</span>
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
            <code>protect zone list [ZONE] [--output json-pretty]</code>
            <span>List Edera zones, or inspect one zone with JSON output.</span>
          </div>

          <div class="cli-help-command">
            <code>protect zone watch</code>
            <span>Watch simulated zone state changes in real time.</span>
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
            <code>protect workload list [--selector status.state=running]</code>
            <span>List workloads and optionally filter them by state.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload stop &lt;workload&gt;</code>
            <span>Stop a running workload.</span>
          </div>

          <div class="cli-help-command">
            <code>protect workload start &lt;workload&gt;</code>
            <span>Start a stopped workload.</span>
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
            <code>protect image list [--output json-pretty]</code>
            <span>List cached container images.</span>
          </div>

          <div class="cli-help-command">
            <code>protect image pull [--overwrite-cache] &lt;image&gt;</code>
            <span>Pull an image into the local cache.</span>
          </div>

          <div class="cli-help-command">
            <code>protect image remove &lt;digest&gt;</code>
            <span>Remove a cached image by digest.</span>
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

  const parseProtectOutputFormat = (tokens: string[]): string => {
    const outputIndex = tokens.findIndex((token) => token === "-o" || token === "--output");
    if (outputIndex >= 0) return tokens[outputIndex + 1] || "table";
    const equalsToken = tokens.find((token) => token.startsWith("-o=") || token.startsWith("--output="));
    return equalsToken ? equalsToken.split("=").slice(1).join("=") : "table";
  };

  const renderProtectZoneJson = (zones: ProtectZone[], pretty = false) => {
    const payload = {
      zones: zones.map((zone) => ({
        name: zone.name,
        id: zone.uuid,
        state: zone.state,
        resources: { cpus: zone.targetCpus, memory: `${zone.maxCpus * 512}MB` },
        ipv4: zone.ipv4,
        ipv6: zone.ipv6,
        ...(zone.kernelVariant ? { kernelVariant: zone.kernelVariant } : {}),
      })),
    };
    printPre(escapeHtml(JSON.stringify(payload, null, pretty ? 2 : 0)));
  };

  const renderProtectWorkloadJson = (workloads: ProtectWorkload[], pretty = false) => {
    const payload = {
      workloads: workloads.map((workload) => ({
        name: workload.name,
        id: workload.uuid,
        zone: workload.zone,
        state: workload.state,
        image: workload.image,
        command: workload.command,
      })),
    };
    printPre(escapeHtml(JSON.stringify(payload, null, pretty ? 2 : 0)));
  };

  const PROTECT_IMAGE_DIGESTS: Record<string, string> = {
    "nginx:latest": "sha256:demo01a7",
    "docker.io/library/alpine:latest": "sha256:demo02b4",
    "ubuntu:latest": "sha256:demo03c9",
  };

  const getProtectImageDigest = (reference: string, index: number): string =>
    PROTECT_IMAGE_DIGESTS[reference] ??
    `sha256:demo${String(index + 4).padStart(2, "0")}`;

  const renderProtectImageList = (pretty = false) => {
    const images = Array.from(cachedProtectImages).map((reference, index) => ({
      reference,
      digest: getProtectImageDigest(reference, index),
      format: "squashfs",
    }));
    if (pretty) {
      printPre(escapeHtml(JSON.stringify({ images }, null, 2)));
      return;
    }
    if (!images.length) {
      printHtml(`<span style="color:#a8cfca;">No cached images.</span>`);
      return;
    }

    // Size each column from the longest value actually being displayed so
    // shorter demo digests do not make the FORMAT column drift.
    const referenceWidth = Math.max(
      "REFERENCE".length,
      ...images.map((image) => image.reference.length),
    ) + 4;
    const digestWidth = Math.max(
      "DIGEST".length,
      ...images.map((image) => image.digest.length),
    ) + 4;
    const formatWidth = Math.max(
      "FORMAT".length,
      ...images.map((image) => image.format.length),
    );
    const tableWidth = referenceWidth + digestWidth + formatWidth;

    let output =
      `<span style="color:#00e5d4;font-weight:700;">` +
      `REFERENCE`.padEnd(referenceWidth) +
      `DIGEST`.padEnd(digestWidth) +
      `FORMAT` +
      `</span>\n`;
    output += `<span style="color:#08736d;">${"─".repeat(tableWidth)}</span>\n`;

    for (const image of images) {
      output +=
        escapeHtml(image.reference.padEnd(referenceWidth)) +
        escapeHtml(image.digest.padEnd(digestWidth)) +
        escapeHtml(image.format) +
        "\n";
    }

    printPre(output.trimEnd());
  };

  const getZoneByIdentifier = (identifier: string) =>
    protectZones.find((zone) => zone.name === identifier || zone.uuid === identifier);

  const renderZoneWatchSnapshot = () => {
    const lines = protectZones.map((zone) => `${zone.name}  ${zone.state}`);
    printPre(escapeHtml(lines.length ? lines.join("\n") : "No zones."));
  };

  const handleProtectCommand = async (
    rawCmd: string,
    tokens: string[],
  ): Promise<boolean> => {
    if (tokens[0] !== "protect") {
      return false;
    }
    if (
      tokens.length === 1 ||
      tokens[1] === "--help" ||
      tokens[1] === "-h"
    ) {
      printHtml(formatProtectHelpText());

      return true;
    }

    if (tokens[1] === "image") {
      if (tokens[2] === "list") {
        const output = parseProtectOutputFormat(tokens);
        renderProtectImageList(output === "json-pretty");
        return true;
      }

      if (tokens[2] === "pull") {
        let image = "";
        let overwrite = false;
        for (let i = 3; i < tokens.length; i++) {
          if (tokens[i] === "--overwrite-cache") overwrite = true;
          else if (!tokens[i].startsWith("-") && !image) image = tokens[i];
        }
        if (!image) {
          printHtml(`<span style="color:#ff7373;">Usage: protect image pull [--overwrite-cache] &lt;image&gt;</span>`);
          return true;
        }
        const existed = cachedProtectImages.has(image);
        cachedProtectImages.add(image);
        printHtml(`<span style="color:#b8ff3c;">${existed && !overwrite ? "Image already cached" : "Pulled image"}: ${escapeHtml(image)}</span>`);
        return true;
      }

      if (tokens[2] === "remove") {
        const image = tokens[3] || "";
        if (!image) {
          printHtml(`<span style="color:#ff7373;">Usage: protect image remove &lt;digest&gt;</span>`);
          return true;
        }
        const refs = Array.from(cachedProtectImages);
        const index = refs.findIndex(
          (ref, i) => image === ref || image === getProtectImageDigest(ref, i),
        );
        if (index < 0) {
          printHtml(`<span style="color:#ff7373;">Error: image digest "${escapeHtml(image)}" not found.</span>`);
          return true;
        }
        cachedProtectImages.delete(refs[index]);
        printHtml(`<span style="color:#b8ff3c;">Removed image ${escapeHtml(image)}.</span>`);
        return true;
      }

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

      if (subcommand === "watch") {
        printHtml(`<span style="color:#00e5d4;font-weight:700;">Watching Edera zones (simulated live updates).</span>`);
        renderZoneWatchSnapshot();
        let ticks = 0;
        const watchTimer = window.setInterval(() => {
          ticks += 1;
          renderZoneWatchSnapshot();
          if (ticks >= 6) {
            window.clearInterval(watchTimer);
            printHtml(`<span style="color:#a8cfca;">Zone watch ended after 6 updates.</span>`);
          }
        }, 1000);
        return true;
      }

      if (subcommand === "list") {
        let identifier = "";
        let selector = "";
        for (let i = 3; i < tokens.length; i++) {
          if (tokens[i] === "--selector" || tokens[i] === "-l") selector = tokens[++i] || "";
          else if (tokens[i].startsWith("--selector=")) selector = tokens[i].slice(11);
          else if (!tokens[i].startsWith("-") && !identifier) identifier = tokens[i];
        }
        let zones = identifier ? protectZones.filter((zone) => zone.name === identifier || zone.uuid === identifier) : [...protectZones];
        if (selector) {
          const normalized = normalizeZoneSelector(selector);
          if (!normalized) {
            printHtml(`<span style="color:#ff7373;">Invalid selector "${escapeHtml(selector)}".</span>`);
            return true;
          }
          const state = normalized === "created" ? "ready" : normalized;
          zones = zones.filter((zone) => zone.state === state);
        }
        const output = parseProtectOutputFormat(tokens);
        if (output === "json" || output === "json-pretty") {
          renderProtectZoneJson(zones, output === "json-pretty");
        } else if (output === "jsonl") {
          printPre(zones.map((zone) => escapeHtml(JSON.stringify({ name: zone.name, id: zone.uuid, state: zone.state }))).join("\n"));
        } else {
          renderProtectZoneList(zones);
        }

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
        let selector = "";
        for (let i = 3; i < tokens.length; i++) {
          if (tokens[i] === "--selector" || tokens[i] === "-l") selector = tokens[++i] || "";
          else if (tokens[i].startsWith("--selector=")) selector = tokens[i].slice(11);
        }
        let workloads = [...protectWorkloads];
        if (selector) {
          const match = selector.trim().match(/^status\.state\s*=\s*(.+)$/i);
          if (!match) { printHtml(`<span style="color:#ff7373;">Invalid selector "${escapeHtml(selector)}".</span>`); return true; }
          const state = match[1].trim().toLowerCase();
          workloads = workloads.filter((workload) => workload.state === state);
        }
        const output = parseProtectOutputFormat(tokens);
        if (output === "json" || output === "json-pretty") renderProtectWorkloadJson(workloads, output === "json-pretty");
        else renderProtectWorkloadList(workloads);

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

      if (subcommand === "stop" || subcommand === "start") {
        const identifier = tokens[3] || "";
        const workload = protectWorkloads.find((item) => item.name === identifier || item.uuid === identifier);
        if (!workload) { printHtml(`<span style="color:#ff7373;">Error: workload "${escapeHtml(identifier)}" not found.</span>`); return true; }
        if (subcommand === "stop") {
          if (workload.state !== "running") { printHtml(`<span style="color:#a8cfca;">Workload "${escapeHtml(workload.name)}" is not running.</span>`); return true; }
          workload.state = "stopped";
          addEvent("Normal", "WorkloadStopped", `workload/${workload.name}`, `Workload ${workload.name} stopped`);
          printHtml(`<span style="color:#b8ff3c;">Workload "${escapeHtml(workload.name)}" stopped.</span>`);
        } else {
          if (workload.state !== "stopped") { printHtml(`<span style="color:#a8cfca;">Workload "${escapeHtml(workload.name)}" is not stopped.</span>`); return true; }
          workload.state = "running";
          addEvent("Normal", "WorkloadStarted", `workload/${workload.name}`, `Workload ${workload.name} started`);
          printHtml(`<span style="color:#b8ff3c;">Workload "${escapeHtml(workload.name)}" started.</span>`);
        }
        updateDashboard();
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

    if (tokens[1] === "host") {
      const subcommand = tokens[2];
      if (subcommand === "status") {
        printPre(`<span style="color:#dff7f0;">protect-daemon    active (running)
zones             ${protectZones.filter((zone) => zone.state !== "destroyed").length}
workloads         ${protectWorkloads.filter((workload) => workload.state !== "destroyed").length}</span>`);
        return true;
      }
      if (subcommand === "cpu-topology") {
        printPre(`<span style="color:#dff7f0;">CPU TOPOLOGY
Sockets: 1
Cores:   4
Threads: 8

0 1 2 3 4 5 6 7</span>`);
        return true;
      }
      if (subcommand === "hv-debug-info") {
        printPre(`<span style="color:#dff7f0;">Hypervisor: simulated-kvm
Edera isolation: enabled
Zones: ${protectZones.filter((zone) => zone.state !== "destroyed").length}
Kernel isolation: enabled</span>`);
        return true;
      }
      printHtml(`<span style="color:#ff7373;">Unknown protect host command: ${escapeHtml(tokens.slice(2).join(" "))}</span>`);
      return true;
    }

    printHtml(
      `<span style="color:#ff7373;">Unknown protect command. Type "protect --help".</span>`,
    );

    return true;
  };

  const bindStorage = () => {
    for (const pvc of persistentVolumeClaims) {
      if (pvc.status === "Bound") continue;
      const pv = persistentVolumes.find((item) =>
        item.status === "Available" &&
        item.volumeMode === pvc.volumeMode &&
        item.capacity === pvc.capacity &&
        item.accessModes === pvc.accessModes &&
        (!pvc.storageClassName || item.storageClassName === pvc.storageClassName),
      );
      if (!pv) continue;
      pv.status = "Bound";
      pv.claimName = `${pvc.namespace}/${pvc.name}`;
      pvc.status = "Bound";
      pvc.volumeName = pv.name;
      pvc.formatted = pv.formatted;
      addEvent("Normal", "Provisioned", `persistentvolumeclaim/${pvc.name}`, `Successfully bound PVC ${pvc.name} to ${pv.name}`);
      addEvent("Normal", "Bound", `persistentvolumeclaim/${pvc.name}`, `PersistentVolumeClaim ${pvc.name} is bound to ${pv.name}`);
    }
  };

  const storageReadyForDeployment = (claimName: string, volumeMode: "Filesystem" | "Block") => {
    const pvc = persistentVolumeClaims.find((item) => item.name === claimName && item.namespace === "default");
    if (!pvc || pvc.status !== "Bound" || pvc.volumeMode !== volumeMode) return false;
    return volumeMode === "Filesystem" || pvc.formatted;
  };

  const markJobComplete = (job: LocalJob) => {
    if (job.status === "Complete") return;
    job.status = "Complete";
    job.succeeded = job.completions;
    if (job.claimName) {
      const pvc = persistentVolumeClaims.find((item) => item.name === job.claimName && item.namespace === job.namespace);
      if (pvc) {
        pvc.formatted = true;
        const pv = persistentVolumes.find((item) => item.name === pvc.volumeName);
        if (pv) pv.formatted = true;
        addEvent("Normal", "Formatted", `persistentvolumeclaim/${pvc.name}`, `Block device ${pv?.devicePath || "/dev/data"} formatted as ext4`);
      }
    }
    addEvent("Normal", "Completed", `job/${job.name}`, `Job ${job.name} completed successfully`);
  };

  const getManifestKind = (manifestPath: string): string => {
    const manifest = getVirtualFile(manifestPath) || "";
    const match = manifest.match(/^\s*kind:\s*([A-Za-z0-9]+)\s*$/m);
    return match?.[1] || "";
  };

  const getManifestNamespace = (manifestPath: string): string => {
    const manifest = getVirtualFile(manifestPath) || "";
    const match = manifest.match(/^\s+namespace:\s*([A-Za-z0-9][A-Za-z0-9.-]*)\s*$/m);
    return match?.[1] || "default";
  };

  const requireManifestNamespace = (manifestPath: string): string | null => {
    const namespaceName = getManifestNamespace(manifestPath);

    if (!namespaces.some((namespace) => namespace.name === namespaceName)) {
      printHtml(
        `<span style="color:#ff7373;">Error from server (NotFound): namespaces "${escapeHtml(
          namespaceName,
        )}" not found</span>`,
      );
      return null;
    }

    return namespaceName;
  };

  const handleKubectlCommand = async (
    rawCmd: string,
    tokens: string[],
  ): Promise<boolean> => {
    if (tokens[0] !== "kubectl") {
      return false;
    }
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

      const pod: LocalPod = {
        name: podName,
        namespace: targetNamespace,
        status: "Pending",
        age: "1s",
        image: imageName,
        ip: "<none>",
        node: "<none>",
        labels: customLabels,
      };

      pods.push(pod);

      addEvent(
        "Normal",
        "Created",
        `pod/${podName}`,
        `pod/${podName} created in namespace ${targetNamespace}`,
      );

      checkPendingPods();
      updateDashboard();

      printHtml(
        `<span style="color:#b8ff3c;">pod/${escapeHtml(
          podName,
        )} created</span>`,
      );

      return true;
    }
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
    if (tokens[1] === "apply" && tokens[2] === "-f") {
      const requestedPath = tokens[3];
      const manifestPath = requestedPath ? resolveVirtualPath(requestedPath) : "";
      const fileName = manifestPath ? virtualBasename(manifestPath) : "";

      if (!requestedPath || !getVirtualFile(manifestPath)) {
        printHtml(
          `<span style="color:#ff7373;">error: the path "${escapeHtml(
            requestedPath || "",
          )}" does not exist</span>`,
        );
        return true;
      }

      // Kubernetes requires namespaced resources to be created in an existing
      // namespace. Validate that before simulating creation so an apply of a
      // manifest with `metadata.namespace` cannot report a misleading
      // successful create. Cluster-scoped resources do not require this check.
      const manifestKind = getManifestKind(manifestPath);
      const clusterScopedKinds = new Set([
        "Namespace",
        "Node",
        "PersistentVolume",
        "RuntimeClass",
        "StorageClass",
        "ClusterRole",
        "ClusterRoleBinding",
        "CustomResourceDefinition",
      ]);
      if (!clusterScopedKinds.has(manifestKind)) {
        const manifestNamespace = requireManifestNamespace(manifestPath);
        if (!manifestNamespace) {
          return true;
        }
      }

      if (fileName === "csi-block-pvc.yaml" || fileName === "filesystem-pvc.yaml") {
        const volumeMode = fileName === "csi-block-pvc.yaml" ? "Block" : "Filesystem" as const;
        const existing = persistentVolumeClaims.find((item) => item.name === "my-app-data");
        if (existing) {
          printHtml(`<span style="color:#a8cfca;">persistentvolumeclaim/my-app-data unchanged</span>`);
          return true;
        }
        const pvName = volumeMode === "Block" ? "pvc-${my-app-data}" : "pvc-${my-app-data}";
        persistentVolumes.push({ name: pvName, status: "Available", capacity: "10Gi", accessModes: "RWO", volumeMode, storageClassName: "gp3", source: "CSI", formatted: volumeMode === "Filesystem" });
        persistentVolumeClaims.push({ name: "my-app-data", namespace: "default", status: "Pending", volumeName: pvName, capacity: "10Gi", accessModes: "RWO", volumeMode, storageClassName: "gp3", formatted: volumeMode === "Filesystem" });
        bindStorage();
        addEvent("Normal", "Created", "persistentvolumeclaim/my-app-data", `persistentvolumeclaim/my-app-data created (${volumeMode})`);
        printHtml(`<span style="color:#b8ff3c;">persistentvolumeclaim/my-app-data created and ${volumeMode === "Block" ? "awaiting formatting" : "bound with a filesystem"}</span>`);
        return true;
      }

      if (fileName === "format-block-device.yaml") {
        const existing = jobs.find((job) => job.name === "format-block-device");
        if (existing) {
          printHtml(`<span style="color:#a8cfca;">job.batch/format-block-device already exists</span>`);
          return true;
        }
        const pvc = persistentVolumeClaims.find((item) => item.name === "my-app-data");
        if (!pvc || pvc.volumeMode !== "Block" || pvc.status !== "Bound") {
          printHtml(`<span style="color:#ff7373;">Error: PersistentVolumeClaim "my-app-data" must be a bound Block volume before the formatter Job can run.</span>`);
          return true;
        }
        const job: LocalJob = { name: "format-block-device", namespace: "default", completions: 1, succeeded: 0, status: "Running", image: "alpine:latest", targetDevice: "/dev/data", claimName: pvc.name };
        jobs.push(job);
        addEvent("Normal", "Created", "job/format-block-device", "formatter Job created using the default container runtime");
        printHtml(`<span style="color:#b8ff3c;">job.batch/format-block-device created</span>`);
        return true;
      }

      if (fileName === "local-nvme-pv.yaml") {
        if (persistentVolumes.some((item) => item.name === "local-raw-pv")) {
          printHtml(`<span style="color:#a8cfca;">persistentvolume/local-raw-pv unchanged</span>`);
          return true;
        }
        persistentVolumes.push({ name: "local-raw-pv", status: "Available", capacity: "5Gi", accessModes: "RWO", volumeMode: "Block", source: "Local", devicePath: "/dev/nvme0n1", nodeAffinity: "kubernetes.io/hostname=my-host", formatted: true });
        addEvent("Normal", "Created", "persistentvolume/local-raw-pv", "local PersistentVolume created for /dev/nvme0n1");
        printHtml(`<span style="color:#b8ff3c;">persistentvolume/local-raw-pv created</span>`);
        return true;
      }

      if (fileName === "local-nvme-pvc.yaml") {
        if (persistentVolumeClaims.some((item) => item.name === "local-block-pvc")) {
          printHtml(`<span style="color:#a8cfca;">persistentvolumeclaim/local-block-pvc unchanged</span>`);
          return true;
        }
        persistentVolumeClaims.push({ name: "local-block-pvc", namespace: "default", status: "Pending", volumeName: "local-raw-pv", capacity: "5Gi", accessModes: "RWO", volumeMode: "Block", formatted: true });
        bindStorage();
        printHtml(`<span style="color:#b8ff3c;">persistentvolumeclaim/local-block-pvc created</span>`);
        return true;
      }

      if (fileName === "csi-block-deployment.yaml" || fileName === "filesystem-deployment.yaml" || fileName === "local-nvme-deployment.yaml") {
        const deploymentName = "my-app";
        const manifestNamespace = getManifestNamespace(manifestPath);
        const existing = deployments.find((deployment) => deployment.name === deploymentName && deployment.namespace === manifestNamespace);
        if (existing) {
          printHtml(`<span style="color:#a8cfca;">deployment.apps/${deploymentName} unchanged</span>`);
          return true;
        }
        const isLocal = fileName === "local-nvme-deployment.yaml";
        const isBlock = fileName !== "filesystem-deployment.yaml";
        const claimName = isLocal ? "local-block-pvc" : "my-app-data";
        const deployment: LocalDeployment = {
          name: deploymentName, namespace: manifestNamespace, replicas: 1, readyReplicas: 0, image: "my-app:latest", runtimeClassName: "edera", selector: "app=my-app",
          nodeSelector: isLocal ? { "kubernetes.io/hostname": "my-host" } : undefined, volumeClaimName: claimName, volumeMode: isBlock ? "Block" : "Filesystem", volumeTargetPath: isBlock ? (isLocal ? "/mnt/high-perf-storage" : "/var/lib/my-app/data") : "/var/lib/my-app/data",
        };
        deployments.push(deployment);
        const pod: LocalPod = { name: "my-app-00001", namespace: manifestNamespace, status: "Pending", age: "1s", image: deployment.image, ip: "<none>", node: "<none>", labels: { app: "my-app" }, runtimeClassName: "edera", ownerDeployment: deploymentName, nodeSelector: deployment.nodeSelector };
        pods.push(pod);
        bindStorage();
        const storageReady = storageReadyForDeployment(claimName, deployment.volumeMode!);
        if (!storageReady) {
          addEvent("Warning", "VolumeNotReady", `pod/${pod.name}`, isBlock ? `Waiting for block volume ${claimName} to be formatted before mounting ${deployment.volumeTargetPath}` : `Waiting for PersistentVolumeClaim ${claimName} to become bound`);
        }
        addEvent("Normal", "Created", `deployment/${deploymentName}`, `deployment.apps/${deploymentName} created with ${deployment.volumeMode} storage`);
        checkPendingPods();
        deployment.readyReplicas = pods.filter((item) => item.ownerDeployment === deploymentName && item.status === "Running").length;
        updateDashboard();
        printHtml(`<span style="color:#b8ff3c;">deployment.apps/${deploymentName} created</span>`);
        return true;
      }

      if (fileName === "nginx-deployment.yaml") {
        const deploymentName = "nginx";
        const manifestNamespace = requireManifestNamespace(manifestPath);
        if (!manifestNamespace) {
          return true;
        }
        const runtimeReady = activeRuntimeClasses.has("edera");
        const existing = deployments.find((deployment) => deployment.name === deploymentName);

        if (existing) {
          printHtml(`<span style="color:#a8cfca;">deployment.apps/${deploymentName} unchanged</span>`);
          return true;
        }

        const deployment: LocalDeployment = {
          name: deploymentName,
          namespace: manifestNamespace,
          replicas: 2,
          readyReplicas: 0,
          image: "nginx:1.14.2",
          runtimeClassName: "edera",
          selector: "app=nginx",
        };
        deployments.push(deployment);

        for (let i = 1; i <= deployment.replicas; i++) {
          const podName = `${deploymentName}-${String(i).padStart(5, "0")}`;
          pods.push({
            name: podName,
            namespace: manifestNamespace,
            status: "Pending",
            age: "1s",
            image: deployment.image,
            ip: "<none>",
            node: "<none>",
            labels: { app: "nginx" },
            runtimeClassName: "edera",
            ownerDeployment: deploymentName,
          });
        }

        addEvent("Normal", "Created", `deployment/${deploymentName}`, `deployment.apps/${deploymentName} created`);
        if (!runtimeReady) {
          addEvent("Warning", "ReplicaSetCreate", `deployment/${deploymentName}`, `Created ${deployment.replicas} Pending pods waiting for RuntimeClass "edera"`);
        }
        checkPendingPods();
        deployment.readyReplicas = pods.filter((pod) => pod.ownerDeployment === deploymentName && pod.status === "Running").length;

        updateDashboard();
        printHtml(`<span style="color:#b8ff3c;">deployment.apps/${deploymentName} created</span>`);
        markDemoStepComplete("deployment-apply");
        return true;
      }

      if (fileName === "pod-nginx.yaml") {
        const podName = "edera-protect-pod";
        const manifestNamespace = requireManifestNamespace(manifestPath);
        if (!manifestNamespace) {
          return true;
        }
        const runtimeReady = activeRuntimeClasses.has("edera");

        const existingPod = pods.find(
          (pod) =>
            pod.name === podName &&
            pod.namespace === manifestNamespace,
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

        pods.push({
          name: podName,
          namespace: manifestNamespace,
          status: "Pending",
          age: "1s",
          image: "nginx",
          ip: "<none>",
          node: "<none>",
          labels: { env: "test" },
          runtimeClassName: "edera",
        });

        addEvent(
          "Normal",
          "Created",
          `pod/${podName}`,
          `pod/${podName} created from manifest`,
        );

        if (!runtimeReady) {
          addEvent(
            "Warning",
            "FailedCreatePodSandBox",
            `pod/${podName}`,
            `Failed to create pod sandbox: RuntimeClass "edera" not found`,
          );
        }

        checkPendingPods();
        updateDashboard();

        printHtml(
          `<span style="color:#b8ff3c;">pod/${podName} created</span>`,
        );

        markDemoStepComplete("edera-pod-apply");
        return true;
      }

      if (fileName === "csi-block-pvc.yaml" || fileName === "filesystem-pvc.yaml") {
        const pvcName = "my-app-data";
        const pvcIndex = persistentVolumeClaims.findIndex((item) => item.name === pvcName);
        if (pvcIndex < 0) { printHtml(`<span style="color:#a8cfca;">persistentvolumeclaim/${pvcName} not found</span>`); return true; }
        const pvc = persistentVolumeClaims[pvcIndex];
        persistentVolumeClaims.splice(pvcIndex, 1);
        persistentVolumes = persistentVolumes.filter((pv) => pv.claimName !== `default/${pvcName}` && pv.name !== pvc.volumeName);
        addEvent("Normal", "Deleted", `persistentvolumeclaim/${pvcName}`, `persistentvolumeclaim/${pvcName} deleted`);
        updateDashboard(); printHtml(`<span style="color:#b8ff3c;">persistentvolumeclaim/${pvcName} deleted</span>`); return true;
      }

      if (fileName === "format-block-device.yaml") {
        const index = jobs.findIndex((job) => job.name === "format-block-device");
        if (index < 0) { printHtml(`<span style="color:#a8cfca;">job.batch/format-block-device not found</span>`); return true; }
        jobs.splice(index, 1); addEvent("Normal", "Deleted", "job/format-block-device", "Job format-block-device deleted"); updateDashboard(); printHtml(`<span style="color:#b8ff3c;">job.batch/format-block-device deleted</span>`); return true;
      }

      if (fileName === "local-nvme-pv.yaml") {
        persistentVolumes = persistentVolumes.filter((pv) => pv.name !== "local-raw-pv"); updateDashboard(); printHtml(`<span style="color:#b8ff3c;">persistentvolume/local-raw-pv deleted</span>`); return true;
      }

      if (fileName === "local-nvme-pvc.yaml") {
        persistentVolumeClaims = persistentVolumeClaims.filter((pvc) => pvc.name !== "local-block-pvc"); persistentVolumes = persistentVolumes.filter((pv) => pv.name !== "local-raw-pv"); updateDashboard(); printHtml(`<span style="color:#b8ff3c;">persistentvolumeclaim/local-block-pvc deleted</span>`); return true;
      }

      if (fileName === "csi-block-deployment.yaml" || fileName === "filesystem-deployment.yaml" || fileName === "local-nvme-deployment.yaml") {
        const ownedPods = pods.filter((pod) => pod.ownerDeployment === "my-app");
        pods = pods.filter((pod) => pod.ownerDeployment !== "my-app");
        deployments = deployments.filter((deployment) => deployment.name !== "my-app");
        protectWorkloads = protectWorkloads.filter((workload) => !ownedPods.some((pod) => pod.name === workload.sourcePodName));
        addEvent("Normal", "Deleted", "deployment/my-app", "deployment.apps/my-app deleted"); updateDashboard(); printHtml(`<span style="color:#b8ff3c;">deployment.apps/my-app deleted</span>`); return true;
      }

      if (fileName === "runtimeclass-edera.yaml") {
        // `kubectl apply` is declarative: re-applying an identical manifest
        // leaves the object untouched and reports "unchanged". The RuntimeClass
        // is cluster-scoped with no mutable fields in this demo, so an existing
        // "edera" entry always means the desired state is already met.
        if (activeRuntimeClasses.has("edera")) {
          printHtml(
            `<span style="color:#a8cfca;">runtimeclass.node.k8s.io/edera unchanged</span>`,
          );

          markDemoStepComplete("edera-runtimeclass-apply");
          return true;
        }

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
        const manifestNamespace = requireManifestNamespace(manifestPath);
        if (!manifestNamespace) {
          return true;
        }

        const runtimeReady =
          activeRuntimeClasses.has("edera");

        const existingPod = pods.find(
          (pod) =>
            pod.name === podName &&
            pod.namespace === manifestNamespace,
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

        pods.push({
          name: podName,
          namespace: manifestNamespace,
          status: "Pending",
          age: "1s",
          image: "denhamparry/leaky-vessel:0.1",
          ip: "<none>",
          node: "<none>",
          labels: {},
          runtimeClassName: "edera",
        });

        addEvent(
          "Normal",
          "Created",
          `pod/${podName}`,
          `pod/${podName} created from manifest`,
        );

        if (!runtimeReady) {
          addEvent(
            "Warning",
            "FailedCreatePodSandBox",
            `pod/${podName}`,
            `Failed to create pod sandbox: RuntimeClass "edera" not found`,
          );
        }

        checkPendingPods();
        updateDashboard();

        printHtml(
          `<span style="color:#b8ff3c;">pod/${podName} created</span>`,
        );

        return true;
      }

      return true;
    }
    if (tokens[1] === "describe") {
      const resource = tokens[2];
      const name = tokens[3];
      let requestedNamespace = "default";

      for (let i = 4; i < tokens.length; i++) {
        if (tokens[i] === "-n" || tokens[i] === "--namespace") {
          requestedNamespace = tokens[++i] || requestedNamespace;
        } else if (tokens[i].startsWith("--namespace=")) {
          requestedNamespace = tokens[i].split("=")[1] || requestedNamespace;
        }
      }

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

      if (resource === "deployment" || resource === "deployments" || resource === "deploy") {
        const deployment = deployments.find(
          (item) => item.name === name && item.namespace === requestedNamespace,
        );

        if (!deployment) {
          printHtml(
            `<span style="color:#ff7373;">Error from server (NotFound): deployments.apps "${escapeHtml(
              name,
            )}" not found</span>`,
          );
          return true;
        }

        const deploymentPods = pods.filter(
          (pod) => pod.ownerDeployment === deployment.name,
        );
        const runningPods = deploymentPods.filter(
          (pod) => pod.status === "Running",
        );
        const pendingPods = deploymentPods.filter(
          (pod) => pod.status === "Pending",
        );
        const failedPods = deploymentPods.filter(
          (pod) => pod.status === "Failed",
        );
        const deploymentEvents = clusterEvents.filter(
          (event) => event.object === `deployment/${deployment.name}`,
        );

        const nodeSelector = deployment.nodeSelector
          ? formatLabels(deployment.nodeSelector)
          : "<none>";
        const storageText = deployment.volumeClaimName
          ? `${deployment.volumeClaimName} (${deployment.volumeMode || "Filesystem"})`
          : "<none>";
        const targetPath = deployment.volumeTargetPath || "<none>";
        const runtimeClass = deployment.runtimeClassName || "<none>";

        const lines = [
          `Name:                   ${deployment.name}`,
          `Namespace:              ${deployment.namespace}`,
          `CreationTimestamp:      Thu, 06 Sep 2026 21:00:00 +0000`,
          `Labels:                 ${escapeHtml(deployment.selector)}`,
          `Annotations:            <none>`,
          `Selector:               ${escapeHtml(deployment.selector)}`,
          `Replicas:               ${deployment.replicas} desired | ${deployment.replicas} updated | ${deployment.readyReplicas} total | ${deployment.readyReplicas} available | 0 unavailable`,
          `StrategyType:           RollingUpdate`,
          `Pod Template:`,
          `  Labels:               ${escapeHtml(deployment.selector)}`,
          `  Containers:`,
          `    ${escapeHtml(deployment.image.split("/").pop()?.split(":")[0] || deployment.name)}:`,
          `      Image:            ${escapeHtml(deployment.image)}`,
          `      Port:             8080/TCP`,
          `      Host Port:        0/TCP`,
          `      Environment:      <none>`,
          `      Mounts:`,
          `        ${escapeHtml(targetPath)} from ${deployment.volumeClaimName ? escapeHtml(deployment.volumeClaimName) : "<none>"}`,
          `  Volumes:`,
          `    ${deployment.volumeClaimName ? escapeHtml(deployment.volumeClaimName) : "<none>"}:`,
          `      ClaimName:        ${deployment.volumeClaimName ? escapeHtml(deployment.volumeClaimName) : "<none>"}`,
          `      VolumeMode:       ${deployment.volumeMode || "Filesystem"}`,
          `  Node-Selectors:       ${escapeHtml(nodeSelector)}`,
          `  RuntimeClassName:     ${escapeHtml(runtimeClass)}`,
          `Conditions:`,
          `  Type           Status  Reason`,
          `  Available      ${deployment.readyReplicas >= deployment.replicas ? "True" : "False"}    ${deployment.readyReplicas >= deployment.replicas ? "MinimumReplicasAvailable" : "MinimumReplicasUnavailable"}`,
          `  Progressing    ${pendingPods.length === 0 && failedPods.length === 0 ? "True" : "False"}    ${pendingPods.length === 0 && failedPods.length === 0 ? "NewReplicaSetAvailable" : "ReplicaSetPending"}`,
          `OldReplicaSets:         <none>`,
          `NewReplicaSet:          ${deployment.name}-00001`,
          `Events:`,
          `  Type     Reason      Age   From                   Message`,
          `  ----     ------      ----  ----                   -------`,
          ...(deploymentEvents.length > 0
            ? deploymentEvents.slice(0, 8).map(
                (event) =>
                  `  ${event.type.padEnd(8)} ${event.reason.padEnd(12)} 1m    deployment-controller  ${event.message}`,
              )
            : [
                `  Normal   ScalingReplicaSet  1m    deployment-controller  Scaled up replica set ${deployment.name}-00001 to ${deployment.replicas}`,
              ]),
          `Pod Summary:             ${runningPods.length} Running, ${pendingPods.length} Pending, ${failedPods.length} Failed`,
          `Storage:                 ${escapeHtml(storageText)}`,
        ];

        printPre(escapeHtml(lines.join("\n")));
        return true;
      }

      if (resource === "pvc" || resource === "persistentvolumeclaim" || resource === "persistentvolumeclaims") {
        const pvc = persistentVolumeClaims.find((item) => item.name === name && item.namespace === "default");
        if (!pvc) { printHtml(`<span style="color:#ff7373;">Error from server (NotFound): persistentvolumeclaims "${escapeHtml(name)}" not found</span>`); return true; }
        const lines = [`Name:              ${pvc.name}`, `Namespace:         ${pvc.namespace}`, `Status:            ${pvc.status}`, `Volume:            ${pvc.volumeName}`, `Capacity:          ${pvc.capacity}`, `Access Modes:      ${pvc.accessModes}`, `VolumeMode:        ${pvc.volumeMode}`, `StorageClass:      ${pvc.storageClassName || "<none>"}`, `Formatted:         ${pvc.formatted}`, `Events:`, `  Normal  ${pvc.status === "Bound" ? "Bound" : "Pending"}  1m  controller  ${pvc.status === "Bound" ? `Successfully bound to ${pvc.volumeName}` : "Waiting for a matching PersistentVolume"}`];
        printPre(escapeHtml(lines.join("\n"))); return true;
      }

      if (resource === "pv" || resource === "persistentvolume" || resource === "persistentvolumes") {
        const pv = persistentVolumes.find((item) => item.name === name);
        if (!pv) { printHtml(`<span style="color:#ff7373;">Error from server (NotFound): persistentvolumes "${escapeHtml(name)}" not found</span>`); return true; }
        const lines = [`Name:              ${pv.name}`, `Status:            ${pv.status}`, `Claim:             ${pv.claimName || "<none>"}`, `Capacity:          ${pv.capacity}`, `Access Modes:      ${pv.accessModes}`, `VolumeMode:        ${pv.volumeMode}`, `Source:             ${pv.source}${pv.devicePath ? ` (${pv.devicePath})` : ""}`, `Node Affinity:     ${pv.nodeAffinity || "<none>"}`, `Formatted:         ${pv.formatted}`];
        printPre(escapeHtml(lines.join("\n"))); return true;
      }

      if (resource === "job" || resource === "jobs") {
        const job = jobs.find((item) => item.name === name && item.namespace === "default");
        if (!job) { printHtml(`<span style="color:#ff7373;">Error from server (NotFound): jobs.batch "${escapeHtml(name)}" not found</span>`); return true; }
        const lines = [`Name:              ${job.name}`, `Namespace:         ${job.namespace}`, `Completions:       ${job.succeeded}/${job.completions}`, `Status:            ${job.status}`, `Image:             ${job.image}`, `RuntimeClass:      ${job.runtimeClassName || "<default>"}`, `Device:            ${job.targetDevice || "<none>"}`, `Claim:             ${job.claimName || "<none>"}`];
        printPre(escapeHtml(lines.join("\n"))); return true;
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
    if (tokens[1] === "get") {
      const resource = tokens[2];

      if (
        resource === "pods" ||
        resource === "pod"
      ) {
        const allNamespaces =
          tokens.includes("-A") ||
          tokens.includes("--all-namespaces");
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

        const requestedPodName = tokens.find(
          (token, index) =>
            index > 2 &&
            !token.startsWith("-") &&
            !["pod", "pods"].includes(token),
        );

        if (
          outputFormat.includes("jsonpath") &&
          outputFormat.includes(".spec.runtimeClassName")
        ) {
          const pod = requestedPodName
            ? filtered.find((item) => item.name === requestedPodName)
            : filtered[0];

          if (!pod) {
            printHtml(
              `<span style="color:#ff7373;">Error from server (NotFound): pod "${escapeHtml(
                requestedPodName || "",
              )}" not found</span>`,
            );
            return true;
          }

          printPre(
            `<span style="color:#dff7f0;">${escapeHtml(
              pod.runtimeClassName || "",
            )}</span>`,
          );

          if (
            pod.name === "edera-protect-pod" &&
            pod.runtimeClassName === "edera"
          ) {
            markDemoStepComplete("edera-pod-runtimeclass");
          }

          return true;
        }

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

      if (resource === "pvc" || resource === "pvcs" || resource === "persistentvolumeclaims") {
        if (persistentVolumeClaims.length === 0) { printHtml(`<span style="color:#a8cfca;">No resources found.</span>`); return true; }
        let output = `<span style="color:#00e5d4;font-weight:700;">NAME                 STATUS    VOLUME              CAPACITY   ACCESS MODES   VOLUME MODE   STORAGECLASS</span>\n`;
        output += `<span style="color:#08736d;">${"─".repeat(105)}</span>\n`;
        for (const pvc of persistentVolumeClaims) output += `${escapeHtml(pvc.name.padEnd(21))}${escapeHtml(pvc.status.padEnd(10))}${escapeHtml(pvc.volumeName.padEnd(20))}${escapeHtml(pvc.capacity.padEnd(11))}${escapeHtml(pvc.accessModes.padEnd(15))}${escapeHtml(pvc.volumeMode.padEnd(14))}${escapeHtml((pvc.storageClassName || "<none>").padEnd(12))}\n`;
        printPre(output.trimEnd()); return true;
      }

      if (resource === "pv" || resource === "pvs" || resource === "persistentvolumes") {
        if (persistentVolumes.length === 0) { printHtml(`<span style="color:#a8cfca;">No resources found.</span>`); return true; }
        let output = `<span style="color:#00e5d4;font-weight:700;">NAME                 CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM</span>\n`;
        output += `<span style="color:#08736d;">${"─".repeat(92)}</span>\n`;
        for (const pv of persistentVolumes) output += `${escapeHtml(pv.name.padEnd(21))}${escapeHtml(pv.capacity.padEnd(11))}${escapeHtml(pv.accessModes.padEnd(15))}${"Delete".padEnd(17)}${escapeHtml(pv.status.padEnd(12))}${escapeHtml(pv.claimName || "<none>")}\n`;
        printPre(output.trimEnd()); return true;
      }

      if (resource === "job" || resource === "jobs") {
        if (jobs.length === 0) { printHtml(`<span style="color:#a8cfca;">No resources found.</span>`); return true; }
        let output = `<span style="color:#00e5d4;font-weight:700;">NAME                    COMPLETIONS   DURATION   AGE</span>\n`;
        output += `<span style="color:#08736d;">${"─".repeat(62)}</span>\n`;
        for (const job of jobs) output += `${escapeHtml(job.name.padEnd(24))}${`${job.succeeded}/${job.completions}`.padEnd(14)}${"1s".padEnd(11)}1s\n`;
        printPre(output.trimEnd()); return true;
      }

      if (resource === "runtimeclass" ||
        resource === "runtimeclasses") {
        const nameWidth = Math.max(
          8,
          ...Array.from(activeRuntimeClasses).map(
            (runtimeClass) => runtimeClass.length + 2,
          ),
        );
        const handlerWidth = 10;
        const ageWidth = 7;

        let output =
          `<span style="color:#00e5d4;font-weight:700;">` +
          `${"NAME".padEnd(nameWidth)}${"HANDLER".padEnd(handlerWidth)}${"AGE".padEnd(ageWidth)}` +
          `</span>\n`;

        output += `<span style="color:#08736d;">${"─".repeat(
          nameWidth + handlerWidth + ageWidth,
        )}</span>\n`;

        for (const runtimeClass of activeRuntimeClasses) {
          output +=
            `${escapeHtml(runtimeClass.padEnd(nameWidth))}` +
            `${escapeHtml(runtimeClass.padEnd(handlerWidth))}` +
            `${"1d".padEnd(ageWidth)}\n`;
        }

        printPre(output.trimEnd());

        if (activeRuntimeClasses.has("edera")) {
          markDemoStepComplete("edera-runtimeclass-list");
        }

        return true;
      }

      if (
        resource === "nodes" ||
        resource === "node"
      ) {
        const showLabels = tokens.includes("--show-labels");

        // Support Kubernetes-style label selectors such as `-l runtime=edera`
        // so `kubectl get nodes -l runtime=edera` only returns matching nodes.
        let labelSelector = "";
        for (let i = 3; i < tokens.length; i++) {
          if (tokens[i] === "-l" || tokens[i] === "--selector") {
            labelSelector = tokens[i + 1] || "";
            break;
          }
          if (tokens[i].startsWith("-l=")) {
            labelSelector = tokens[i].slice(3);
            break;
          }
          if (tokens[i].startsWith("--selector=")) {
            labelSelector = tokens[i].slice("--selector=".length);
            break;
          }
        }

        const selectedNodes = labelSelector
          ? nodes.filter((node) => {
              return labelSelector.split(",").every((selector) => {
                const expression = selector.trim();
                if (!expression) return true;

                const equalsIndex = expression.indexOf("=");
                if (equalsIndex >= 0) {
                  const key = expression.slice(0, equalsIndex).trim();
                  const value = expression.slice(equalsIndex + 1).trim();
                  return key.length > 0 && node.labels[key] === value;
                }

                return Object.prototype.hasOwnProperty.call(
                  node.labels,
                  expression,
                );
              });
            })
          : nodes;

        if (selectedNodes.length === 0) {
          printHtml(`<span style="color:#a8cfca;">No resources found.</span>`);
          return true;
        }

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
          ...selectedNodes.map((node) => node.name.length + 2),
        );
        const statusWidth = Math.max(
          11,
          ...selectedNodes.map((node) => node.status.length + 2),
        );
        const rolesWidth = Math.max(
          15,
          ...selectedNodes.map((node) => getNodeRoles(node).length + 2),
        );
        const ageWidth = Math.max(
          7,
          ...selectedNodes.map((node) => node.age.length + 2),
        );
        const versionWidth = Math.max(
          20,
          ...selectedNodes.map((node) => node.version.length + 2),
        );
        const internalIpWidth = Math.max(
          16,
          ...selectedNodes.map((node) => node.internalIp.length + 2),
        );
        const externalIpWidth = Math.max(
          16,
          ...selectedNodes.map((node) => node.externalIp.length + 2),
        );
        const osImageWidth = Math.max(
          18,
          ...selectedNodes.map((node) => node.osImage.length + 2),
        );
        const kernelWidth = Math.max(
          22,
          ...selectedNodes.map((node) => node.kernelVersion.length + 2),
        );
        const runtimeWidth = Math.max(
          22,
          ...selectedNodes.map((node) => node.containerRuntime.length + 2),
        );
        const labelWidth = Math.max(
          40,
          ...selectedNodes.map(
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

        for (const node of selectedNodes) {
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
    if (tokens[1] === "wait") {
      const target = tokens.find((token) => token.startsWith("job/"));
      if (!target) {
        printHtml(`<span style="color:#ff7373;">Usage: kubectl wait --for=condition=complete job/<name> [--timeout=120s]</span>`);
        return true;
      }
      const jobName = target.slice(4);
      const job = jobs.find((item) => item.name === jobName && item.namespace === "default");
      if (!job) {
        printHtml(`<span style="color:#ff7373;">Error from server (NotFound): jobs.batch "${escapeHtml(jobName)}" not found</span>`);
        return true;
      }
      markJobComplete(job);
      bindStorage();
      checkPendingPods();
      for (const deployment of deployments) deployment.readyReplicas = pods.filter((pod) => pod.ownerDeployment === deployment.name && pod.status === "Running").length;
      updateDashboard();
      printHtml(`<span style="color:#b8ff3c;">job.batch/${escapeHtml(jobName)} condition met</span>`);
      return true;
    }

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

      if (
        node.name === "node-3" &&
        labelExpression === "runtime=edera"
      ) {
        markDemoStepComplete("edera-node-label");
      }

      return true;
    }
    if (tokens[1] === "delete" && tokens[2] === "-f") {
      const requestedPath = tokens[3];
      const manifestPath = requestedPath ? resolveVirtualPath(requestedPath) : "";
      const fileName = manifestPath ? virtualBasename(manifestPath) : "";

      if (!requestedPath || !getVirtualFile(manifestPath)) {
        printHtml(
          `<span style="color:#ff7373;">error: the path "${escapeHtml(
            requestedPath || "",
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
          pod.status = "Pending";
          pod.node = "<none>";
          pod.ip = "<none>";

          addEvent(
            "Warning",
            "NodeEviction",
            `pod/${pod.name}`,
            `Pod evicted from deleted node ${nodeName}; waiting for a schedulable node`,
          );
        }
      });

      checkPendingPods();

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
        if (tokens[0] === "sudo") {
          tokens = tokens.slice(1);
        }
        if (tokens[0] === "clear") {
          output.innerHTML = "";
          return;
        }
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
          tokens[0] === "systemctl" &&
          tokens[1] === "restart" &&
          tokens[2] === "falco"
        ) {
          falcoInstalled = true;
          falcoConfigured = true;
          falcoRulesLoaded = true;
          falcoRunning = true;
          ederaFalcoPluginLoaded = true;
          falcoLogLines = [];
          falcoStreamMode = null;

          printHtml(
            `<span style="color:#b8ff3c;">Falco restarted successfully.</span>`,
          );
          printHtml(
            `<span style="color:#00e5d4;">Loaded plugin: edera</span>`,
          );

          addEvent(
            "Normal",
            "FalcoPluginLoaded",
            "falco/edera",
            "Edera Falco plugin loaded successfully and is waiting for zones",
          );

          markDemoStepComplete("falco-restart");
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
        if (tokens[0] === "pwd") {
          printHtml(
            `<span style="color:#dff7f0;">${escapeHtml(
              currentDirectory,
            )}</span>`,
          );
          return;
        }

        if (tokens[0] === "cd") {
          const requestedPath = tokens[1] || "~";
          const targetPath = resolveVirtualPath(requestedPath);

          if (!isVirtualDirectory(targetPath)) {
            printHtml(
              `<span style="color:#ff7373;">cd: ${escapeHtml(
                requestedPath,
              )}: No such file or directory</span>`,
            );
            return;
          }

          currentDirectory = targetPath;
          updateTerminalPrompt();
          return;
        }

        if (tokens[0] === "ls") {
          const args = tokens.slice(1);
          const requestedFlags = args.filter((arg) => arg.startsWith("-"));
          const pathArgs = args.filter((arg) => !arg.startsWith("-"));
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

          const hasUnsupportedFlags = requestedFlags.some(
            (flag) =>
              flag !== "-l" &&
              flag !== "-a" &&
              flag !== "-la" &&
              flag !== "-al",
          );

          if (hasUnsupportedFlags || (requestedFlags.length > 0 && !supportedLongListing)) {
            printHtml(
              `<span style="color:#ff7373;">ls: unsupported option. Try: ls, ls -la, or ls &lt;directory&gt;</span>`,
            );
            return;
          }

          if (pathArgs.length > 1) {
            printHtml(
              `<span style="color:#ff7373;">ls: too many arguments</span>`,
            );
            return;
          }

          const targetPath = resolveVirtualPath(pathArgs[0] || currentDirectory);

          if (!isVirtualDirectory(targetPath)) {
            printHtml(
              `<span style="color:#ff7373;">ls: cannot access '${escapeHtml(
                pathArgs[0] || targetPath,
              )}': No such file or directory</span>`,
            );
            return;
          }

          const entries = listVirtualDirectory(targetPath);

          if (!supportedLongListing) {
            const renderedEntries = entries
              .map(
                (entry) =>
                  `<span style="color:${
                    entry.isDirectory ? "#00e5d4" : "#5e9f2d"
                  };font-weight:600;">${escapeHtml(entry.name)}${
                    entry.isDirectory ? "/" : ""
                  }</span>`,
              )
              .join("  ");

            printHtml(
              renderedEntries ||
                `<span style="color:#a8cfca;">(empty)</span>`,
            );
            return;
          }

          const fileEntries = entries.filter((entry) => !entry.isDirectory);
          const totalSize = fileEntries.reduce(
            (sum, entry) =>
              sum +
              (localFileMetadata[entry.path]?.size ||
                getVirtualFile(entry.path)?.length ||
                0),
            0,
          );

          const longListing = [
            `total ${totalSize}`,
            `${READ_ONLY_DIRECTORY_MODE} 1 user 197609        0 Apr  9 07:53 ./`,
            `${READ_ONLY_DIRECTORY_MODE} 1 user 197609        0 Apr  9 07:42 ../`,
            ...entries.map((entry) => {
              if (entry.isDirectory) {
                return `${READ_ONLY_DIRECTORY_MODE} 1 user 197609        0 Apr  9 07:42 ${entry.name}/`;
              }

              const metadata = localFileMetadata[entry.path] || {
                size: getVirtualFile(entry.path)?.length || 0,
                modified: "Apr  9 07:48",
              };

              return `${READ_ONLY_FILE_MODE} 1 user 197609 ${String(
                metadata.size,
              ).padStart(8, " ")} ${metadata.modified} ${entry.name}`;
            }),
          ].join("\n");

          printPre(
            `<span style="color:#dff7f0;">${escapeHtml(
              longListing,
            )}</span>`,
          );

          return;
        }
        if (tokens[0] === "cat") {
          const fileName = tokens[1];

          if (fileName === "/etc/falco/config.d/falco-edera-config.yaml") {
            printPre(
              `<span style="color:#dff7f0;">${escapeHtml(FALCO_EDERA_CONFIG_YAML)}</span>`,
            );
            falcoConfigured = true;
            markDemoStepComplete("falco-config");
            return;
          }

          if (fileName === "/etc/falco/rules.d/falco-edera-rules.yaml") {
            printPre(
              `<span style="color:#dff7f0;">${escapeHtml(FALCO_EDERA_RULES_YAML)}</span>`,
            );
            falcoRulesLoaded = true;
            markDemoStepComplete("falco-rules");
            return;
          }

          if (fileName === "falco-edera-values.yaml" || fileName === "/falco-edera-values.yaml") {
            printPre(
              `<span style="color:#dff7f0;">${escapeHtml(FALCO_HELM_VALUES_YAML)}</span>`,
            );
            markDemoStepComplete("falco-helm-values");
            return;
          }

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
          } else {
            const manifestPath = resolveVirtualPath(fileName);
            const manifest = getVirtualFile(manifestPath);

            if (manifest) {
              printPre(escapeHtml(manifest));
            } else {
              printHtml(
                `<span style="color:#ff7373;">cat: ${escapeHtml(
                  fileName,
                )}: No such file or directory</span>`,
              );
            }
          }

          return;
        }
        if (tokens[0] === "falco") {
          const debug = rawCmd.includes('log_level=debug');

          if (!debug) {
            printHtml(
              `<span style="color:#ff7373;">falco: this simulator supports only -o "log_level=debug".</span>`,
            );
            return;
          }

          falcoInstalled = true;
          falcoRunning = true;
          ederaFalcoPluginLoaded = true;
          renderFalcoDebugOutput("node");
          markDemoStepComplete("falco-debug");
          return;
        }

        if (tokens[0] === "helm") {
          if (
            tokens[1] === "upgrade" &&
            tokens[2] === "falco" &&
            tokens.includes("falcosecurity/falco")
          ) {
            falcoInstalled = true;
            falcoConfigured = true;
            falcoRulesLoaded = true;
            falcoRunning = true;
            ederaFalcoPluginLoaded = true;
            falcoLogLines = [];
            falcoStreamMode = null;

            printHtml(
              `<span style="color:#b8ff3c;">Release "falco" upgraded successfully.</span>`,
            );
            printHtml(
              `<span style="color:#00e5d4;">Edera plugin mounted and configured.</span>`,
            );

            addEvent(
              "Normal",
              "FalcoHelmConfigured",
              "helm/falco",
              "Falco Helm release updated with Edera plugin and detection rules",
            );

            markDemoStepComplete("falco-helm-upgrade");
            return;
          }

          printHtml(
            `<span style="color:#ff7373;">helm: unsupported command in this demo.</span>`,
          );
          return;
        }

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
        if (
          tokens[0] === "help" ||
          rawCmd === "kubectl --help" ||
          rawCmd === "kubectl -h"
        ) {
          printHtml(formatHelpText());
          return;
        }
        if (tokens[0] === "protect") {
          await handleProtectCommand(
            rawCmd,
            tokens,
          );
          return;
        }
        if (tokens[0] === "kubectl") {
          if (tokens[1] === "get" && tokens[2] === "pods" && tokens.includes("-n") && tokens[tokens.indexOf("-n") + 1] === "falco") {
            printPre(
              `<span style="color:#dff7f0;">NAME                                      READY   STATUS    RESTARTS   AGE
falco-edera-node-7d8f9                   1/1     Running   0          2m</span>`,
            );
            markDemoStepComplete("falco-pods");
            return;
          }

          if (tokens[1] === "logs" && tokens.includes("-n") && tokens[tokens.indexOf("-n") + 1] === "falco") {
            falcoInstalled = true;
            falcoRunning = true;
            ederaFalcoPluginLoaded = true;
            renderFalcoDebugOutput("helm");
            markDemoStepComplete("falco-logs");
            return;
          }

          const handled =
            await handleKubectlCommand(
              rawCmd,
              tokens,
            );

          if (handled) {
            return;
          }
        }
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
