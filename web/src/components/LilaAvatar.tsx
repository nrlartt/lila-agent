type Props = {

  size?: "sm" | "md" | "lg";

  className?: string;

  pulse?: boolean;

};



const SIZES = { sm: 36, md: 42, lg: 72 } as const;



/** Lila — friendly agent mascot (alt.fun emerald palette). */

export function LilaAvatar({ size = "md", className = "", pulse = false }: Props) {

  const px = SIZES[size];

  return (

    <span

      className={`lila-avatar lila-avatar--${size}${pulse ? " lila-avatar--pulse" : ""} ${className}`.trim()}

      aria-hidden

    >

      <svg width={px} height={px} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">

        <defs>

          <linearGradient id="lila-face" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">

            <stop stopColor="#6ee7b7" />

            <stop offset="0.45" stopColor="#34d399" />

            <stop offset="1" stopColor="#047857" />

          </linearGradient>

          <linearGradient id="lila-glow" x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">

            <stop stopColor="#a7f3d0" stopOpacity="0.9" />

            <stop offset="1" stopColor="#064e3b" stopOpacity="0" />

          </linearGradient>

        </defs>

        <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#lila-face)" />

        <rect x="4" y="4" width="56" height="28" rx="18" fill="url(#lila-glow)" opacity="0.35" />

        <ellipse cx="32" cy="58" rx="18" ry="4" fill="#10b981" opacity="0.25" />

        <rect x="14" y="22" width="12" height="12" rx="4" fill="#022c22" />

        <rect x="38" y="22" width="12" height="12" rx="4" fill="#022c22" />

        <circle cx="20" cy="28" r="3" fill="#ecfdf5" />

        <circle cx="44" cy="28" r="3" fill="#ecfdf5" />

        <path

          d="M22 40c4 4 16 4 20 0"

          stroke="#022c22"

          strokeWidth="3"

          strokeLinecap="round"

        />

        <circle cx="52" cy="14" r="5" fill="#4ade80" opacity="0.9" />

        <circle cx="52" cy="14" r="2" fill="#ecfdf5" />

      </svg>

    </span>

  );

}


