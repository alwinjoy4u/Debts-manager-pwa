import { formatDate, formatMoney } from "../utils";

const STATUS_LABEL = {
  overdue: "Overdue",
  soon: "Due soon",
};

// One row per person on the main screen; tapping it opens their debts.
export default function PersonCard({ person, onOpen }) {
  const { name, net, debts, openCount, status, nextDue } = person;
  const dir = net > 0 ? "owes_me" : net < 0 ? "i_owe" : "even";
  const amountLabel = {
    owes_me: "owes you",
    i_owe: "you owe",
    even: openCount ? "all square" : "settled",
  }[dir];

  return (
    <li className={`card ${dir} status-${status}`}>
      <button className="person-card" onClick={() => onOpen(name)}>
        <div className="card-head">
          <div>
            <h3>{name}</h3>
            <p className="muted">
              {debts.length} {debts.length === 1 ? "entry" : "entries"}
              {nextDue && <> · next due {formatDate(nextDue)}</>}
            </p>
          </div>
          <div className="card-amount">
            <strong>{dir === "even" ? "—" : formatMoney(Math.abs(net))}</strong>
            <span className="muted">{amountLabel}</span>
          </div>
        </div>
        {STATUS_LABEL[status] && (
          <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
        )}
      </button>
    </li>
  );
}
