# Email Notification Integration - Implementation Checklist

## ✅ Notification Service (Complete)

### Email Sending
- ✅ `emailService.js` - NodeMailer integration with multiple providers (Gmail, Outlook, SendGrid, Custom SMTP)
- ✅ `emailTemplates.js` - HTML email templates for:
  - Appointment Booked (Patient)
  - Appointment Booked (Doctor)
  - Appointment Cancelled by Patient (Doctor)
  - Appointment Cancelled by Doctor (Patient)
- ✅ `notificationEmailService.js` - Email sending orchestration
- ✅ `internal.controller.js` - Modified to trigger email sending

### Configuration
- ✅ `EMAIL_SETUP.md` - Complete setup and configuration guide
- ✅ `.env.example` - Updated with email configuration variables

## ✅ Appointment Service (Complete)

- ✅ `notificationClient.js` - Updated to support `appointmentDetails` parameter
- ✅ `createAppointment()` - Sends notifications to both patient and doctor
- ✅ `cancelAppointment()` - Sends notifications with full appointment details

## 🔧 Patient Service (Required)

The notification service calls these endpoints to fetch patient data. **If not implemented, add these endpoints:**

### Endpoint 1: Get Patient Email
```javascript
// Route
GET /api/patients/emails/:id

// Response
{
  "email": "patient@example.com"
}
```

### Endpoint 2: Get Patient Details
```javascript
// Route
GET /api/patients/:id

// Response
{
  "id": "patient-id",
  "name": "John Doe",
  "email": "patient@example.com"
}
```

### Example Implementation (Express.js)
```javascript
// patient.routes.js
router.get('/api/patients/emails/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).select('email');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json({ email: patient.email });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/patients/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).select('name email');
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

## 🔧 Doctor Service (Required)

The notification service calls these endpoints to fetch doctor data. **If not implemented, add these endpoints:**

### Endpoint 1: Get Doctor Email
```javascript
// Route
GET /api/doctors/emails/:id

// Response
{
  "email": "doctor@example.com"
}
```

### Endpoint 2: Get Doctor Details
```javascript
// Route
GET /api/doctors/:id

// Response
{
  "id": "doctor-id",
  "name": "Dr. Jane Smith",
  "email": "doctor@example.com"
}
```

### Example Implementation (Express.js)
```javascript
// doctor.routes.js
router.get('/api/doctors/emails/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('email');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.json({ email: doctor.email });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/doctors/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('name email');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

## 📋 Configuration Checklist

Before running, ensure:

### Notification Service .env
```
✓ MONGO_URI - MongoDB connection string
✓ EMAIL_PROVIDER - gmail|outlook|sendgrid|custom
✓ EMAIL_USER - Email account username
✓ EMAIL_PASSWORD - Email account password/app-key
✓ EMAIL_FROM - (Optional) Sender display email
✓ NOTIFICATION_INTERNAL_SECRET - Service communication secret
```

### Gmail Setup (if using gmail)
```
✓ Gmail account with 2FA enabled
✓ App password generated (not regular password)
✓ Added EMAIL_USER and EMAIL_PASSWORD to .env
```

### Service URLs
All running on expected ports:
```
✓ Patient Service: http://localhost:8002
✓ Doctor Service: http://localhost:4001
✓ Appointment Service: http://localhost:8003
✓ Notification Service: http://localhost:8006
```

## 🧪 Testing Flow

### Test Data Setup
1. Create a patient with email
2. Create a doctor with email
3. Book an appointment

### Expected Behavior
```
Timeline:
t=0:   Patient books appointment
t+1s:  Appointment service sends notification to notification service
t+2s:  Notification stored in MongoDB
t+3s:  Email fetched for patient & doctor
t+5s:  Emails sent via provider
```

### Verify
Check notification service logs:
```
[EMAIL-SENT] patient@example.com - Appointment Confirmed
[EMAIL-SENT] doctor@example.com - New Appointment Scheduled
```

Check patient/doctor inbox for emails ✉️

## 🔐 Security Notes

1. **NEVER** commit `.env` file with real credentials
2. Change `NOTIFICATION_INTERNAL_SECRET` in production
3. For Gmail, use App Passwords (not regular password)
4. For SendGrid, use API keys in EMAIL_PASSWORD field
5. Consider rate limiting to prevent email flooding

## 📈 Next Steps (Optional Enhancements)

- [ ] Add email delivery tracking (webhooks)
- [ ] Implement retry logic for failed emails
- [ ] Add email queue (Redis/RabbitMQ) for high volume
- [ ] Create unsubscribe mechanism
- [ ] Add email templates UI/editor
- [ ] Implement SMS notifications (Twilio already in package.json)
- [ ] Add email open/click tracking
- [ ] Create admin notification dashboard

## 📞 Support

If emails aren't sending:
1. Check notification service logs
2. Verify patient/doctor email endpoints are responding
3. Test email credentials on email provider website
4. Check spam folder
5. Review EMAIL_SETUP.md troubleshooting section
