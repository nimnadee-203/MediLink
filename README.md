# MediSync AI

Microservices-based healthcare management system with AI integration.

## Project Structure

- `client/`: React frontend
- `api-gateway/`: Main entry point and request routing
- `services/`: Specialized microservices
- `k8s/`: Kubernetes configurations
- `docker-compose.yml`: Local orchestraion

## Patient Service Backend (Node.js + Express)

Implemented in `services/patient-service` with MongoDB.

### Features
- Clerk-based sign in/sign up
- Profile management
- Report upload and listing
- Authentication with Clerk session token verification

### Main Endpoints
- `GET /api/patients/profile`
- `PUT /api/patients/profile`
- `POST /api/patients/reports` (multipart form-data, file field: `report`)
- `GET /api/patients/reports`

Gateway proxy (from `api-gateway`):
- `/api/patients/*` -> Patient service
- `/patient-uploads/*` -> Patient service `/uploads/*`

### Environment Variables (Patient Service)
- `PORT` (default: `8002`)
- `MONGO_URI` (required) — local: `mongodb://localhost:27017/medisync`; **MongoDB Atlas**: use the `mongodb+srv://...` string from Atlas (include the database name in the path, e.g. `/medisync`). Allow your IP in Atlas **Network Access**.
- `CLERK_SECRET_KEY` (required)

## Patient + Auth Frontend (React)

Implemented in `client` with React + Vite.

### Pages
- Sign In page (Clerk)
- Sign Up page (Clerk)
- Patient Dashboard (report upload + reports list)
- Profile page (view/update profile)

### Frontend Environment
- `VITE_API_BASE_URL` (default: `http://localhost:8000/api/patients`)
- `VITE_CLERK_PUBLISHABLE_KEY`

### Run Frontend
```bash
cd client
npm install
npm run dev
```

## Auth Service Backend (Node.js + Express)

Implemented in `services/auth-service` with MongoDB.

### Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (JWT required)
- `GET /api/auth/verify` (JWT required)

### Environment Variables (Auth Service)
- `PORT` (default: `8001`)
- `MONGO_URI`
- `JWT_SECRET`

## Appointment Service Backend (Node.js + Express)

Implemented in `services/appointment-service` with MongoDB.

### Endpoints
- `GET /api/appointments`
- `POST /api/appointments`
- `GET /api/appointments/:id`
- `GET /api/appointments/:id/status`
- `PATCH /api/appointments/:id`
- `PATCH /api/appointments/:id/cancel`

Gateway proxy (from `api-gateway`):
- `/api/appointments/*` -> Appointment service

### Environment Variables (Appointment Service)
- `PORT` (default: `8004`)
- `MONGO_URI`
- `JWT_SECRET` (must match auth-service secret for token verification)
- `APPOINTMENT_DB_NAME` (default: `appointment-db`)
