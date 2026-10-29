import { openDB } from "idb";
import { newId } from "./utils";

const STORE = "debts";

const dbPromise = openDB("debts-db", 2, {
  async upgrade(db, oldVersion, _newVersion, tx) {
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    }

    // v1 stored a single running `paid` total; v2 keeps a list of payments.
    if (oldVersion === 1) {
      let cursor = await tx.objectStore(STORE).openCursor();
      while (cursor) {
        await cursor.update(normalizeDebt(cursor.value));
        cursor = await cursor.continue();
      }
    }
  },
});

// Fill in fields that older records or imported files may be missing.
export function normalizeDebt(debt) {
  const { paid, ...rest } = debt;
  const payments = Array.isArray(debt.payments) ? debt.payments : [];
  if (!payments.length && paid > 0) {
    payments.push({
      id: newId(),
      amount: Number(paid),
      date: "",
      note: "Earlier payments",
    });
  }
  return {
    name: "",
    type: "owes_me",
    dueDate: "",
    note: "",
    createdAt: new Date().toISOString(),
    ...rest,
    amount: Number(debt.amount) || 0,
    payments,
  };
}

export async function addDebtToDB(debt) {
  const db = await dbPromise;
  return db.add(STORE, debt);
}

export async function getAllDebtsFromDB() {
  const db = await dbPromise;
  return db.getAll(STORE);
}

export async function deleteDebtFromDB(id) {
  const db = await dbPromise;
  return db.delete(STORE, id);
}

export async function updateDebtInDB(updatedDebt) {
  const db = await dbPromise;
  return db.put(STORE, updatedDebt);
}

// Replace everything in the store with the given debts (used by backup import).
export async function replaceAllDebtsInDB(debts) {
  const db = await dbPromise;
  const tx = db.transaction(STORE, "readwrite");
  await tx.store.clear();
  for (const debt of debts) {
    await tx.store.put(normalizeDebt(debt));
  }
  await tx.done;
}
