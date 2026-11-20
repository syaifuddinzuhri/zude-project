/** Logo horizontal; versi gelap otomatis mengikuti tema. */
export function Logo({ width = 200 }: { width?: number }) {
  const h = Math.round((width * 200) / 640);
  return (
    <span className="inline-block" style={{ width, height: h }}>
      <img src="/logo-horizontal.svg" alt="ZuDe — Kas Zuhri & Devi" width={width} height={h} className="logo-light" />
      <img src="/logo-horizontal-dark.svg" alt="" aria-hidden width={width} height={h} className="logo-dark" />
    </span>
  );
}
