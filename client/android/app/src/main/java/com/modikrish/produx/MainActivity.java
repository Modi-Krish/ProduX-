package com.modikrish.produx;

import android.os.Bundle;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.BridgeActivity;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Schedule native background notification polling without Firebase
        scheduleBackgroundWorker();
    }

    private void scheduleBackgroundWorker() {
        // Set constraints: background check requires an active internet connection
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        // 1. Android enforces a minimum 15-minute interval for periodic tasks to preserve battery life.
        PeriodicWorkRequest periodicWorkRequest = new PeriodicWorkRequest.Builder(
                NotificationWorker.class,
                15,
                TimeUnit.MINUTES
        )
                .setConstraints(constraints)
                .build();

        // Enqueue the work uniquely: keeps the single active scheduler instance alive
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "ProduxBackgroundPoll",
                ExistingPeriodicWorkPolicy.KEEP,
                periodicWorkRequest
        );

        // 2. ALSO enqueue an immediate OneTimeWorkRequest for instant testing on app boot!
        OneTimeWorkRequest oneTimeWorkRequest = new OneTimeWorkRequest.Builder(NotificationWorker.class)
                .build();
        WorkManager.getInstance(this).enqueue(oneTimeWorkRequest);
    }
}
