import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import toast from 'react-hot-toast';
import API from '../api/axios';

/**
 * Custom hook to register, sync, and listen to native Android FCM push notifications
 * using `@capacitor/push-notifications`. Safe fallback on Web browsers.
 * 
 * Called at the App level so FCM tokens are registered immediately on login.
 */
const useFCM = () => {
  const { token, user } = useSelector((state) => state.auth);

  useEffect(() => {
    // Only configure native push notifications if on Android/iOS wrapper and authenticated
    if (!Capacitor.isNativePlatform() || !token || !user) {
      return;
    }

    const configureFCM = async () => {
      try {
        // 1. Verify push permissions
        let permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        
        if (permStatus.receive !== 'granted') {
          console.warn('⚠️ Push notifications permission denied on mobile device.');
          return;
        }

        // Also ensure local notification permissions (for foreground display)
        const localPermStatus = await LocalNotifications.checkPermissions();
        if (localPermStatus.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }

        // 2. Register application for native push services
        await PushNotifications.register();

        // 3. Setup registration success listener
        await PushNotifications.addListener('registration', async (fcmTokenData) => {
          const registeredToken = fcmTokenData.value;
          console.log('📡 Mobile FCM Push Token Generated: ', registeredToken);
          
          try {
            await API.post('/social/fcm/token', { fcmToken: registeredToken });
            console.log('✅ FCM Push Token synced successfully with the database.');
          } catch (err) {
            console.error('❌ Failed to sync FCM push token with backend:', err.message);
          }
        });

        // Setup registration failure listener
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('❌ Native Push Registration Failed: ', error.error);
        });

        // 4. Foreground push delivery — Android silently receives data messages
        //    in the foreground. We must manually display a local notification.
        await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          console.log('📬 Native Push Notification Received (foreground): ', notification);
          
          const title = notification.title || 'New Message';
          const body = notification.body || '';

          // Show in-app toast
          toast(body ? `${title}: ${body}` : title, { icon: '💬' });

          // Show a native system notification so it appears in the drawer
          try {
            await LocalNotifications.schedule({
              notifications: [{
                title,
                body,
                id: Math.floor(Math.random() * 1000000),
                sound: 'default',
                actionTypeId: 'chat_msg',
              }]
            });
          } catch (err) {
            console.error('Failed to show foreground local notification:', err);
          }
        });

        // Setup push click/tap action listener
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('🔗 Push Notification clicked by user: ', action);
          // Redirect the user to the social feed or chat workspace
          window.location.hash = '/social';
        });

      } catch (err) {
        console.error('❌ Failed to configure native push configuration:', err);
      }
    };

    configureFCM();

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [token, user]);
};

export default useFCM;
export { useFCM };

