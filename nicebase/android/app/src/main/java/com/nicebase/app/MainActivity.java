package com.nicebase.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Create notification channels for Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannels();
        }
    }
    
    private void createNotificationChannels() {
        NotificationManager notificationManager = getSystemService(NotificationManager.class);
        
        if (notificationManager == null) {
            return;
        }
        
        // Daily Reminder Channel
        NotificationChannel dailyReminderChannel = new NotificationChannel(
            "daily-reminder",
            "Günlük Hatırlatmalar",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        dailyReminderChannel.setDescription("Günlük anı hatırlatmaları");
        dailyReminderChannel.enableVibration(true);
        notificationManager.createNotificationChannel(dailyReminderChannel);
        
        // Streak Protection Channel
        NotificationChannel streakProtectionChannel = new NotificationChannel(
            "streak-protection",
            "Streak Koruma",
            NotificationManager.IMPORTANCE_HIGH
        );
        streakProtectionChannel.setDescription("Streak kırılma riski bildirimleri");
        streakProtectionChannel.enableVibration(true);
        notificationManager.createNotificationChannel(streakProtectionChannel);
        
        // Random Memory Channel
        NotificationChannel randomMemoryChannel = new NotificationChannel(
            "random-memory",
            "Rastgele Anı Hatırlatmaları",
            NotificationManager.IMPORTANCE_LOW
        );
        randomMemoryChannel.setDescription("Rastgele anı hatırlatmaları");
        randomMemoryChannel.enableVibration(false);
        notificationManager.createNotificationChannel(randomMemoryChannel);
        
        // Default Channel (for other notifications)
        NotificationChannel defaultChannel = new NotificationChannel(
            "default",
            "Varsayılan",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        defaultChannel.setDescription("Diğer bildirimler");
        notificationManager.createNotificationChannel(defaultChannel);
    }
}
