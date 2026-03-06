package com.nicebase.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
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

        // Ensure content does NOT draw behind system bars (status bar, navigation bar).
        // On Android 15+ edge-to-edge is enforced, so we explicitly disable it.
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, true);
        window.setStatusBarColor(0xFFFFFFFF);
        // Light status bar (dark icons on white background)
        View decorView = window.getDecorView();
        decorView.setSystemUiVisibility(
            decorView.getSystemUiVisibility() | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        );

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
