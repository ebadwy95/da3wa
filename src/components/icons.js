// Inline SVG icon set.
//
// These replace the emoji the app used to render (📅 📍 ✅ 🎉 …). Emoji are
// drawn by the operating system, so the same invitation looked different on
// every guest's phone — a colourful iOS glyph next to a flat Android one, at
// sizes and baselines we don't control. These are stroke icons that inherit
// `currentColor` and the surrounding font-size, so they sit on the text
// baseline and take the palette with them.
//
// Every icon is decorative by default (aria-hidden). When an icon is the only
// content of a control, label the CONTROL — `<button aria-label="…">` — not
// the icon.

function Icon({ children, size = 20, strokeWidth = 1.75, className = "", ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 ${className}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------- Invitation ---------- */

export function CalendarIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
  );
}

export function MapPinIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20 10.5c0 5.2-5.6 9.9-7.5 11.3a1 1 0 0 1-1.2 0C9.6 20.4 4 15.7 4 10.5a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10.2" r="2.6" />
    </Icon>
  );
}

export function GiftIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 13h18M12 9v12" />
      <path d="M12 9S10.5 3 8 3a2.5 2.5 0 0 0 0 5h4Zm0 0s1.5-6 4-6a2.5 2.5 0 0 1 0 5h-4Z" />
    </Icon>
  );
}

/* A stylised eight-point star — the geometry that runs through the rest of
   the invitation's ornament, used where the app wants a small flourish. */
export function StarOrnamentIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 2.5 14.6 9 21 11.6 14.6 14.2 12 20.6 9.4 14.2 3 11.6 9.4 9Z" />
    </Icon>
  );
}

export function HeartIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 20.5s-7.5-4.7-7.5-10a4.3 4.3 0 0 1 7.5-2.8A4.3 4.3 0 0 1 19.5 10.5c0 5.3-7.5 10-7.5 10Z" />
    </Icon>
  );
}

export function MessageIcon(props) {
  return (
    <Icon {...props}>
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3.2A8 8 0 1 1 21 12Z" />
    </Icon>
  );
}

/* ---------- Status ---------- */

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  );
}

export function CheckCircleIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.8 2.8L16 9.5" />
    </Icon>
  );
}

export function XCircleIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Icon>
  );
}

export function XIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 6 18 18M18 6 6 18" />
    </Icon>
  );
}

export function BanIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </Icon>
  );
}

export function AlertIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </Icon>
  );
}

export function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.2 1.9" />
    </Icon>
  );
}

/* ---------- People & events ---------- */

export function UsersIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6M18 20a6.2 6.2 0 0 0-2.2-4.7" />
    </Icon>
  );
}

export function UserPlusIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9.5" cy="8" r="3.4" />
      <path d="M3 20a6.5 6.5 0 0 1 13 0" />
      <path d="M18.5 8.5v5M21 11h-5" />
    </Icon>
  );
}

export function PhoneIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6.2 3.5h3l1.5 3.8-2 1.3a11 11 0 0 0 5 5l1.3-2 3.8 1.5v3a1.9 1.9 0 0 1-2.1 1.9A16.5 16.5 0 0 1 4.3 5.6 1.9 1.9 0 0 1 6.2 3.5Z" />
    </Icon>
  );
}

export function RingsIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="14.5" r="5.5" />
      <circle cx="15" cy="14.5" r="5.5" />
      <path d="M15 3.5 16.8 6h-3.6Z" />
    </Icon>
  );
}

/* ---------- Door & entry ---------- */

export function QrIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
    </Icon>
  );
}

export function ScanIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
      <path d="M3 12h18" />
    </Icon>
  );
}

export function ShieldIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 2.8 20 5.6v5.6c0 4.6-3.3 8.3-8 9.9-4.7-1.6-8-5.3-8-9.9V5.6Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </Icon>
  );
}

export function DoorIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21M3 21h18" />
      <path d="M14.5 12h.01" />
    </Icon>
  );
}

/* ---------- Actions ---------- */

export function SendIcon(props) {
  return (
    <Icon {...props}>
      <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8Z" />
    </Icon>
  );
}

export function UploadIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
      <path d="M12 3.5v11M7.8 7.7 12 3.5l4.2 4.2" />
    </Icon>
  );
}

export function DownloadIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
      <path d="M12 14.5v-11M7.8 10.3 12 14.5l4.2-4.2" />
    </Icon>
  );
}

export function PencilIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 20h4l10.3-10.3a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 5.5 4 4" />
    </Icon>
  );
}

export function ArchiveIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="4.5" rx="1.5" />
      <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5M10 12.5h4" />
    </Icon>
  );
}

export function RotateIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20 11a8 8 0 1 0-1.8 6" />
      <path d="M20 4v7h-7" />
    </Icon>
  );
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function LogOutIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14 20H6.5A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4H14" />
      <path d="M17 8.5 20.5 12 17 15.5M20.5 12H10" />
    </Icon>
  );
}

export function LockIcon(props) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </Icon>
  );
}

export function WrenchIcon(props) {
  return (
    <Icon {...props}>
      <path d="M15.2 3.4a5.5 5.5 0 0 0-6.6 7L3.6 15.4a2 2 0 0 0 2.8 2.8l5-5a5.5 5.5 0 0 0 7-6.6l-3 3-2.6-2.6Z" />
    </Icon>
  );
}

export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  );
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

/* ---------- Invitation opener ---------- */

export function PlayIcon(props) {
  return (
    <Icon {...props}>
      <path d="M7 4.8v14.4a.7.7 0 0 0 1.07.6l11.3-7.2a.7.7 0 0 0 0-1.2L8.07 4.2A.7.7 0 0 0 7 4.8Z" />
    </Icon>
  );
}

export function SoundOnIcon(props) {
  return (
    <Icon {...props}>
      <path d="M11 4.8 6.5 8.5H3.5v7h3L11 19.2Z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.3 6.4a8 8 0 0 1 0 11.2" />
    </Icon>
  );
}

export function SoundOffIcon(props) {
  return (
    <Icon {...props}>
      <path d="M11 4.8 6.5 8.5H3.5v7h3L11 19.2Z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </Icon>
  );
}

export function VideoIcon(props) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="m15.5 11 6-3.2v8.4l-6-3.2Z" />
    </Icon>
  );
}

export function MusicIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9 18V6.2l10-2v11.6" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="15.8" r="2.5" />
    </Icon>
  );
}

export function ImageIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m4 17 4.8-4.5a1.6 1.6 0 0 1 2.2 0L20 20.5" />
    </Icon>
  );
}

export function PaletteIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3.2a8.8 8.8 0 0 0 0 17.6c1.2 0 1.9-.8 1.9-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h1.6a4.6 4.6 0 0 0 4.6-4.6c0-3.9-4-7.2-8.8-7.2Z" />
      <circle cx="7.8" cy="11.5" r="1.1" />
      <circle cx="10.8" cy="7.6" r="1.1" />
      <circle cx="15.6" cy="8.3" r="1.1" />
    </Icon>
  );
}

export function InboxIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 13h4.5l1.5 3h6l1.5-3H21" />
      <path d="M5.4 4.7 3 13v5.5A1.5 1.5 0 0 0 4.5 20h15a1.5 1.5 0 0 0 1.5-1.5V13l-2.4-8.3A1.5 1.5 0 0 0 17.2 3.5H6.8a1.5 1.5 0 0 0-1.4 1.2Z" />
    </Icon>
  );
}
