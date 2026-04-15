/** Must match doctor / patient / appointment services (or set NOTIFICATION_INTERNAL_SECRET everywhere). */
const DEFAULT_INTERNAL_SECRET = "medilink-local-notification-secret-change-me";

export const requireInternalSecret = (req, res, next) => {
  const expected = (process.env.NOTIFICATION_INTERNAL_SECRET || DEFAULT_INTERNAL_SECRET).trim();
  if (!expected || /^replace_with/i.test(expected)) {
    return res.status(503).json({ success: false, message: "Notification internal API is not configured" });
  }
  const sent = req.headers["x-internal-secret"];
  if (!sent || sent !== expected) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  return next();
};
