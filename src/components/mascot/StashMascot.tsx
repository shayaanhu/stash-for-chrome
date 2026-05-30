import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/utils";

export type MascotState = "idle" | "save" | "trash-empty" | "search-miss" | "reduced";

const INK = "#1f1b16";
const FUR = "#e7ac80";
const FUR_DARK = "#dc966a";
const BELLY = "#f8efe1";
const TAIL = "#c26847";
const TAIL_HI = "#d2825f";
const NUT = "#c9a06b";
const STROKE = 3.2;

export function StashMascot({
  state,
  reduceMotion,
  className
}: {
  state: MascotState;
  reduceMotion: boolean;
  className?: string;
}) {
  const activeState: MascotState = reduceMotion ? "reduced" : state;
  const loop = activeState === "idle";
  const isSaving = activeState === "save";
  const isSearching = activeState === "search-miss";
  const isSweeping = activeState === "trash-empty";

  return (
    <motion.svg
      width="130"
      height="120"
      viewBox="0 0 140 126"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("overflow-visible", className)}
      aria-hidden="true"
      style={{ transformOrigin: "70px 116px" }}
      animate={
        isSaving
          ? { y: [0, -7, 0], rotate: 0 }
          : isSearching
            ? { rotate: [0, -4, 4, -2, 0], y: 0 }
            : loop
              ? { y: [0, -2.5, 0], rotate: 0 }
              : { y: 0, rotate: 0 }
      }
      transition={
        isSaving
          ? { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
          : isSearching
            ? { duration: 0.6, ease: "easeInOut" }
            : loop
              ? { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.3 }
      }
    >
      {/* Tail — terracotta curl behind the body */}
      <g transform="translate(-7 3)">
        <motion.g
          style={{ transformOrigin: "104px 96px" }}
          animate={loop ? { rotate: [0, 3, 0] } : { rotate: 0 }}
          transition={loop ? { duration: 4.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
        >
          <path
            d="M94 104C124 102 134 66 116 44C105 31 86 35 85 51"
            fill="none"
            stroke={INK}
            strokeWidth="23"
            strokeLinecap="round"
          />
          <path
            d="M94 104C124 102 134 66 116 44C105 31 86 35 85 51"
            fill="none"
            stroke={TAIL}
            strokeWidth="17"
            strokeLinecap="round"
          />
          <path
            d="M99 99C120 96 127 68 113 50"
            fill="none"
            stroke={TAIL_HI}
            strokeWidth="5"
            strokeLinecap="round"
          />
        </motion.g>
      </g>

      {/* Feet */}
      <ellipse cx="49" cy="118" rx="9.5" ry="5.5" fill={FUR_DARK} stroke={INK} strokeWidth={STROKE} />
      <ellipse cx="77" cy="118" rx="9.5" ry="5.5" fill={FUR_DARK} stroke={INK} strokeWidth={STROKE} />

      {/* Ears (behind head) */}
      <path d="M45 33C40 13 54 9 62 27C56 30 50 32 45 33Z" fill={FUR} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M79 33C84 13 70 9 62 27C68 30 74 32 79 33Z" fill={FUR} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M50 28C48 19 55 18 58 26Z" fill={TAIL} />
      <path d="M74 28C76 19 69 18 66 26Z" fill={TAIL} />

      {/* Body + belly */}
      <ellipse cx="62" cy="88" rx="28" ry="30" fill={FUR} stroke={INK} strokeWidth={STROKE} />
      <ellipse cx="62" cy="93" rx="17" ry="20" fill={BELLY} />

      {/* Head */}
      <circle cx="62" cy="50" r="26" fill={FUR} stroke={INK} strokeWidth={STROKE} />

      {/* Cheeks */}
      <ellipse cx="44" cy="56" rx="5.5" ry="3.6" fill={TAIL} opacity="0.32" />
      <ellipse cx="80" cy="56" rx="5.5" ry="3.6" fill={TAIL} opacity="0.32" />

      {/* Eyes (blink on loop) */}
      <motion.g
        animate={loop ? { scaleY: [1, 1, 0.1, 1, 1] } : { scaleY: 1 }}
        transition={
          loop
            ? { duration: 3.6, repeat: Infinity, times: [0, 0.82, 0.86, 0.9, 1], ease: "easeInOut" }
            : { duration: 0.2 }
        }
        style={{ transformOrigin: "62px 48px" }}
      >
        <ellipse cx="53" cy="48" rx="4.6" ry="5.4" fill={INK} />
        <ellipse cx="71" cy="48" rx="4.6" ry="5.4" fill={INK} />
        <circle cx="54.7" cy="46" r="1.5" fill="#fff" />
        <circle cx="72.7" cy="46" r="1.5" fill="#fff" />
      </motion.g>

      {/* Nose + mouth */}
      <path d="M58 56H66L62 61Z" fill={INK} />
      <path
        d="M62 61C62 65 58.5 66 56.5 64M62 61C62 65 65.5 66 67.5 64"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Acorn + paws (tucked away on save) */}
      <motion.g
        animate={isSaving ? { y: 14, opacity: 0 } : { y: 0, opacity: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "62px 92px" }}
      >
        <path d="M53 90Q53 107 62 107Q71 107 71 90Z" fill={NUT} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
        <path d="M50 90Q62 77 74 90Z" fill={TAIL} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
        <path d="M62 78V72" stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
        <ellipse cx="49" cy="95" rx="6" ry="5" fill={FUR} stroke={INK} strokeWidth={STROKE} />
        <ellipse cx="75" cy="95" rx="6" ry="5" fill={FUR} stroke={INK} strokeWidth={STROKE} />
      </motion.g>

      {/* Search-miss: question mark */}
      <AnimatePresence>
        {isSearching ? (
          <motion.text
            key="q"
            x="104"
            y="34"
            fill={TAIL}
            fontSize="26"
            fontWeight="800"
            fontFamily="Geist Variable, Inter, sans-serif"
            initial={{ opacity: 0, y: 40, scale: 0.6 }}
            animate={{ opacity: 1, y: 34, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            ?
          </motion.text>
        ) : null}
      </AnimatePresence>

      {/* Trash-empty: sparkles */}
      <AnimatePresence>
        {isSweeping ? (
          <motion.g key="sparkle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {[
              { x: 102, y: 40, d: 0 },
              { x: 116, y: 58, d: 0.12 },
              { x: 98, y: 66, d: 0.22 }
            ].map((s) => (
              <motion.path
                key={`${s.x}-${s.y}`}
                d={`M${s.x} ${s.y - 5}L${s.x + 1.6} ${s.y - 1.6}L${s.x + 5} ${s.y}L${s.x + 1.6} ${s.y + 1.6}L${s.x} ${s.y + 5}L${s.x - 1.6} ${s.y + 1.6}L${s.x - 5} ${s.y}L${s.x - 1.6} ${s.y - 1.6}Z`}
                fill={TAIL_HI}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: s.d, ease: "easeInOut" }}
                style={{ transformOrigin: `${s.x}px ${s.y}px` }}
              />
            ))}
          </motion.g>
        ) : null}
      </AnimatePresence>
    </motion.svg>
  );
}
