import { useState } from "react";
import DebtForm from "./DebtForm";
import PaymentForm from "./PaymentForm";
import {
  dueStatus,
  formatDate,
  formatMoney,
  remaining,
  toLocalISO,
  totalPaid,
} from "../utils";

const STATUS_LABEL = {
  settled: "Settled",
  overdue: "Overdue",
  soon: "Due soon",
};

export default function DebtCard({ debt, names, onUpdate, onDelete }) {
  // null | "edit" | "pay" | "confirm-delete"
  const [mode, setMode] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const paid = totalPaid(debt);
  const left = remaining(debt);
  const status = dueStatus(debt);
  const added = debt.createdAt ? toLocalISO(debt.createdAt) : "";
  const progress = Math.min(100, (paid / debt.amount) * 100) || 0;

  if (mode === "edit") {
    return (
      <li className="card editing">
        <DebtForm
          initial={{ ...debt, amount: String(debt.amount) }}
          names={names}
          submitLabel="Save changes"
          onCancel={() => setMode(null)}
          onSubmit={(changes) => {
            onUpdate({ ...debt, ...changes });
            setMode(null);
          }}
        />
      </li>
    );
  }

  const addPayment = (payment) => {
    onUpdate({ ...debt, payments: [...debt.payments, payment] });
    setMode(null);
    setShowHistory(true);
  };

  const removePayment = (id) =>
    onUpdate({ ...debt, payments: debt.payments.filter((p) => p.id !== id) });

  return (
    <li className={`card ${debt.type} status-${status}`}>
      <div className="card-head">
        <div>
          {/* The person's name is already in the page header. */}
          <h3>{debt.note || `Added ${formatDate(added)}`}</h3>
          <p className="muted">
            {debt.type === "owes_me" ? "Owes you" : "You owe"}
            {debt.note && added && <> · added {formatDate(added)}</>}
            {debt.dueDate && <> · due {formatDate(debt.dueDate)}</>}
          </p>
        </div>
        <div className="card-amount">
          <strong>{formatMoney(Math.max(left, 0))}</strong>
          <span className="muted">of {formatMoney(debt.amount)}</span>
        </div>
      </div>

      {STATUS_LABEL[status] && (
        <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
      )}

      <div className="progress" aria-label={`${Math.round(progress)}% paid`}>
        <div style={{ width: `${progress}%` }} />
      </div>

      {debt.payments.length > 0 && (
        <div className="paid-row muted">
          <span>Paid {formatMoney(paid)}</span>
          <button className="link" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "Hide history" : `History (${debt.payments.length})`}
          </button>
        </div>
      )}

      {mode === "pay" ? (
        <PaymentForm
          maxAmount={Math.max(left, 0)}
          onSubmit={addPayment}
          onCancel={() => setMode(null)}
        />
      ) : mode === "confirm-delete" ? (
        <div className="confirm">
          <span>Delete this debt and its payments?</span>
          <div className="actions">
            <button className="ghost" onClick={() => setMode(null)}>
              Keep
            </button>
            <button className="danger" onClick={() => onDelete(debt.id)}>
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button className="ghost" onClick={() => setMode("edit")}>
            Edit
          </button>
          <button className="ghost" onClick={() => setMode("confirm-delete")}>
            Delete
          </button>
          {status !== "settled" && (
            <button className="primary" onClick={() => setMode("pay")}>
              Add payment
            </button>
          )}
        </div>
      )}

      {showHistory && debt.payments.length > 0 && (
        <ul className="history">
          {debt.payments.map((p) => (
            <li key={p.id}>
              <span>
                {formatMoney(p.amount)}
                <span className="muted">
                  {p.date && ` · ${formatDate(p.date)}`}
                  {p.note && ` · ${p.note}`}
                </span>
              </span>
              <button
                className="icon"
                aria-label="Remove payment"
                title="Remove payment"
                onClick={() => removePayment(p.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
