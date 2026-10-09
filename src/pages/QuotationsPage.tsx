import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, Eye, FilePlus2, Minus, Plus, Save, Search, X } from "lucide-react";
import { toast } from "sonner";
import { api, jsonRequest } from "../services/api/apiClient";
import type {
  Client,
  Quotation,
  QuotationInput,
  QuotationStatus,
} from "../types/business";

const statusOptions: QuotationStatus[] = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
];
const money = (minor: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    minor / 100,
  );
const dateToday = () => new Date().toISOString().slice(0, 10);
type ItemDraft = { description: string; quantity: string; unit_price: string };
type FormDraft = {
  client_id: string;
  title: string;
  description: string;
  items: ItemDraft[];
  discount_type: QuotationInput["discount_type"];
  discount_value: string;
  issue_date: string;
  valid_until: string;
  terms: string;
  notes: string;
};
const blankForm = (): FormDraft => ({
  client_id: "",
  title: "",
  description: "",
  items: [{ description: "", quantity: "1", unit_price: "0.00" }],
  discount_type: "none",
  discount_value: "0",
  issue_date: dateToday(),
  valid_until: "",
  terms: "",
  notes: "",
});
const numeric = (value: string) => Number(value || 0);
const itemAmount = (item: ItemDraft) =>
  Math.round(
    numeric(item.quantity) * Math.round(numeric(item.unit_price) * 100),
  );

