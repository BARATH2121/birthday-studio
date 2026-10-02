export default function CakeIllustration() {
  return (
    <svg
      viewBox="0 0 260 200"
      role="img"
      aria-label="Illustration of a three tier birthday cake with lit candles"
      className="h-auto w-full"
    >
      <defs>
        <linearGradient id="bs-tier-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd0e4" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id="bs-tier-mid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8fc0" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="bs-tier-low" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7aa8ff" />
          <stop offset="100%" stopColor="#6d5cf6" />
        </linearGradient>
        <radialGradient id="bs-flame" cx="50%" cy="62%" r="52%">
          <stop offset="0%" stopColor="#fff7dd" />
          <stop offset="52%" stopColor="#ffc46b" />
          <stop offset="100%" stopColor="#ff7a3d" />
        </radialGradient>
        <filter id="bs-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <ellipse
        cx="130"
        cy="96"
        rx="96"
        ry="52"
        fill="#ff4d97"
        opacity="0.35"
        filter="url(#bs-soft-glow)"
      />

      <g fill="#ffffff" opacity="0.55">
        <circle cx="34" cy="46" r="3" />
        <circle cx="226" cy="38" r="2.4" />
        <circle cx="244" cy="86" r="2" />
        <circle cx="20" cy="102" r="2" />
        <circle cx="58" cy="24" r="2" />
        <circle cx="204" cy="18" r="1.8" />
      </g>

      <rect x="34" y="176" width="192" height="9" rx="4.5" fill="#ffffff" opacity="0.16" />

      <rect x="46" y="130" width="168" height="46" rx="13" fill="url(#bs-tier-low)" />
      <rect x="46" y="130" width="168" height="15" rx="7.5" fill="#ffffff" opacity="0.9" />
      <rect x="64" y="86" width="132" height="46" rx="13" fill="url(#bs-tier-mid)" />
      <rect x="64" y="86" width="132" height="15" rx="7.5" fill="#ffffff" opacity="0.9" />
      <rect x="84" y="48" width="92" height="40" rx="12" fill="url(#bs-tier-top)" />
      <rect x="84" y="48" width="92" height="14" rx="7" fill="#ffffff" opacity="0.9" />

      <g fill="#ffffff" opacity="0.82">
        <rect x="110" y="28" width="5" height="20" rx="2.5" />
        <rect x="128" y="24" width="5" height="24" rx="2.5" />
        <rect x="146" y="28" width="5" height="20" rx="2.5" />
      </g>
      <g fill="url(#bs-flame)">
        <ellipse cx="112.5" cy="20" rx="4.6" ry="7" />
        <ellipse cx="130.5" cy="15" rx="5" ry="7.6" />
        <ellipse cx="148.5" cy="20" rx="4.6" ry="7" />
      </g>
    </svg>
  );
}
