import Link from "next/link";
import { Home, MapPinned, ShieldOff, MapPinPlus } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/alerts", label: "Dashboard", icon: MapPinned },
  { href: "/update-alert-area", label: "Update area", icon: MapPinPlus },
  { href: "/unsubscribe", label: "Unsubscribe", icon: ShieldOff },
];

export default function SiteNav() {
  return (
    <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-[13px] text-ink-muted">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex items-center gap-1.5 font-medium text-earth underline-offset-4 transition-colors hover:text-earth-hover hover:underline focus-visible:rounded-md"
        >
          <Icon size={13} strokeWidth={1.8} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
