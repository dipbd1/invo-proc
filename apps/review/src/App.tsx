import { useEffect, useState } from "react";
import type { Extraction, ExtractedLine, QueueItem } from "@invo/shared";
import { fileUrl, getItem, listItems, postItem, saveItem } from "./api.ts";

function emptyLine(): ExtractedLine {
  return {
    description: "",
    quantity: null,
    unit: "式",
    unit_price: null,
    amount: 0,
    tax_rate_percent: 10,
  };
}

export function App() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [item, setItem] = useState<QueueItem | null>(null);
  const [draft, setDraft] = useState<Extraction | null>(null);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function refreshList(preferId?: string) {
    const { items: next } = await listItems();
    setItems(next);
    const id = preferId ?? selectedId ?? next[0]?.id ?? null;
    if (id) {
      setSelectedId(id);
      const loaded = await getItem(id);
      setItem(loaded.item);
      setDraft(loaded.item.extraction);
    }
  }

  useEffect(() => {
    refreshList().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Failed to load queue");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSelect(id: string) {
    setSelectedId(id);
    setMessage("");
    const loaded = await getItem(id);
    setItem(loaded.item);
    setDraft(loaded.item.extraction);
  }

  async function onSave() {
    if (!item || !draft) return;
    setBusy(true);
    try {
      const { item: next } = await saveItem(item.id, draft);
      setItem(next);
      setDraft(next.extraction);
      await refreshList(next.id);
      setMessage("Saved and rechecked against partner master and tax rules.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPost() {
    if (!item) return;
    setBusy(true);
    try {
      const { item: next } = await postItem(item.id);
      setItem(next);
      setDraft(next.extraction);
      await refreshList(next.id);
      setMessage(`Posted as ${next.accountingId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Post failed");
      await refreshList(item.id);
    } finally {
      setBusy(false);
    }
  }

  function patch(partial: Partial<Extraction>) {
    if (!draft) return;
    setDraft({ ...draft, ...partial });
  }

  function patchLine(index: number, partial: Partial<ExtractedLine>) {
    if (!draft) return;
    const lines = draft.lines.map((line, i) => (i === index ? { ...line, ...partial } : line));
    setDraft({ ...draft, lines });
  }

  return (
    <div className="layout">
      <aside>
        <h1>Invoice review</h1>
        <p className="muted">Approve is the only path into the accounting API.</p>
        <ul className="queue">
          {items.map((row) => (
            <li key={row.id}>
              <button
                className={row.id === selectedId ? "active" : ""}
                type="button"
                onClick={() => void onSelect(row.id)}
              >
                <strong>{row.sourceName}</strong>
                <span className={`status ${row.status}`}>{row.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {item && draft ? (
        <main>
          <section className="preview">
            {item.sourceName.toLowerCase().endsWith(".pdf") ? (
              <iframe title="invoice" src={fileUrl(item.id)} />
            ) : (
              <img alt={item.sourceName} src={fileUrl(item.id)} />
            )}
          </section>
          <section className="form">
            <header>
              <h2>{item.sourceName}</h2>
              {item.accountingId ? <p>Accounting id {item.accountingId}</p> : null}
              {message ? <p className="banner">{message}</p> : null}
            </header>
            <label>
              Supplier
              <input
                value={draft.supplier_name_raw}
                onChange={(e) => patch({ supplier_name_raw: e.target.value })}
              />
            </label>
            <label>
              Registration no
              <input
                value={draft.registration_no_raw ?? ""}
                onChange={(e) => patch({ registration_no_raw: e.target.value || null })}
              />
            </label>
            <label>
              Invoice number
              <input
                value={draft.invoice_number}
                onChange={(e) => patch({ invoice_number: e.target.value })}
              />
            </label>
            <div className="row">
              <label>
                Issue date
                <input
                  value={draft.issue_date}
                  onChange={(e) => patch({ issue_date: e.target.value })}
                />
              </label>
              <label>
                Due date
                <input
                  value={draft.due_date ?? ""}
                  onChange={(e) => patch({ due_date: e.target.value || null })}
                />
              </label>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Price</th>
                  <th>Amount</th>
                  <th>Tax %</th>
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((line, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        value={line.description}
                        onChange={(e) => patchLine(index, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={line.quantity ?? ""}
                        onChange={(e) =>
                          patchLine(index, {
                            quantity: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={line.unit}
                        onChange={(e) => patchLine(index, { unit: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={line.unit_price ?? ""}
                        onChange={(e) =>
                          patchLine(index, {
                            unit_price: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={line.amount}
                        onChange={(e) => patchLine(index, { amount: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        value={line.tax_rate_percent}
                        onChange={(e) =>
                          patchLine(index, { tax_rate_percent: Number(e.target.value) })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyLine()] })}>
              Add line
            </button>
            <div className="row">
              <label>
                Printed subtotal
                <input
                  value={draft.printed_subtotal ?? ""}
                  onChange={(e) =>
                    patch({
                      printed_subtotal: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Printed tax
                <input
                  value={draft.printed_tax_amount ?? ""}
                  onChange={(e) =>
                    patch({
                      printed_tax_amount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Printed total
                <input
                  value={draft.printed_total ?? ""}
                  onChange={(e) =>
                    patch({ printed_total: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </label>
            </div>
            {item.payload ? (
              <p className="muted">
                Payload to API: {item.payload.partner_code} / subtotal {item.payload.subtotal} /
                tax {item.payload.tax_amount} / total {item.payload.total_amount}
              </p>
            ) : (
              <p className="muted">No payload yet — partner or dates still fail.</p>
            )}
            <ul className="checks">
              {(item.checks ?? []).map((check) => (
                <li key={check.id} className={check.ok ? "ok" : "bad"}>
                  {check.ok ? "ok" : "hold"} — {check.message}
                </li>
              ))}
            </ul>
            {item.checks.some((c) => !c.ok && c.id.startsWith("printed_")) ? (
              <p className="muted">Printed mismatches stay held. Approve still posts the recomputed payload if partner, dates, and tax codes are valid.</p>
            ) : null}
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => void onSave()}>
                Save &amp; recheck
              </button>
              <button type="button" disabled={busy || item.status === "posted"} onClick={() => void onPost()}>
                Approve &amp; post
              </button>
            </div>
          </section>
        </main>
      ) : (
        <main>
          <p>No queue items. Run ingest after setting GEMINI_API_KEY, or keep the seeded fixture.</p>
        </main>
      )}
    </div>
  );
}
