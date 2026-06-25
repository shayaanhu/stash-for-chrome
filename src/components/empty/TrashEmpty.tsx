import { Trash2 } from "lucide-react";
import { motion } from "motion/react";

/**
 * Trash empty state. Deliberately the material inverse of the Library preview:
 * instead of a raised stack of cards (content present), this is an empty,
 * carved-out "holding bay" recessed into the canvas, with a trash glyph
 * floating above its own cast shadow. Reads as "the bay where deleted sessions
 * rest is empty" — a distinct concept, not the Library card with the lights off.
 */
export function TrashEmpty({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      className="relative mx-auto flex h-[122px] w-[268px] items-center justify-center"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* recessed holding bay — carved into the surface (inset, not raised) */}
      <div className="relative flex h-[104px] w-[228px] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-border/60 bg-surface-muted/70 shadow-[inset_0_2px_8px_var(--inset-groove),inset_0_-1px_0_var(--inset-hl-soft)]">
        {/* cast shadow on the bay floor — shrinks as the glyph rises */}
        <motion.span
          className="absolute bottom-[26px] h-[7px] w-[38px] rounded-full bg-[var(--scrim)] blur-[3px]"
          animate={reduceMotion ? undefined : { scaleX: [1, 0.82, 1], opacity: [0.5, 0.32, 0.5] }}
          transition={reduceMotion ? undefined : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* floating trash glyph */}
        <motion.div
          className="relative mb-2"
          style={reduceMotion ? undefined : { willChange: "transform" }}
          animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
          transition={reduceMotion ? undefined : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Trash2 size={30} strokeWidth={1.5} className="text-muted-2" />
        </motion.div>
      </div>
    </motion.div>
  );
}
