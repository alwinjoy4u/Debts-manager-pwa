import { useEffect, useMemo, useRef, useState } from "react";
import DebtCard from "./components/DebtCard";
import DebtForm from "./components/DebtForm";
import PersonCard from "./components/PersonCard";
import {
  addDebtToDB,
  deleteDebtFromDB,
  getAllDebtsFromDB,
  normalizeDebt,
  replaceAllDebtsInDB,
  updateDebtInDB,
} from "./db";
import {
  formatMoney,
  isSettled,
  remaining,
  round2,
  summarizePerson,
  todayISO,
} from "./utils";

const FILTERS = [
  ["all", "All"],
  ["owes_me", "Owed to me"],
  ["i_owe", "I owe"],
];

// Open debts first, earliest due date first, undated ones after; settled last.
function compareDebts(a, b) {
  const settled = isSettled(a) - isSettled(b);
  if (settled) return settled;
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return (b.createdAt || "").localeCompare(a.createdAt || "");
}

const STATUS_ORDER = { overdue: 0, soon: 1, open: 2, settled: 3 };

// Overdue people first, then by next due date, then most recently added.
function comparePeople(a, b) {
  const status = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (status) return status;
  if (a.nextDue !== b.nextDue) {
    if (!a.nextDue) return 1;
    if (!b.nextDue) return -1;
    return a.nextDue < b.nextDue ? -1 : 1;
  }
  return b.lastAdded.localeCompare(a.lastAdded);
}

