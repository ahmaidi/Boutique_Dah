import { Capacitor, registerPlugin } from "@capacitor/core";

type FileResult = { cancelled: boolean; text?: string };
const files = registerPlugin<{
  save(options: { filename: string; text: string }): Promise<FileResult>;
  open(): Promise<FileResult>;
  email(options: {
    filename: string;
    text: string;
    recipient: string;
  }): Promise<void>;
}>("BackupFiles");

export const isAndroidApp = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
export const saveAndroidBackup = (filename: string, text: string) =>
  files.save({ filename, text });
export const openAndroidBackup = () => files.open();
export const emailAndroidBackup = (
  filename: string,
  text: string,
  recipient: string,
) => files.email({ filename, text, recipient });
