package com.modikrish.produx;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class ForegroundPollingService extends Service {
    private static final String CHANNEL_ID = "produx_foreground_service";
    private static final int FOREGROUND_NOTIFICATION_ID = 9999;
    private Handler handler;
    private Runnable pollingRunnable;
    private int lastUnreadMessages = 0;
    private int lastPendingFriends = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        // Start as a foreground service immediately
        startForeground(FOREGROUND_NOTIFICATION_ID, createForegroundNotification());

        handler = new Handler(Looper.getMainLooper());
        pollingRunnable = new Runnable() {
            @Override
            public void run() {
                pollServer();
                // Poll every 10 seconds for instant notifications
                handler.postDelayed(this, 10000); 
            }
        };
        handler.post(pollingRunnable);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY; // Restart service if system kills it
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null) {
            handler.removeCallbacks(pollingRunnable);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification createForegroundNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("ProduX is running")
                .setContentText("Listening for real-time messages...")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW) // Low priority so it doesn't constantly buzz
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "ProduX Active Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void pollServer() {
        new Thread(() -> {
            try {
                SharedPreferences capStorage = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String token = capStorage.getString("token", null);

                if (token == null || token.trim().isEmpty()) {
                    return;
                }
                if (token.startsWith("\"") && token.endsWith("\"")) {
                    token = token.substring(1, token.length() - 1);
                }

                URL url = new URL("https://produx-orcin.vercel.app/api/social/unread");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);

                if (conn.getResponseCode() == 200) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) response.append(line);
                    in.close();

                    JSONObject jsonObj = new JSONObject(response.toString());
                    if (jsonObj.getBoolean("success")) {
                        JSONObject data = jsonObj.getJSONObject("data");
                        int pendingFriendsCount = data.optInt("pendingFriendsCount", 0);
                        int unreadMessagesCount = data.optInt("unreadMessagesCount", 0);

                        // Trigger alert only if the count INCREASES (new message received)
                        if (unreadMessagesCount > lastUnreadMessages) {
                            triggerAlertNotification("New Messages!", "You have " + unreadMessagesCount + " unread message(s) waiting!", 1002);
                        }
                        if (pendingFriendsCount > lastPendingFriends) {
                            triggerAlertNotification("New Friend Request!", "You have " + pendingFriendsCount + " pending request(s)!", 1001);
                        }

                        lastUnreadMessages = unreadMessagesCount;
                        lastPendingFriends = pendingFriendsCount;
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void triggerAlertNotification(String title, String body, int notificationId) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "produx_instant_alerts",
                    "ProduX Instant Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.enableVibration(true);
            if (manager != null) manager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "produx_instant_alerts")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        if (manager != null) manager.notify(notificationId, builder.build());
    }
}
