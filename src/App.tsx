import { useEffect, useState } from "react";
import {
  Archive,
  BriefcaseBusiness,
  CheckSquare,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Mail,
  Menu,
  Plus,
  Settings,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import EmailStudio from "./EmailStudio";
import QuotationsPage from "./pages/QuotationsPage";
import ProjectsPage from "./pages/ProjectsPage";
import BusinessProfileForm from "./components/BusinessProfileForm";
import logoUrl from "./assets/JSN DESIGN.png";

type Page =
  | "dashboard"
  | "email"
  | "quotations"
  | "orders"
  | "clients"
  | "settings";
type Client = {
  id: string;
  client_code: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};
type Stats = {
  clients: number;
  open_quotations: number;
  active_orders: number;
  open_tasks: number;
  outstanding_minor: number;
  upcoming_tasks: {
    id: string;
    title: string;
    due_date: string | null;
    status: string;
  }[];
};
const nav: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "email", label: "Email Studio", icon: Mail },
  { id: "quotations", label: "Quotations", icon: FileText },
  { id: "orders", label: "Orders & Projects", icon: BriefcaseBusiness },
  { id: "clients", label: "Clients", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];
const pageCopy: Record<Page, { title: string; description: string }> = {
  dashboard: {
    title: "Dashboard",
    description: "A current view of your business records.",
  },
  email: {
    title: "Email Studio",
    description: "Compose and send a polished email.",
  },
  quotations: {
    title: "Quotations",
    description: "Create and track client quotations.",
  },
  orders: {
    title: "Orders & Projects",
    description: "Track agreed work, delivery, tasks, and payments.",
  },
  clients: {
    title: "Clients",
    description: "Keep your client details in one place.",
  },
  settings: {
    title: "Settings",
    description: "Manage local data and email connection.",
  },
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}
const money = (minor: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(minor / 100);

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const p = window.location.pathname.slice(1) as Page;
    return nav.some((n) => n.id === p) ? p : "dashboard";
  });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [gmail, setGmail] = useState<string | null>(null);
  const [gmailError, setGmailError] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const navigate = (next: Page) => {
    setPage(next);
    setMobileOpen(false);
    window.history.pushState({}, "", next === "dashboard" ? "/" : `/${next}`);
  };
  useEffect(() => {
    const pop = () => {
      const p = window.location.pathname.slice(1) as Page;
      setPage(nav.some((n) => n.id === p) ? p : "dashboard");
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    setLoadError(null);
    if (page === "dashboard") {
      setLoading(true);
      api<Stats>("/api/dashboard")
        .then(setStats)
        .catch((e) => {
          setLoadError(e.message);
          toast.error(e.message);
        })
        .finally(() => setLoading(false));
    }
    if (page === "clients") {
      setLoading(true);
      api<Client[]>("/api/clients")
        .then(setClients)
        .catch((e) => {
          setLoadError(e.message);
          toast.error(e.message);
        })
        .finally(() => setLoading(false));
    }
    if (page === "settings") {
      setGmailError(false);
      api<{ gmailUser: string | null }>("/api/email/config")
        .then((d) => setGmail(d.gmailUser))
        .catch(() => {
          setGmail(null);
          setGmailError(true);
        });
    }
  }, [page]);
  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({
        name: "",
        company_name: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      });
      setShowForm(false);
      setClients(await api<Client[]>("/api/clients"));
      toast.success("Client saved to this device.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save client.",
      );
    }
  };
  const restore = async () => {
    if (!restoreFile) return;
    const data = new FormData();
    data.append("backup", restoreFile);
    try {
      await api("/api/restore", { method: "POST", body: data });
      setRestoreFile(null);
      toast.success("Database restored. Refreshing records.");
      if (page === "dashboard") setStats(await api<Stats>("/api/dashboard"));
      if (page === "clients") setClients(await api<Client[]>("/api/clients"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed.");
    }
  };
  const content = () => {
    if (page === "email") return <EmailStudio />;
    if (page === "dashboard")
      return (
        <>
          {loadError && <LoadFailure message={loadError} />}
          {!loadError && loading && !stats ? (
            <div className="business-panel">Loading business records…</div>
          ) : !loadError ? (
            stats && (
              <>
                <div className="metric-grid">
                  {[
                    ["Clients", stats.clients],
                    ["Open quotations", stats.open_quotations],
                    ["Active orders", stats.active_orders],
                    ["Open tasks", stats.open_tasks],
                  ].map(([label, value]) => (
                    <div className="metric-card" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                  <div className="metric-card">
                    <span>Outstanding balance</span>
                    <strong>{money(stats.outstanding_minor)}</strong>
                  </div>
                </div>
                <section className="business-panel">
                  <h2>Upcoming tasks</h2>
                  {stats.upcoming_tasks.length ? (
                    <ul className="record-list">
                      {stats.upcoming_tasks.map((t) => (
                        <li key={t.id}>
                          <CheckSquare size={16} />
                          <span>{t.title}</span>
                          <small>{t.due_date || "No due date"}</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-copy">
                      No open tasks yet. Tasks added to projects will appear
                      here.
                    </p>
                  )}
                </section>
              </>
            )
          ) : null}
        </>
      );
    if (page === "clients")
      return (
        <>
          <div className="page-toolbar">
            <span>
              {clients.length} client{clients.length === 1 ? "" : "s"}
            </span>
            <button
              className="studio-button"
              onClick={() => setShowForm((v) => !v)}
            >
              <Plus size={15} /> Add client
            </button>
          </div>
          {showForm && (
            <form
              className="business-panel client-form"
              onSubmit={createClient}
            >
              <h2>New client</h2>
              <label>
                Name
                <input
                  required
                  maxLength={160}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Company
                <input
                  value={form.company_name}
                  onChange={(e) =>
                    setForm({ ...form, company_name: e.target.value })
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="wide">
                Address
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Notes
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="studio-button" type="submit">
                  Save client
                </button>
              </div>
            </form>
          )}
          {loadError ? (
            <LoadFailure message={loadError} />
          ) : loading ? (
            <div className="business-panel">Loading clients…</div>
          ) : clients.length ? (
            <div className="business-panel table-wrap">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Company</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.company_name || "—"}</td>
                      <td>{c.email || "—"}</td>
                      <td>{c.phone || "—"}</td>
                      <td>{c.client_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No clients yet"
              text="Add your first client to begin keeping business records on this device."
            />
          )}
        </>
      );
    if (page === "quotations")
      return (
        <QuotationsPage
          onClients={() => navigate("clients")}
          onConverted={() => navigate("orders")}
          onEmailStudio={() => {
            toast("Attach the downloaded quotation PDF and review your email before sending.");
            navigate("email");
          }}
        />
      );
    if (page === "orders")
      return <ProjectsPage onClients={() => navigate("clients")} />;
    return (
      <>
        <BusinessProfileForm />
        <section className="business-panel">
          <h2>Local database</h2>
          <p>
            Business records are stored in a SQLite database on this computer.
            No records are stored in the public frontend folder.
          </p>
          <p className="muted">
            Database path:{" "}
            <code>
              {"LOCALAPPDATA or APPDATA"}\JSN Designs Business
              Studio\business.sqlite
            </code>
          </p>
          <a className="studio-button link-button" href="/api/backup" download>
            <Archive size={15} /> Download database backup
          </a>
        </section>
        <section className="business-panel">
          <h2>Restore a backup</h2>
          <p>
            Upload a SQLite backup created by this application. The file is
            checked before replacement, and a recovery copy of the current
            database is kept locally.
          </p>
          <div className="restore-row">
            <input
              type="file"
              accept=".sqlite,.db,application/vnd.sqlite3"
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
            />
            <button
              className="secondary-button"
              disabled={!restoreFile}
              onClick={restore}
            >
              Restore backup
            </button>
          </div>
        </section>
        <section className="business-panel">
          <h2>Email connection</h2>
          <p>
            {gmailError
              ? "Unable to check the Gmail connection. The local API may be unavailable."
              : gmail
                ? `Gmail is configured for ${gmail}.`
                : "Gmail is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to the local .env file."}
          </p>
        </section>
      </>
    );
  };
  const active = nav.find((n) => n.id === page)!;
  return (
    <div
      className={`business-shell ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
    >
      <aside className="business-sidebar">
        <div className="sidebar-brand">
          <img src={logoUrl} alt="JSN Designs" />
          <span>
            JSN DESIGNS
            <br />
            <b>BUSINESS STUDIO</b>
          </span>
          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-link ${page === n.id ? "selected" : ""}`}
              onClick={() => navigate(n.id)}
              title={n.label}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-indicator" /> Local workspace
        </div>
      </aside>
      <div className="business-main">
        <header className="business-topbar">
          <button
            className="collapse-control"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Collapse sidebar"
          >
            <Menu size={18} />
          </button>
          <button
            className="mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <div className="topbar-context">
            JSN DESIGNS <ChevronRight size={13} />
            <span>{active.label}</span>
          </div>
          <span className="secure-local">LOCAL DATA</span>
        </header>
        <main
          className={`business-content ${page === "email" ? "email-content" : ""}`}
        >
          <div className="business-page-heading">
            <div>
              <span className="business-eyebrow">
                BUSINESS STUDIO /{" "}
                {String(nav.findIndex((n) => n.id === page) + 1).padStart(
                  2,
                  "0",
                )}
              </span>
              <h1>{pageCopy[page].title}</h1>
              <p>{pageCopy[page].description}</p>
            </div>
          </div>
          {content()}
        </main>
      </div>
    </div>
  );
}

function Empty({
  title,
  text,
  action,
  actionLabel,
}: {
  title: string;
  text: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <section className="empty-state">
      <div className="empty-icon">
        <FileText size={21} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="secondary-button" onClick={action}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

function LoadFailure({ message }: { message: string }) {
  return (
    <section className="empty-state">
      <h2>Business records unavailable</h2>
      <p>
        {message}. Check that the local API is running, then refresh this page.
      </p>
    </section>
  );
}
