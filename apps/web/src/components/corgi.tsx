export function Corgi({ size = 64 }: { size?: number }) {
  return (
    <img
      src="/mascot/waffles-icon.webp"
      width={size}
      height={size}
      alt="Waffles the corgi"
      decoding="async"
      style={{ objectFit: "contain", flexShrink: 0 }}
    />
  );
}
