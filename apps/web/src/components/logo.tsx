/**
 * Yard logo — terracotta price tag with a sprout and a smiley face.
 * `leaves="cream"` for dark surfaces, `leaves="ink"` for light surfaces.
 */
export function Logo({
  size = 32,
  leaves = "ink",
}: {
  size?: number;
  leaves?: "cream" | "ink";
}) {
  const leafColor = leaves === "cream" ? "#f3eee3" : "#3b3b3d";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label="Yard"
    >
      <g stroke={leafColor} strokeWidth={8} strokeLinecap="round" fill="none">
        <path d="M100 82 C102 66 98 56 90 44" />
        <path d="M100 82 C104 62 112 52 122 44" />
      </g>
      <path
        d="M90 44 C70 52 52 44 42 24 C64 14 84 22 90 44 Z"
        fill={leafColor}
      />
      <path
        d="M122 44 C124 22 140 8 164 8 C164 32 148 48 122 44 Z"
        fill={leafColor}
      />
      <path
        d="M134 32 L150 20"
        stroke="rgba(255,255,255,.85)"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <g transform="rotate(10 100 120)">
        <path
          d="M66 88 L100 60 L134 88 V166 Q134 178 122 178 H78 Q66 178 66 166 Z"
          fill="#de5a38"
          stroke="#de5a38"
          strokeWidth={14}
          strokeLinejoin="round"
        />
        <circle cx={100} cy={88} r={9.5} fill="#fff" />
        <g stroke="#fff" strokeWidth={8} strokeLinecap="round" fill="none">
          <path d="M78 118 Q86 108 94 116" />
          <path d="M112 122 Q120 112 128 120" />
          <path d="M80 138 Q100 158 126 134" />
        </g>
      </g>
    </svg>
  );
}
