import { motion } from "motion/react";
import { cn } from "../../lib/utils";

export type MascotState = "idle" | "save" | "trash-empty" | "search-miss" | "reduced";

export function StashMascot({
  state,
  reduceMotion,
  className
}: {
  state: MascotState;
  reduceMotion: boolean;
  className?: string;
}) {
  const activeState = reduceMotion ? "reduced" : state;
  const isSearching = activeState === "search-miss";
  const isSaving = activeState === "save";
  const isSweeping = activeState === "trash-empty";

  return (
    <motion.svg
      width="132"
      height="116"
      viewBox="0 0 132 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("overflow-visible", className)}
      aria-hidden="true"
      initial={false}
      animate={
        activeState === "idle"
          ? { y: [0, -1, 0] }
          : activeState === "search-miss"
            ? { rotate: [0, -2, 2, 0] }
            : { y: 0, rotate: 0 }
      }
      transition={
        activeState === "idle"
          ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <motion.path
        d="M84 35C98 18 121 28 116 50C112 68 94 76 78 67"
        fill="var(--color-bg)"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        animate={activeState === "idle" ? { rotate: [0, 1.5, 0] } : { rotate: 0 }}
        transition={{ duration: 4, repeat: activeState === "idle" ? Infinity : 0, ease: "easeInOut" }}
        style={{ transformOrigin: "82px 62px" }}
      />
      <path
        d="M40 53C40 35 52 24 68 24C84 24 94 36 94 53V70C94 90 82 101 66 101C50 101 40 90 40 70V53Z"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth="3"
      />
      <path
        d="M52 31L45 16L62 24"
        fill="var(--color-accent)"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M78 24L93 15L88 33"
        fill="var(--color-accent)"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M56 58C58.2091 58 60 56.2091 60 54C60 51.7909 58.2091 50 56 50C53.7909 50 52 51.7909 52 54C52 56.2091 53.7909 58 56 58Z"
        fill="var(--color-ink)"
      />
      <motion.path
        d="M78 58C80.2091 58 82 56.2091 82 54C82 51.7909 80.2091 50 78 50C75.7909 50 74 51.7909 74 54C74 56.2091 75.7909 58 78 58Z"
        fill="var(--color-ink)"
        animate={activeState === "idle" ? { scaleY: [1, 1, 0.12, 1, 1] } : { scaleY: 1 }}
        transition={{ duration: 3.7, repeat: activeState === "idle" ? Infinity : 0, times: [0, 0.72, 0.75, 0.78, 1] }}
        style={{ transformOrigin: "78px 54px" }}
      />
      <path
        d="M66 61L70 65L64 65L66 61Z"
        fill="var(--color-accent)"
        stroke="var(--color-ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <motion.path
        d={isSearching ? "M59 74C64 70 72 70 77 74" : "M59 73C64 77 72 77 77 73"}
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <motion.path
        d="M48 73C38 74 30 79 26 88"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        animate={isSaving ? { rotate: [0, -18, 0], x: [0, 5, 0] } : { rotate: 0, x: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "48px 73px" }}
      />
      <motion.path
        d="M84 73C94 75 101 80 105 88"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        animate={
          isSweeping
            ? { rotate: [0, 16, -8, 0], x: [0, 2, -2, 0] }
            : isSaving
              ? { rotate: [0, 18, 0], x: [0, -5, 0] }
              : { rotate: 0, x: 0 }
        }
        transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "84px 73px" }}
      />
      <motion.g
        animate={isSaving ? { y: [0, 7], opacity: [1, 0] } : { y: 0, opacity: 1 }}
        transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      >
        <rect x="56" y="80" width="23" height="14" rx="4" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="3" />
        <path d="M61 86H74" stroke="var(--color-bg)" strokeWidth="2" strokeLinecap="round" />
      </motion.g>
      {isSweeping ? (
        <motion.g
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: [0, 1, 0], x: [6, 0, -8] }}
          transition={{ duration: 0.7, ease: [0.2, 0, 0, 1] }}
        >
          <path d="M101 95H116" stroke="var(--color-border)" strokeWidth="3" strokeLinecap="round" />
          <path d="M106 101H121" stroke="var(--color-border)" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
      ) : null}
      {isSearching ? (
        <motion.path
          d="M96 39L104 31M105 42L116 39"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
        />
      ) : null}
    </motion.svg>
  );
}
