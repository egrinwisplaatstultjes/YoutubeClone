export default function VeloraLogo({ size = 28 }) {
  const id = 'vlr-grad'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#a78bfa" />
          <stop offset="55%"  stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>

      {/* Rounded background tile */}
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />

      {/* Stylised V mark — two tapered arms */}
      {/* Left arm: top-left → centre-bottom */}
      <polygon
        points="6,7 13,7 16,22 12,22"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Right arm: top-right → centre-bottom */}
      <polygon
        points="26,7 19,7 16,22 20,22"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Small play-triangle accent at the bottom of the V */}
      <polygon
        points="14.2,23.5 17.8,23.5 16,26.5"
        fill="white"
        fillOpacity="0.55"
      />
    </svg>
  )
}
