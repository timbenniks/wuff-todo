export function Corgi({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="Wuff the corgi"
    >
      <rect width="80" height="80" rx="24" fill="#dfeefa" />
      <path
        d="M17 36 14 12Q27 11 34 28h12Q54 11 66 12l-3 24q7 7 5 19-3 16-28 16T12 55q-2-11 5-19Z"
        fill="#dba05c"
      />
      <path d="m20 29-2-11 11 12m22 0 11-12-2 11" fill="#eac4ad" />
      <path
        d="M40 27q-4 15-14 22-9 7-8 14 8 8 22 8t22-8q1-7-8-14Q44 42 40 27"
        fill="#fffaf1"
      />
      <ellipse cx="26" cy="43" rx="3" ry="3.8" fill="#253d55" />
      <ellipse cx="54" cy="43" rx="3" ry="3.8" fill="#253d55" />
      <path d="M35 54q5-4 10 0-1 6-5 6t-5-6Z" fill="#253d55" />
      <path
        d="M40 60v4m0 0q-5 4-8 0m8 0q5 4 8 0"
        fill="none"
        stroke="#253d55"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
