import { FaBars } from "react-icons/fa";

export type SidebarItem = {
  id: string;
  label: string;
  targetId: string;
};

type AppSidebarProps = {
  items: SidebarItem[];
  open: boolean;
  onToggle: () => void;
  onNavigate: (targetId: string) => void;
};

export default function AppSidebar({ items, open, onToggle, onNavigate }: AppSidebarProps) {
  return (
    <aside className={`app-sidebar ${open ? "open" : "collapsed"}`}>
      <div className="sidebar-head">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-label="Toggle sidebar"
        >
          <FaBars />
        </button>
        {open ? (
          <div className="sidebar-brand">
            <img src="/logo.png" alt="PDF Solution logo" className="sidebar-logo" />
            <div>
              <p>PDF Solution</p>
              <span>Workspace</span>
            </div>
          </div>
        ) : null}
      </div>

      <nav className="sidebar-nav" aria-label="Sidebar navigation">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="sidebar-link"
            onClick={() => onNavigate(item.targetId)}
          >
            {open ? item.label : item.label[0]}
          </button>
        ))}
      </nav>
    </aside>
  );
}
