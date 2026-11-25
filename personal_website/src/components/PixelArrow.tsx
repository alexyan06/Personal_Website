// The ▶ of an NES menu, drawn as pixels: 4 x 7 font pixels, or 6 x 9 with a one-pixel black outline.
// It is sized in em (.pixel-arrow in src/index.css), so it matches Press Start 2P text of any size.
const ROWS = [1, 2, 3, 4, 3, 2, 1];

export function PixelArrow({ outlined = false }: { outlined?: boolean }) {
  return (
    <svg
      className={outlined ? 'pixel-arrow pixel-arrow--outlined' : 'pixel-arrow'}
      viewBox={outlined ? '0 0 6 9' : '0 0 4 7'}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {outlined && ROWS.map((width, row) => <rect key={`edge-${row}`} className="pixel-arrow__edge" x={0} y={row} width={width + 2} height={3} />)}
      {ROWS.map((width, row) => (
        <rect key={row} x={outlined ? 1 : 0} y={outlined ? row + 1 : row} width={width} height={1} />
      ))}
    </svg>
  );
}
