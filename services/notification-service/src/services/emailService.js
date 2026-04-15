import nodemailer from "nodemailer";

const getEmailProvider = () => {
  const provider = process.env.EMAIL_PROVIDER || "gmail";
  const user = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;

  if (!user || !password) {
    console.warn("⚠️ Email credentials not configured. Emails will not be sent.");
    console.warn("Set EMAIL_USER and EMAIL_PASSWORD in .env file");
    return null;
  }

  let transportConfig = {};

  if (provider === "gmail") {
    transportConfig = {
      service: "gmail",
      auth: {
        user,
        pass: password // App-specific password for Gmail
      }
    };
  } else if (provider === "outlook") {
    transportConfig = {
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false,
      auth: {
        user,
        pass: password
      }
    };
  } else if (provider === "sendgrid") {
    transportConfig = {
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: password // SendGrid API key
      }
    };
  } else if (provider === "custom") {
    transportConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user,
        pass: password
      }
    };
  }

  const transporter = nodemailer.createTransport(transportConfig);
  return transporter;
};

/**
 * Send email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email body
 * @param {string} options.text - Plain text email body
 * @returns {Promise<void>}
 */
export async function sendEmail({ to, subject, html, text }) {
  const transporter = getEmailProvider();

  if (!transporter) {
    console.log(`[EMAIL-SKIPPED] ${to} - ${subject}`);
    return; // Skip if no provider configured
  }

  try {
    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@medilink.com";

    const info = await transporter.sendMail({
      from: `MediLink <${fromEmail}>`,
      to,
      subject,
      text: text || "",
      html: html || ""
    });

    console.log(`[EMAIL-SENT] ${to} - ${subject} (${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`[EMAIL-ERROR] Failed to send email to ${to}:`, error.message);
    throw error;
  }
}

export default { sendEmail };
