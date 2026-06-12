# Troubleshooting & Deployment SOP: SettleUp (Splitwise) on EKS

This Standard Operating Procedure (SOP) documents the troubleshooting steps and resolutions for issues encountered during the deployment of the SettleUp application on an AWS EKS cluster, integrated with NGINX Gateway Fabric, cert-manager, GoDaddy DNS, and an external Oracle Cloud MySQL database.

---

## Table of Contents
1. [Issue 1: Unable to Find NGINX Gateway External Load Balancer IP](#issue-1-unable-to-find-nginx-gateway-external-load-balancer-ip)
2. [Issue 2: HTTPS Listener in Accepted/Programmed False (Missing TLS Secret)](#issue-2-https-listener-in-acceptedprogrammed-false-missing-tls-secret)
3. [Issue 3: ACME Challenge Stuck in Pending with "Gateway API is not Enabled" Error](#issue-3-acme-challenge-stuck-in-pending-with-gateway-api-is-not-enabled-error)
4. [Issue 4: ACME Challenge Stuck in Pending with "No Such Host" (DNS Propagation)](#issue-4-acme-challenge-stuck-in-pending-with-dns-propagation)
5. [Issue 5: Backend 500 Internal Server Error (MySQL Access Denied for User)](#issue-5-backend-500-internal-server-error-mysql-access-denied-for-user)

---

## Issue 1: Unable to Find NGINX Gateway External Load Balancer IP

### Symptom
Checking services in the control plane namespace returned only an internal `ClusterIP` service:
```bash
$ kubectl get service -n nginx-gateway
NAME                       TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
ngf-nginx-gateway-fabric   ClusterIP   10.100.150.93   <none>        443/TCP   38m
```

### Root Cause
In NGINX Gateway Fabric (NGF), the service in the `nginx-gateway` namespace is the internal control plane service. The actual data plane `LoadBalancer` service is provisioned dynamically in the **same namespace as the `Gateway` resource** itself. In this deployment, the `Gateway` is defined in the `splitwise` namespace.

### Resolution
List the services in the application namespace to retrieve the external AWS Load Balancer hostname:
```bash
kubectl get service -n splitwise
```
*Look for the service named `splitwise-gateway` (or similar) of type `LoadBalancer` to find the `EXTERNAL-IP`.*

---

## Issue 2: HTTPS Listener in Accepted/Programmed False (Missing TLS Secret)

### Symptom
Describing the Gateway showed that the `http` listener was working, but the `https` listener failed:
```yaml
message: 'tls.certificateRefs[0]: Invalid value: {"Namespace":"splitwise","Name":"splitwise-tls-cert"}: Secret splitwise/splitwise-tls-cert does not exist'
reason: InvalidCertificateRef
status: "False"
type: Accepted
```

### Root Cause
Cert-manager did not automatically create the `Certificate` resource because **Gateway API support** was not enabled in the cert-manager controller, meaning the cert-manager "gateway-shim" did not reconcile the Gateway annotations.

### Resolution
Apply the `Certificate` resource manually to request the TLS certificate from Let's Encrypt. 

1. Create a certificate manifest `k8s/09a-certificate.yaml`:
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: Certificate
   metadata:
     name: splitwise-tls-cert
     namespace: splitwise
   spec:
     secretName: splitwise-tls-cert
     dnsNames:
       - "splitwise.devopshome.online"
       - "splitewise.devopshome.online"
     issuerRef:
       name: letsencrypt-prod
       kind: ClusterIssuer
       group: cert-manager.io
   ```
2. Apply the manifest:
   ```bash
   kubectl apply -f k8s/09a-certificate.yaml
   ```

---

## Issue 3: ACME Challenge Stuck in Pending with "Gateway API is not Enabled" Error

### Symptom
Describing the ACME challenges showed the following warning:
```
Error presenting challenge: couldn't Present challenge splitwise/...: gateway api is not enabled
```

### Root Cause
The `letsencrypt-prod` ClusterIssuer is configured to use the `http01.gatewayHTTPRoute` solver. Since the cert-manager controller did not have Gateway API support enabled, it was unable to dynamically provision the temporary `HTTPRoute` required to solve the Let's Encrypt challenge.

### Resolution
Enable Gateway API support in the cert-manager deployment.

* **If installed via Helm:**
  Upgrade the Helm release:
  ```bash
  helm upgrade cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --reuse-values \
    --set config.enableGatewayAPI=true
  ```

* **If installed via YAML Manifests:**
  Patch the `cert-manager` deployment to append the configuration flag to the container arguments:
  
  *For cert-manager v1.15+:*
  ```bash
  kubectl patch deployment cert-manager -n cert-manager --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--enable-gateway-api"}]'
  ```
  *For cert-manager < v1.15:*
  ```bash
  kubectl patch deployment cert-manager -n cert-manager --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--feature-gates=ExperimentalGatewayAPISupport=true"}]'
  ```

Restart the controller to apply:
```bash
kubectl rollout restart deployment cert-manager -n cert-manager
```

---

## Issue 4: ACME Challenge Stuck in Pending with "No Such Host" (DNS Propagation)

### Symptom
Challenges stayed in the `pending` state with the following reason:
```
Waiting for HTTP-01 challenge propagation: failed to perform self check GET request 'http://splitwise.devopshome.online/...': dial tcp: lookup splitwise.devopshome.online on 10.100.0.10:53: no such host
```

### Root Cause
Before notifying Let's Encrypt to perform verification, cert-manager runs a self-check. The domain name was not yet resolving to the AWS Load Balancer IP within the cluster's DNS (CoreDNS) because either:
1. The DNS records were not added in GoDaddy.
2. The DNS changes had not propagated yet.

### Resolution
1. **Add DNS Records in GoDaddy:**
   Add two **CNAME** records in your GoDaddy DNS settings:
   
   | Type | Host/Name | Points to | TTL |
   | :--- | :--- | :--- | :--- |
   | CNAME | `splitwise` | `a8421302d64b34059a6fa04ea48db417-1140569083.us-east-1.elb.amazonaws.com` | 1 Hour |
   | CNAME | `splitewise` | `a8421302d64b34059a6fa04ea48db417-1140569083.us-east-1.elb.amazonaws.com` | 1 Hour |

2. **Wait for Propagation:**
   Wait 2–5 minutes for DNS servers to update. You can verify propagation using:
   ```bash
   nslookup splitwise.devopshome.online
   ```
   Once resolved, the self-check passes, Let's Encrypt verifies the HTTPRoute, and the certificate is issued (`READY: True`).

---

## Issue 5: Backend 500 Internal Server Error (MySQL Access Denied for User)

### Symptom
Logging in via the frontend web app returned a `500 (Internal Server Error)`. Examining the backend logs showed:
```
Login error: Error: Access denied for user 'splitwise_user'@'ec2-3-239-12-8.compute-1.amazonaws.com' (using password: YES)
code: 'ER_ACCESS_DENIED_ERROR', errno: 1045, sqlState: '28000'
```

### Root Cause
1. The EKS pod was attempting to connect to the database with the user `splitwise_user`, but the correct database user was `wms_app`.
2. MySQL verifies connections based on both user credentials and the source IP/hostname. If the user does not have permission to connect from the AWS node IP (`%` wildcard), MySQL rejects the handshake.

> [!NOTE]
> Rebuilding the Docker image was **not** required because `.env` is ignored by `.dockerignore` during build time. The application reads environment variables injected by Kubernetes at runtime.

### Resolution
1. **Update the Kubernetes Secret:**
   Edit `k8s/secrets.yaml` (or `k8s/03-backend-secret.yaml`) to update the database user:
   ```yaml
   stringData:
     DB_USER: "wms_app"
   ```
   Apply the updated secret:
   ```bash
   kubectl apply -f k8s/secrets.yaml
   ```

2. **Restart the Backend Pods:**
   Force the pods to restart and load the updated secret variables:
   ```bash
   kubectl rollout restart deployment splitwise-backend -n splitwise
   kubectl rollout status deployment splitwise-backend -n splitwise
   ```

3. **Grant Wildcard Host Privileges in MySQL (if access denied persists):**
   If the new user `wms_app` is still blocked from connecting from AWS, SSH into the Oracle Cloud VM and update the MySQL privileges:
   ```sql
   -- Log in to MySQL as root
   sudo mysql -u root -p

   -- Grant permissions to connect from any remote host (%)
   CREATE USER IF NOT EXISTS 'wms_app'@'%' IDENTIFIED BY 'Ajaykumar@12.';
   GRANT ALL PRIVILEGES ON splitwise.* TO 'wms_app'@'%';
   FLUSH PRIVILEGES;
   ```
