/**
 * Decorative sunlit-meadow backdrop: morning light rays, out-of-focus daisies,
 * and (for the hero) a strip of grass and daisies. Purely visual — aria-hidden
 * and pointer-events-none so it never affects layout or interaction.
 */

type DaisyProps = { x: number; y: number; r: number; petals?: number; tilt?: number; opacity?: number };

function Daisy({ x, y, r, petals = 14, tilt = 0, opacity = 1 }: DaisyProps) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`} opacity={opacity}>
      {Array.from({ length: petals }, (_, i) => (
        <ellipse
          key={i}
          cx={0}
          cy={-r * 0.62}
          rx={r * 0.2}
          ry={r * 0.5}
          fill="url(#petal)"
          transform={`rotate(${(360 / petals) * i})`}
        />
      ))}
      <circle r={r * 0.3} fill="url(#daisy-heart)" />
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <radialGradient id="petal" cx="50%" cy="80%" r="80%">
        <stop offset="0%" stopColor="oklch(0.93 0.03 95)" />
        <stop offset="60%" stopColor="oklch(0.995 0.005 100)" />
      </radialGradient>
      <radialGradient id="daisy-heart" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="oklch(0.93 0.14 95)" />
        <stop offset="100%" stopColor="oklch(0.76 0.15 75)" />
      </radialGradient>
      <linearGradient id="blade-a" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="oklch(0.42 0.1 145)" />
        <stop offset="100%" stopColor="oklch(0.7 0.14 128)" />
      </linearGradient>
      <linearGradient id="blade-b" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="oklch(0.5 0.11 140)" />
        <stop offset="100%" stopColor="oklch(0.82 0.13 118)" />
      </linearGradient>
      <filter id="soft-focus" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <filter id="far-focus" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </defs>
  );
}

/** Light rays + sun glow + floating bokeh. Fills its positioned parent. */
export function MeadowSky({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="meadow-sun absolute -right-40 -top-40 size-[640px] rounded-full" />
      <div className="meadow-rays absolute inset-0" />
      <div className="absolute -left-24 top-[38%] size-[420px] rounded-full bg-blush/25 blur-[110px]" />
      <div className="absolute -bottom-40 right-1/4 size-[520px] rounded-full bg-primary/12 blur-[130px]" />
      <span className="bokeh left-[8%] top-[18%] size-16" />
      <span className="bokeh left-[22%] top-[9%] size-7 opacity-70" />
      <span className="bokeh right-[14%] top-[44%] size-12" />
      <span className="bokeh right-[30%] top-[16%] size-5 opacity-80" />
      <span className="bokeh left-[40%] top-[62%] size-9 opacity-60" />
    </div>
  );
}

/** Small deterministic PRNG so the meadow looks the same on every render. */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Blade = { d: string; g: "a" | "b" };

/** Curved, tapering grass blades with varied height, width and lean. */
function makeBlades(count: number, seed: number, minH: number, maxH: number): Blade[] {
  const rnd = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = (i / count) * 1040 - 20 + rnd() * 14;
    const h = minH + rnd() * (maxH - minH);
    const w = 3 + rnd() * 5;
    const lean = (rnd() - 0.5) * h * 0.55;
    const tipX = x + lean;
    const tipY = 200 - h;
    const d = `M${x - w} 200 C${x - w * 0.6} ${200 - h * 0.45} ${x + lean * 0.55 - 1} ${200 - h * 0.8} ${tipX} ${tipY} C${x + lean * 0.5 + w * 0.3} ${200 - h * 0.75} ${x + w * 0.5} ${200 - h * 0.4} ${x + w} 200 Z`;
    return { d, g: rnd() > 0.45 ? "a" : "b" };
  });
}

const backBlades = makeBlades(110, 7, 50, 120);
const frontBlades = makeBlades(70, 21, 70, 175);

/** A strip of grass and daisies that sits along the bottom edge of its parent. */
export function MeadowGround({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`meadow-ground pointer-events-none absolute inset-x-0 bottom-0 ${className}`}>
      <svg viewBox="0 0 1000 200" preserveAspectRatio="xMidYMax slice" className="block h-full w-full">
        <Defs />
        {/* far, out-of-focus daisies */}
        <g filter="url(#soft-focus)">
          <Daisy x={70} y={70} r={26} opacity={0.75} tilt={12} />
          <Daisy x={600} y={60} r={22} opacity={0.6} />
          <Daisy x={930} y={80} r={30} opacity={0.7} tilt={-8} />
        </g>
        <g opacity={0.55} filter="url(#far-focus)">
          {backBlades.map((b, i) => (
            <path key={i} d={b.d} fill={`url(#blade-${b.g})`} />
          ))}
        </g>
        {frontBlades.map((b, i) => (
          <path key={i} d={b.d} fill={`url(#blade-${b.g})`} />
        ))}
        {/* near daisies, slightly soft like a shallow depth of field */}
        <g filter="url(#far-focus)">
          <Daisy x={150} y={140} r={22} tilt={-10} />
          <Daisy x={455} y={128} r={18} tilt={15} />
          <Daisy x={790} y={136} r={24} tilt={-4} />
        </g>
        <Daisy x={290} y={150} r={26} tilt={8} />
        <Daisy x={640} y={156} r={20} tilt={-14} />
        <Daisy x={965} y={150} r={18} tilt={6} />
        <Daisy x={30} y={162} r={16} tilt={20} />
      </svg>
    </div>
  );
}

/** A single daisy, for small accents. */
export function DaisyMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="-30 -30 60 60" className={className}>
      <Defs />
      <Daisy x={0} y={0} r={28} />
    </svg>
  );
}
