"use client";
import Link from "./app-link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Clock3,
  Coins,
  Package,
  Plus,
  Truck,
  Wallet,
} from "lucide-react";
import { complete, money, outstanding } from "@/lib/domain";
import { useApp, currency, dateLabel } from "./workspace";
import { PageHeading, StatCard, Status } from "./ui";
export function Dashboard() {
  const { data } = useApp();
  const [period, setPeriod] = useState("week");
  const [now] = useState(() => new Date());
  const stats = useMemo(() => {
    if (!data) return null;
    const parcels = data.lists.flatMap((l) => l.parcels);
    return {
      parcels: parcels.length,
      completed: data.lists.filter(complete).length,
      total: money(data.lists.reduce((s, l) => s + l.total, 0)),
      paid: money(
        parcels.filter((p) => p.paid).reduce((s, p) => s + p.total, 0),
      ),
      unpaid: money(
        parcels.filter((p) => !p.paid).reduce((s, p) => s + p.total, 0),
      ),
      collected: parcels.filter((p) => p.collected).length,
    };
  }, [data]);
  if (!data || !stats) return null;
  const anchor = new Date(now);
  const days = period === "week" ? 7 : 30;
  const chart = Array.from({ length: days === 7 ? 7 : 6 }, (_, i) => {
    const count = days === 7 ? 1 : 5;
    const end = new Date(anchor);
    end.setUTCDate(anchor.getUTCDate() - (days === 7 ? 6 - i : (5 - i) * 5));
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - (count - 1));
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
    return {
      label:
        days === 7
          ? new Intl.DateTimeFormat("ar-MA", {
              weekday: "short",
              timeZone: "Africa/Casablanca",
            }).format(end)
          : `${end.getUTCDate()}/${end.getUTCMonth() + 1}`,
      value: data.lists
        .filter(
          (l) => new Date(l.createdAt) >= start && new Date(l.createdAt) <= end,
        )
        .reduce((s, l) => s + l.total, 0),
    };
  });
  const maximum = Math.max(...chart.map((c) => c.value), 100);
  const chartTotal = chart.reduce((s, c) => s + c.value, 0);
  const percent = Math.round(
    (stats.completed / Math.max(data.lists.length, 1)) * 100,
  );
  return (
    <>
      <PageHeading
        title="أهلاً بك في بوتيك الداه 👋"
        description="كل ما تحتاجه لمتابعة طرودك، في مكان واحد."
        action={
          <div className="date-chip">
            <CalendarDays size={17} />
            {dateLabel(now.toISOString())}
          </div>
        }
      />
      <section className="welcome-banner">
        <div className="welcome-copy">
          <div className="home-brand">
            <span className="brand-icon">
              <Package size={30} />
            </span>
            <strong>بوتيك الداه</strong>
          </div>
          <span className="hero-kicker">
            <span /> تفاصيل أقل. إنجاز أكثر.
          </span>
          <h2>
            طرود منظّمة،
            <br />
            وزبناء مطمئنّون.
          </h2>
          <p>من وصول الطرد حتى استلامه، تابع كل خطوة بكل سهولة.</p>
          <Link href="/lists/new" className="button primary">
            {" "}
            <Plus size={18} />
            إنشاء لائحة جديدة
            <ArrowLeft size={17} />
          </Link>
        </div>
        <div className="parcel-scene" aria-hidden="true">
          <div className="scene-ring ring-one" />
          <div className="scene-ring ring-two" />
          <div className="floating-check">
            <Check size={20} />
          </div>
          <div className="scene-line" />
          <div className="parcel-box back-box">
            <div className="box-top" />
            <div className="box-tape" />
          </div>
          <div className="parcel-box front-box">
            <div className="box-top" />
            <div className="box-tape" />
            <div className="box-label">
              <span />
              <span />
              <i />
              <span />
            </div>
            <Package className="box-mark" size={27} strokeWidth={1.2} />
          </div>
          <div className="delivery-tag">
            <span>
              <Truck size={19} />
            </span>
            <div>
              <strong>كل طرد له حكاية</strong>
              <small>ونحن نهتم بوصولها</small>
            </div>
            <span className="tag-dot" />
          </div>
          <div className="scene-spark spark-one">✧</div>
          <div className="scene-spark spark-two">✦</div>
        </div>
      </section>
      <div className="section-heading">
        <h2>
          نظرة عامة <span>أرقام متجرك في لمحة</span>
        </h2>
        <span className="overview-period">
          جميع الفترات <Clock3 size={14} />
        </span>
      </div>
      <section className="stats-grid">
        <StatCard
          label="إجمالي اللوائح"
          value={data.lists.length}
          icon={ClipboardList}
          footnote="لائحة مسجلة في المتجر"
        />
        <StatCard
          label="إجمالي الطرود"
          value={stats.parcels}
          icon={Package}
          tone="blue"
          footnote="طرداً تحت متابعتك"
        />
        <StatCard
          label="لوائح مكتملة"
          value={stats.completed}
          icon={CheckCheck}
          footnote="مدفوعة ومستلمة بالكامل"
        />
        <StatCard
          label="لوائح غير مكتملة"
          value={data.lists.length - stats.completed}
          icon={Clock3}
          tone="amber"
          footnote="بانتظار الدفع أو الاستلام"
        />
      </section>
      <section className="finance-grid">
        <StatCard
          label="إجمالي مبالغ الشحن"
          value={stats.total}
          unit="د.م"
          icon={Wallet}
          footnote={`تم تحصيل ${currency(stats.paid)} د.م`}
          tone="green"
        />
        <StatCard
          label="مبالغ الشحن المستحقة"
          value={stats.unpaid}
          unit="د.م"
          icon={Coins}
          footnote="مبالغ لم يتم تحصيلها بعد"
          tone="amber"
        />
        <StatCard
          label="النسب المستحقة"
          value={outstanding(data)}
          unit="د.م"
          icon={ArrowUpLeft}
          footnote="من اللوائح المكتملة · بعد التسويات"
          tone="violet"
        />
      </section>
      <section className="analytics-grid">
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>حركة الشحن</h2>
              <p>إجمالي مبالغ اللوائح حسب تاريخ إنشائها</p>
            </div>
            <div className="select-wrap">
              <select
                aria-label="فترة الرسم البياني"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="week">آخر ٧ أيام</option>
                <option value="month">آخر ٣٠ يوماً</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>
          <div className="chart-summary">
            <strong>
              {currency(chartTotal)} <small>د.م</small>
            </strong>
            <span>
              <i />
              مبالغ الشحن
            </span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={`مبالغ الشحن خلال الفترة: ${currency(chartTotal)} درهم`}
          >
            <div className="chart-axis">
              <span>{currency(Math.ceil(maximum / 100) * 100)}</span>
              <span>{currency(Math.ceil(maximum / 200) * 100)}</span>
              <span>0</span>
            </div>
            <div className="chart-plot">
              <div className="chart-gridlines">
                <i />
                <i />
                <i />
              </div>
              <div className="chart-bars">
                {chart.map((c, i) => (
                  <div className="chart-column" key={i}>
                    <div className="bar-track">
                      <div
                        className={`chart-bar ${i === chart.length - 1 ? "highlight" : ""}`}
                        style={{ height: `${(c.value / maximum) * 88}%` }}
                        title={`${c.label}: ${c.value} د.م`}
                      >
                        <span>{currency(c.value)} د.م</span>
                      </div>
                    </div>
                    <small>{c.label}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <h2>حالة اللوائح</h2>
              <p>خطوة بخطوة نحو الاكتمال</p>
            </div>
            <span className="subtle-icon">
              <Package size={20} />
            </span>
          </div>
          <div
            className="donut-chart"
            style={{ "--progress": `${percent}%` } as React.CSSProperties}
          >
            <div>
              <strong>
                {percent}
                <small>%</small>
              </strong>
              <span>نسبة الاكتمال</span>
            </div>
          </div>
          <div className="progress-legend">
            <div>
              <span>
                <i className="green-dot" />
                مدفوعة ومستلمة
              </span>
              <strong>
                {stats.completed}
                <small> لوائح</small>
              </strong>
            </div>
            <div>
              <span>
                <i className="mint-dot" />
                غير مكتملة
              </span>
              <strong>
                {data.lists.length - stats.completed}
                <small> لوائح</small>
              </strong>
            </div>
          </div>
          <Link href="/lists" className="panel-link">
            متابعة جميع اللوائح
            <ArrowLeft size={16} />
          </Link>
        </div>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>
              أحدث لوائح الطرود{" "}
              <span className="count-chip">{data.lists.length}</span>
            </h2>
            <p>آخر اللوائح المسجلة ومتابعة حالتها</p>
          </div>
          <Link className="text-link" href="/lists">
            عرض الكل
            <ArrowLeft size={16} />
          </Link>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>رقم اللائحة</th>
                <th>السائق</th>
                <th>تاريخ الإنشاء</th>
                <th>الطرود</th>
                <th>مبلغ الشحن</th>
                <th>الحالة</th>
                <th>
                  <span className="sr-only">عرض</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.lists.slice(0, 4).map((l) => (
                <tr key={l.id}>
                  <td data-label="رقم اللائحة">
                    <Link href={`/lists?list=${l.id}`} className="reference">
                      <span className="table-icon">
                        <ClipboardList size={16} />
                      </span>
                      <bdi>{l.id}</bdi>
                    </Link>
                  </td>
                  <td data-label="السائق">
                    <span className="driver-cell">
                      <span className="driver-avatar">{l.driver[0]}</span>
                      {l.driver}
                    </span>
                  </td>
                  <td className="muted" data-label="تاريخ الإنشاء">
                    {dateLabel(l.createdAt)}
                  </td>
                  <td data-label="الطرود">
                    {l.parcels.length}
                    <span className="muted"> طرود</span>
                  </td>
                  <td data-label="مبلغ الشحن">
                    <strong>{currency(l.total)}</strong>{" "}
                    <small className="muted">د.م</small>
                  </td>
                  <td data-label="الحالة">
                    <Status done={complete(l)} />
                  </td>
                  <td>
                    <Link
                      href={`/lists?list=${l.id}`}
                      className="icon-button"
                      aria-label={`عرض ${l.id}`}
                    >
                      <ArrowUpLeft size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.lists.length === 0 && (
          <p className="table-empty">
            لا توجد لوائح بعد. ابدأ بإنشاء لائحتك الأولى.
          </p>
        )}
        <div className="table-footer">
          <span>
            <span className="live-dot" />
            البيانات محفوظة على هذا الجهاز
          </span>
          <span>
            {stats.collected} طرداً تم استلامه <CheckCheck size={15} />
          </span>
        </div>
      </section>
    </>
  );
}
