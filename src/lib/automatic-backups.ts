import { registerPlugin } from "@capacitor/core";
import { makeBackup } from "./backups";
import { readDeviceStore } from "./device-store";
import { isAndroidApp } from "./native-backups";

export type AutomaticBackupStatus = {
  enabled: boolean;
  account: string;
  authorized: boolean;
  lastSentAt: number;
  lastSnapshotAt: number;
  lastSentSnapshotAt: number;
  error: string;
};
export const automaticBackups = registerPlugin<{
  status(): Promise<AutomaticBackupStatus>;
  authorize(options: { email: string }): Promise<{ cancelled: boolean }>;
  enable(options: { password: string; text: string }): Promise<void>;
  sync(options: { text: string }): Promise<void>;
  sendNow(): Promise<void>;
  disable(): Promise<void>;
}>("AutomaticBackups");

// Serialize reads and bridge calls: an old render must never replace a newer snapshot.
let syncing: Promise<void> = Promise.resolve();
export function syncAutomaticBackup(): Promise<void> {
  if (!isAndroidApp()) return Promise.resolve();
  const next = syncing.catch(() => {}).then(async () => {
    const status = await automaticBackups.status();
    if (!status.enabled) return;
    await automaticBackups.sync({ text: JSON.stringify(makeBackup(await readDeviceStore())) });
  });
  syncing = next;
  return next;
}
