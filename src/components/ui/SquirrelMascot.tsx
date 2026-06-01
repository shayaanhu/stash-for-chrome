import { motion } from "motion/react";

export type MascotState = "idle" | "saving" | "saved" | "reduced";

interface SquirrelMascotProps {
  state: MascotState;
  className?: string;
  reduceMotion?: boolean;
}

export function SquirrelMascot({ state, className, reduceMotion = false }: SquirrelMascotProps) {
  // If reduced motion is requested, render a simplified static cute pose
  const isReduced = reduceMotion || state === "reduced";

  // Framer Motion spring and transition variants
  const tailVariants = {
    idle: {
      rotate: [0, 6, -3, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    saving: {
      rotate: [0, -12, 12, -12, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    saved: {
      rotate: [0, -25, 20, -25, 20, 0],
      scale: 1.05,
      transition: {
        duration: 0.8,
        repeat: 3,
        ease: "easeOut" as const,
      },
    },
  };

  const eyeVariants = {
    idle: {
      scaleY: [1, 1, 0.1, 1, 1, 1, 0.1, 1],
      transition: {
        duration: 5,
        repeat: Infinity,
        times: [0, 0.45, 0.47, 0.49, 0.8, 0.82, 0.84, 1],
      },
    },
    saving: {
      scaleY: 0.8, // focused squint
    },
    saved: {
      scaleY: 1,
    },
  };

  const bodyVariants = {
    idle: {
      y: [0, -2, 0],
      scaleY: [1, 1.02, 1],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    saving: {
      y: [0, -4, 0],
      scaleY: [1, 1.05, 1],
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    saved: {
      y: [0, -15, 0],
      scale: [1, 1.1, 0.95, 1],
      transition: {
        duration: 0.8,
        ease: "easeInOut" as const,
      },
    },
  };

  const armVariants = {
    idle: {
      rotate: 0,
    },
    saving: {
      rotate: [0, 15, -15, 0],
      transition: {
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    saved: {
      y: -10,
      rotate: [0, 160, 130, 160, 0],
      transition: {
        duration: 1.2,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <div className={`relative flex flex-col items-center justify-center ${className || ""}`}>
      {/* Sparkles / Delight Effects in Saved State */}
      {!isReduced && state === "saved" && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Left Sparkle */}
          <motion.div
            className="absolute left-[15%] top-[20%] h-3 w-3 rounded-full bg-accent"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0], y: -20, x: -10 }}
            transition={{ duration: 1.2, delay: 0.1 }}
          />
          {/* Right Sparkle */}
          <motion.div
            className="absolute right-[15%] top-[25%] h-2.5 w-2.5 rounded-full bg-[#FFF2BD]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 0], opacity: [0, 1, 0], y: -25, x: 12 }}
            transition={{ duration: 1, delay: 0.2 }}
          />
          {/* Top Sparkle */}
          <motion.div
            className="absolute left-[45%] top-[5%] h-3.5 w-3.5 rounded-full bg-accent"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 0], opacity: [0, 1, 0], y: -30 }}
            transition={{ duration: 1.4, delay: 0.3 }}
          />
        </div>
      )}

      {/* SVG Canvas */}
      <motion.svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        animate={isReduced ? undefined : state}
      >
        <g id="Squirrel">
          {/* TAIL (drawn behind body) */}
          <motion.g
            id="Tail"
            variants={tailVariants}
            style={{ originX: "40px", originY: "105px" }}
          >
            {/* Fluffy tail base */}
            <path
              d="M42 105C30 90 20 60 40 35C52 20 70 25 72 40C74 55 60 70 65 85C70 100 55 110 42 105Z"
              fill="#D29628" // warm ocher fur
              stroke="#1C336B" // standard Ink outline
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Inner fluffy tail highlight */}
            <path
              d="M48 95C38 82 32 62 43 45C50 35 60 38 61 46C62 54 52 64 56 78C60 92 53 97 48 95Z"
              fill="#EADBB0" // buttermilk shade fur
              opacity="0.95"
            />
          </motion.g>

          {/* FEET / LEGS */}
          <g id="Feet">
            {/* Left foot */}
            <rect
              x="50"
              y="110"
              width="15"
              height="8"
              rx="4"
              fill="#C2685F" // contrasting soft terracotta/red accent-soft
              stroke="#1C336B"
              strokeWidth="3"
            />
            {/* Right foot */}
            <rect
              x="75"
              y="110"
              width="15"
              height="8"
              rx="4"
              fill="#C2685F"
              stroke="#1C336B"
              strokeWidth="3"
            />
          </g>

          {/* BODY & HEAD GROUP */}
          <motion.g id="BodyAndHead" variants={bodyVariants} style={{ originX: "70px", originY: "110px" }}>
            {/* Main body body oval */}
            <path
              d="M45 80C45 62 52 55 70 55C88 55 95 62 95 80C95 98 88 112 70 112C52 112 45 98 45 80Z"
              fill="#D29628"
              stroke="#1C336B"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Tummy patch */}
            <path
              d="M55 85C55 73 60 67 70 67C80 67 85 73 85 85C85 97 80 105 70 105C60 105 55 97 55 85Z"
              fill="#FFFEFA" // warm white surface
              stroke="#1C336B"
              strokeWidth="2"
              opacity="0.9"
            />

            {/* EARS */}
            {/* Left ear */}
            <path
              d="M50 25C47 12 55 8 58 18L64 35L50 35V25Z"
              fill="#D29628"
              stroke="#1C336B"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M53 24C51 16 55 13 56 19L60 32L53 32V24Z" fill="#C2685F" />
            {/* Right ear */}
            <path
              d="M90 25C93 12 85 8 82 18L76 35L90 35V25Z"
              fill="#D29628"
              stroke="#1C336B"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M87 24C89 16 85 13 84 19L80 32L87 32V24Z" fill="#C2685F" />

            {/* HEAD */}
            <path
              d="M48 40C48 28 58 25 70 25C82 25 92 28 92 40C92 52 82 58 70 58C58 58 48 52 48 40Z"
              fill="#D29628"
              stroke="#1C336B"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />

            {/* EYES */}
            {/* Left Eye */}
            <motion.ellipse
              cx="60"
              cy="38"
              rx="4.5"
              ry="5.5"
              fill="#1C336B"
              variants={eyeVariants}
              style={{ originX: "60px", originY: "38px" }}
            />
            {/* Left eye reflection */}
            <circle cx="58.5" cy="36" r="1.5" fill="#FFFEFA" />

            {/* Right Eye */}
            <motion.ellipse
              cx="80"
              cy="38"
              rx="4.5"
              ry="5.5"
              fill="#1C336B"
              variants={eyeVariants}
              style={{ originX: "80px", originY: "38px" }}
            />
            {/* Right eye reflection */}
            <circle cx="78.5" cy="36" r="1.5" fill="#FFFEFA" />

            {/* CHEEKS */}
            <circle cx="53" cy="45" r="3" fill="#C2685F" opacity="0.6" />
            <circle cx="87" cy="45" r="3" fill="#C2685F" opacity="0.6" />

            {/* NOSE */}
            <polygon points="68,43 72,43 70,45" fill="#1C336B" stroke="#1C336B" strokeWidth="1.5" />

            {/* MOUTH */}
            <path d="M68 47C69 48 70 48.5 70 48.5C70 48.5 71 48 72 47" stroke="#1C336B" strokeWidth="1.5" strokeLinecap="round" />

            {/* ACORN / TAB STACK held by squirrel */}
            <motion.g
              id="HeldItem"
              animate={state === "saved" ? { scale: [1, 1.4, 1.2], y: -5 } : { scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {state === "saved" ? (
                // Beautiful glowing blue tab stack when saved
                <g transform="translate(62, 58)">
                  <rect x="-6" y="-4" width="28" height="18" rx="4" fill="#285CCC" stroke="#1C336B" strokeWidth="2.5" />
                  <rect x="-3" y="-1" width="22" height="12" rx="2" fill="#FFFEFA" />
                  {/* Miniature tab header line */}
                  <line x1="-3" y1="3" x2="19" y2="3" stroke="#1C336B" strokeWidth="1.5" />
                  {/* Glowing star effect */}
                  <path d="M22, -8 L24, -3 L29, -3 L25, 0 L27, 5 L22, 2 L17, 5 L19, 0 L15, -3 L20, -3 Z" fill="#EADBB0" stroke="#1C336B" strokeWidth="1" />
                </g>
              ) : (
                // Traditional cute acorn when idle/saving
                <g transform="translate(63, 62)">
                  {/* Acorn cup */}
                  <path d="M2 -2C2 -2 4 4 12 4C20 4 22 -2 22 -2C22 -2 21 -6 12 -6C3 -6 2 -2 2 -2Z" fill="#1C336B" />
                  <rect x="11" y="-9" width="2" height="4" fill="#1C336B" />
                  {/* Acorn nut */}
                  <path d="M4 -1C4 7 8 13 12 15C16 13 20 7 20 -1H4Z" fill="#C2685F" stroke="#1C336B" strokeWidth="2.5" strokeLinejoin="round" />
                </g>
              )}
            </motion.g>

            {/* ARMS */}
            {/* Left Arm */}
            <motion.g id="LeftArm" variants={armVariants} style={{ originX: "48px", originY: "68px" }}>
              <path
                d="M48 68C42 68 40 78 48 80C54 81 60 76 60 70"
                stroke="#1C336B"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M48 69C44 69 42 77 48 78C53 79 57 75 58 71"
                stroke="#D29628"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </motion.g>
            {/* Right Arm */}
            <motion.g id="RightArm" variants={armVariants} style={{ originX: "92px", originY: "68px" }}>
              <path
                d="M92 68C98 68 100 78 92 80C86 81 80 76 80 70"
                stroke="#1C336B"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M92 69C96 69 98 77 92 78C87 79 83 75 82 71"
                stroke="#D29628"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </motion.g>
          </motion.g>
        </g>
      </motion.svg>

      {/* Label under Mascot */}
      {state === "saved" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.2 }}
          className="absolute -bottom-2 bg-success-soft border border-success-border text-accent-text text-[11px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full shadow-xs"
        >
          Tucked Away!
        </motion.div>
      )}
    </div>
  );
}
