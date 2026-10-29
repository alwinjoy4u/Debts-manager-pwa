// Round to cents so float sums like 0.1 + 0.2 don't leak into the UI.
export const round2 = (n) => Math.round(n * 100) / 100;

const moneyFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatMoney = (n) => moneyFormat.format(n);

// YYYY-MM-DD in local time (toISOString alone would give the UTC date).
export const toLocalISO = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const todayISO = () => toLocalISO(new Date());

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const totalPaid = (debt) =>
  round2(debt.payments.reduce((sum, p) => sum + p.amount, 0));

export const remaining = (debt) => round2(debt.amount - totalPaid(debt));

export const isSettled = (debt) => remaining(debt) <= 0;

export function dueStatus(debt) {
  if (isSettled(debt)) return "settled";
  if (!debt.dueDate) return "none";
  const today = todayISO();
  if (debt.dueDate < today) return "overdue";
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  soon.setMinutes(soon.getMinutes() - soon.getTimezoneOffset());
  if (debt.dueDate <= soon.toISOString().slice(0, 10)) return "soon";
  return "upcoming";
}

// crypto.randomUUID only exists on https/localhost, so fall back for LAN testing.
export const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// Combine all of one person's debts into a single balance for the main list.
export function summarizePerson(name, debts) {
  const open = debts.filter((d) => !isSettled(d));
  let net = 0;
  for (const d of open) net += d.type === "owes_me" ? remaining(d) : -remaining(d);
  const statuses = open.map(dueStatus);
  return {
    name,
    debts,
    openCount: open.length,
    net: round2(net),
    status: statuses.includes("overdue")
      ? "overdue"
      : statuses.includes("soon")
        ? "soon"
        : open.length
          ? "open"
          : "settled",
    nextDue: open.map((d) => d.dueDate).filter(Boolean).sort()[0] || "",
    lastAdded: debts.map((d) => d.createdAt || "").sort().at(-1),
  };
}
