import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Custom hook to register, sync, and listen to native Android FCM push notifications
 * using `@capacitor/push-notifications`. Safe fallback on Web browsers.
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

        // 2. Register application for native push services
        await PushNotifications.register();

        // 3. Setup registration success listener
        await PushNotifications.addListener('registration', async (fcmTokenData) => {
          const registeredToken = fcmTokenData.value;
          console.log('📡 Mobile FCM Push Token Generated: ', registeredToken);
          
          try {
            await axios.post(
              `${API_URL}/api/social/fcm/token`,
              { fcmToken: registeredToken },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            console.log('✅ FCM Push Token synced successfully with the database.');
          } catch (err) {
            console.error('❌ Failed to sync FCM push token with backend:', err.message);
          }
        });

        // Setup registration failure listener
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('❌ Native Push Registration Failed: ', error.error);
        });

        // 4. Setup push delivery listeners
        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('📬 Native Push Notification Received: ', notification);
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
