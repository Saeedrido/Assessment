import { NavLink } from 'react-router-dom';
import { Coins, FileText, LayoutDashboard, Users, Wallet, Image as ImageIcon } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/content', label: 'Content', icon: FileText },
  { to: '/ai-runs', label: 'AI runs', icon: Coins },
  { to: '/tokens', label: 'Tokens', icon: Wallet },
  { to: '/media', label: 'Media', icon: ImageIcon },
  { to: '/users', label: 'Users', icon: Users, adminOnly: true },
];

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">TW</span>
        <div>
          <p className="text-sm font-semibold text-slate-100">T-World</p>
          <p className="text-xs text-slate-500">Module console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Main">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }: { isActive: boolean }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-slate-800 font-medium text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
              }`
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
