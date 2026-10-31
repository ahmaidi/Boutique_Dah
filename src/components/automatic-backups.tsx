"use client";
import { useEffect, useState } from "react";
import { Mail, LoaderCircle, LockKeyhole } from "lucide-react";
import { automaticBackups, syncAutomaticBackup, type AutomaticBackupStatus } from "@/lib/automatic-backups";
import { readDeviceStore } from "@/lib/device-store";
import { makeBackup } from "@/lib/backups";
import { useApp } from "./workspace";

const timestamp = (value: number) => value
  ? new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(value)
  : "لا توجد نسخة بعد";

export function AutomaticBackups() {
  const { data, notify } = useApp();
  const [status, setStatus] = useState<AutomaticBackupStatus | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [keptPassword, setKeptPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() { setStatus(await automaticBackups.status()); }
  useEffect(() => {
    const check = () => { void automaticBackups.status().then(setStatus).catch(() => setError("تعذّر قراءة حالة النسخ التلقائي")); };
    check();
    const timer = setInterval(check, 15000);
    window.addEventListener("focus", check);
    return () => { clearInterval(timer); window.removeEventListener("focus", check); };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); await refresh(); }
    catch (e) { setError((e as Error).message); await refresh().catch(() => {}); }
    finally { setBusy(false); }
  }
  const email = data?.settings.backupEmail ?? "";
  return (
    <div className="automatic-backups">
      <h3><LockKeyhole size={19} /> نسخة يومية مشفّرة إلى Gmail</h3>
      <p className="field-help">
        كل ٢٤ ساعة تقريباً، حتى والتطبيق مغلق. ينتظر الإنترنت وقد يتأخر بسبب توفير البطارية.
        يُرسل فقط ملف النسخة المشفّر إلى حساب Google الذي تربطه هنا. يتطلب إعداد Google Cloud مرة واحدة.
      </p>
      {status ? <>
        <p className={`status-badge ${status.enabled ? "done" : "pending"}`}>
          {status.enabled ? "النسخ التلقائي مفعّل" : "النسخ التلقائي غير مفعّل"}
        </p>
        {status.account && <p className="field-help">الحساب: <bdi>{status.account}</bdi></p>}
        {status.enabled && email !== status.account && <p className="field-help">النسخ اليومي ما زال يُرسل إلى الحساب المربوط أعلاه. لتغيير الحساب، أوقف النسخ ثم اربط الحساب الجديد.</p>}
        <p className="backup-last">آخر إرسال أكّده Gmail: <strong>{timestamp(status.lastSentAt)}</strong></p>
        <p className="field-help">بيانات آخر نسخة مرسلة حتى: {timestamp(status.lastSentSnapshotAt)}</p>
        {status.enabled && <p className="field-help">آخر تحديث للنسخة على الهاتف: {timestamp(status.lastSnapshotAt)}</p>}
        {status.error && <p className="error-message" role="alert">{status.error}</p>}
        {!status.enabled && <>
          <p className="field-help">احفظ بريد النسخ أعلاه أولاً. يجب أن يكون حساب Google مضافاً على هذا الهاتف.</p>
          <button className="button outline" disabled={busy || !email} onClick={() => void run(async () => {
            const result = await automaticBackups.authorize({ email });
            if (!result.cancelled) notify("تم ربط Google. اختر كلمة مرور النسخ وفعّل النسخ اليومي.");
          })}><Mail size={17} /> ربط حساب Google</button>
          {status.authorized && status.account === email && <div className="automatic-backup-passwords">
            <label>كلمة مرور استعادة النسخ
              <input type="password" autoComplete="new-password" aria-invalid={password.length > 0 && password.length < 12 || undefined} minLength={12} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label>تأكيد كلمة المرور
              <input type="password" autoComplete="new-password" aria-invalid={confirmation.length > 0 && password !== confirmation || undefined} maxLength={128} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </label>
            <p className="field-help">١٢ حرفاً على الأقل. احتفظ بها خارج الهاتف؛ ستحتاجها على الهاتف البديل. هذه كلمة مرور للنسخ، وليست كلمة مرور Google. لا يمكن استعادتها إذا نسيتها.</p>
            <label className="restore-confirm"><input type="checkbox" checked={keptPassword} onChange={(e) => setKeptPassword(e.target.checked)} /> احتفظت بكلمة المرور في مكان آمن خارج الهاتف.</label>
            <button className="button primary" disabled={busy || !keptPassword || password.length < 12 || password !== confirmation} onClick={() => void run(async () => {
              const current = await readDeviceStore();
              await automaticBackups.enable({ password, text: JSON.stringify(makeBackup(current)) });
              setPassword(""); setConfirmation(""); setKeptPassword(false);
              // Capture any write that completed while encryption/authorization was in progress.
              await syncAutomaticBackup();
              notify("فُعّل النسخ اليومي وجُدولت أول نسخة. تحقق من تاريخ الإرسال بعد وصولها.");
            })}>{busy ? <LoaderCircle size={17} className="spin" /> : <LockKeyhole size={17} />} تفعيل النسخ اليومي</button>
          </div>}
        </>}
        {status.enabled && <div className="backup-actions">
          {!status.authorized && <button className="button outline" disabled={busy} onClick={() => void run(async () => {
            await automaticBackups.authorize({ email: status.account });
          })}>تجديد إذن Google</button>}
          <button className="button primary" disabled={busy} onClick={() => void run(async () => {
            await syncAutomaticBackup(); await automaticBackups.sendNow();
            notify("جُدول إرسال النسخة المشفرة. انتظر تأكيد Gmail في الحالة أدناه.");
          })}>إرسال نسخة مشفّرة الآن</button>
          <button className="button outline" disabled={busy} onClick={() => void run(async () => {
            await automaticBackups.disable(); notify("تم إيقاف النسخ اليومي. يمكنك إلغاء إذن التطبيق من حساب Google أيضاً.");
          })}>إيقاف النسخ التلقائي</button>
        </div>}
      </> : <p className="field-help">جارٍ قراءة حالة النسخ…</p>}
      <p className="field-help">إغلاق التطبيق من التطبيقات الأخيرة لا يلغي الجدول. بعد «فرض الإيقاف» افتحه مجدداً. إيقاف النسخ لا يسحب رسالة بدأ إرسالها. الحد للنسخ التلقائي ١٢ ميغابايت.</p>
      {error && <p className="error-message" role="alert">{error}</p>}
    </div>
  );
}
