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
- Firebase OTP login/signup (phone-based)
- Profile management
- Report upload and listing
- Authentication with Firebase token verification only

### Main Endpoints
- `POST /api/patients/firebase/login`
- `GET /api/patients/profile`
- `PUT /api/patients/profile`
- `POST /api/patients/reports` (multipart form-data, file field: `report`)
- `GET /api/patients/reports`

Gateway proxy (from `api-gateway`):
- `/api/patients/*` -> Patient service
- `/patient-uploads/*` -> Patient service `/uploads/*`

### Environment Variables (Patient Service)
- `PORT` (default: `8002`)
- `MONGO_URI` (default: `mongodb://localhost:27017/medisync`)
- `FIREBASE_PROJECT_ID` (required)

Optional service-account variables (recommended in production):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (with `\n` escaped in `.env`)

## Patient + Auth Frontend (React)

Implemented in `client` with React + Vite.

### Pages
- Sign In page (Firebase phone OTP)
- Sign Up page (Firebase phone OTP)
- Patient Dashboard (report upload + reports list)
- Profile page (view/update profile)

### Frontend Environment
- `VITE_API_BASE_URL` (default: `http://localhost:8000/api/patients`)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

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
- `POST /api/auth/firebase/login`
- `GET /api/auth/me` (JWT required)
- `GET /api/auth/verify` (JWT required)

### Environment Variables (Auth Service)
- `PORT` (default: `8001`)
- `MONGO_URI`
- `JWT_SECRET`

Firebase mode additionally requires:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
