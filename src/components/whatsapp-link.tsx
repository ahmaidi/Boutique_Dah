"use client";
import { useState, type ReactNode } from "react";
import { registerPlugin } from "@capacitor/core";
import { isAndroidApp } from "@/lib/native-backups";

const phone = registerPlugin<{
  whatsapp(options: { url: string }): Promise<void>;
}>("PhoneActions");

export function WhatsappLink({
  href,
  onOpened,
  children,
}: {
  href: string;
  onOpened: () => void;
  children: ReactNode;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <a
        className="button primary"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={busy}
        onClick={async (event) => {
          if (!isAndroidApp()) {
            onOpened();
            return;
          }
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await phone.whatsapp({ url: href });
            onOpened();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
      </a>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