export default function QuotationsPage({
  onClients,
  onConverted,
}: {
  onClients: () => void;
  onConverted: () => void;
}) {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<Quotation | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      setQuotes(await api<Quotation[]>(`/api/quotations${params.size ? `?${params}` : ""}`));
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Unable to load quotations.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);
  useEffect(() => {
    void refresh();
    api<Client[]>("/api/clients")
      .then(setClients)
      .catch((e) => toast.error(e.message));
  }, [refresh]);

  const totals = useMemo(() => {
    const subtotal =
      form?.items.reduce((sum, item) => sum + itemAmount(item), 0) ?? 0;
    const discount =
      !form || form.discount_type === "none"
        ? 0
        : form.discount_type === "percentage"
          ? Math.round((subtotal * numeric(form.discount_value)) / 100)
          : Math.round(numeric(form.discount_value) * 100);
    return { subtotal, discount, total: Math.max(0, subtotal - discount) };
  }, [form]);

  const startCreate = () => {
    setEditingId(null);
    setForm({ ...blankForm(), client_id: clients[0]?.id ?? "" });
  };
  const startEdit = async (quote: Quotation) => {
    try {
      const full = await api<Quotation>(`/api/quotations/${quote.id}`);
      setEditingId(quote.id);
      setForm({
        client_id: full.client_id,
        title: full.title,
        description: full.description || "",
        items: (full.items || []).map((i) => ({
          description: i.description,
          quantity: String(i.quantity),
          unit_price: (i.unit_price_minor / 100).toFixed(2),
        })),
        discount_type: full.discount_type,
        discount_value: String(
          full.discount_type === "fixed"
            ? full.discount_value
            : full.discount_value,
        ),
        issue_date: full.issue_date,
        valid_until: full.valid_until || "",
        terms: full.terms || "",
        notes: full.notes || "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load quotation.");
    }
  };
  const closeForm = () => {
    setForm(null);
    setEditingId(null);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const payload: QuotationInput = {
      client_id: form.client_id,
      title: form.title.trim(),
      description: form.description.trim(),
      items: form.items.map((i) => ({
        description: i.description.trim(),
        quantity: numeric(i.quantity),
        unit_price_minor: Math.round(numeric(i.unit_price) * 100),
      })),
      discount_type: form.discount_type,
      discount_value: numeric(form.discount_value),
      issue_date: form.issue_date,
      valid_until: form.valid_until || null,
      terms: form.terms.trim(),
      notes: form.notes.trim(),
    };
    setSaving(true);
    try {
      await api(
        editingId ? `/api/quotations/${editingId}` : "/api/quotations",
        jsonRequest(editingId ? "PUT" : "POST", payload),
      );
      toast.success(editingId ? "Quotation updated." : "Quotation created.");
      closeForm();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to save quotation.");
    } finally {
      setSaving(false);
    }
  };
  const setStatus = async (quote: Quotation, status: QuotationStatus) => {
    try {
      await api(
        `/api/quotations/${quote.id}/status`,
        jsonRequest("PATCH", { status }),
      );
      toast.success(`Quotation marked ${status}.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to update status.");
    }
  };
  const showDetails = async (quote: Quotation) => {
    try {
      setDetails(await api<Quotation>(`/api/quotations/${quote.id}`));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to load quotation details.",
      );
    }
  };
  const convert = async (quote: Quotation) => {
    try {
      await api(`/api/quotations/${quote.id}/convert`, jsonRequest("POST", {}));
      toast.success("Accepted quotation converted to an order.");
      onConverted();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to convert quotation.",
      );
    }
  };
  const duplicate = async (quote: Quotation) => {
    try {
      await api(`/api/quotations/${quote.id}/duplicate`, jsonRequest("POST", {}));
      toast.success("A new draft was created.");
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to duplicate quotation."); }
  };

  return (
    <>
      <div className="page-toolbar">
        <span>
          {quotes.length} quotation{quotes.length === 1 ? "" : "s"}
        </span>
        <label className="quotation-search"><Search size={15}/><input aria-label="Search quotations" placeholder="Search reference, client, or title" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <select aria-label="Filter quotations by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All statuses</option>{statusOptions.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <button
          className="studio-button"
          onClick={startCreate}
          disabled={!clients.length}
        >
          <FilePlus2 size={15} /> New quotation
        </button>
      </div>
      <div className="quotation-metrics">
        <div><span>Total quotations</span><strong>{quotes.length}</strong></div>
        <div><span>Drafts</span><strong>{quotes.filter(q=>q.status==="draft").length}</strong></div>
        <div><span>Sent</span><strong>{quotes.filter(q=>q.status==="sent").length}</strong></div>
        <div><span>Accepted</span><strong>{quotes.filter(q=>q.status==="accepted").length}</strong></div>
        <div><span>Quotation value</span><strong>{money(quotes.reduce((sum,q)=>sum+q.total_minor,0))}</strong><small>All displayed quotations</small></div>
        <div><span>Accepted value</span><strong>{money(quotes.filter(q=>q.status==="accepted").reduce((sum,q)=>sum+q.total_minor,0))}</strong><small>Accepted quotations, not collected revenue</small></div>
      </div>
      {!clients.length && !loading && (
        <div className="workflow-note">
          Add a client before creating a quotation.{" "}
          <button className="inline-link" onClick={onClients}>
            Open Clients
          </button>
        </div>
      )}
      {error && (
        <div className="workflow-error">
          {error} <button onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      {loading ? (
        <div className="business-panel">Loading quotations…</div>
      ) : error ? null : quotes.length ? (
        <div className="business-panel table-wrap">
          <table className="records-table workflow-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Client</th>
                <th>Title</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td>{q.quotation_number}</td>
                  <td>{q.client_name}</td>
                  <td>{q.title}</td>
                  <td>{money(q.total_minor)}</td>
                  <td>
                    <select aria-label={`Status for ${q.quotation_number}`} value={q.status} disabled={Boolean(q.converted_order_id)} onChange={(e) => void setStatus(q, e.target.value as QuotationStatus)}>
                      {statusOptions.filter(s=>s===q.status || (q.status==="draft" ? ["sent","cancelled"] : q.status==="sent" ? ["accepted","rejected","expired","cancelled"] : []).includes(s)).map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-action"
                        title="View details"
                        onClick={() => void showDetails(q)}
                      >
                        <Eye size={15} />
                      </button>
                      <button className="icon-action" title="Duplicate as draft" aria-label={`Duplicate ${q.quotation_number}`} onClick={()=>void duplicate(q)}><Copy size={15}/></button>
                      <button
                        className="icon-action"
                        title="Edit quotation"
                        disabled={Boolean(q.converted_order_id)}
                        onClick={() => void startEdit(q)}
                      >
                        <FilePlus2 size={15} />
                      </button>
                      {q.status === "accepted" && !q.converted_order_id && (
                        <button
                          className="icon-action convert-action"
                          title="Convert to order"
                          onClick={() => void convert(q)}
                        >
                          <ArrowRight size={15} />
                        </button>
                      )}
                      {q.converted_order_id && (
                        <span className="record-status">
                          {q.converted_order_number || "Converted"}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="empty-state">
          <div className="empty-icon">
            <FilePlus2 size={21} />
          </div>
          <h2>No quotations yet</h2>
          <p>
            Create a client quotation with line items. Totals and discounts are
            recalculated by the local API.
          </p>
          <button
            className="studio-button"
            onClick={startCreate}
            disabled={!clients.length}
          >
            Create first quotation
          </button>
        </section>
      )}

      {form && (
        <div className="modal-backdrop" role="presentation">
          <form className="workflow-modal quotation-modal" onSubmit={save}>
            <header>
              <div>
                <span className="business-eyebrow">
                  QUOTATION / {editingId ? "EDIT" : "NEW"}
                </span>
                <h2>{editingId ? "Edit quotation" : "New quotation"}</h2>
              </div>
              <button
                type="button"
                className="icon-action"
                onClick={closeForm}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>
            <div className="workflow-form-grid">
              <label>
                Client
                <select
                  required
                  value={form.client_id}
                  onChange={(e) =>
                    setForm({ ...form, client_id: e.target.value })
                  }
                >
                  <option value="">Choose a client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company_name ? ` · ${c.company_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="wide">
                Description
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="line-items-editor">
              <div className="workflow-section-title">
                <h3>Line items</h3>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() =>
                    setForm({
                      ...form,
                      items: [
                        ...form.items,
                        { description: "", quantity: "1", unit_price: "0.00" },
                      ],
                    })
                  }
                >
                  <Plus size={14} /> Add item
                </button>
              </div>
              <div className="line-item-head">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit price (₹)</span>
                <span>Line total</span>
                <span></span>
              </div>
              {form.items.map((item, index) => (
                <div className="line-item-row" key={index}>
                  <input
                    aria-label={`Item ${index + 1} description`}
                    required
                    value={item.description}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((v, i) =>
                          i === index
                            ? { ...v, description: e.target.value }
                            : v,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label="Quantity"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((v, i) =>
                          i === index ? { ...v, quantity: e.target.value } : v,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label="Unit price in rupees"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        items: form.items.map((v, i) =>
                          i === index
                            ? { ...v, unit_price: e.target.value }
                            : v,
                        ),
                      })
                    }
                  />
                  <span className="line-total">{money(itemAmount(item))}</span>
                  <button
                    type="button"
                    className="icon-action danger-action"
                    aria-label="Remove line item"
                    disabled={form.items.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        items: form.items.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Minus size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="workflow-form-grid">
              <label>
                Discount
                <select
                  value={form.discount_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      discount_type: e.target
                        .value as FormDraft["discount_type"],
                    })
                  }
                >
                  <option value="none">No discount</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount (₹)</option>
                </select>
              </label>
              {form.discount_type !== "none" && (
                <label>
                  {form.discount_type === "percentage"
                    ? "Discount (%)"
                    : "Discount (₹)"}
                  <input
                    type="number"
                    min="0"
                    max={form.discount_type === "percentage" ? 100 : undefined}
                    step="0.01"
                    value={form.discount_value}
                    onChange={(e) =>
                      setForm({ ...form, discount_value: e.target.value })
                    }
                  />
                </label>
              )}
              <label>
                Issue date
                <input
                  required
                  type="date"
                  value={form.issue_date}
                  onChange={(e) =>
                    setForm({ ...form, issue_date: e.target.value })
                  }
                />
              </label>
              <label>
                Valid until
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) =>
                    setForm({ ...form, valid_until: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Terms
                <textarea
                  rows={2}
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                />
              </label>
              <label className="wide">
                Internal notes
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="quotation-totals">
              <div>
                <span>Subtotal</span>
                <strong>{money(totals.subtotal)}</strong>
              </div>
              <div>
                <span>Discount</span>
                <strong>− {money(totals.discount)}</strong>
              </div>
              <div className="grand-total">
                <span>Total (INR)</span>
                <strong>{money(totals.total)}</strong>
              </div>
              <small>
                Final values are calculated and rounded by the local API.
              </small>
            </div>
            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={closeForm}
              >
                Cancel
              </button>
              <button type="submit" className="studio-button" disabled={saving}>
                <Save size={14} />
                {saving ? "Saving…" : "Save quotation"}
              </button>
            </footer>
          </form>
        </div>
      )}
      {details && (
        <div className="modal-backdrop" role="presentation">
          <section className="workflow-modal detail-modal">
            <header>
              <div>
                <span className="business-eyebrow">
                  {details.quotation_number}
                </span>
                <h2>{details.title}</h2>
                <p>
                  {details.client_name} · {details.status}
                </p>
              </div>
              <button
                type="button"
                className="icon-action"
                onClick={() => setDetails(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>
            <p>{details.description}</p>
            <div className="table-wrap">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {details.items?.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unit_price_minor)}</td>
                      <td>{money(item.line_total_minor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="quotation-totals">
              <div>
                <span>Subtotal</span>
                <strong>{money(details.subtotal_minor)}</strong>
              </div>
              <div>
                <span>Discount</span>
                <strong>− {money(details.discount_minor)}</strong>
              </div>
              <div className="grand-total">
                <span>Total</span>
                <strong>{money(details.total_minor)}</strong>
              </div>
            </div>
            {details.terms && (
              <p>
                <b>Terms:</b> {details.terms}
              </p>
            )}
            {details.notes && (
              <p>
                <b>Notes:</b> {details.notes}
              </p>
            )}
            <footer>
              <button
                className="secondary-button"
                onClick={() => setDetails(null)}
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
