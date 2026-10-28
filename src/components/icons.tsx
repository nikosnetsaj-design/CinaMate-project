import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CirclePlay,
  CircleUser,
  Clock,
  Compass,
  Crown,
  Dice5,
  Download,
  EllipsisVertical,
  Eye,
  Film,
  Globe,
  Heart,
  House,
  Info,
  LayoutGrid,
  Layers,
  LibraryBig,
  Link,
  List,
  ListTree,
  MessageSquareQuote,
  Minus,
  Moon,
  Music,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share,
  Star,
  Sun,
  TriangleAlert,
  Tv,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/*
 * Le icone dell'app, tutte dallo stesso disegno: Lucide, griglia 24,
 * estremità tonde.
 *
 * Erano trenta tracciati scritti a mano con otto spessori diversi su tre
 * griglie, più una ventina di caratteri Unicode usati come icone: accanto,
 * non sembravano della stessa famiglia perché non lo erano. Da una libreria
 * arrivano solo le icone importate qui — poche centinaia di byte l'una — non
 * le duemila del catalogo.
 *
 * I nomi e le props restano quelli di prima (`size`, `filled`), così nessun
 * file che le usa ha dovuto cambiare.
 */

type IconProps = { size?: number };

/**
 * Il tratto resta otticamente uguale a ogni misura: in piccolo si ispessisce
 * un poco, altrimenti un'icona da 14 px avrebbe un filo da un pixel scarso
 * accanto a una da 20 che ne ha uno e mezzo.
 */
function stroke(size: number) {
  return size <= 16 ? 2 : 1.75;
}

function Glyph({ icon: Icon, size }: { icon: LucideIcon; size: number }) {
  return <Icon size={size} strokeWidth={stroke(size)} aria-hidden="true" />;
}

export function HomeIcon({ size = 18 }: IconProps) {
  return <Glyph icon={House} size={size} />;
}
export function CompassIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Compass} size={size} />;
}
export function BookIcon({ size = 18 }: IconProps) {
  return <Glyph icon={LibraryBig} size={size} />;
}
export function SunIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Sun} size={size} />;
}
export function MoonIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Moon} size={size} />;
}
export function SearchIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Search} size={size} />;
}
export function ChartIcon({ size = 18 }: IconProps) {
  return <Glyph icon={ChartNoAxesColumn} size={size} />;
}
/** A heartbeat trace: the page you open when you want to know if it's alive. */
export function PulseIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Activity} size={size} />;
}
/**
 * Il Critico. Era una scintilla, il segno di ogni prodotto «con l'IA»; qui
 * l'assistente è un critico che scrive, quindi una citazione.
 */
