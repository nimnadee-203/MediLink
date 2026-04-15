import axios from "axios";

/** Prefer 127.0.0.1 on Windows to avoid IPv6 localhost mismatches. */
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
      console.error("[doctor-service] notification send failed", status, data);
    }
  } catch (e) {
    const hint = e.code === "ECONNREFUSED" ? " Is notification-service running on port 8006?" : "";
    console.error(`[doctor-service] notification POST ${url}${hint}`, e.message);
  }
}

export async function listNotificationsForRecipient(recipientId, recipientRole) {
  const key = secret();
  const url = `${base()}/internal/notifications`;
  const { data, status } = await http.get(url, {
    headers: { "X-Internal-Secret": key },
    params: {
      recipientId: String(recipientId),
      recipientRole,
      limit: 50
    },
    validateStatus: () => true
  });
  if (status < 200 || status >= 300) {
    throw new Error(data?.message || `Failed to load notifications (${status})`);
  }
  return data;
}

export async function markNotificationReadInternal(notificationId, recipientId, recipientRole) {
  const key = secret();
  const url = `${base()}/internal/notifications/${encodeURIComponent(notificationId)}/read`;
  const { data, status } = await http.patch(
    url,
    { recipientId: String(recipientId), recipientRole },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": key
      },
      validateStatus: () => true
    }
  );
  if (status < 200 || status >= 300) {
    throw new Error(data?.message || `Failed to mark notification read (${status})`);
  }
  return data;
}
