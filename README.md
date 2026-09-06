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
| Assign pods to a specific node | [Link](https://github.com/ndouglas-edera/my-webernetes-demo#assign-pods-to-a-specific-node) | Insert Description |
| Run pods with an assigned label | [Link](https://github.com/ndouglas-edera/my-webernetes-demo#run-pods-with-an-assigned-label) | Insert Description |
| Working with namespaces | [Link](https://github.com/ndouglas-edera/my-webernetes-demo#working-with-namespaces) | Insert Description |
| NVIDIA GPU passthrough |  [Link](https://github.com/ndouglas-edera/my-webernetes-demo#nvidia-gpu-passthrough-to-an-edera-zone)   | Load NVIDIA driver & run GPU-accelerated workload in zone. |
| Using storage in Kubernetes |  [Link](https://github.com/ndouglas-edera/my-webernetes-demo#using-storage-in-kubernetes)   | Edera supports native Kubernetes storage APIs. |

---

## Assign pods to a specific node

You can list the files in the demo terminal and even simulate reading a manifest file:

```
ls -la
```
```
cat runtimeclass-edera.yaml
```

Create a ```RuntimeClass``` called ```edera``` and label a specific node with the runtime context.
```
kubectl apply -f runtimeclass-edera.yaml
```
```
kubectl label node node-2 runtime=edera
```

Applying the manifest leads to a ```FailedScheduling``` error for (```pod/nginx```) since none of the 3 nodes match the Pod's node selector
```
kubectl apply -f pod-nginx.yaml
```
```
kubectl get pods
```




## Run pods with an assigned label

Run a pod with a specific label ```env=prod```
```
kubectl run ubuntu --image=ubuntu:latest --labels="env=prod"
```

Confirm the labels are assigned to the pod
```
kubectl get pods --show-labels
```


## Working with namespaces

Check for pods in all namespaces
```
kubectl get pods -A
```

Check what namespaces exist:
```
kubectl get namespaces
```

Create your own custom ```edera``` namespace:
```
kubectl create namespace edera
```

Run a new workload inside the ```edera``` namespace:
```
kubectl run ubuntu --image=ubuntu:latest --labels="env=prod" -n edera
```


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
kubectl apply -f csi-block-pvc.yaml
```

Create the formatter ```Job```:
```
kubectl apply -f format-block-device.yaml
```

Wait for formatting to complete:
```
kubectl wait --for=condition=complete job/format-block-device --timeout=120s
```
Then deploy the Edera workload:
```
kubectl apply -f csi-block-deployment.yaml
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


And:
```
kubectl describe pvc my-app-data
```
```
kubectl describe job format-block-device
```

<img width="1507" height="765" alt="Screenshot 2026-09-06 at 22 39 35" src="https://github.com/user-attachments/assets/1e00caa3-b036-4c43-b9a3-6776dd6ee5f3" />


### Step 2: Filesystem-mounted PVC:
Create the ```PersistentVolumeClaims```:
```
kubectl apply -f filesystem-pvc.yaml
```
Then deploy the workload:
```
kubectl apply -f filesystem-deployment.yaml
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


### Step 3: Local NVMe block device:
Create the local ```PersistentVolume```:
```
kubectl apply -f local-nvme-pv.yaml
```
Create the ```PersistentVolumeClaims```:
```
kubectl apply -f local-nvme-pvc.yaml
```
Then deploy the Edera workload:
```
kubectl apply -f local-nvme-deployment.yaml
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

