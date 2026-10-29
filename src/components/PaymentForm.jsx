import { useState } from "react";
import { newId, todayISO } from "../utils";

export default function PaymentForm({ maxAmount, onSubmit, onCancel }) {
  const [amount, setAmount] = useState(String(maxAmount));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!(value > 0)) return setError("Enter an amount above 0");
    onSubmit({ id: newId(), amount: value, date, note: note.trim() });
  };

  return (
    <form className="payment-form" onSubmit={submit} noValidate>
      <div className="row">
        <label>
          Amount paid
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!error}
            autoFocus
          />
          {error && <span className="error">{error}</span>}
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label>
        Note <span className="optional">(optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. GPay"
        />
      </label>
      <div className="actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary">
          Record payment
        </button>
      </div>
    </form>
  );
}
