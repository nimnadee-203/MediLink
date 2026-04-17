# MediSync Docker & Kubernetes Guide for the Team

This guide explains why we have introduced Docker and Kubernetes (K8s) to the MediSync project, what benefits they bring, and exactly what commands the team needs to run to get the project working locally.

---

## 🧐 1. Why Docker and Kubernetes?

Our project has grown into a **microservices architecture** (Auth, Patient, Doctor, Appointment, Telemedicine, API Gateway, Client, Admin). Managing all these separately is painful.

### Why Docker?
*   **No more "It works on my machine":** Docker packages each service with its exact dependencies, Node.js version, and environment. If it runs on one machine, it will run exactly the same on everyone else's.
*   **One-Click Startup:** Previously, you had to open 10 different terminal windows, navigate to each service folder, and run `npm run dev`. With `docker-compose`, you can spin up the *entire* stack (backends, frontends, gateway) with just **one command**.

### Why Kubernetes (K8s)?
*   **Production Readiness:** While Docker Compose is great for local coding, our production environment will likely use Kubernetes to manage containers. K8s handles auto-restarting crashed containers, load balancing, and scaling.
*   **Local Cluster Testing:** Using K8s locally allows us to test how services discover and talk to each other inside a secure cluster, ensuring our configurations are solid before we deploy to production clouds (like AWS, GCP, Azure).

---

## 🛠️ 2. Prerequisites

Before running any commands, make sure you have the following installed on your machine:

1.  **Docker Desktop:** Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/). Make sure it is running.
2.  *(Optional but Recommended)* **Enable Kubernetes:** Open Docker Desktop Settings -> Kubernetes -> check "Enable Kubernetes" -> click "Apply & Restart".
3.  **kubectl:** The command-line tool for K8s (comes bundled with Docker Desktop when you enable Kubernetes).

---

## 🚀 3. Daily Development: Using Docker Compose

For your day-to-day coding, creating features, and debugging, **Docker Compose is the recommended approach** because it mounts your local files into the container. When you make a code change, it updates immediately!

### Step 1: Set Up Environment Variables
Ensure all your local `.env` files are in place in the respective directories (e.g., `./client/.env`, `./services/auth-service/.env`, etc.).

### Step 2: Build & Start Everything
Open a terminal in the root `mediSync` folder and run:
```bash
docker-compose up --build
```
> **Tip:** Adding `-d` (`docker-compose up --build -d`) runs everything in the background so your terminal remains free.

### Useful Docker Commands:
*   `docker-compose down` - Stops and removes all containers. Run this when you are done working.
*   `docker-compose logs <service-name>` - View logs for a specific service (e.g., `docker-compose logs patient-service`).
*   `docker ps` - View all currently running containers.

---

## 🌐 4. Advanced Testing: Using Kubernetes

Use this when you want to test the full production-like deployment of the application.

### Step 1: Prepare Secrets
Do **not** commit `k8s-secrets.yaml` to GitHub! We have a `k8s-secrets.example.yaml` file.
1. Duplicate `kubernetes/k8s-secrets.example.yaml` and rename the copy to `kubernetes/k8s-secrets.yaml`.
2. Fill in the base64-encoded values of your API keys inside `k8s-secrets.yaml`. *(Base64 encoding command in Windows powershell: `[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("your-secret"))`)*

### Step 2: Deploy to the Local Cluster
Run these commands in the terminal from the root `mediSync` folder:

```bash
# 1. Apply your environment variables (ConfigMap)
kubectl apply -f kubernetes/k8s-configmap.yaml

# 2. Apply your secrets
kubectl apply -f kubernetes/k8s-secrets.yaml

# 3. Apply ALL the service definitions, deployments, and gateway
kubectl apply -f kubernetes/
```

> **Alternatively for Windows users:** You can simply run the provided PowerShell script which automates this:
> `.\kubernetes\deploy-k8s.ps1`

### Step 3: Monitor the Startup
Kubernetes takes a minute or two to pull and start the containers. You can watch the progress using:
```bash
kubectl get pods -w
```
*(Press `Ctrl+C` to exit the watch mode when all pods show "Running")*

### Useful Kubernetes Commands:
*   `kubectl get services` - See internal IP addresses and exposed ports.
*   `kubectl logs <pod-name>` - See console.logs for a specific pod (find the pod name using `kubectl get pods`).
*   `kubectl delete -f kubernetes/` - Shuts down and deletes the whole cluster deployment.

---

## 📝 Summary for the Team
*   **Writing code today?** Use `docker-compose up`.
*   **Testing production deployment?** Use `kubectl apply -f kubernetes/`.
*   **Issues?** Make sure Docker Desktop is running. Check your `.env` and `k8s-secrets.yaml` files.
