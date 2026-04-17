# 🚀 MediSync Team Guide: Docker & Kubernetes

Welcome to the new infrastructure for MediSync! We have upgraded the project to use **Docker** and **Kubernetes (K8s)**. 

This guide will explain *why* we made this change and provide the exact step-by-step commands you need to get the project running on your local machine.

---

## 🤔 Why did we add Docker and Kubernetes?

When building an application with 11 different microservices (patient, doctor, auth, gateway, frontends, etc.), running everything manually with `npm run dev` in 11 different terminal windows becomes a nightmare. 

### Why Docker? (The "Box")
- **No more "It works on my machine"**: Docker packages our code with its exact environment (Node.js versions, dependencies, OS). If it runs in Docker on my laptop, it will run exactly the same way on yours.
- **Isolation**: Each service runs in its own secure, isolated container.

### Why Kubernetes? (The "City Manager")
While Docker gives us the "boxes", Kubernetes tells those boxes *how* to behave and talk to each other.
- **Service Discovery**: Instead of hardcoding `localhost:8004`, our Microservices can just talk to each other using internal K8s names like `http://appointment-service`.
- **Production-Ready**: By running K8s locally, we are perfectly simulating how our app will run when we deploy it to AWS, Google Cloud, or Azure.
- **Secrets Management**: It securely handles our environment variables so we don't have to keep `.env` files floating around everywhere.

---

## 🛠️ Prerequisites

Before you start, make sure you have:
1. **Docker Desktop** installed.
2. **Kubernetes Enabled**: Open Docker Desktop -> Settings (Gear Icon) -> Kubernetes -> Check **"Enable Kubernetes"** -> Apply & Restart.

---

## 🏃‍♂️ Step-by-Step Local Setup

Whenever you pull the latest code from `main-test`, follow these steps to run the MediSync cluster locally.

### Step 1: Set up your Secrets
Because we don't commit real passwords to GitHub, you need to create your own local secrets file.
1. Go to the `kubernetes/` folder.
2. Copy `k8s-secrets.example.yaml` and rename the copy to `k8s-secrets.yaml` (this file is ignored by Git, so it's safe).
3. Open `k8s-secrets.yaml` and replace the placeholder values (like `REPLACE_WITH_YOUR_ACTUAL_CLERK_SECRET_KEY` and `REPLACE_WITH_ENV`) with the actual API keys and database URLs from the team.

### Step 2: Build the Docker Images
Kubernetes on Docker Desktop pulls images directly from your local machine. We need to build them first.
Open your terminal in the root `mediSync` folder and run:
```bash
docker compose build
```
*(This builds all 11 services based on the `docker-compose.yml` file. It might take a few minutes the first time).*

### Step 3: Deploy to Kubernetes
We have created a helper script to launch the entire cluster. In the root folder, run:
```powershell
.\kubernetes\deploy-k8s.ps1
```
This script tells Kubernetes to read all our YAML files and start creating the network, secrets, and pods.

### Step 4: Verify Everything is Running
Use the Kubernetes command line tool (`kubectl`) to check the status of the containers (called "Pods"):
```bash
kubectl get pods
```
> **What to look for**: You should see 11 Pods listed. Wait until the `STATUS` column says **Running** for all of them (it usually takes 1-2 minutes). 

If a pod says `CrashLoopBackOff` or `ErrImageNeverPull`, it means something failed to start. 

---

## 🌐 Accessing the Application

Once everything is `Running`, Kubernetes maps the services to your local machine:

- **Patient Portal (Client)**: [http://localhost:5173](http://localhost:5173)
- **Doctor/Admin Portal**: [http://localhost:5174](http://localhost:5174)
- **API Gateway (Backend)**: [http://localhost:8000](http://localhost:8000)

---

## 🧰 Cheat Sheet: Essential K8s Commands

As developers, you will need to debug your services. Here are the most useful commands:

**1. View Logs of a Service**
If a service crashes or you want to see the `console.log` output:
```bash
# First, get the exact pod name:
kubectl get pods
# Then view the logs:
kubectl logs -f <exact-pod-name>
# Example: kubectl logs -f doctor-service-7f8d6f5b9-x2k4j
```

**2. Find out why a Pod is crashing**
If a pod is stuck in `Pending` or `CrashLoopBackOff`:
```bash
kubectl describe pod <exact-pod-name>
```

**3. Stop and Delete Everything**
If you want to clear the cluster and shut everything down:
```bash
kubectl delete -f kubernetes/
```

**4. Update a Single Service after changing Code**
If you edit code in the `doctor-service`, you don't need to restart everything!
```bash
# 1. Rebuild just that image:
docker compose build doctor-service
# 2. Tell K8s to restart that specific deployment:
kubectl rollout restart deployment doctor-service
```
