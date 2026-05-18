package com.modikrish.produx;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class NotificationWorker extends Worker {
    private static final String CHANNEL_ID = "produx_background_alerts";
    private static final String CHANNEL_NAME = "ProduX Background Activity";

    public NotificationWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            // Get user token stored by Capacitor Preferences in SharedPreferences
            // Capacitor's default SharedPreferences is usually named "CapacitorStorage"
            Context context = getApplicationContext();
            SharedPreferences capStorage = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String token = capStorage.getString("token", null);

            // If not logged in, skip background polling
            if (token == null || token.trim().isEmpty()) {
                return Result.success();
            }

            // Clean the token (Capacitor preferences sometimes wraps strings in double quotes)
            if (token.startsWith("\"") && token.endsWith("\"")) {
                token = token.substring(1, token.length() - 1);
            }

            // Poll the backend endpoint for pending friend requests
            URL url = new URL("https://produx-orcin.vercel.app/api/social/friends");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();

                JSONObject jsonObj = new JSONObject(response.toString());
                if (jsonObj.getBoolean("success")) {
                    JSONObject data = jsonObj.getJSONObject("data");
                    int pendingRequestsCount = data.getJSONArray("pending").length();

                    // If there are pending requests, trigger the native system notification!
                    if (pendingRequestsCount > 0) {
                        String bodyText = "You have " + pendingRequestsCount + " pending friend request(s) waiting for you in ProduX!";
                        triggerSystemNotification("New Activity in ProduX", bodyText);
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return Result.success();
    }

    private void triggerSystemNotification(String title, String body) {
        Context context = getApplicationContext();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // 1. Create Notification Channel for Android O+ (API 26+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Channel for background polling alerts in ProduX");
            channel.enableVibration(true);
            notificationManager.createNotificationChannel(channel);
        }

        // 2. Click Action: Open MainActivity
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                flags
        );

        // 3. Build Notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher) // Use default launcher icon as notification icon
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        // 4. Fire Notification
        notificationManager.notify(4567, builder.build());
    }
}
