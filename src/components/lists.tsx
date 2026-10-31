"use client";
import Link from "./app-link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  LoaderCircle,
  MessageCircle,
  Package,
  Plus,
  Search,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { complete, whatsappUrl } from "@/lib/domain";
import type { Parcel, ParcelList } from "@/lib/types";
import { currency, dateLabel, useApp } from "./workspace";
import { EmptyState, Modal, PageHeading, Status } from "./ui";
import { WhatsappMessage, WhatsappQueue } from "./whatsapp-queue";
import { WhatsappLink } from "./whatsapp-link";
export function Lists({
  initialSelected,
  justCreated,
}: {
  initialSelected: string | null;
  justCreated: boolean;
}) {
  const { data, mutate, notify } = useApp();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<string | null>(
    () =>
      initialSelected ??
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("list")
        : null),
  );
  const [tab, setTab] = useState(selected ? "all" : "incomplete");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Parcel | null>(null);
  const [queueListId, setQueueListId] = useState<string | null>(null);
  useEffect(() => {
    if (
      justCreated ||
      new URLSearchParams(window.location.search).get("created") === "1"
    ) {
      notify("تم إنشاء اللائحة وحفظ جميع الطرود بنجاح");
      const url = new URL(window.location.href);
      url.searchParams.delete("created");
      window.history.replaceState(null, "", url);
    }
  }, [notify, justCreated]);
  if (!data) return null;
  const filtered = data.lists.filter(
    (l) =>
      (tab === "all" || (tab === "complete" ? complete(l) : !complete(l))) &&
      (!search ||
        [l.id, l.driver, ...l.parcels.flatMap((p) => [p.reference, p.phone])]
          .join(" ")
          .toLowerCase()
          .includes(search.replace(/^0(?=[5-7])/, "+212").toLowerCase()) ||
        l.createdAt.slice(0, 10).includes(search)) &&
      (!date ||
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Casablanca",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(l.createdAt)) === date),
  );
  const selectedList = data.lists.find((l) => l.id === selected);
  const queueList = data.lists.find((l) => l.id === queueListId);
  async function status(parcel: Parcel, field: "paid" | "collected") {
    if (busy) return;
    setBusy(parcel.id);
    setError("");
    try {
      const result = await mutate("parcel-status", {
        parcelId: parcel.id,
        [field]: !parcel[field],
      });
      const updatedList = result.lists.find((list) =>
        list.parcels.some((p) => p.id === parcel.id),
      );
      if (updatedList && complete(updatedList) && tab === "incomplete")
        setTab("complete");
      notify("تم حفظ حالة الطرد");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function finish(list: ParcelList) {
    if (busy) return;
    setBusy(list.id);
    setError("");
    try {
      await mutate("close-list", { listId: list.id });
      setSelected(null);
      setSearch("");
      setDate("");
      setTab("complete");
      const url = new URL(window.location.href);
      url.searchParams.delete("list");
      window.history.replaceState(null, "", url);
      notify("تم تأكيد دفع اللائحة وحفظها");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function ListCard({ list }: { list: ParcelList }) {
    const done = complete(list);
    return (
      <article
        className={`panel list-card ${selected === list.id ? "expanded" : ""}`}
      >
        <button
          className="list-card-toggle"
          onClick={() => setSelected(selected === list.id ? null : list.id)}
          aria-expanded={selected === list.id}
        >
          <span className="list-card-icon">
            <ClipboardList size={23} />
          </span>
          <span className="list-title">
            <strong dir="ltr">{list.id}</strong>
            <small>
              <Truck size={13} />
              {list.driver}
              <i /> {dateLabel(list.createdAt)}
            </small>
          </span>
          <span className="list-meta">
            <strong>
              {currency(list.total)} <small>د.م</small>
            </strong>
            <small>{list.parcels.length} طرود</small>
          </span>
          {list.closedAt ? (
            <span className="status-badge done">
              <CheckCheck size={14} /> خلصت · مدفوعة
            </span>
          ) : (
            <Status done={done} />
          )}
          <ChevronDown className="expand-chevron" size={18} />
        </button>
        {selected === list.id && (
          <div className="list-detail">
            <div className="list-notification-toolbar">
              {done ? (
                <>
                  <p>
                    {list.closedAt
                      ? "تم تأكيد دفع هذه اللائحة وحفظها."
                      : "جميع طرود هذه اللائحة مدفوعة ومستلمة."}
                  </p>
                  {!list.closedAt && (
                    <button
                      type="button"
                      className="button primary"
                      disabled={!!busy}
                      onClick={() => void finish(list)}
                    >
                      <CheckCheck size={18} />
                      خلصت
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>افتح رسائل الزبناء بالتتابع، وأرسل كل رسالة بنفسك.</p>
                  <button
                    className="button outline small"
                    disabled={!list.parcels.some((p) => !p.collected)}
                    onClick={() => setQueueListId(list.id)}
                  >
                    <MessageCircle size={16} />
                    إشعار زبناء اللائحة
                  </button>
                </>
              )}
            </div>
            <div className="list-detail-note">
              <CheckCheck size={17} />
              {list.parcels.filter((p) => p.paid && p.collected).length} من{" "}
              {list.parcels.length} طرود مكتملة
              <span>حدّث الدفع والاستلام لكل طرد على حدة</span>
            </div>
            {list.parcels.map((p, i) => (
              <div className="parcel-detail" key={p.id}>
                <div className="parcel-detail-info">
                  <span className="detail-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong dir="ltr">{p.reference}</strong>
                    <a href={`tel:${p.phone}`} dir="ltr">
                      {p.phone}
                    </a>
                    <small>
                      {p.items
                        .map((item) => `${item.name} × ${item.quantity}`)
                        .join(" · ")}
                    </small>
                  </div>
                </div>
                <strong className="parcel-price">
                  {currency(p.total)} <small>د.م</small>
                </strong>
                <div className="parcel-actions">
                  <button
                    className={`state-button ${p.paid ? "checked" : ""}`}
                    aria-pressed={p.paid}
                    disabled={!!busy}
                    onClick={() => void status(p, "paid")}
                  >
                    {busy === p.id ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : p.paid ? (
                      <Check size={15} />
                    ) : (
                      <Wallet size={15} />
                    )}{" "}
                    {p.paid ? "مدفوع" : "غير مدفوع"}
                  </button>
                  <button
                    className={`state-button ${p.collected ? "checked" : ""}`}
                    aria-pressed={p.collected}
                    disabled={!!busy}
                    onClick={() => void status(p, "collected")}
                  >
                    {p.collected ? <Check size={15} /> : <Package size={15} />}{" "}
                    {p.collected ? "مستلم" : "غير مستلم"}
                  </button>
                  <button
                    className="whatsapp-button"
                    aria-label={`إشعار واتساب للطرد ${p.reference}`}
                    onClick={() => setPreview(p)}
                  >
                    <MessageCircle size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    );
  }
  return (
    <>
      <PageHeading
        title="لوائح الطرود"
        description="من الوصول إلى الاستلام، تابع تفاصيل كل لائحة."
        action={
          <Link href="/lists/new" className="button primary">
            <Plus size={18} />
            إنشاء لائحة جديدة
          </Link>
        }
      />
      <div className="panel list-toolbar">
        <div className="search-input">
          <Search size={19} />
          <input
            placeholder="ابحث بكود الطرد، اللائحة، السائق، أو الهاتف…"
            aria-label="البحث في اللوائح"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              aria-label="مسح البحث"
              className="icon-button"
              onClick={() => setSearch("")}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <input
          type="date"
          aria-label="تصفية حسب التاريخ"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="tabs" role="tablist" aria-label="حالة اللوائح">
        {[
          {
            id: "incomplete",
            label: "غير مكتملة",
            count: data.lists.filter((l) => !complete(l)).length,
          },
          {
            id: "complete",
            label: "مدفوعة ومستلمة كلياً",
            count: data.lists.filter(complete).length,
          },
          { id: "all", label: "جميع اللوائح", count: data.lists.length },
        ].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t.id}
            key={t.id}
            className={tab === t.id ? "selected" : ""}
            onClick={() => {
              setTab(t.id);
              setSelected(null);
            }}
          >
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <div className="lists-stack">
        {filtered.map((l) => (
          <ListCard key={l.id} list={l} />
        ))}
        {!filtered.length && (
          <div className="panel">
            <EmptyState
              icon={Package}
              title="لا توجد لوائح هنا بعد"
              description="جرّب تغيير البحث أو أنشئ لائحة طرود جديدة."
              action={
                <Link href="/lists/new" className="button primary">
                  <Plus size={16} />
                  إنشاء لائحة
                </Link>
              }
            />
          </div>
        )}
      </div>
      <p className="list-bottom-note">
        {selectedList?.closedAt
          ? "تم احتساب نسبة اللائحة مرة واحدة."
          : selectedList && complete(selectedList)
            ? "اضغط «خلصت» لتأكيد دفع اللائحة واحتساب نسبتها."
            : "تكتمل اللائحة فقط بعد دفع واستلام جميع طرودها."}
      </p>
      {queueList && (
        <WhatsappQueue
          key={queueList.id}
          list={queueList}
          mapsUrl={data.settings.mapsUrl}
          onClose={() => setQueueListId(null)}
        />
      )}
      {preview && (
        <Modal title="إشعار وصول الطرد" onClose={() => setPreview(null)}>
          <span className="notification-recipient" dir="ltr">
            {preview.phone}
          </span>
          <WhatsappMessage parcel={preview} mapsUrl={data.settings.mapsUrl} />
          <p className="field-help">
            سيُفتح واتساب برسالة جاهزة. اضغط إرسال بنفسك داخل واتساب. فتح الرابط
            لا يعني إرسال الرسالة أو توصيلها.
          </p>
          {data.settings.mapsUrl ? (
            <WhatsappLink
              href={whatsappUrl(
                preview.phone,
                preview.reference,
                preview.total,
                data.settings.mapsUrl,
              )}
              onOpened={() => {
                notify("تم فتح مسودة واتساب. أكّد الإرسال داخل واتساب.");
                setPreview(null);
              }}
            >
              <MessageCircle size={18} />
              فتح في واتساب
              <ArrowLeft size={17} />
            </WhatsappLink>
          ) : (
            <Link className="button primary" href="/settings">
              إضافة موقع المتجر
              <ArrowLeft size={17} />
            </Link>
          )}
        </Modal>
      )}
    </>
  );
}
