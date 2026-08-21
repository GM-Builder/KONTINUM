import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Activity, ChevronRight, LayoutDashboard, ListChecks, LogOut,
  Network, Search, Sparkles, Users, X,
} from "lucide-react";
import { api, SESSION_KEY } from "@/api";
import { AskPanel } from "@/components/AskPanel";

const NAV = [
  { to: "/overview", label: "Ringkasan", icon: LayoutDashboard, id: "overview" },
  { to: "/map", label: "Dependency Map", icon: Network, id: "map" },
  { to: "/people", label: "Orang", icon: Users, id: "people" },
  { to: "/simulate/sarah-mitchell", label: "Simulasi", icon: Activity, id: "simulations" },
  { to: "/actions", label: "Action Center", icon: ListChecks, id: "actions" },
];

const KIND_LABEL = {
  person: "orang",
  process: "proses",
  client: "klien",
  vendor: "vendor",
  system: "sistem",
  knowledge: "pengetahuan",
};

function SearchOverlay({ onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api
        .get("/search", { params: { q: query.trim() } })
        .then((r) => setResults(r.data.results))
        .catch(() => setResults([]));
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="search-overlay" data-testid="search-overlay" onClick={onClose}>
      <div className="search-box" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button close-button" onClick={onClose} data-testid="search-close-button">
          <X size={18} />
        </button>
        <span className="eyebrow">PENCARIAN GLOBAL</span>
        <h2>Cari ketergantungan</h2>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari orang, proses, klien, atau pengetahuan…"
          data-testid="global-search-input"
        />
        <div className="search-results" data-testid="search-results">
          {results.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              onClick={() => {
                onClose();
                navigate(item.kind === "person" ? `/people/${item.id}` : "/map");
              }}
              data-testid={`search-result-${item.id}`}
            >
              <span className={`kind-tag kind-${item.kind}`}>{KIND_LABEL[item.kind] || item.kind}</span>
              <b>{item.label}</b>
              <small>{item.meta}</small>
            </button>
          ))}
          {query.trim().length >= 2 && results.length === 0 ? (
            <p className="muted" data-testid="search-empty">Belum ada entitas yang cocok.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Shell({ children, organization, user }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* sesi sudah tidak ada */
    }
    localStorage.removeItem(SESSION_KEY);
    navigate("/login");
  };

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setAskOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>KONTINŪM</span>
        </div>
        <div className="org-switcher" data-testid="organization-switcher">
          <span className="org-dot" />
          <div>
            <b>{organization?.name || "Northstar Labs"}</b>
            <small>Workspace operasional</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, id }) => (
            <NavLink
              key={id}
              to={to}
              className={({ isActive }) => (isActive ? "active" : "")}
              data-testid={`nav-${id}-button`}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="ask-trigger" onClick={() => setAskOpen(true)} data-testid="ask-open-button">
            <Sparkles size={17} /> Tanya KONTINŪM
          </button>
          <button onClick={() => setSearchOpen(true)} data-testid="global-search-button">
            <Search size={17} /> Cari <em>⌘K</em>
          </button>
          <button onClick={logout} data-testid="logout-button">
            <LogOut size={17} /> Keluar
          </button>
          <div className="user-chip" data-testid="user-chip">
            <span>{(user?.name || "Demo Operator").split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
            <div>
              <b>{user?.name || "Demo Operator"}</b>
              <small>{user?.role || "Owner"}</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="mobile-header">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>KONTINŪM</span>
        </div>
        <div className="mobile-actions">
          <button className="icon-button" onClick={() => setAskOpen(true)} data-testid="mobile-ask-button">
            <Sparkles size={18} />
          </button>
          <button className="icon-button" onClick={() => setSearchOpen(true)} data-testid="mobile-search-button">
            <Search size={18} />
          </button>
        </div>
      </div>

      <main className="main-content">
        <header className="context-header">
          <div>
            <span className="breadcrumb">
              {(organization?.name || "NORTHSTAR LABS").toUpperCase()} <ChevronRight size={13} /> RESILIENCE INTELLIGENCE
            </span>
            <p>
              Model deterministik v1.0 <span className="live-dot" /> {organization?.counts?.employees || 47} orang terpetakan
            </p>
          </div>
          <button className="secondary-button ask-header-button" onClick={() => setAskOpen(true)} data-testid="header-ask-button">
            <Sparkles size={15} /> Tanya KONTINŪM
          </button>
        </header>
        {children}
      </main>

      {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}
      <AskPanel open={askOpen} onClose={() => setAskOpen(false)} />

      <div className="bottom-nav">
        {NAV.map(({ to, label, icon: Icon, id }) => (
          <NavLink
            key={id}
            to={to}
            className={({ isActive }) => (isActive ? "active" : "")}
            data-testid={`mobile-nav-${id}-button`}
          >
            <Icon size={17} />
            <span>{label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
