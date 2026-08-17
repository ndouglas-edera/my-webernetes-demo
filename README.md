# Webernetes demo
This project is a port of a subset of the Kubernetes project to make it such that clusters can be booted up in the browser, without any backend server components.

### Preview
--> https://ndouglas-edera.github.io/my-webernetes-demo

<br/>
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


