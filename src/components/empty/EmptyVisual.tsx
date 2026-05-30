import { Search, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

export type EmptyVariant = "library" | "trash" | "search";

const SPINES = ["bg-accent", "bg-success", "bg-danger"] as const;

export function EmptyVisual({ variant, reduceMotion }: { variant: EmptyVariant; reduceMotion: boolean }) {
  return (
    <motion.div
      className="relative mx-auto h-[104px] w-[160px]"
      animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
      transition={reduceMotion ? undefined : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    >
      {variant === "library" ? <CardDeck reduceMotion={reduceMotion} /> : null}
      {variant === "trash" ? <GhostCard icon={<Trash2 size={20} />} /> : null}
      {variant === "search" ? <GhostCard icon={<Search size={20} />} accent /> : null}
    </motion.div>
  );
}

function CardDeck({ reduceMotion }: { reduceMotion: boolean }) {
  // back → front; the front card is the hero
  const cards = [
    { rotate: -7, x: -16, y: 12, scale: 0.9, opacity: 0.5, spine: 2 },
    { rotate: 4, x: 14, y: 6, scale: 0.95, opacity: 0.8, spine: 1 },
    { rotate: -1.5, x: 0, y: 0, scale: 1, opacity: 1, spine: 0 }
  ];

  return (
    <>
      {cards.map((card, index) => (
        <motion.div
          key={index}
          className="absolute left-1/2 top-1/2 h-[74px] w-[128px] -translate-x-1/2 -translate-y-1/2 rounded-[13px] border border-border bg-surface p-3 shadow-[var(--shadow-soft)]"
          style={{ zIndex: index, opacity: card.opacity }}
          initial={reduceMotion ? false : { opacity: 0, y: 14, rotate: card.rotate }}
          animate={{
            opacity: card.opacity,
            x: card.x,
            y: card.y,
            rotate: card.rotate,
            scale: card.scale
          }}
          transition={{
            duration: 0.45,
            delay: reduceMotion ? 0 : index * 0.08,
            ease: [0.22, 1, 0.36, 1]
          }}
        >
          <span className={cn("absolute bottom-3 left-3 top-3 w-[3px] rounded-full", SPINES[card.spine])} />
          <div className="ml-3 flex h-full flex-col justify-center gap-2">
            <div className="h-2.5 w-[70%] rounded-full bg-surface-muted" />
            <div className="h-2 w-[42%] rounded-full bg-chip" />
            <div className="mt-1 flex gap-1.5">
              {[0, 1, 2].map((dot) => (
                <span key={dot} className="h-3 w-3 rounded-[4px] border border-border bg-chip" />
              ))}
            </div>
          </div>
        </motion.div>
      ))}
    </>
  );
}

function GhostCard({ icon, accent = false }: { icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className="absolute left-1/2 top-1/2 flex h-[74px] w-[128px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[13px] border-2 border-dashed border-border bg-surface-subtle">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", accent ? "bg-accent/12 text-accent" : "bg-surface-muted text-muted")}>
        {icon}
      </span>
    </div>
  );
}
