# Email Notifications Setup Guide

## Overview
The MediLink notification service now supports sending email notifications for appointment events:
- ✅ Appointment Booked (to Patient & Doctor)
- ✅ Appointment Cancelled by Patient (to Doctor)
- ✅ Appointment Cancelled by Doctor (to Patient)

## Email Configuration

### Environment Variables
Add these to your `.env` file in the `notification-service` folder:

```env
# Email Provider Configuration
EMAIL_PROVIDER=gmail              # Options: gmail, outlook, sendgrid, custom
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password  # NOT your regular password
EMAIL_FROM=noreply@medilink.com  # Optional: sender email address

# For custom SMTP (if using EMAIL_PROVIDER=custom)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_SECURE=false
```

## Email Provider Setup

### Gmail Setup (Recommended)
1. Enable 2-Factor Authentication on your Gmail account
2. Go to [Google Account Security](https://myaccount.google.com/security)
3. Find "App passwords" and generate a new password for "Mail" and "Windows"
4. Copy the 16-character password and use it as `EMAIL_PASSWORD`

**Note:** Do NOT use your regular Gmail password

### Outlook Setup
```env
EMAIL_PROVIDER=outlook
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

### SendGrid Setup
```env
EMAIL_PROVIDER=sendgrid
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

### Custom SMTP Setup
```env
EMAIL_PROVIDER=custom
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-password
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
```

## How It Works

### Event Flow
1. User books/cancels appointment in appointment service
2. Appointment service sends notification to notification service with:
   - Recipient ID & role (patient/doctor)
   - Notification type (appointment_booked, appointment_cancelled_by_patient, etc.)
   - Appointment details (date, time, visit mode, etc.)

3. Notification service:
   - Stores notification in MongoDB
   - **Sends email asynchronously** (non-blocking)
   - Fetches user emails from respective microservices
   - Generates HTML email using templates
   - Sends via configured email provider

### Email Templates
All emails include:
- Styled HTML templates with MediLink branding
- Appointment details (date, time, doctor/patient name, visit mode)
- Clear call-to-action
- Plain text fallback

#### Template Types
- `appointmentBookedPatient` - Confirmation email for patient
- `appointmentBookedDoctor` - Notification for doctor
- `appointmentCancelledByPatient` - Cancellation notice for doctor
- `appointmentCancelledByDoctor` - Cancellation notice for patient

## User Email Resolution

The notification service fetches user emails by calling:
- **Patient emails:** `GET http://localhost:8002/api/patients/emails/{userId}`
- **Doctor emails:** `GET http://localhost:4001/api/doctors/emails/{userId}`

### Required Endpoints in Services

Your patient and doctor services must implement:

```javascript
// Doctor Service
GET /api/doctors/emails/:id
Response: { email: "doctor@example.com" }

GET /api/doctors/:id
Response: { name: "Dr. John", ... }

// Patient Service
GET /api/patients/emails/:id
Response: { email: "patient@example.com" }

GET /api/patients/:id
Response: { name: "John Doe", ... }
```

## Testing Email Notifications

### Test Email Sending
```bash
# Terminal 1: Start notification service
cd services/notification-service
npm run dev

# Terminal 2: Test appointment creation
curl -X POST http://localhost:8003/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "667f1d5c4c8d9e2f7a1b2c3d",
    "doctorId": "667f1d5c4c8d9e2f7a1b2c3e",
    "slotDate": "2026-04-20",
    "slotTime": "10:00 AM",
    "amount": 500,
    "visitMode": "telemedicine",
    "reason": "Consultation"
  }'
```

### Email Logs
Check terminal logs for email status:
```
[EMAIL-SENT] patient@example.com - Appointment Confirmed (message-id@example.com)
[EMAIL-ERROR] doctor@example.com - New Appointment Scheduled: Connection refused
[EMAIL-SKIP] patient@example.com - No email found for patient xyz
```

## Troubleshooting

### "Email credentials not configured"
- ✓ Check `.env` file has `EMAIL_USER` and `EMAIL_PASSWORD`
- ✓ Restart notification service after updating `.env`

### "Connection refused" errors
- ✓ Check SMTP host and port are correct
- ✓ Some providers require specific ports:
  - Gmail: 587 (TLS) or 465 (SSL)
  - Outlook: 587 (TLS)
  - SendGrid: 587

### Emails sent but not received
- ✓ Check spam/junk folder
- ✓ Verify recipient email is correct (check user service endpoints)
- ✓ Check email provider logs for bounces

### Gmail "Less secure app access" error
- ✓ Must use App Password, not regular Gmail password
- ✓ Must enable 2-Factor Authentication first

## Production Considerations

1. **Rate Limiting:** Consider adding rate limits to avoid email flooding
2. **Retry Logic:** Current implementation doesn't retry failed emails
3. **Email Queuing:** For high volume, implement a queue (Redis/RabbitMQ)
4. **Monitoring:** Log all email events to track delivery rates
5. **Unsubscription:** Add unsubscribe links for compliance (CAN-SPAM, GDPR)
6. **Templates:** Customize templates for your branding

## API Reference

### Send Notification
```
POST /internal/notifications
Headers: X-Internal-Secret: medilink-local-notification-secret-change-me
Content-Type: application/json

Body:
{
  "recipientId": "userId",
  "recipientRole": "patient|doctor",
  "type": "appointment_booked|appointment_cancelled_by_patient|appointment_cancelled_by_doctor",
  "title": "Email Subject",
  "body": "Notification body",
  "appointmentId": "appointmentId",
  "appointmentDetails": {
    "patientId": "...",
    "doctorId": "...",
    "slotDate": "2026-04-20",
    "slotTime": "10:00 AM",
    "visitMode": "telemedicine|in_person",
    "reason": "Optional reason"
  }
}
```

## Support
For issues, check:
1. Notification service logs
2. Email provider documentation
3. User service email endpoints
4. MongoDB notification records
