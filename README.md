# my-webernetes-demo
This project is a port of a subset of the Kubernetes project to make it such that clusters can be booted up in the browser, without any backend server components.

### Preview
--> https://ndouglas-edera.github.io/my-webernetes-demo


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

<img width="1506" height="819" alt="Screenshot 2026-08-17 at 17 34 51" src="https://github.com/user-attachments/assets/1339522c-4a2b-49db-97e9-c8d9a26fa4d3" />

This can be addressed by simply assigning the matching pod label to one of the 3 nodes:
```
kubectl label nodes node-3 disktype=ssd
```

<img width="1506" height="819" alt="Screenshot 2026-08-17 at 17 33 58" src="https://github.com/user-attachments/assets/d0443ee8-c563-4fd9-9e5e-b618ded431d9" />
