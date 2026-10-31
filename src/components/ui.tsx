"use client";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { currency } from "./workspace";
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "green",
  footnote,
}: {
  label: string;
  value: number;
  unit?: string;
  icon: LucideIcon;
  tone?: string;
  footnote: string;
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={20} strokeWidth={1.7} />
        </span>
      </div>
      <div className="stat-value">
        {currency(value)}
        {unit && <small>{unit}</small>}
      </div>
      <div className="stat-footnote">
        {footnote}
      </div>
    </div>
  );
}
export function Status({ done }: { done: boolean }) {
  return (
    <span className={`status-badge ${done ? "done" : "pending"}`}>
      <i />
      {done ? "مدفوعة ومستلمة" : "غير مكتملة"}
    </span>
  );
}
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={(node) => node?.focus()}
      >
        <button
          className="modal-close icon-button"
          aria-label="إغلاق"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
