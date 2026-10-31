package com.boutiquedah.app;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PhoneActions")
public class PhoneActionsPlugin extends Plugin {
    @PluginMethod
    public void whatsapp(PluginCall call) {
        String address = call.getString("url");
        if (address == null) { call.reject("رابط واتساب غير صالح"); return; }
        Uri url = Uri.parse(address);
        String phone = url.getPath() != null ? url.getPath().replace("/", "") : "";
        String text = url.getQueryParameter("text");
        if (!"https".equals(url.getScheme()) || !"wa.me".equals(url.getHost()) || !phone.matches("212[5-7][0-9]{8}") || text == null) {
            call.reject("رابط واتساب غير صالح"); return;
        }
        Uri draft = Uri.parse("whatsapp://send?phone=" + phone + "&text=" + Uri.encode(text));
        getActivity().runOnUiThread(() -> {
            for (String app : new String[]{"com.whatsapp.w4b", "com.whatsapp"}) {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, draft);
                    intent.setPackage(app);
                    getActivity().startActivity(intent);
                    call.resolve();
                    return;
                } catch (android.content.ActivityNotFoundException ignored) {
                    // Prefer WhatsApp Business; fall back to the personal app.
                } catch (Exception e) {
                    call.reject("تعذّر فتح واتساب", e); return;
                }
            }
            call.reject("ثبّت واتساب بزنس أو واتساب أولاً");
        });
    }
}