export default function App() {
  const [debts, setDebts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showSettled, setShowSettled] = useState(false);
  const [person, setPerson] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [message, setMessage] = useState("");
  const fileInput = useRef(null);

  const refresh = async () => setDebts(await getAllDebtsFromDB());

  useEffect(() => {
    refresh().then(() => setLoaded(true));
  }, []);

  const addDebt = async (debt) => {
    await addDebtToDB(
      normalizeDebt({ ...debt, payments: [], createdAt: new Date().toISOString() })
    );
    await refresh();
    setShowAdd(false);
  };

  const updateDebt = async (debt) => {
    await updateDebtInDB(debt);
    await refresh();
  };

  const deleteDebt = async (id) => {
    await deleteDebtFromDB(id);
    const all = await getAllDebtsFromDB();
    setDebts(all);
    // Leave the person's page once their last debt is gone.
    if (person && !all.some((d) => d.name === person)) setPerson(null);
  };

  // Everyone seen so far, most recently added first.
  const names = useMemo(() => {
    const sorted = [...debts].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
    return [...new Set(sorted.map((d) => d.name))];
  }, [debts]);

  const scoped = useMemo(
    () => (person ? debts.filter((d) => d.name === person) : debts),
    [debts, person]
  );

  // Each person's debts combined into one balance.
  const summaries = useMemo(() => {
    const byName = new Map();
    for (const d of debts) byName.set(d.name, [...(byName.get(d.name) || []), d]);
    return [...byName].map(([name, list]) => summarizePerson(name, list));
  }, [debts]);

  // A person's page adds up their individual debts; the main screen adds up
  // each person's net balance, so it matches the per-person cards.
  const totals = useMemo(() => {
    let owesMe = 0;
    let iOwe = 0;
    if (person) {
      for (const d of scoped) {
        if (d.type === "owes_me") owesMe += Math.max(remaining(d), 0);
        else iOwe += Math.max(remaining(d), 0);
      }
    } else {
      for (const { net } of summaries) {
        if (net > 0) owesMe += net;
        else iOwe -= net;
      }
    }
    return {
      owesMe: round2(owesMe),
      iOwe: round2(iOwe),
      net: round2(owesMe - iOwe),
    };
  }, [summaries, scoped, person]);

  // On a person's page: their individual debts.
  const visible = useMemo(() => {
    const list = scoped.filter((d) => filter === "all" || d.type === filter);
    return {
      open: list.filter((d) => !isSettled(d)).sort(compareDebts),
      settled: list.filter(isSettled).sort(compareDebts),
    };
  }, [scoped, filter]);

  // On the main screen: one combined balance per person.
  const people = useMemo(() => {
    const list = summaries
      .filter(
        (p) =>
          filter === "all" ||
          (filter === "owes_me" ? p.net > 0 : p.net < 0)
      )
      .sort(comparePeople);
    return {
      open: list.filter((p) => p.openCount > 0),
      settled: list.filter((p) => p.openCount === 0),
    };
  }, [summaries, filter]);

  const shown = person ? visible : people;

  const selectPerson = (name) => {
    setPerson(name);
    setFilter("all");
    // Someone with only settled debts would otherwise open to an empty page.
    setShowSettled(debts.every((d) => d.name !== name || isSettled(d)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exportBackup = () => {
    const data = {
      app: "debts-manager",
      version: 2,
      exportedAt: new Date().toISOString(),
      debts,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debts-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pickImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.debts;
      if (!Array.isArray(list)) throw new Error("no debts");
      setPendingImport(list);
      setMessage("");
    } catch {
      setMessage("That file doesn't look like a Debts Manager backup.");
    }
  };

  const confirmImport = async () => {
    await replaceAllDebtsInDB(pendingImport);
    await refresh();
    setMessage(`Restored ${pendingImport.length} debts from backup.`);
    setPendingImport(null);
  };

  const renderItem = (item) =>
    person ? (
      <DebtCard
        key={item.id}
        debt={item}
        names={names}
        onUpdate={updateDebt}
        onDelete={deleteDebt}
      />
    ) : (
      <PersonCard key={item.name} person={item} onOpen={selectPerson} />
    );

  return (
    <div className="app">
      <header>
        <h1>Debts</h1>
        <button
          className={showAdd ? "ghost" : "primary"}
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? "Close" : "+ New debt"}
        </button>
      </header>

      {person && (
        <div className="person-banner">
          <span>
            With <strong>{person}</strong>
          </span>
          <button className="ghost" onClick={() => setPerson(null)}>
            Show everyone
          </button>
        </div>
      )}

      <section className="summary">
        <div className="stat owes_me">
          <span>Owed to me</span>
          <strong>{formatMoney(totals.owesMe)}</strong>
        </div>
        <div className="stat i_owe">
          <span>I owe</span>
          <strong>{formatMoney(totals.iOwe)}</strong>
        </div>
        <div className={`stat net ${totals.net < 0 ? "negative" : ""}`}>
          <span>Net</span>
          <strong>
            {totals.net > 0 && "+"}
            {formatMoney(totals.net)}
          </strong>
        </div>
      </section>

      {showAdd && (
        <section className="card">
          <DebtForm
            // Remount when the person changes so the name prefill updates.
            key={person ?? ""}
            initial={person ? { name: person } : undefined}
            names={names}
            submitLabel="Add debt"
            onSubmit={addDebt}
          />
        </section>
      )}

      <nav className="filters" aria-label="Filter debts">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "chip active" : "chip"}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {loaded && debts.length === 0 && !showAdd && (
        <div className="empty">
          <p>No debts yet.</p>
          <button className="primary" onClick={() => setShowAdd(true)}>
            Add your first one
          </button>
        </div>
      )}

      <ul className="list">
        {shown.open.map((item) => renderItem(item))}
      </ul>

      {loaded && debts.length > 0 && shown.open.length === 0 && (
        <p className="empty muted">Nothing outstanding here 🎉</p>
      )}

      {shown.settled.length > 0 && (
        <>
          <button className="link" onClick={() => setShowSettled(!showSettled)}>
            {showSettled ? "Hide" : "Show"} settled ({shown.settled.length})
          </button>
          {showSettled && (
            <ul className="list settled">
              {shown.settled.map((item) => renderItem(item))}
            </ul>
          )}
        </>
      )}

      <footer>
        <p className="muted">
          Your data is stored only on this device. Back it up now and then.
        </p>
        {pendingImport ? (
          <div className="confirm">
            <span>
              Replace your {debts.length} debts with {pendingImport.length} from
              the backup?
            </span>
            <div className="actions">
              <button className="ghost" onClick={() => setPendingImport(null)}>
                Cancel
              </button>
              <button className="danger" onClick={confirmImport}>
                Replace
              </button>
            </div>
          </div>
        ) : (
          <div className="actions">
            <button className="ghost" onClick={exportBackup} disabled={!debts.length}>
              Export backup
            </button>
            <button className="ghost" onClick={() => fileInput.current.click()}>
              Restore backup
            </button>
          </div>
        )}
        {message && <p className="message">{message}</p>}
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={pickImportFile}
        />
      </footer>
    </div>
  );
}
