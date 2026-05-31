import { motion } from "motion/react";

/* Muted, designed favicon palette — colorful enough to read as real sites,
   desaturated enough to live happily on the sage canvas. */
const DOTS = ["#3A7A52", "#D98E5A", "#5B8DB8", "#C26B6B"] as const;

/**
 * A tactile preview of a real Stash session card, fanned over two ghost cards
 * for depth. Stands in for "here's what a saved session looks like" on the
 * empty Library — premium onboarding, not an illustration.
 */
export function EmptyPreview({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      className="relative mx-auto h-[138px] w-[268px]"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
        transition={reduceMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* ghost cards behind — solid surfaces, no skeleton bars */}
        <div className="absolute left-1/2 top-1 h-[104px] w-[230px] -translate-x-1/2 -rotate-[6deg] rounded-[var(--radius-card)] border border-border bg-surface/60 shadow-[var(--shadow-sm)]" />
        <div className="absolute left-1/2 top-0.5 h-[108px] w-[244px] -translate-x-1/2 rotate-[3.5deg] rounded-[var(--radius-card)] border border-border bg-surface/80 shadow-[var(--shadow-sm)]" />

        {/* hero card — mirrors the real session card */}
        <div className="relative w-[256px] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-md)]">
          <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
          <div className="py-4 pl-5 pr-4 text-left">
            <p className="font-display display-title text-[15.5px] font-semibold leading-snug text-ink">
              Weekend reading
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[10.5px] text-muted-2">
                6 tabs
              </span>
              <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[10.5px] text-muted-2">
                now
              </span>
            </div>
            <div className="mt-3 flex items-center">
              {DOTS.map((color, i) => (
                <span
                  key={color}
                  className="-ml-1.5 inline-flex h-[18px] w-[18px] rounded-full shadow-[var(--shadow-xs)] ring-[2px] ring-white first:ml-0"
                  style={{ backgroundColor: color, zIndex: DOTS.length - i }}
                />
              ))}
              <span className="-ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-border bg-chip px-1 font-mono text-[8.5px] font-semibold text-muted-2 ring-[2px] ring-white">
                +2
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
