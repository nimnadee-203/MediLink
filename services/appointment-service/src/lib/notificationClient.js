import axios from "axios";

const base = () => process.env.NOTIFICATION_SERVICE_URL || "http://127.0.0.1:8006";

const DEFAULT_INTERNAL_SECRET = "medilink-local-notification-secret-change-me";

const secret = () => process.env.NOTIFICATION_INTERNAL_SECRET || DEFAULT_INTERNAL_SECRET;

const http = axios.create({ timeout: 15_000 });

function buildPayload(payload) {
  const body = {
    recipientId: String(payload.recipientId),
    recipientRole: payload.recipientRole,
    type: payload.type || "general",
    title: payload.title,
    body: payload.body || ""
  };
  if (payload.appointmentId) {
    body.appointmentId = String(payload.appointmentId);
  }
  return body;
}

export async function sendNotificationToUser(payload) {
  const key = secret();
  const url = `${base()}/internal/notifications`;
  try {
    const { status, data } = await http.post(url, buildPayload(payload), {
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": key
      },
      validateStatus: () => true
    });
    if (status < 200 || status >= 300) {
      console.error("[appointment-service] notification send failed", status, data);
    }
  } catch (e) {
    const hint = e.code === "ECONNREFUSED" ? " Is notification-service running on port 8006?" : "";
    console.error(`[appointment-service] notification POST ${url}${hint}`, e.message);
  }
}
