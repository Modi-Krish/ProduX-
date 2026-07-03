package com.modikrish.produx;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
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
    private static final String TAG = "ProduX_Worker";
    private static final String CHANNEL_ID = "produx_background_alerts";
    private static final String CHANNEL_NAME = "ProduX Background Activity";

    public NotificationWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Worker started - Checking for notifications...");
        try {
            Context context = getApplicationContext();
            SharedPreferences capStorage = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String token = capStorage.getString("token", null);

            if (token == null || token.trim().isEmpty()) {
                Log.w(TAG, "Aborting: No auth token found.");
                return Result.success();
            }

            if (token.startsWith("\"") && token.endsWith("\"")) {
                token = token.substring(1, token.length() - 1);
            }

            URL url = new URL("https://produx-orcin.vercel.app/api/social/unread");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);

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
                    int pendingFriendsCount = data.optInt("pendingFriendsCount", 0);
                    int unreadMessagesCount = data.optInt("unreadMessagesCount", 0);

                    if (unreadMessagesCount > 0) {
                        triggerSystemNotification("New Messages!", "You have " + unreadMessagesCount + " unread message(s)!", 1002);
                    }

                    if (pendingFriendsCount > 0) {
                        triggerSystemNotification("New Friend Request!", "You have " + pendingFriendsCount + " pending request(s)!", 1001);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Worker Exception: " + e.getMessage());
        }
        return Result.success();
    }

    private void triggerSystemNotification(String title, String body, int notificationId) {
        Log.i(TAG, "Triggering Notification: " + title);
        Context context = getApplicationContext();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.enableVibration(true);
            notificationManager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        
        PendingIntent pendingIntent = PendingIntent.getActivity(context, notificationId, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

        notificationManager.notify(notificationId, builder.build());
    }
}
