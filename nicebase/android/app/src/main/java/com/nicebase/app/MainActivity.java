package com.nicebase.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
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

        // Android 15 (API 35) enforces edge-to-edge. Apply system bar insets
        // as padding on the root content view so the WebView never renders
        // behind the status bar or navigation bar.
        View contentView = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return windowInsets;
        });

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

        NotificationChannel dailyReminderChannel = new NotificationChannel(
            "daily-reminder",
            "Günlük Hatırlatmalar",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        dailyReminderChannel.setDescription("Günlük anı hatırlatmaları");
        dailyReminderChannel.enableVibration(true);
        notificationManager.createNotificationChannel(dailyReminderChannel);

        NotificationChannel streakProtectionChannel = new NotificationChannel(
            "streak-protection",
            "Streak Koruma",
            NotificationManager.IMPORTANCE_HIGH
        );
        streakProtectionChannel.setDescription("Streak kırılma riski bildirimleri");
        streakProtectionChannel.enableVibration(true);
        notificationManager.createNotificationChannel(streakProtectionChannel);

        NotificationChannel randomMemoryChannel = new NotificationChannel(
            "random-memory",
            "Rastgele Anı Hatırlatmaları",
            NotificationManager.IMPORTANCE_LOW
        );
        randomMemoryChannel.setDescription("Rastgele anı hatırlatmaları");
        randomMemoryChannel.enableVibration(false);
        notificationManager.createNotificationChannel(randomMemoryChannel);

        NotificationChannel defaultChannel = new NotificationChannel(
            "default",
            "Varsayılan",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        defaultChannel.setDescription("Diğer bildirimler");
        notificationManager.createNotificationChannel(defaultChannel);
    }
}
