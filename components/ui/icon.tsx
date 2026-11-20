import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Award, Baby, BadgeCheck, Banknote, Bell, BookCheck, Briefcase, Calendar,
  CalendarClock, Car, ChartLine, ChartPie, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, CirclePlus, ClipboardList,
  Coins, CreditCard, Ellipsis, Eye, EyeOff, Gem, Gift, Gauge, HandCoins, HandHeart, HeartPulse, History, House, Landmark,
  LayoutGrid, Lock, LogOut, type LucideIcon, Menu, PiggyBank, Plus, Popcorn, Receipt, RefreshCw, Repeat, Search, Settings,
  ShieldCheck, ShoppingBasket, Smartphone, SlidersHorizontal, Sparkles, Store, Tag, Target, Trash2, TrendingUp, Undo2, User,
  Users, Wallet, X, Download, Copy, Pencil, Split, Bitcoin, Building2, ChartColumn, Scale, Smartphone as Phone, Mail, KeyRound,
  Fingerprint, Moon, Sun, Monitor, BellRing, Send, Calculator, Delete, FileText, Info, TriangleAlert, CircleCheck, Plane,
  GraduationCap, Shield, Umbrella, Heart, Home, Utensils, Shirt, Gamepad2, Zap, Droplet, Wifi, Fuel,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  "arrow-down-left": ArrowDownLeft, "arrow-left-right": ArrowLeftRight, "arrow-up-right": ArrowUpRight, award: Award, baby: Baby,
  "badge-check": BadgeCheck, banknote: Banknote, bell: Bell, "book-check": BookCheck, briefcase: Briefcase, calendar: Calendar,
  "calendar-clock": CalendarClock, car: Car, "chart-line": ChartLine, "chart-pie": ChartPie, check: Check, "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft, "chevron-right": ChevronRight, circle: Circle, "circle-plus": CirclePlus, "clipboard-list": ClipboardList,
  coins: Coins, "credit-card": CreditCard, ellipsis: Ellipsis, eye: Eye, "eye-off": EyeOff, gem: Gem, gift: Gift, gauge: Gauge,
  "hand-coins": HandCoins, "hand-heart": HandHeart, "heart-pulse": HeartPulse, history: History, house: House, landmark: Landmark,
  "layout-grid": LayoutGrid, lock: Lock, "log-out": LogOut, menu: Menu, "piggy-bank": PiggyBank, plus: Plus, popcorn: Popcorn,
  receipt: Receipt, "refresh-cw": RefreshCw, repeat: Repeat, search: Search, settings: Settings, "shield-check": ShieldCheck,
  "shopping-basket": ShoppingBasket, smartphone: Smartphone, sliders: SlidersHorizontal, sparkles: Sparkles, store: Store, tag: Tag,
  target: Target, trash: Trash2, "trending-up": TrendingUp, "undo-2": Undo2, user: User, users: Users, wallet: Wallet, x: X,
  download: Download, copy: Copy, pencil: Pencil, split: Split, bitcoin: Bitcoin, building: Building2, "chart-column": ChartColumn,
  scale: Scale, phone: Phone, mail: Mail, key: KeyRound, fingerprint: Fingerprint, moon: Moon, sun: Sun, monitor: Monitor,
  "bell-ring": BellRing, send: Send, calculator: Calculator, delete: Delete, "file-text": FileText, info: Info, alert: TriangleAlert,
  "circle-check": CircleCheck, plane: Plane, "graduation-cap": GraduationCap, shield: Shield, umbrella: Umbrella, heart: Heart,
  home: Home, utensils: Utensils, shirt: Shirt, gamepad: Gamepad2, zap: Zap, droplet: Droplet, wifi: Wifi, fuel: Fuel,
};

export const ACCOUNT_ICONS = ["wallet", "landmark", "credit-card", "smartphone", "banknote", "coins", "piggy-bank", "chart-line", "hand-coins", "building"];

export function Icon({ name, size = 20, className, strokeWidth = 1.75, fill, fillOpacity }: { name: string; size?: number; className?: string; strokeWidth?: number; fill?: string; fillOpacity?: number }) {
  const C = ICONS[name] ?? Circle;
  return <C size={size} strokeWidth={strokeWidth} className={className} fill={fill ?? "none"} fillOpacity={fillOpacity} aria-hidden />;
}

/** Ikon kategori dalam lingkaran 40px berlatar warna kategori opacity 15%. */
export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `${color}26`, color }}
    >
      <Icon name={icon} size={Math.round(size / 2)} />
    </span>
  );
}
