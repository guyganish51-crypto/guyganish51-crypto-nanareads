/** Patrik — original illustration. Messy hair, stubble, raised eyebrow, DJ headphones round the neck, tomato tee. */
export function Avatar({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label="Patrik">
      <circle cx="60" cy="60" r="58" fill="#a8dadc" stroke="#221b16" strokeWidth="3" />
      {/* tee */}
      <path d="M20 114c4-18 20-26 40-26s36 8 40 26" fill="#e4572e" stroke="#221b16" strokeWidth="3" />
      {/* neck */}
      <path d="M50 84v8q10 6 20 0v-8" fill="#e8b48f" stroke="#221b16" strokeWidth="3" />
      {/* headphones round the neck */}
      <path d="M33 90q27 16 54 0" fill="none" stroke="#221b16" strokeWidth="5" strokeLinecap="round" />
      <rect x="25" y="84" width="14" height="16" rx="5" fill="#221b16" />
      <rect x="81" y="84" width="14" height="16" rx="5" fill="#221b16" />
      {/* face */}
      <ellipse cx="60" cy="58" rx="24" ry="27" fill="#e8b48f" stroke="#221b16" strokeWidth="3" />
      {/* stubble */}
      <path d="M40 66q20 26 40 0" fill="#c99a78" opacity=".55" />
      {/* messy hair */}
      <path d="M35 52c-3-18 9-29 25-29 9 0 13-4 18 0 7 5 9 16 7 29-3-7-7-11-13-12 2 4 1 7-1 8-3-6-9-9-16-9-8 0-14 4-20 13z"
        fill="#3b2a20" stroke="#221b16" strokeWidth="3" strokeLinejoin="round" />
      {/* eyebrows: one raised */}
      <path d="M43 50q6-3 11-1" stroke="#221b16" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M66 46q7-5 12-1" stroke="#221b16" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {/* eyes */}
      <ellipse cx="49" cy="57" rx="2.6" ry="3" fill="#221b16" />
      <ellipse cx="71" cy="56" rx="2.6" ry="3" fill="#221b16" />
      {/* nose + smirk */}
      <path d="M60 60q-3 6 1 7" stroke="#221b16" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M51 73q9 4 17-3" stroke="#221b16" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
