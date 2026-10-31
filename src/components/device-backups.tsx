"use client";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  Database,
  LoaderCircle,
  ShieldCheck,
  Mail,
} from "lucide-react";
import {
  makeBackup,
  parseBackup,
  type Backup,
} from "@/lib/backups";
import {
  deviceBackupInfo,
  markBackupExported,
  readDeviceStore,
  readSafetyBackup,
  type BackupInfo,
} from "@/lib/device-store";
import { useApp, dateLabel } from "./workspace";
import { Modal } from "./ui";
import { nativeBuild } from "@/lib/app-href";
import { AutomaticBackups } from "./automatic-backups";
import { decryptBackup, isEncryptedBackup, MAX_BACKUP_FILE_BYTES } from "@/lib/encrypted-backups";
import {
  isAndroidApp,
  openAndroidBackup,
  saveAndroidBackup,
  emailAndroidBackup,
} from "@/lib/native-backups";

async function download(backup: Backup, suffix = "") {
  const filename = `boutique-dah${suffix}-${backup.exportedAt.replace(/[:.]/g, "-")}.json`;
  const text = JSON.stringify(backup);
  if (isAndroidApp()) {
    const result = await saveAndroidBackup(filename, text);
    return !result.cancelled;
  }
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export function DeviceBackups() {
  const { data, restore, notify } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [info, setInfo] = useState<BackupInfo>({
    lastExportedAt: null,
    safetyAvailable: false,
  });
  const [pending, setPending] = useState<{
    backup: Backup;
    revision: number;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [lockedText, setLockedText] = useState<string | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  useEffect(() => {
    void deviceBackupInfo()
      .then(setInfo)
      .catch(() => {});
  }, [data?.revision]);
  if (!data) return null;
  async function exportFile(safety = false) {
    setBusy(true);
    setError("");
    try {
      const backup = safety
        ? await readSafetyBackup()
        : makeBackup(await readDeviceStore());
      if (!backup) throw new Error("لا توجد نسخة أمان قبل الاستعادة");
      if (!(await download(backup, safety ? "-before-restore" : ""))) return;
      if (!safety) {
        await markBackupExported();
        setInfo(await deviceBackupInfo());
      }
      notify(
        isAndroidApp()
          ? "تم حفظ ملف النسخة في المكان الذي اخترته. احتفظ بنسخة خارج الهاتف أيضاً."
          : "تم تجهيز ملف النسخة. احفظه في التنزيلات واحتفظ بنسخة خارج الهاتف.",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function prepareRestore(text: string) {
    if (isEncryptedBackup(text)) {
      setLockedText(text);
      setRestorePassword("");
      return;
    }
    const backup = parseBackup(text);
    const current = await readDeviceStore();
    setPending({ backup, revision: current.revision });
  }
  async function emailBackup() {
    if (busy || !data?.settings.backupEmail) return;
    setBusy(true);
    setError("");
    try {
      if (!isAndroidApp())
        throw new Error("إرسال المرفق عبر Gmail متاح داخل تطبيق أندرويد");
      const backup = makeBackup(await readDeviceStore());
      const filename = `boutique-dah-${backup.exportedAt.replace(/[:.]/g, "-")}.json`;
      await emailAndroidBackup(
        filename,
        JSON.stringify(backup),
        data.settings.backupEmail,
      );
      notify(
        "تم فتح Gmail بالنسخة مرفقة. اضغط إرسال بنفسك وتحقق من وصول الرسالة؛ لم يتم تأكيد إرسالها من التطبيق.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function inspectNative() {
    setBusy(true);
    setError("");
    setConfirmed(false);
    try {
      const result = await openAndroidBackup();
      if (!result.cancelled && result.text !== undefined)
        await prepareRestore(result.text);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function inspect(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setConfirmed(false);
    try {
      if (file.size > MAX_BACKUP_FILE_BYTES)
        throw new Error("اختر نسخة أصغر من ٣٢ ميغابايت");
      await prepareRestore(await file.text());
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function confirmRestore() {
    if (!pending || !confirmed || busy) return;
    setBusy(true);
    setError("");
    try {
      await restore(pending.backup.data, pending.revision);
      setPending(null);
      notify(
        "تمت استعادة النسخة على هذا الجهاز. حُفظت نسخة أمان من البيانات السابقة.",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel form-panel device-backups">
      <div className="form-section-title">
        <span className="section-icon">
          <Database size={22} />
        </span>
        <div>
          <h2>بيانات الهاتف والنسخ الاحتياطي</h2>
          <p>
            {nativeBuild
              ? "سجلاتك محفوظة داخل التطبيق على هذا الهاتف وتعمل دون إنترنت. ربط Google اختياري للنسخ اليومي فقط."
              : "سجلاتك محفوظة على هذا الجهاز، دون حساب أو قاعدة بيانات سحابية."}
          </p>
        </div>
      </div>
      <div className="device-storage-status">
        <span className="status-badge done">
          <i />
          محفوظ على هذا الجهاز
        </span>
        {nativeBuild && <span className="status-badge done">
          <i />
          جاهز للعمل دون إنترنت
        </span>}
      </div>
      <p className="backup-guidance">
        صدّر نسخة بانتظام، خصوصاً بعد إضافة لوائح أو تسجيل تسوية.{" "}
        {nativeBuild
          ? "حذف التطبيق أو مسح بياناته أو فقدان الهاتف قد يحذف سجلاتك؛ اختر مكاناً خارج التطبيق واحفظ نسخة خارج الهاتف أيضاً."
          : "مسح بيانات المتصفح أو فقدان الهاتف قد يحذف سجلاتك؛ احتفظ بالملف خارج الهاتف أيضاً."}
      </p>
      <p className="backup-last">
        آخر تجهيز لنسخة:{" "}
        <strong>
          {info.lastExportedAt
            ? dateLabel(info.lastExportedAt)
            : "لم يتم تجهيز نسخة بعد"}
        </strong>
      </p>
      <div className="backup-actions">
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void exportFile()}
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Download size={17} />
          )}
          تصدير نسخة احتياطية
        </button>
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            isAndroidApp() ? void inspectNative() : input.current?.click()
          }
        >
          <Upload size={17} />
          استعادة نسخة احتياطية
        </button>
      </div>
      {nativeBuild && (
        <AutomaticBackups />
      )}
      {nativeBuild && (
        <div className="gmail-backup-action">
          <button
            className="button outline"
            disabled={busy || !data.settings.backupEmail}
            onClick={() => void emailBackup()}
          >
            <Mail size={17} /> إرسال نسخة إلى Gmail
          </button>
          <p className="field-help">
            {data.settings.backupEmail
              ? `إلى ${data.settings.backupEmail} — يُفتح Gmail بالمرفق. اضغط إرسال بنفسك وتحقق من وصوله.`
              : "أدخل بريد النسخ الاحتياطية أعلاه واضغط حفظ الإعدادات أولاً."}
          </p>
        </div>
      )}
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="ملف النسخة الاحتياطية"
        disabled={busy}
        onChange={(e) => void inspect(e.target.files?.[0])}
      />
      {info.safetyAvailable && (
        <button
          className="text-link safety-backup"
          disabled={busy}
          onClick={() => void exportFile(true)}
        >
          <ShieldCheck size={16} />
          تنزيل نسخة الأمان قبل آخر استعادة
        </button>
      )}
      <p className="field-help">
        النسخة تتضمن اللوائح والطرود والأسعار والنسب والتسويات والإعدادات وسجل
        العمليات. التصدير اليدوي وزر Gmail اليدوي ينتجان ملفاً غير مشفّر؛ احفظه في مكان خاص. النسخ اليومي التلقائي مشفّر بكلمة مرور.
      </p>
      {error && !pending && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {lockedText && <Modal title="فتح النسخة المشفرة" onClose={() => {
        if (!busy) { setLockedText(null); setRestorePassword(""); setError(""); }
      }}>
        <p>أدخل كلمة مرور النسخ التي احتفظت بها عند تفعيل النسخ اليومي.</p>
        <label>كلمة مرور النسخة<input type="password" autoComplete="off" aria-invalid={!!error || undefined} maxLength={128} value={restorePassword} onChange={(e) => { setRestorePassword(e.target.value); setError(""); }} /></label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="modal-actions"><button className="button primary" disabled={busy || !restorePassword} onClick={() => {
          setBusy(true); setError("");
          void decryptBackup(lockedText, restorePassword).then(async (backup) => {
            const current = await readDeviceStore();
            setPending({ backup, revision: current.revision });
            setLockedText(null); setRestorePassword("");
          }).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
        }}>{busy ? "جارٍ فتح النسخة…" : "فتح ومراجعة النسخة"}</button></div>
      </Modal>}
      {pending && (
        <Modal
          title="استعادة النسخة الاحتياطية"
          onClose={() => {
            if (!busy) {
              setPending(null);
              setError("");
            }
          }}
        >
          <p>
            سيتم استبدال سجلات هذا الجهاز بمحتويات الملف المحدد. لن تُدمج
            البيانات.
          </p>
          <div className="restore-summary">
            <span>
              تاريخ النسخة
              <strong>{dateLabel(pending.backup.exportedAt)}</strong>
            </span>
            <span>
              اللوائح<strong>{pending.backup.data.lists.length}</strong>
            </span>
            <span>
              الطرود
              <strong>
                {pending.backup.data.lists.reduce(
                  (sum, l) => sum + l.parcels.length,
                  0,
                )}
              </strong>
            </span>
            <span>
              التسويات<strong>{pending.backup.data.settlements.length}</strong>
            </span>
          </div>
          <p className="field-help">
            ستُحفظ نسخة أمان من سجلات الجهاز الحالية قبل الاستبدال. يمكنك
            تنزيلها بعد الاستعادة.
          </p>
          <label className="restore-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy}
            />
            أفهم أن هذه النسخة ستستبدل سجلات هذا الجهاز.
          </label>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button primary"
              disabled={!confirmed || busy}
              onClick={() => void confirmRestore()}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Upload size={17} />
              )}
              تأكيد الاستعادة
            </button>
            <button
              className="button outline"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
