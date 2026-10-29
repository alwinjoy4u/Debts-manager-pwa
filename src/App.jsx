import { useEffect, useMemo, useRef, useState } from "react";
import DebtCard from "./components/DebtCard";
import DebtForm from "./components/DebtForm";
import {
  addDebtToDB,
  deleteDebtFromDB,
  getAllDebtsFromDB,
  normalizeDebt,
  replaceAllDebtsInDB,
  updateDebtInDB,
} from "./db";
import { formatMoney, isSettled, remaining, round2, todayISO } from "./utils";

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
    await refresh();
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

  const totals = useMemo(() => {
    const t = { owes_me: 0, i_owe: 0 };
    for (const d of scoped) t[d.type] += Math.max(remaining(d), 0);
    return {
      owesMe: round2(t.owes_me),
      iOwe: round2(t.i_owe),
      net: round2(t.owes_me - t.i_owe),
    };
  }, [scoped]);

  const visible = useMemo(() => {
    const list = scoped.filter((d) => filter === "all" || d.type === filter);
    return {
      open: list.filter((d) => !isSettled(d)).sort(compareDebts),
      settled: list.filter(isSettled).sort(compareDebts),
    };
  }, [scoped, filter]);

  const selectPerson = (name) => {
    setPerson(name);
    setFilter("all");
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
        {visible.open.map((d) => (
          <DebtCard
            key={d.id}
            debt={d}
            names={names}
            onUpdate={updateDebt}
            onDelete={deleteDebt}
            onSelectPerson={person ? null : selectPerson}
          />
        ))}
      </ul>

      {loaded && debts.length > 0 && visible.open.length === 0 && (
        <p className="empty muted">Nothing outstanding here 🎉</p>
      )}

      {visible.settled.length > 0 && (
        <>
          <button className="link" onClick={() => setShowSettled(!showSettled)}>
            {showSettled ? "Hide" : "Show"} settled ({visible.settled.length})
          </button>
          {showSettled && (
            <ul className="list settled">
              {visible.settled.map((d) => (
                <DebtCard
                  key={d.id}
                  debt={d}
                  names={names}
                  onUpdate={updateDebt}
                  onDelete={deleteDebt}
                  onSelectPerson={person ? null : selectPerson}
                />
              ))}
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
