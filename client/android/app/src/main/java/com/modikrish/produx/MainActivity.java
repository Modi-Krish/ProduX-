package com.modikrish.produx;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Commented out to switch completely to energy-efficient Firebase Cloud Messaging (FCM) background wake-ups like WhatsApp
        // startInstantBackgroundService();
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
