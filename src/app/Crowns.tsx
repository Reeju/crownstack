/** Row of three crowns, `earned` of them lit. */
export function Crowns({ earned, small = false }: { earned: number; small?: boolean }) {
  return (
    <span
      className={small ? 'crowns small' : 'crowns'}
      role="img"
      aria-label={`${earned} of 3 crowns`}
    >
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= earned ? 'crown earned' : 'crown'} aria-hidden="true">
          ♛
        </span>
      ))}
    </span>
  );
}
