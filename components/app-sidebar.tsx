import Link from 'next/link';
import { Boxes, Package, Building, History } from 'lucide-react';
import { UserMenu } from '@/components/user-menu';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Boxes },
  { href: '/inventory/materials', label: 'Materials', icon: Package },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/warehouses', label: 'Warehouses', icon: Building },
  { href: '/inventory/adjustments', label: 'Adjustments', icon: History },
];

export function AppSidebar() {
  return (
    <aside className="w-56 border-r bg-card hidden md:flex flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
          <Package className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight">StockPilot</span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t p-3">
        <UserMenu />
      </div>
    </aside>
  );
}
