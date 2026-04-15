import { listNotificationsForRecipient, markNotificationReadInternal } from "../lib/notificationClient.js";

export const getDoctorNotifications = async (req, res) => {
	try {
		const data = await listNotificationsForRecipient(req.doctorId, "doctor");
		return res.json(data);
	} catch (error) {
		console.log("[doctor] notifications list", error.message);
		return res.json({ success: true, unreadCount: 0, notifications: [] });
	}
};

export const markDoctorNotificationRead = async (req, res) => {
	try {
		const { notificationId } = req.params;
		await markNotificationReadInternal(notificationId, req.doctorId, "doctor");
		return res.json({ success: true });
	} catch (error) {
		console.log(error);
		return res.json({ success: false, message: error.message });
	}
};
