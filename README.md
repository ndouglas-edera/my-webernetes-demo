# Webernetes demo
This project is a port of a specific subset of the Kubernetes project to make it such that clusters can be booted up in the browser, without any backend server components. If you'd like to learn more about the **Webernetes** project, check out **[ngrok's Github repo](https://github.com/ngrok/webernetes)**.

**Preview:** <br/>
--> https://ndouglas-edera.github.io/my-webernetes-demo
<br/><br/>
**Blog post:** <br/>
--> https://coderlegion.com/24792/webernetes-kubernetes-in-your-browser
<br/>

---

## Assign pods to a specific node

You can list the files in the demo terminal and even simulate reading a manifest file:

```
ls
cat pod-nginx.yaml
```

Applying the manifest leads to a ```FailedScheduling``` error for (```pod/nginx```) since none of the 3 nodes match the Pod's node selector
```
kubectl apply -f pod-nginx.yaml
```
```
kubectl get pods
```

<img width="1506" height="781" alt="Screenshot 2026-08-17 at 18 41 23" src="https://github.com/user-attachments/assets/446000fe-f069-4e9a-add2-9e14263cf471" />


This can be addressed by simply assigning the matching pod label to one of the 3 nodes:
```
kubectl label nodes node-3 disktype=ssd
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

<img width="1506" height="781" alt="Screenshot 2026-08-17 at 18 50 17" src="https://github.com/user-attachments/assets/e0fe0e40-8ad1-459b-9942-8ca976d28d47" />


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

<img width="1506" height="781" alt="Screenshot 2026-08-18 at 20 40 03" src="https://github.com/user-attachments/assets/0b668f13-9ed7-45d4-963b-52aa2ad5dc8a" />


## NVIDIA GPU passthrough to an Edera zone

Supported GPUs, like the Tesla, should show up in the output of ```lspci```:
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
