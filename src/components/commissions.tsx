"use client";
import { clientId } from "@/lib/client-id";
import Link from "./app-link";
import { useRef, useState } from "react";
import {
  ArrowUpLeft,
  Check,
  ClipboardList,
  Coins,
  History,
  LoaderCircle,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { money, outstanding } from "@/lib/domain";
import { useApp, currency, dateLabel } from "./workspace";
import { EmptyState, Modal, PageHeading, StatCard } from "./ui";
export function Commissions() {
  const { data, mutate, notify } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const transaction = useRef<string | null>(null);
  const [expected, setExpected] = useState(0);
  if (!data) return null;
  const earned = money(data.commissions.reduce((s, c) => s + c.amount, 0));
  const settled = money(data.settlements.reduce((s, c) => s + c.amount, 0));
  const balance = outstanding(data);
  async function settle() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await mutate("settlements", {
        transactionId: transaction.current,
        expectedAmount: expected,
      });
      setConfirm(false);
      notify("تم تسجيل دفع النسبة وحفظ التسوية في السجل");
      transaction.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="إدارة النسب"
        description="حسابات واضحة، وتسويات محفوظة دائماً."
        action={
          <button
            className="button primary"
            disabled={balance <= 0}
            onClick={() => {
              transaction.current ??= clientId();
              setExpected(balance);
              setError("");
              setConfirm(true);
            }}
          >
            <Wallet size={18} />
            تسجيل دفع النسبة
          </button>
        }
      />
      <section className="commission-stats">
        <StatCard
          label="إجمالي النسب المكتسبة"
          value={earned}
          unit="د.م"
          icon={Coins}
          footnote="بعد تأكيد دفع اللائحة بزر خلصت"
        />
        <StatCard
          label="إجمالي النسب المدفوعة"
          value={settled}
          unit="د.م"
          icon={Check}
          tone="blue"
          footnote={`${data.settlements.length} عمليات تسوية مسجلة`}
        />
        <StatCard
          label="النسب المستحقة"
          value={balance}
          unit="د.م"
          icon={ArrowUpLeft}
          tone="violet"
          footnote="الرصيد المتبقي للتسوية"
        />
      </section>
      <div className="info-strip">
        <ShieldCheck size={21} />
        <p>
          تُحتسب النسبة مرة واحدة عند الضغط على «خلصت» لتأكيد دفع اللائحة، بعد
          دفع واستلام جميع طرودها. تحفظ كل لائحة نسبة العمولة المطبقة عند
          إنشائها.
        </p>
      </div>
      {data.commissions.some(
        (c) => !data.lists.find((l) => l.id === c.listId)?.closedAt,
      ) && (
        <p className="field-help">
          النسب المسجلة قبل هذا التحديث محفوظة كما هي.
        </p>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>اللوائح المساهمة في النسب</h2>
            <p>سجل النسب المكتسبة من اللوائح المكتملة</p>
          </div>
          <span className="subtle-icon">
            <ClipboardList size={22} />
          </span>
        </div>
        {data.commissions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>اللائحة</th>
                  <th>السائق</th>
                  <th>إجمالي الشحن</th>
                  <th>النسبة</th>
                  <th>المبلغ المكتسب</th>
                  <th>تاريخ الاكتمال</th>
                </tr>
              </thead>
              <tbody>
                {data.commissions.map((c) => {
                  const list = data.lists.find((l) => l.id === c.listId);
                  return (
                    <tr key={c.id}>
                      <td data-label="اللائحة">
                        <Link
                          className="reference"
                          href={"/lists?list=" + c.listId}
                        >
                          <bdi>{c.listId}</bdi>
                        </Link>
                      </td>
                      <td data-label="السائق">{list?.driver}</td>
                      <td data-label="إجمالي الشحن">
                        {currency(list?.total ?? 0)} د.م
                      </td>
                      <td data-label="النسبة">{list?.commissionRate}%</td>
                      <td className="earned-amount" data-label="المبلغ المكتسب">
                        {currency(c.amount)} د.م
                      </td>
                      <td className="muted" data-label="تاريخ الاكتمال">
                        {dateLabel(c.earnedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Coins}
            title="ستظهر نسبك هنا"
            description="أكمل دفع واستلام الطرود ثم اضغط «خلصت» لاحتساب نسبة اللائحة."
          />
        )}
      </section>
      <section className="panel settlement-panel">
        <div className="panel-heading">
          <div>
            <h2>سجل التسويات</h2>
            <p>كل عملية دفع محفوظة برقم مرجعي مستقل</p>
          </div>
          <span className="subtle-icon">
            <History size={22} />
          </span>
        </div>
        {data.settlements.map((s) => (
          <div className="settlement-row" key={s.id}>
            <span className="settlement-icon">
              <Receipt size={21} />
            </span>
            <div>
              <strong>تسوية النسبة المستحقة</strong>
              <small>
                {dateLabel(s.createdAt)} <bdi>· {s.id.slice(0, 12)}</bdi>
              </small>
            </div>
            <strong>
              {currency(s.amount)} <small>د.م</small>
            </strong>
            <span className="status-badge done">
              <Check size={13} />
              مسجلة
            </span>
          </div>
        ))}
        {!data.settlements.length && (
          <EmptyState
            icon={History}
            title="لا توجد تسويات بعد"
            description="عند تسجيل دفع النسبة، ستظهر العملية هنا."
          />
        )}
      </section>
      {confirm && (
        <Modal
          title="تأكيد تسجيل دفع النسبة"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p>هل تؤكد استلام مبلغ النسب المستحقة التالي؟</p>
          <div className="confirm-amount">
            {currency(expected)} <small>درهم</small>
          </div>
          <p className="field-help">
            سيُسجّل قيد تسوية جديد في السجل المالي. تبقى جميع النسب والتسويات
            السابقة محفوظة.
          </p>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void settle()}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Check size={17} />
              )}
              تأكيد تسجيل الدفع
            </button>
            <button
              className="button outline"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
