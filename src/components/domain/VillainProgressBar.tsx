export function VillainProgressBar({
  pct,
}: {
  pct: number;
}): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="relative w-full h-2 rounded-full bg-surface overflow-hidden"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${clamped}%`,
          background:
            "linear-gradient(90deg, var(--color-oak) 0%, var(--color-sage) 100%)",
        }}
      />
    </div>
  );
}
