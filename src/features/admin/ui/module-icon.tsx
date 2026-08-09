import {
    AudioLines,
    BarChart3,
    BookOpen,
    Building,
    CalendarRange,
    ClipboardCheck,
    Cpu,
    DatabaseZap,
    FileText,
    Headphones,
    LayoutGrid,
    Megaphone,
    Mic,
    Music,
    PanelsTopLeft,
    Search,
    SearchCheck,
    Send,
    Settings,
    Shield,
    ShieldAlert,
    Sparkles,
    Target,
    TrendingUp,
    Video,
    Briefcase,
    Mail,
    Server,
    CreditCard,
    type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
    cpu: Cpu,
    "file-text": FileText,
    "layout-grid": LayoutGrid,
    "layout-template": PanelsTopLeft,
    "book-open": BookOpen,
    "clipboard-check": ClipboardCheck,
    headphones: Headphones,
    megaphone: Megaphone,
    mic: Mic,
    music: Music,
    settings: Settings,
    shield: Shield,
    "shield-alert": ShieldAlert,
    sparkles: Sparkles,
    video: Video,
    briefcase: Briefcase,
    mail: Mail,
    server: Server,
    "bar-chart-3": BarChart3,
    "calendar-range": CalendarRange,
    "search-check": SearchCheck,
    send: Send,
    search: Search,
    building: Building,
    "audio-lines": AudioLines,
    target: Target,
    "trending-up": TrendingUp,
    "database-zap": DatabaseZap,
    "credit-card": CreditCard,
};

interface ModuleIconProps {
    name: string;
    className?: string;
}

export function ModuleIcon({ name, className }: ModuleIconProps) {
    const Icon = ICONS[name] ?? LayoutGrid;
    return <Icon className={className} />;
}
