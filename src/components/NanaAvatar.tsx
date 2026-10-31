/** Nana — original illustration. Grey bun, round glasses, raised eyebrow, tomato cardigan, pearls. */
export function NanaAvatar({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label="Nana">
      <circle cx="60" cy="60" r="58" fill="#f6d776" stroke="#221b16" strokeWidth="3" />
      {/* bun */}
      <circle cx="60" cy="22" r="13" fill="#d9d4ce" stroke="#221b16" strokeWidth="3" />
      {/* hair */}
      <path d="M28 58c0-22 14-34 32-34s32 12 32 34c-6-10-14-15-32-15S34 48 28 58z" fill="#d9d4ce" stroke="#221b16" strokeWidth="3" strokeLinejoin="round" />
      {/* face */}
      <ellipse cx="60" cy="64" rx="25" ry="27" fill="#f3c9a8" stroke="#221b16" strokeWidth="3" />
      {/* cardigan */}
      <path d="M22 112c4-16 18-24 38-24s34 8 38 24" fill="#e4572e" stroke="#221b16" strokeWidth="3" />
      <path d="M60 88v24" stroke="#221b16" strokeWidth="3" />
      {/* pearls */}
      {[44, 51, 58, 65, 72].map((x, i) => (
        <circle key={x} cx={x + (i === 2 ? 2 : 0)} cy={i === 2 ? 96 : i % 2 ? 94 : 91} r="3" fill="#fffdf8" stroke="#221b16" strokeWidth="1.5" />
      ))}
      {/* glasses */}
      <circle cx="49" cy="62" r="8" fill="#fffdf8" fillOpacity=".5" stroke="#221b16" strokeWidth="3" />
      <circle cx="71" cy="62" r="8" fill="#fffdf8" fillOpacity=".5" stroke="#221b16" strokeWidth="3" />
      <path d="M57 62h6" stroke="#221b16" strokeWidth="3" />
      <circle cx="49" cy="63" r="2.2" fill="#221b16" />
      <circle cx="71" cy="63" r="2.2" fill="#221b16" />
      {/* raised eyebrow */}
      <path d="M42 50q7-4 13-1" stroke="#221b16" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M65 47q7-5 13 0" stroke="#221b16" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* smirk */}
      <path d="M52 78q8 5 15-2" stroke="#221b16" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="44" cy="74" r="3.5" fill="#e4572e" opacity=".35" />
      <circle cx="76" cy="74" r="3.5" fill="#e4572e" opacity=".35" />
    </svg>
  );
}