export function SparkleIcon({ size = 18 }: IconProps) {
  return <Glyph icon={MessageSquareQuote} size={size} />;
}
export function MinusIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Minus} size={size} />;
}
export function PlusIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Plus} size={size} />;
}
export function GearIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Settings} size={size} />;
}
export function FilmKindIcon({ size = 14 }: IconProps) {
  return <Glyph icon={Film} size={size} />;
}
export function SerieKindIcon({ size = 14 }: IconProps) {
  return <Glyph icon={Tv} size={size} />;
}
export function DocKindIcon({ size = 14 }: IconProps) {
  return <Glyph icon={CirclePlay} size={size} />;
}
export function DiceIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Dice5} size={size} />;
}
export function StackIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Layers} size={size} />;
}
export function PersonIcon({ size = 18 }: IconProps) {
  return <Glyph icon={CircleUser} size={size} />;
}
export function TimelineIcon({ size = 18 }: IconProps) {
  return <Glyph icon={ListTree} size={size} />;
}
export function CheckIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Check} size={size} />;
}
export function InfoIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Info} size={size} />;
}
export function DotsIcon({ size = 18 }: IconProps) {
  return <Glyph icon={EllipsisVertical} size={size} />;
}
export function ListIcon({ size = 18 }: IconProps) {
  return <Glyph icon={List} size={size} />;
}
export function LinkIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Link} size={size} />;
}
export function GlobeIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Globe} size={size} />;
}
export function RefreshIcon({ size = 18 }: IconProps) {
  return <Glyph icon={RefreshCw} size={size} />;
}
export function CloseIcon({ size = 16 }: IconProps) {
  return <Glyph icon={X} size={size} />;
}
export function BackIcon({ size = 18 }: IconProps) {
  return <Glyph icon={ArrowLeft} size={size} />;
}
export function ArrowRightIcon({ size = 18 }: IconProps) {
  return <Glyph icon={ArrowRight} size={size} />;
}
export function ExternalIcon({ size = 14 }: IconProps) {
  return <Glyph icon={ArrowUpRight} size={size} />;
}
export function ChevronUpIcon({ size = 14 }: IconProps) {
  return <Glyph icon={ChevronUp} size={size} />;
}
export function ChevronDownIcon({ size = 14 }: IconProps) {
  return <Glyph icon={ChevronDown} size={size} />;
}
export function ChevronRightIcon({ size = 16 }: IconProps) {
  return <Glyph icon={ChevronRight} size={size} />;
}
export function ClockIcon({ size = 12 }: IconProps) {
  return <Glyph icon={Clock} size={size} />;
}
export function EyeIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Eye} size={size} />;
}
export function ShareIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Share} size={size} />;
}
export function MusicIcon({ size = 18 }: IconProps) {
  return <Glyph icon={Music} size={size} />;
}
export function DownloadIcon({ size = 16 }: IconProps) {
  return <Glyph icon={Download} size={size} />;
}
export function GridIcon({ size = 16 }: IconProps) {
  return <Glyph icon={LayoutGrid} size={size} />;
}
export function CrownIcon({ size = 14 }: IconProps) {
  return <Glyph icon={Crown} size={size} />;
}
export function WarningIcon({ size = 14 }: IconProps) {
  return <Glyph icon={TriangleAlert} size={size} />;
}
export function SuccessIcon({ size = 16 }: IconProps) {
  return <Glyph icon={CircleCheck} size={size} />;
}
export function ErrorIcon({ size = 16 }: IconProps) {
  return <Glyph icon={CircleAlert} size={size} />;
}

export function StarIcon({ size = 14, filled = false }: IconProps & { filled?: boolean }) {
  return <Star size={size} strokeWidth={stroke(size)} fill={filled ? "currentColor" : "none"} aria-hidden="true" />;
}

export function PlayIcon({ size = 18 }: IconProps) {
  return <Play size={size} strokeWidth={stroke(size)} fill="currentColor" aria-hidden="true" />;
}

export function HeartIcon({ size = 18, filled = false }: IconProps & { filled?: boolean }) {
  return <Heart size={size} strokeWidth={stroke(size)} fill={filled ? "currentColor" : "none"} aria-hidden="true" />;
}

export function BellIcon({ size = 18, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Bell
      size={size}
      strokeWidth={stroke(size)}
      fill={filled ? "currentColor" : "none"}
      fillOpacity={filled ? 0.28 : 0}
      aria-hidden="true"
    />
  );
}

/**
 * L'anime: un torii. Lucide non ne ha uno, quindi è disegnato qui con le sue
 * stesse regole — griglia 24, estremità e angoli tondi, lo stesso tratto —
 * perché accanto al film e alla serie sembri della stessa mano.
 */
export function AnimeKindIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5c3.5 1.4 14.5 1.4 18 0" />
      <path d="M4.5 9.5h15" />
      <path d="M6.5 6.2V20M17.5 6.2V20" />
      <path d="M12 6.6v2.9" />
    </svg>
  );
}

/**
 * Il marchio: la pizza della pellicola sulla tessera dell'accento. È il logo,
 * non un'icona d'interfaccia, quindi resta disegnato a mano e segue il colore
 * scelto nelle Impostazioni.
 */
export function ReelMark({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect width="26" height="26" rx="6" fill="var(--accent)" />
      <circle cx="13" cy="13" r="7.2" fill="none" stroke="var(--accent-contrast)" strokeWidth="1.4" />
      <circle cx="13" cy="6.6" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="18.6" cy="9.8" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="18.6" cy="16.2" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="13" cy="19.4" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="7.4" cy="16.2" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="7.4" cy="9.8" r="1.1" fill="var(--accent-contrast)" />
      <circle cx="13" cy="13" r="2.2" fill="var(--accent-contrast)" />
    </svg>
  );
}

