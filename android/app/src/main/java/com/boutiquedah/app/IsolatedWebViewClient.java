package com.boutiquedah.app;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.util.Collections;

/** App pages/resources stay in the bundled runtime. External actions use explicit native plugins. */
public class IsolatedWebViewClient extends BridgeWebViewClient {
    public IsolatedWebViewClient(Bridge bridge) { super(bridge); }

    private boolean isLocalPage(Uri uri) {
        return "https".equals(uri.getScheme()) && "localhost".equals(uri.getHost());
    }
    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return !isLocalPage(request.getUrl()) || super.shouldOverrideUrlLoading(view, request);
    }
    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!isLocalPage(uri) && !"data".equals(uri.getScheme()) && !"blob".equals(uri.getScheme())) {
            return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
        return super.shouldInterceptRequest(view, request);
    }
}
