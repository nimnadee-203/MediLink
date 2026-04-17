import jwt from 'jsonwebtoken';

export const generateJitsiToken = async (req, res) => {
  try {
    const { roomName, userName, email, isModerator } = req.body;

    if (!roomName) {
      return res.status(400).json({ success: false, message: 'Room name is required' });
    }


    const jitsiSecret = process.env.JITSI_SECRET || 'a-very-secure-generic-secret-for-project';
    const appId = process.env.JITSI_APP_ID || 'medisync-app-id';

    const payload = {
      context: {
        user: {
          name: userName || 'Guest User',
          email: email || '',
          affiliation: isModerator ? 'owner' : 'member',
        },
      },
      aud: 'jitsi',
      iss: appId,
      sub: '*', // Assuming generic domain like meet.jit.si requires valid sub for jaas or just * for standard self host
      room: roomName,
    };

    const token = jwt.sign(payload, jitsiSecret, { expiresIn: '2h' });

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('Error generating Jitsi token:', error);
    res.status(500).json({ success: false, message: 'Failed to generate token' });
  }
};
