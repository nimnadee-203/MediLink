# MediSync Kubernetes Deployment Script (Docker Desktop)
# This script applies all manifests in the correct order.

Write-Host "--- Starting MediSync K8s Deployment ---" -ForegroundColor Cyan

# 1. Apply Global Configuration
Write-Host "1. Applying ConfigMaps and Secrets..."
kubectl apply -f kubernetes/k8s-configmap.yaml
kubectl apply -f kubernetes/k8s-secrets.yaml

# 2. Apply Backend Services
Write-Host "2. Applying Backend Services..."
kubectl apply -f kubernetes/auth-service.yaml
kubectl apply -f kubernetes/patient-service.yaml
kubectl apply -f kubernetes/appointment-service.yaml
kubectl apply -f kubernetes/doctor-service.yaml
kubectl apply -f kubernetes/notification-service.yaml
kubectl apply -f kubernetes/payment-service.yaml
kubectl apply -f kubernetes/symptom-checker-service.yaml
kubectl apply -f kubernetes/telemedicine-service.yaml

# 3. Apply API Gateway and Frontends
Write-Host "3. Applying Gateway and Frontends..."
kubectl apply -f kubernetes/api-gateway.yaml
kubectl apply -f kubernetes/client.yaml
kubectl apply -f kubernetes/admin.yaml

Write-Host "`n--- Deployment Commands Sent! ---" -ForegroundColor Green
Write-Host "Run 'kubectl get pods' to check the status."
Write-Host "Wait a few minutes for Pods to show 'Running'."
