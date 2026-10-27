import type { LucideIcon } from "lucide-react";
import {
  Building2, ChartColumn, ClipboardList, Droplets, Gauge, House, Info, LayoutGrid,
  Mail, MapPinned, Route, Truck, UserRound, Workflow,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** true = rendered by React Router; false = full page load to a Flask page */
  spa?: boolean;
}
export interface NavSection { label: string; items: NavItem[] }

export const publicNav: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Home", href: "/", icon: House, spa: true },
      { label: "How it works", href: "/#how-it-works", icon: Workflow },
      { label: "About", href: "/#about", icon: Info },
      { label: "Contact", href: "/#contact", icon: Mail },
    ],
  },
  {
    label: "Partners",
    items: [
      { label: "Register an STP", href: "/stp/register", icon: Building2, spa: true },
      { label: "Tanker partners", href: "/tanker/register", icon: Truck, spa: true },
    ],
  },
];

export const roleNav: Record<string, NavSection[]> = {
  demand: [
    {
      label: "Water",
      items: [
        { label: "Find water", href: "/demand", icon: Droplets, spa: true },
        { label: "My orders", href: "/track", icon: ClipboardList },
      ],
    },
    { label: "Account", items: [{ label: "Profile", href: "/profile", icon: UserRound, spa: true }] },
  ],
  stp: [
    {
      label: "Plant",
      items: [
        { label: "Overview", href: "/supply", icon: LayoutGrid, spa: true },
        { label: "Order tracking", href: "/stp_track", icon: MapPinned },
        { label: "OCEMS readings", href: "/supply_ocems", icon: Gauge },
      ],
    },
    { label: "Account", items: [{ label: "Profile", href: "/profile", icon: UserRound, spa: true }] },
  ],
  tanker: [
    {
      label: "Operations",
      items: [
        { label: "Dashboard", href: "/tanker", icon: LayoutGrid, spa: true },
        { label: "Trip history", href: "/trip_history", icon: Route },
        { label: "Fleet & documents", href: "/tanker/reports", icon: ChartColumn, spa: true },
      ],
    },
    { label: "Account", items: [{ label: "Profile", href: "/profile", icon: UserRound, spa: true }] },
  ],
};
