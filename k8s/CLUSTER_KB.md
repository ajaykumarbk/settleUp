# Knowledge Base: EKS Cluster Setup & Core Infrastructure Config

This document outlines the step-by-step procedure to provision and configure the EKS cluster (`prod-lab-cluster`) and all its underlying platform utilities (NGINX Gateway Fabric, cert-manager, AWS EBS CSI driver, and DNS configurations).

---

## 1. Prerequisites & CLI Installation
Before starting, ensure you have the following CLI tools installed locally and configured:
* **AWS CLI** (configured with your AWS account credentials via `aws configure`)
* **eksctl** (AWS EKS CLI management tool)
* **kubectl** (Kubernetes controller CLI)
* **helm** (Kubernetes package manager)

---

## 2. Provisioning the EKS Cluster
The cluster is configured using the [10-cluster.yaml](file:///c:/Users/ajayk/.gemini/antigravity/scratch/splitwise/k8s/10-cluster.yaml) configuration file.

1. **Deploy the Cluster:**
   ```bash
   eksctl create cluster -f k8s/10-cluster.yaml
   ```
   *Note: This process takes roughly 15 to 20 minutes as AWS provisions the VPC, Managed Node Groups, Control Plane, and Core Addons.*

2. **Configure Local kubectl Context:**
   Ensure your local shell context points to the new cluster:
   ```bash
   aws eks update-kubeconfig --region us-east-1 --name prod-lab-cluster
   ```

---

## 3. Configuring Persistent Storage (AWS EBS CSI Driver)
To support persistent volumes (e.g., uploaded backend files), EKS needs the Amazon EBS CSI driver addon and corresponding IAM permissions.

1. **Create the IAM OIDC Provider** (required for Service Accounts to authenticate with AWS IAM):
   ```bash
   eksctl utils associate-iam-oidc-provider --cluster prod-lab-cluster --approve
   ```

2. **Create the IAM Role for the EBS CSI Driver Service Account:**
   Replace `<AWS_ACCOUNT_ID>` with your AWS Account ID:
   ```bash
   eksctl create iamserviceaccount \
     --name ebs-csi-controller-sa \
     --namespace kube-system \
     --cluster prod-lab-cluster \
     --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
     --approve \
     --role-only \
     --role-name AmazonEKS_EBS_CSI_DriverRole
   ```

3. **Install/Add the `aws-ebs-csi-driver` Addon:**
   ```bash
   eksctl create addon \
     --name aws-ebs-csi-driver \
     --cluster prod-lab-cluster \
     --service-account-role-arn arn:aws:iam::<AWS_ACCOUNT_ID>:role/AmazonEKS_EBS_CSI_DriverRole \
     --force
   ```

4. **Apply the StorageClass:**
   Apply the gp3 storage class defined in [00-storageclass.yaml](file:///c:/Users/ajayk/.gemini/antigravity/scratch/splitwise/k8s/00-storageclass.yaml):
   ```bash
   kubectl apply -f k8s/00-storageclass.yaml
   ```

---

## 4. Installing Gateway API CRDs & NGINX Gateway Fabric
NGINX Gateway Fabric (NGF) relies on the Kubernetes Gateway API. The CRDs must be applied before installing the gateway fabric.

1. **Install Gateway API CRDs:**
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml
   ```

2. **Install NGINX Gateway Fabric using Helm:**
   ```bash
   helm install ngf oci://ghcr.io/nginx/charts/nginx-gateway-fabric \
     --create-namespace \
     -n nginx-gateway
   ```

---

## 5. Installing cert-manager with Gateway API Support
To automate Let's Encrypt TLS certificate provisioning, install cert-manager with the Gateway API feature gate enabled.

1. **Add the Jetstack Helm repository:**
   ```bash
   helm repo add jetstack https://charts.jetstack.io
   helm repo update
   ```

2. **Install cert-manager with `config.enableGatewayAPI=true`:**
   ```bash
   helm install cert-manager jetstack/cert-manager \
     --namespace cert-manager \
     --create-namespace \
     --set installCRDs=true \
     --set config.enableGatewayAPI=true
   ```

---

## 6. Deploying SettleUp Applications & Routing

1. **Apply Namespace and Storage Claims:**
   ```bash
   kubectl apply -f k8s/01-namespace.yaml
   kubectl apply -f k8s/02-backend-pvc.yaml
   ```

2. **Deploy Configuration Secrets:**
   Apply [secrets.yaml](file:///c:/Users/ajayk/.gemini/antigravity/scratch/splitwise/k8s/secrets.yaml):
   ```bash
   kubectl apply -f k8s/secrets.yaml
   ```

3. **Deploy Backend and Frontend Workloads:**
   ```bash
   kubectl apply -f k8s/04-backend-deployment.yaml
   kubectl apply -f k8s/05-backend-service.yaml
   kubectl apply -f k8s/06-frontend-deployment.yaml
   kubectl apply -f k8s/07-frontend-service.yaml
   ```

4. **Deploy the Gateway and routing Rules:**
   Apply the Gateway and HTTPRoute definitions in [08-gateway.yaml](file:///c:/Users/ajayk/.gemini/antigravity/scratch/splitwise/k8s/08-gateway.yaml):
   ```bash
   kubectl apply -f k8s/08-gateway.yaml
   ```

5. **Deploy the Let's Encrypt ClusterIssuer:**
   Apply [09-issuer.yaml](file:///c:/Users/ajayk/.gemini/antigravity/scratch/splitwise/k8s/09-issuer.yaml):
   ```bash
   kubectl apply -f k8s/09-issuer.yaml
   ```

6. **Create the Certificate Resource:**
   Apply [09a-certificate.yaml](file:///c:/Users/ajayk/.gemini/antigravity/scratch/splitwise/k8s/09a-certificate.yaml) to initiate cert acquisition:
   ```bash
   kubectl apply -f k8s/09a-certificate.yaml
   ```

---

## 7. DNS & Verification (GoDaddy Configuration)

1. **Retrieve External Gateway Address:**
   Find the external address of your newly provisioned Gateway:
   ```bash
   kubectl get gateway splitwise-gateway -n splitwise -o jsonpath='{.status.addresses[0].value}'
   ```
   *(This resolves to an AWS ELB DNS name like `*.us-east-1.elb.amazonaws.com`).*

2. **Configure GoDaddy CNAMEs:**
   In your GoDaddy DNS settings for `devopshome.online`, add:
   * **Host:** `splitwise` $\rightarrow$ **Points to:** `<AWS_ELB_HOSTNAME>`
   * **Host:** `splitewise` $\rightarrow$ **Points to:** `<AWS_ELB_HOSTNAME>`

3. **Verify Everything is Green:**
   Check that your TLS certificate resolves to a ready state:
   ```bash
   kubectl get certificate -n splitwise
   ```
   *Expected output:*
   ```
   NAME                 READY   SECRET               AGE
   splitwise-tls-cert   True    splitwise-tls-cert   1m
   ```
