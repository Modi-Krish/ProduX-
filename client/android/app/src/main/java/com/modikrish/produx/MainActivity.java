package com.modikrish.produx;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.BridgeActivity;
import java.util.concurrent.TimeUnit;

import android.util.Log;
import androidx.work.OneTimeWorkRequest;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ProduX_Main";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Log.d(TAG, "Initializing Background Workers...");
        
        // 1. Schedule Background Polling via WorkManager (runs even when app is closed)
        scheduleBackgroundNotificationWorker();
        
        // 2. Run an immediate check right now for testing
        runImmediateNotificationCheck();
    }

    private void scheduleBackgroundNotificationWorker() {
        Log.d(TAG, "Scheduling PeriodicWorkRequest (15 min interval)");
        PeriodicWorkRequest notificationWorkRequest =
                new PeriodicWorkRequest.Builder(NotificationWorker.class, 15, TimeUnit.MINUTES)
                        .setInitialDelay(15, TimeUnit.MINUTES) // Normal periodic delay
                        .build();

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "ProduXNotificationWork",
                ExistingPeriodicWorkPolicy.KEEP,
                notificationWorkRequest
        );
    }

    private void runImmediateNotificationCheck() {
        Log.d(TAG, "Enqueuing OneTimeWorkRequest for immediate check");
        OneTimeWorkRequest immediateWork = new OneTimeWorkRequest.Builder(NotificationWorker.class).build();
        WorkManager.getInstance(this).enqueue(immediateWork);
    }

    private void startInstantBackgroundService() {
        Intent serviceIntent = new Intent(this, ForegroundPollingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }
}
