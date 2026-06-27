/**
 * Push Controller — Web Push and FCM Notifications
 *
 * Handles push subscription registration and FCM multicast.
 * Separated from socialController.js to follow SRP.
 */

const { db, admin, isFCMEnabled } = require('../config/firebase');
const webpush = require('web-push');
const logger = require('../utils/logger');

// FIX (SEC-5): VAPID mailto moved to env variable
if (process.env.PUBLIC_VAPID_KEY && process.env.PRIVATE_VAPID_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:admin@produx.app',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
  );
}

/**
 * @desc    Subscribe a browser to web push notifications
 * @route   POST /api/social/subscribe
 * @access  Private
 */
const subscribePush = async (req, res, next) => {
  try {
    const subscription = req.body;
    const userId = req.user._id;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Invalid push subscription object' });
    }

    // Sanitize subscription — only keep known fields
    const cleanSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys?.p256dh,
        auth: subscription.keys?.auth,
      },
    };

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existing = (userSnap.data().pushSubscriptions || []).some(
      (sub) => sub.endpoint === cleanSubscription.endpoint
    );

    if (!existing) {
      // Use arrayUnion for atomic add — avoids race conditions
      await userRef.update({
        pushSubscriptions: admin.firestore.FieldValue.arrayUnion(cleanSubscription),
        updatedAt: new Date(),
      });
    }

    res.status(201).json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register an FCM token for mobile push notifications
 * @route   POST /api/social/fcm/token
 * @access  Private
 */
const registerFCMToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user._id;

    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.length > 500) {
      return res.status(400).json({ success: false, message: 'Valid FCM token is required (max 500 chars)' });
    }

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const tokens = userSnap.data().fcmTokens || [];

    if (!tokens.includes(fcmToken)) {
      // Cap FCM tokens per user to avoid unbounded growth
      const MAX_FCM_TOKENS = 10;
      const updated = tokens.length >= MAX_FCM_TOKENS
        ? [...tokens.slice(-(MAX_FCM_TOKENS - 1)), fcmToken]
        : [...tokens, fcmToken];

      await userRef.update({ fcmTokens: updated, updatedAt: new Date() });
    }

    res.status(200).json({ success: true, message: 'FCM Token registered' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Trigger an FCM push notification to a user or group
 * @route   POST /api/social/push-notify
 * @access  Private
 */
const triggerFCMPush = async (req, res, next) => {
  try {
    const { receiverId, groupId, text } = req.body;
    const senderId = req.user._id;
    const senderName = req.user.name;

    if (!isFCMEnabled) {
      return res.status(200).json({
        success: true,
        message: 'FCM is not enabled on this server. Push skipped.',
      });
    }

    if (!receiverId && !groupId) {
      return res.status(400).json({ success: false, message: 'Either receiverId or groupId must be provided' });
    }

    let tokens = [];
    let title = '';
    let body = String(text || '').substring(0, 200);
    let group = null;

    if (groupId) {
      const groupSnap = await db.collection('groups').doc(groupId).get();
      if (!groupSnap.exists) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      group = groupSnap.data();

      if (!group.members.includes(senderId)) {
        return res.status(403).json({ success: false, message: 'Not a member of this group' });
      }

      title = `Group: ${group.name}`;
      body = `${senderName}: ${body}`;

      const memberSnaps = await Promise.all(
        group.members.filter((m) => m !== senderId).map((uid) => db.collection('users').doc(uid).get())
      );
      memberSnaps.forEach((snap) => {
        if (snap.exists && snap.data().fcmTokens) {
          tokens.push(...snap.data().fcmTokens);
        }
      });
    } else if (receiverId) {
      const receiverSnap = await db.collection('users').doc(receiverId).get();
      if (!receiverSnap.exists) {
        return res.status(404).json({ success: false, message: 'Recipient not found' });
      }
      title = senderName;
      tokens = receiverSnap.data().fcmTokens || [];
    }

    // Deduplicate and filter
    tokens = [...new Set(tokens.filter((t) => typeof t === 'string' && t.trim()))];

    if (tokens.length === 0) {
      return res.status(200).json({ success: true, message: 'No FCM tokens found for recipients.' });
    }

    const message = {
      tokens,
      notification: { title, body: body.length > 100 ? body.substring(0, 97) + '...' : body },
      data: { type: groupId ? 'group' : 'dm', id: groupId || senderId },
      android: { priority: 'high', notification: { sound: 'default' } },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    logger.info('FCM multicast sent', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    // Clean up expired tokens
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(resp.error?.code)) {
          tokensToRemove.push(tokens[idx]);
        }
      });

      if (tokensToRemove.length > 0) {
        const recipientIds = groupId ? (group?.members || []) : [receiverId];
        for (const uid of recipientIds) {
          const uRef = db.collection('users').doc(uid);
          const uSnap = await uRef.get();
          if (uSnap.exists) {
            const updatedTokens = (uSnap.data().fcmTokens || []).filter((t) => !tokensToRemove.includes(t));
            if (updatedTokens.length !== (uSnap.data().fcmTokens || []).length) {
              await uRef.update({ fcmTokens: updatedTokens, updatedAt: new Date() });
            }
          }
        }
      }
    }

    res.status(200).json({ success: true, successCount: response.successCount });
  } catch (error) {
    next(error);
  }
};

module.exports = { subscribePush, registerFCMToken, triggerFCMPush };
