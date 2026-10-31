package com.boutiquedah.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import android.webkit.WebView;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private boolean pageReady = false;
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> !pageReady);
        splash.setOnExitAnimationListener(provider -> provider.remove());
        registerPlugin(BackupFilesPlugin.class);
        registerPlugin(PhoneActionsPlugin.class);
        registerPlugin(AutomaticBackupsPlugin.class);
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView view) {
                pageReady = true;
            }
            @Override public void onReceivedError(WebView view) { pageReady = true; }
        });
        super.onCreate(savedInstanceState);
        if (bridge != null) bridge.setWebViewClient(new IsolatedWebViewClient(bridge));
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (bridge != null && bridge.getWebView().canGoBack()) bridge.getWebView().goBack();
                else moveTaskToBack(true);
            }
        });
    }
}
