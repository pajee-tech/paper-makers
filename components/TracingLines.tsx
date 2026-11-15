// Printable writing/tracing guides drawn as SVG (always print — unlike CSS backgrounds,
// which browsers drop unless "Background graphics" is ticked).

type Style = "FOUR_LINE" | "SQUARE" | "PLAIN";

export default function TracingLines({ style = "FOUR_LINE", rows = 2, traceText = "", widthMm = 180 }: { style?: Style | null; rows?: number; traceText?: string; widthMm?: number }) {
  const W = widthMm;

  if (style === "SQUARE") {
    const cell = 8;
    const cols = Math.floor(W / cell);
    const h = rows * cell;
    const chars = [...traceText.replace(/\s+/g, "")];
    return (
      <svg viewBox={`0 0 ${cols * cell} ${h}`} style={{ width: "100%", maxWidth: `${cols * cell}mm`, display: "block", margin: "1mm 0" }}>
        {Array.from({ length: rows + 1 }, (_, r) => <line key={`h${r}`} x1={0} x2={cols * cell} y1={r * cell} y2={r * cell} stroke="#6b8fd6" strokeWidth={0.25} />)}
        {Array.from({ length: cols + 1 }, (_, c) => <line key={`v${c}`} y1={0} y2={h} x1={c * cell} x2={c * cell} stroke="#6b8fd6" strokeWidth={0.25} />)}
        {Array.from({ length: rows }, (_, r) =>
          chars.map((ch, i) =>
            i < cols ? (
              <text key={`${r}-${i}`} x={i * cell + cell / 2} y={r * cell + cell * 0.78} textAnchor="middle" fontSize={cell * 0.85} fontFamily="Arial, sans-serif" fill="none" stroke="#888" strokeWidth={0.22} strokeDasharray="0.6 0.5">
                {ch}
              </text>
            ) : null,
          ),
        )}
      </svg>
    );
  }

  if (style === "PLAIN") {
    return (
      <div className="write-lines">
        {Array.from({ length: rows }, (_, i) => <div key={i} />)}
      </div>
    );
  }

  // FOUR_LINE: classic English copy lines — ascender, mid (dashed), baseline (red), descender.
  const gap = 3.2;
  const rowH = gap * 3 + 4;
  const h = rows * rowH;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: "100%", display: "block", margin: "1mm 0" }}>
      {Array.from({ length: rows }, (_, r) => {
        const y0 = r * rowH + 2;
        return (
          <g key={r}>
            <line x1={0} x2={W} y1={y0} y2={y0} stroke="#6b8fd6" strokeWidth={0.25} />
            <line x1={0} x2={W} y1={y0 + gap} y2={y0 + gap} stroke="#6b8fd6" strokeWidth={0.2} strokeDasharray="1.2 1" />
            <line x1={0} x2={W} y1={y0 + gap * 2} y2={y0 + gap * 2} stroke="#d64545" strokeWidth={0.3} />
            <line x1={0} x2={W} y1={y0 + gap * 3} y2={y0 + gap * 3} stroke="#6b8fd6" strokeWidth={0.25} />
            {traceText && (
              <text x={2} y={y0 + gap * 2} fontSize={gap * 2.9} fontFamily="'Comic Sans MS', 'Arial Rounded MT Bold', Arial, sans-serif" letterSpacing={1.2} fill="none" stroke="#8a8a8a" strokeWidth={0.22} strokeDasharray="0.7 0.55">
                {traceText}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
