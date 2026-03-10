package com.nicebase.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    private String insetsJs;

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Required by @capgo/capacitor-social-login to enable Google Sign-In with scopes
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15 (API 35) enforces edge-to-edge: WebView renders behind system bars.
        // Instead of padding native views (which creates visible color gaps), we inject
        // the exact inset values as CSS variables into the WebView. The existing CSS
        // body { padding-top: var(--safe-area-inset-top); ... } takes care of the rest,
        // producing a seamless look with no native gaps.
        View contentView = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            float density = getResources().getDisplayMetrics().density;
            int top = Math.round(insets.top / density);
            int bottom = Math.round(insets.bottom / density);
            int left = Math.round(insets.left / density);
            int right = Math.round(insets.right / density);

            insetsJs = String.format(java.util.Locale.US,
                "window.__SAFE_AREA_INSETS={top:%d,bottom:%d,left:%d,right:%d};" +
                "document.documentElement.style.setProperty('--safe-area-inset-top','%dpx');" +
                "document.documentElement.style.setProperty('--safe-area-inset-bottom','%dpx');" +
                "document.documentElement.style.setProperty('--safe-area-inset-left','%dpx');" +
                "document.documentElement.style.setProperty('--safe-area-inset-right','%dpx');",
                top, bottom, left, right,
                top, bottom, left, right);

            injectInsets();
            return windowInsets;
        });

        // Create notification channels for Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannels();
        }
    }

    /** Inject safe-area CSS variables into the WebView at multiple points to survive page loads. */
    private void injectInsets() {
        if (insetsJs == null) return;
        WebView webView = getBridge().getWebView();
        Handler handler = new Handler(Looper.getMainLooper());
        // Fire immediately and again after page likely loaded
        handler.post(() -> webView.evaluateJavascript(insetsJs, null));
        handler.postDelayed(() -> webView.evaluateJavascript(insetsJs, null), 300);
        handler.postDelayed(() -> webView.evaluateJavascript(insetsJs, null), 1000);
        handler.postDelayed(() -> webView.evaluateJavascript(insetsJs, null), 3000);
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
