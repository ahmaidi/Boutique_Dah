"use client";
import Link from "./app-link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, MessageCircle, SkipForward } from "lucide-react";
import type { Parcel, ParcelList } from "@/lib/types";
import {
  nextNotification,
  notificationQueue,
  QUEUE_STORAGE_KEY,
} from "@/lib/notification-queue";
import { whatsappUrl } from "@/lib/domain";
import { currency } from "./workspace";
import { Modal } from "./ui";
import { WhatsappLink } from "./whatsapp-link";

export function WhatsappMessage({
  parcel,
  mapsUrl,
}: {
  parcel: Parcel;
  mapsUrl: string;
}) {
  return (
    <div className="message-preview">
      السلام عليكم ورحمة الله وبركاته،
      <br />
      <br />
      📦 نخبركم أن طردكم رقم <bdi>{parcel.reference}</bdi> قد وصل وأصبح جاهزاً
      للاستلام.
      <br />
      <br />
      💰 ثمن الشحن الإجمالي المستحق: {currency(parcel.total)} درهم
      <br />
      <br />
      📍 بوتيك الداه – بوجدور، قبالة الضمان الاجتماعي.
      <br />
      <br />
      🗺️ الموقع: {mapsUrl || "أضف رابط الموقع من الإعدادات"}
      <br />
      <br />
      شكراً لثقتكم وتعاملكم معنا.
    </div>
  );
}

export function WhatsappQueue({
  list,
  mapsUrl,
  onClose,
}: {
  list: ParcelList;
  mapsUrl: string;
  onClose: () => void;
}) {
  const [queue, setQueue] = useState(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(QUEUE_STORAGE_KEY);
    } catch {
      /* Private browsing can disable storage. */
    }
    return notificationQueue(list, saved);
  });
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const parcel = list.parcels.find(
    (p) => p.id === queue.parcelIds[queue.index],
  );
  const finished = queue.index >= queue.parcelIds.length;
  useEffect(() => {
    try {
      if (finished) sessionStorage.removeItem(QUEUE_STORAGE_KEY);
      else sessionStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch {
      /* The current queue still works in memory if session storage is unavailable. */
    }
  }, [queue, finished]);
  // Expose unavailable persistence only on an explicit action, without changing send behavior.
  function opened() {
    if (!parcel) return;
    try {
      sessionStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify({ ...queue, openedParcelId: parcel.id }),
      );
    } catch {
      setStorageUnavailable(true);
    }
    setQueue((current) => ({ ...current, openedParcelId: parcel.id }));
  }
  return (
    <Modal title="إشعار زبناء اللائحة" onClose={onClose}>
      <span className="queue-list-reference" dir="ltr">
        {list.id}
      </span>
      {finished ? (
        <div className="queue-finished">
          <span className="queue-finished-icon">
            <Check size={28} />
          </span>
          <h3>انتهت مراجعة الطرود</h3>
          <p>
            الإرسال يتم يدوياً داخل واتساب. لا يؤكد التطبيق إرسال الرسائل أو
            توصيلها.
          </p>
          <button className="button primary" onClick={onClose}>
            العودة إلى اللائحة
          </button>
        </div>
      ) : parcel ? (
        <>
          <div className="queue-progress" aria-live="polite">
            <span>
              الطرد {queue.index + 1} من {queue.parcelIds.length}
            </span>
            <span>الطرود غير المستلمة فقط</span>
          </div>
          <div className="queue-progress-track" aria-hidden="true">
            <i
              style={{
                width: `${(queue.index / queue.parcelIds.length) * 100}%`,
              }}
            />
          </div>
          <span className="notification-recipient" dir="ltr">
            {parcel.phone}
          </span>
          <div className="queue-parcel-summary">
            <bdi>{parcel.reference}</bdi>
            <strong>
              {currency(parcel.total)} <small>درهم</small>
            </strong>
          </div>
          <details className="queue-message-details">
            <summary>معاينة الرسالة</summary>
            <WhatsappMessage parcel={parcel} mapsUrl={mapsUrl} />
          </details>
          <p className="queue-instruction">
            افتح واتساب واضغط إرسال بنفسك. بعد العودة، اضغط «الزبون التالي»
            للمتابعة.
          </p>
          {mapsUrl ? (
            <div className="queue-actions">
              <WhatsappLink
                href={whatsappUrl(
                  parcel.phone,
                  parcel.reference,
                  parcel.total,
                  mapsUrl,
                )}
                onOpened={opened}
              >
                <MessageCircle size={18} />
                {queue.openedParcelId === parcel.id
                  ? "فتح واتساب مجدداً"
                  : "فتح في واتساب"}
              </WhatsappLink>
              <button
                className="button outline"
                disabled={queue.openedParcelId !== parcel.id}
                onClick={() => setQueue(nextNotification)}
              >
                {queue.index === queue.parcelIds.length - 1
                  ? "إنهاء المراجعة"
                  : "الزبون التالي"}
                <ArrowLeft size={17} />
              </button>
            </div>
          ) : (
            <Link href="/settings" className="button primary" onClick={onClose}>
              إضافة موقع المتجر
              <ArrowLeft size={17} />
            </Link>
          )}
          <div className="queue-secondary">
            <button
              className="text-link"
              onClick={() => setQueue(nextNotification)}
            >
              <SkipForward size={15} />
              تخطي هذا الطرد
            </button>
            <span>فتح الرابط لا يؤكد الإرسال</span>
          </div>
          <p className="field-help">
            {storageUnavailable
              ? "للاحتفاظ بمكانك، أبقِ هذه الصفحة مفتوحة أثناء استخدام واتساب."
              : "يُحفظ مكانك في هذه الجلسة. يمكنك إغلاق النافذة ثم فتح إشعارات نفس اللائحة للمتابعة."}
          </p>
        </>
      ) : (
        <p className="field-help">
          هذا الطرد لم يعد متاحاً. أغلق النافذة وحدّث اللائحة.
        </p>
      )}
    </Modal>
  );
}
