import { useState } from "react";

const EMPTY = { name: "", amount: "", type: "owes_me", dueDate: "", note: "" };

// Used both for adding a new debt and editing an existing one.
export default function DebtForm({ initial, names = [], onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial }));
  const [errors, setErrors] = useState({});
  const isEdit = initial?.id != null;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    // Reuse the existing spelling so "rahul " and "Rahul" count as one person.
    const typed = form.name.trim();
    const name =
      names.find((n) => n.toLowerCase() === typed.toLowerCase()) ?? typed;
    const amount = parseFloat(form.amount);
    const nextErrors = {};
    if (!name) nextErrors.name = "Who is this with?";
    if (!(amount > 0)) nextErrors.amount = "Enter an amount above 0";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    onSubmit({ ...form, name, amount, note: form.note.trim() });
    if (!isEdit) setForm({ ...EMPTY, ...initial });
  };

  return (
    <form className="debt-form" onSubmit={submit} noValidate>
      <div className="segmented" role="radiogroup" aria-label="Direction">
        {[
          ["owes_me", "They owe me"],
          ["i_owe", "I owe them"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={form.type === value}
            className={form.type === value ? `active ${value}` : ""}
            onClick={() => setForm({ ...form, type: value })}
          >
            {label}
          </button>
        ))}
      </div>

      <label>
        Name
        <input
          value={form.name}
          onChange={set("name")}
          placeholder="e.g. Rahul"
          list="people"
          autoComplete="off"
          aria-invalid={!!errors.name}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </label>
      <datalist id="people">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {!isEdit && names.length > 0 && !form.name && (
        <div className="people-chips">
          {names.slice(0, 8).map((n) => (
            <button
              key={n}
              type="button"
              className="chip"
              onClick={() => setForm({ ...form, name: n })}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <div className="row">
        <label>
          Amount
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.amount}
            onChange={set("amount")}
            placeholder="0"
            aria-invalid={!!errors.amount}
          />
          {errors.amount && <span className="error">{errors.amount}</span>}
        </label>
        <label>
          Due date <span className="optional">(optional)</span>
          <input type="date" value={form.dueDate} onChange={set("dueDate")} />
        </label>
      </div>

      <label>
        Note <span className="optional">(optional)</span>
        <input
          value={form.note}
          onChange={set("note")}
          placeholder="What was it for?"
        />
      </label>

      <div className="actions">
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
