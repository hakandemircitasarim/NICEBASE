package com.nicebase.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Required by @capgo/capacitor-social-login to enable Google Sign-In with scopes
    }
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Capacitor 8 defaults to edge-to-edge (content goes behind system bars).
        // Opt out so the WebView content stays below the status bar and above the
        // navigation bar, matching the traditional Android layout.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

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
