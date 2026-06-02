import { Check, Loader2, MousePointerClick, PanelTopClose, Pin, Keyboard as KeyboardIcon, RotateCcw } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { sendBackgroundRequest } from "../shared/messages";
import { getSettings } from "../shared/storage";
import type { SaveTarget } from "../shared/types";
import { toast } from "sonner";
import { Toaster } from "../components/ui/toaster";

type Phase = "idle" | "saving" | "saved" | "error";

export function OnboardingApp() {
  const reduceMotion = useReducedMotion();
  const [saveTarget, setSaveTarget] = useState<SaveTarget>("current-window");
  const [phase, setPhase] = useState<Phase>("idle");
  const [savedCount, setSavedCount] = useState(0);

  // Keyboard shortcut listener states
  const [isMac, setIsMac] = useState(false);
  const [pressedKeys, setPressedKeys] = useState({ ctrl: false, shift: false, s: false });

  // Auto-play active index for the 3 visual simulation cards
  const [activeSimIndex, setActiveSimIndex] = useState(0);

  useEffect(() => {
    // Detect OS for shortcut display
    setIsMac(navigator.userAgent.toUpperCase().includes("MAC"));

    void getSettings().then((s) => setSaveTarget(s.saveTarget));
  }, []);

  // Run the sequential auto-play simulation loop every 5.5 seconds
  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setActiveSimIndex((prev) => (prev + 1) % 3);
    }, 5550);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  // Monitor keyboard shortcut keypresses (Ctrl+Shift+S or Cmd+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = isMac ? e.metaKey : e.ctrlKey;
      const isShift = e.shiftKey;
      const isS = e.key.toLowerCase() === "s";

      setPressedKeys({
        ctrl: isModifier,
        shift: isShift,
        s: isS,
      });

      if (isModifier && isShift && isS) {
        e.preventDefault();
        if (phase === "idle" || phase === "error") {
          void handleSave();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isModifier = isMac ? e.metaKey : e.ctrlKey;
      const isShift = e.shiftKey;
      const isS = e.key.toLowerCase() === "s";

      setPressedKeys({
        ctrl: isModifier,
        shift: isShift,
        s: isS,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isMac, phase, saveTarget]);

  async function handleSave() {
    setPhase("saving");
    const response = await sendBackgroundRequest({ type: "SAVE_TABS", target: saveTarget });
    if (!response.ok || !response.session) {
      const errMsg = response.ok ? "No saveable tabs found in this window." : response.error;
      toast.error(errMsg);
      setPhase("error");
      return;
    }
    setSavedCount(response.session.tabs.length);
    setPhase("saved");
  }

  // Stagger variants for the onboarding layout entrance
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 24,
      },
    },
  };

  // Stash wordmark split letters
  const stashLetters = ["S", "t", "a", "s", "h"];

  const wordmarkContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.15,
      }
    }
  };

  const letterVariants = {
    hidden: { y: -30, opacity: 0, scale: 0.7, rotate: -10 },
    show: {
      y: 0,
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring" as const,
        stiffness: 320,
        damping: 14,
      }
    }
  };

  return (
    <main className="paper-bg relative flex min-h-screen items-center justify-center overflow-x-hidden px-6 py-12 text-ink">
      {/* Decorative Floating Backdrop Tabs */}
      {!reduceMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Tab 1 */}
          <motion.div
            className="absolute left-[8%] top-[15%] flex items-center gap-2 rounded-lg border border-border/40 bg-surface/40 px-3 py-2 shadow-xs backdrop-blur-[2px]"
            animate={
              phase === "saving"
                ? { x: 300, y: 200, scale: 0.2, opacity: 0 }
                : { y: [0, -12, 0], rotate: [-2, 1, -2] }
            }
            transition={{ duration: phase === "saving" ? 0.6 : 6, repeat: phase === "saving" ? 0 : Infinity, ease: "easeInOut" as const }}
          >
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-mono text-[10.5px] text-muted-2/80">reddit.com</span>
          </motion.div>
          {/* Tab 2 */}
          <motion.div
            className="absolute right-[10%] top-[12%] flex items-center gap-2 rounded-lg border border-border/40 bg-surface/40 px-3 py-2 shadow-xs backdrop-blur-[2px]"
            animate={
              phase === "saving"
                ? { x: -300, y: 220, scale: 0.2, opacity: 0 }
                : { y: [0, -8, 0], rotate: [1, -2, 1] }
            }
            transition={{ duration: phase === "saving" ? 0.65 : 7, repeat: phase === "saving" ? 0 : Infinity, ease: "easeInOut" as const }}
          >
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            <span className="font-mono text-[10.5px] text-muted-2/80">news.ycombinator.com</span>
          </motion.div>
          {/* Tab 3 */}
          <motion.div
            className="absolute left-[6%] bottom-[20%] flex items-center gap-2 rounded-lg border border-border/40 bg-surface/40 px-3 py-2 shadow-xs backdrop-blur-[2px]"
            animate={
              phase === "saving"
                ? { x: 300, y: -200, scale: 0.2, opacity: 0 }
                : { y: [0, -15, 0], rotate: [2, -1, 2] }
            }
            transition={{ duration: phase === "saving" ? 0.55 : 8, repeat: phase === "saving" ? 0 : Infinity, ease: "easeInOut" as const }}
          >
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="font-mono text-[10.5px] text-muted-2/80">wikipedia.org</span>
          </motion.div>
          {/* Tab 4 */}
          <motion.div
            className="absolute right-[8%] bottom-[25%] flex items-center gap-2 rounded-lg border border-border/40 bg-surface/40 px-3 py-2 shadow-xs backdrop-blur-[2px]"
            animate={
              phase === "saving"
                ? { x: -300, y: -180, scale: 0.2, opacity: 0 }
                : { y: [0, -10, 0], rotate: [-1, 2, -1] }
            }
            transition={{ duration: phase === "saving" ? 0.6 : 6.5, repeat: phase === "saving" ? 0 : Infinity, ease: "easeInOut" as const }}
          >
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            <span className="font-mono text-[10.5px] text-muted-2/80">github.com</span>
          </motion.div>
        </div>
      )}

      {/* Main Container */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-[920px] text-center"
      >
        {/* Headline — fixed layout. "Welcome to" is absolute and the underline only
            fades, so NOTHING here changes height. The wordmark never reflows. */}
        <motion.div
          variants={itemVariants}
          animate={{ y: phase === "saved" ? -10 : 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-2 mt-4 select-none flex flex-col items-center"
        >
          {/* "Welcome to" — absolute, so its removal can't shift the wordmark */}
          <AnimatePresence>
            {phase !== "saved" && (
              <motion.p
                key="welcome"
                initial={false}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.28, ease: "easeOut" as const } }}
                className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[14px] font-extrabold uppercase tracking-[0.25em] text-muted select-none"
              >
                Welcome to
              </motion.p>
            )}
          </AnimatePresence>

          <motion.h1
            variants={wordmarkContainer}
            initial="hidden"
            animate="show"
            className="wordmark mt-7 text-[68px] leading-none text-ink select-none flex justify-center items-center gap-1.5"
          >
            {stashLetters.map((char, i) => (
              <motion.span
                key={i}
                variants={letterVariants}
                animate={
                  phase === "saved" && !reduceMotion
                    ? {
                        scale: [1, 1.16, 1],
                        transition: { type: "spring", stiffness: 340, damping: 12, delay: 0.1 + i * 0.05 }
                      }
                    : { scale: 1 }
                }
                className="inline-block"
              >
                {char}
              </motion.span>
            ))}
          </motion.h1>

          {/* Underline — always rendered (reserves its space); only fades out on save */}
          <motion.div
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 1, opacity: phase === "saved" ? 0 : 1 }}
            transition={{
              scaleX: { duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.3 },
            }}
            className="h-[2px] bg-accent/25 w-[100px] mx-auto mt-4 origin-center rounded-full"
          />
        </motion.div>

        {/* Fixed-height stage — its height never changes between states, so the
            vertically-centered page never recenters. Button and card simply
            crossfade INSIDE this slot. Zero layout shift = zero jar. */}
        <motion.div
          variants={itemVariants}
          className="relative z-10 mt-6 flex min-h-[268px] items-center justify-center"
        >
          <AnimatePresence mode="wait" initial={false}>
            {phase === "saved" ? (
              <motion.div
                key="saved"
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
                whileHover={reduceMotion ? undefined : { y: -4, boxShadow: "0 18px 46px -10px rgba(20,35,80,0.34)", transition: { duration: 0.25, ease: "easeOut" } }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative mx-auto max-w-[440px] cursor-default overflow-hidden rounded-[22px] border border-success-border bg-surface px-8 py-9 shadow-[var(--shadow-pop)]"
              >
                {/* soft accent glow behind the card content */}
                {!reduceMotion && (
                  <motion.div
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, delay: 0.25 }}
                    className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-accent/10 blur-2xl"
                  />
                )}

                {/* Checkmark with an expanding ring burst */}
                <div className="relative mx-auto h-14 w-14">
                  {!reduceMotion && (
                    <>
                      <motion.span
                        className="absolute inset-0 rounded-full bg-accent/30"
                        initial={{ scale: 0.6, opacity: 0.7 }}
                        animate={{ scale: 2.4, opacity: 0 }}
                        transition={{ duration: 0.9, delay: 0.35, ease: "easeOut" as const }}
                      />
                      <motion.span
                        className="absolute inset-0 rounded-full border-2 border-accent/40"
                        initial={{ scale: 0.8, opacity: 0.8 }}
                        animate={{ scale: 1.8, opacity: 0 }}
                        transition={{ duration: 0.7, delay: 0.47, ease: "easeOut" as const }}
                      />
                    </>
                  )}
                  <motion.div
                    initial={reduceMotion ? false : { scale: 0, rotate: -40 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.28 }}
                    className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-[#FFF2BD] shadow-[var(--shadow-primary)]"
                  >
                    <Check size={26} strokeWidth={3} />
                  </motion.div>
                </div>

                <motion.p
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-5 font-display display-emphasis text-[23px] font-semibold text-ink"
                >
                  Saved {savedCount} {savedCount === 1 ? "tab" : "tabs"}.
                </motion.p>
                <motion.p
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.54, ease: [0.16, 1, 0.3, 1] }}
                  className="mx-auto mt-2.5 max-w-[330px] text-[13.5px] leading-relaxed text-muted"
                >
                  Your tabs are safe. Click the <span className="font-bold text-accent">Stash icon</span> in your toolbar anytime to bring them back.
                </motion.p>
              </motion.div>
            ) : (
              <motion.div
                key="cta"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
                className="flex flex-col items-center justify-center gap-8"
              >
                <p className="mx-auto max-w-[480px] text-[16px] leading-relaxed text-muted">
                  Save the tabs you don't need now, and bring the whole set back in a single click.
                  <span className="block mt-1 font-medium text-ink/80">Close the clutter without losing the trail.</span>
                </p>

                <div className="relative inline-block">
                  {/* Soft pulsing brand halo ring around button */}
                  {phase === "idle" && !reduceMotion && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-accent/20 pointer-events-none"
                      animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0, 0.35] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" as const }}
                    />
                  )}
                  <motion.div
                    whileHover={phase === "saving" ? undefined : { scale: 1.04 }}
                    whileTap={phase === "saving" ? undefined : { scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 600, damping: 22 }}
                    className="relative z-10"
                  >
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      disabled={phase === "saving"}
                      className="h-14 px-10 text-[15.5px] font-bold rounded-full gap-2.5 shadow-[var(--shadow-primary)] hover:shadow-[var(--shadow-primary-hover)] active:shadow-[var(--shadow-press)]"
                    >
                      {phase === "saving" ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <PanelTopClose size={18} />
                      )}
                      {phase === "saving" ? "Stashing tabs..." : "Stash my open tabs now"}
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Redesigned Elevated Feature Cards (Grid rearranged: Shortcut first, Restore second, Pin third) */}
        <motion.div
          variants={itemVariants}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-[880px] mx-auto"
        >
          {/* Card 1: Chrome Keyboard Shortcut */}
          <InteractiveCard
            title="Chrome Shortcut"
            copy="Press the key combination to sweep your workspace instantly without lifting your hands."
            icon={<KeyboardIcon size={16} />}
            isActive={activeSimIndex === 0}
          >
            <ShortcutSimulation isActive={activeSimIndex === 0} isMac={isMac} pressedKeys={pressedKeys} />
          </InteractiveCard>

          {/* Card 2: Single-Click Restore */}
          <InteractiveCard
            title="Single-Click Restore"
            copy="Hover over any stashed session in the Library and click the circular Restore button to bring all tabs back instantly."
            icon={<RotateCcw size={16} />}
            isActive={activeSimIndex === 1}
          >
            <RestoreSimulation isActive={activeSimIndex === 1} />
          </InteractiveCard>

          {/* Card 3: Pin for Speed */}
          <InteractiveCard
            title="Keep Within Reach"
            copy="Pin Stash so it remains one click away. A cluttered browser is resolved in a split second."
            icon={<Pin size={16} />}
            isActive={activeSimIndex === 2}
          >
            <PinSimulation isActive={activeSimIndex === 2} />
          </InteractiveCard>
        </motion.div>
      </motion.div>

      {/* Warm Global Toaster */}
      <Toaster />
    </main>
  );
}

// Wrapper component for the Interactive Feature Cards
function InteractiveCard({
  title,
  copy,
  icon,
  children,
  isActive,
}: {
  title: string;
  copy: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive: boolean;
}) {
  return (
    <motion.div
      animate={isActive ? { y: -4 } : { y: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 20 }}
      className={`group flex flex-col justify-between rounded-2xl border p-5 transition-all duration-500 shadow-xs ${
        isActive
          ? "border-accent bg-surface shadow-[0_0_15px_rgba(40,92,204,0.1)] scale-[1.01]"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      {/* Mockup Animation Visual area */}
      <div className="w-full h-[120px] rounded-lg border border-border/80 bg-surface-subtle overflow-hidden flex items-center justify-center relative select-none">
        {children}
      </div>

      {/* Description Info area */}
      <div className="mt-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-[var(--dur-base)] ${
            isActive ? "bg-accent text-[#FFF2BD]" : "bg-accent-soft text-accent-text"
          }`}>
            {icon}
          </span>
          <h3 className={`font-display display-title text-[15.5px] font-semibold leading-snug transition-colors duration-[var(--dur-fast)] ${
            isActive ? "text-accent" : "text-ink"
          }`}>
            {title}
          </h3>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted flex-1">
          {copy}
        </p>
      </div>
    </motion.div>
  );
}

// Visual Simulation 1: Replicates actual popup restore session card + hover lighting blue + Restore tooltip
function RestoreSimulation({ isActive }: { isActive: boolean }) {
  // Cursor initial and target coordinates are relative to the relative wrapper enclosing both the card and the cursor, guaranteeing perfect alignment
  const cursorVariants = {
    active: {
      x: [180, 174, 174, 174, 176],
      y: [70, 24, 24, 24, 28],
      scale: [1, 1, 0.85, 1, 1],
      transition: { duration: 1.6, delay: 2.0, times: [0, 0.6, 0.75, 0.85, 1.0], ease: "easeInOut" as const },
    },
    initial: { x: 180, y: 70, scale: 1 },
  };

  const buttonVariants = {
    active: {
      backgroundColor: ["#FFFEFA", "#FFFEFA", "#285CCC", "#285CCC", "#285CCC"],
      color: ["#285CCC", "#285CCC", "#FFF2BD", "#FFF2BD", "#FFF2BD"],
      scale: [1, 1, 0.85, 1, 1],
      transition: { duration: 1.6, delay: 2.0, times: [0, 0.6, 0.75, 0.85, 1.0] },
    },
    initial: { backgroundColor: "#FFFEFA", color: "#285CCC", scale: 1 },
  };

  const tooltipVariants = {
    active: {
      opacity: [0, 0, 1, 1],
      y: [4, 4, -4, -4],
      transition: { duration: 1.6, delay: 2.0, times: [0, 0.55, 0.65, 1.0] },
    },
    initial: { opacity: 0, y: 4 },
  };

  const cardRestoreVariants = {
    active: {
      scale: [1, 1, 1.03, 0],
      opacity: [1, 1, 1, 0],
      y: [0, 0, -2, 10],
      transition: { duration: 0.7, delay: 3.36, ease: "easeInOut" as const },
    },
    initial: { scale: 1, opacity: 1, y: 0 },
  };

  const restoredWindowVariants = {
    active: {
      opacity: [0, 1],
      scale: [0.88, 1],
      y: [12, 0],
      transition: { duration: 0.6, delay: 3.8, ease: "easeOut" as const },
    },
    initial: { opacity: 0, scale: 0.88, y: 12 },
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-3">
      {/* Anchor both card and cursor inside a relative frame so coordinate translation matches perfectly */}
      <div className="relative w-[196px] h-[52px] flex items-center justify-center">
        {/* Session Card (Exact copy of popup card) */}
        <motion.div
          variants={cardRestoreVariants}
          animate={isActive ? "active" : "initial"}
          className="absolute inset-0 bg-[#FFFEFA] border border-border shadow-xs pl-3.5 pr-2 py-2 flex items-center justify-between rounded-lg overflow-visible"
          style={{ originY: "50%" }}
        >
          <span className="absolute inset-y-0 left-0 w-[4px] bg-accent rounded-l-lg" />
          <div className="text-left flex-1 min-w-0 pr-2">
            <span className="font-display block truncate text-[11px] font-bold text-ink leading-snug">
              Monday Reading
            </span>
            <div className="flex items-center gap-1 mt-1 font-mono">
              {/* Favicons spine */}
              <span className="h-3.5 w-3.5 rounded-full bg-blue-500 border border-white shrink-0" />
              <span className="h-3.5 w-3.5 rounded-full bg-red-400 border border-white shrink-0 -ml-1.5" />
              <span className="inline-flex h-[11px] items-center rounded-full bg-chip px-1.5 text-[7px] font-bold text-muted-2">
                3 tabs
              </span>
            </div>
          </div>

          {/* Circular Restore Button (Lights up blue + Tooltip) */}
          <div className="relative flex items-center justify-center mr-1">
            {/* Circular Tooltip ("Restore tabs") */}
            <motion.div
              variants={tooltipVariants}
              className="absolute bottom-full mb-1 bg-ink text-[#FFFEFA] text-[7px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-pop whitespace-nowrap pointer-events-none"
            >
              Restore tabs
            </motion.div>

            <motion.div
              variants={buttonVariants}
              className="h-6 w-6 rounded-full border border-border flex items-center justify-center shadow-xs cursor-pointer"
            >
              {/* Clockwise Rotate Arrow Icon matching real button */}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </motion.div>
          </div>
        </motion.div>

        {/* Simulated restored window success popup */}
        <motion.div
          variants={restoredWindowVariants}
          animate={isActive ? "active" : "initial"}
          className="absolute inset-x-2 inset-y-1 bg-accent-soft border border-accent/20 rounded-lg p-2 shadow-sm flex items-center gap-2"
          style={{ originY: "50%" }}
        >
          <span className="h-5 w-5 bg-accent text-[#FFF2BD] rounded-full flex items-center justify-center shrink-0">
            <Check size={11} strokeWidth={3} />
          </span>
          <div className="text-left">
            <div className="h-1.5 w-16 bg-accent-text/60 rounded" />
            <div className="h-1 w-20 bg-accent-text/30 rounded mt-1" />
          </div>
        </motion.div>

        {/* Moving cursor pointer inside relative frame targeting center coordinates (x: 163, y: 12) exactly */}
        <motion.div
          animate={isActive ? cursorVariants.active : cursorVariants.initial}
          className="absolute left-0 top-0 pointer-events-none z-20 text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.5,0 L20.5,12.5 L12,14.5 L20.5,24 L17,24 L8.5,15 L4.5,18 Z" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}

// Visual Simulation 2: Interactive 3D Tactile Keycaps + keyboard feedback
function ShortcutSimulation({
  isActive,
  isMac,
  pressedKeys,
}: {
  isActive: boolean;
  isMac: boolean;
  pressedKeys: { ctrl: boolean; shift: boolean; s: boolean };
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 select-none">
      <div className="flex items-center gap-2">
        {/* Modifier key (Cmd or Ctrl) */}
        <Keycap
          label={isMac ? "⌘ Cmd" : "Ctrl"}
          isPressed={pressedKeys.ctrl || (isActive && !pressedKeys.s)}
          delay={2.0}
        />
        <span className="text-muted-2 text-xs font-semibold">+</span>
        {/* Shift key */}
        <Keycap
          label={isMac ? "⇧ Shift" : "Shift"}
          isPressed={pressedKeys.shift || (isActive && !pressedKeys.s)}
          delay={2.3}
        />
        <span className="text-muted-2 text-xs font-semibold">+</span>
        {/* S key */}
        <Keycap
          label="S"
          isPressed={pressedKeys.s || isActive}
          delay={2.6}
        />
      </div>

      {/* Tiny instructions or active key lights */}
      <div className="mt-3.5 h-4 flex items-center justify-center">
        {pressedKeys.ctrl || pressedKeys.shift || pressedKeys.s ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 text-accent font-semibold text-[9.5px] font-mono"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
            KEYBOARD DETECTED!
          </motion.div>
        ) : (
          <span className="text-[10px] text-muted-2 font-mono opacity-80">
            {isMac ? "Try pressing ⌘ + Shift + S" : "Try pressing Ctrl + Shift + S"}
          </span>
        )}
      </div>
    </div>
  );
}

// 3D Keycap Component
function Keycap({ label, isPressed, delay }: { label: string; isPressed: boolean; delay: number }) {
  const capVariants = {
    pressed: {
      y: 3,
      boxShadow: "0 1px 0px rgba(28, 51, 107, 0.4)",
      borderColor: "#1C336B",
      backgroundColor: "#DCE6FA", // highlight blue on active/pressed
    },
    idle: {
      y: 0,
      boxShadow: "0 4px 0px rgba(28, 51, 107, 0.25)",
      borderColor: "#E5DDC4",
      backgroundColor: "#FFFEFA",
    },
  };

  return (
    <motion.div
      variants={capVariants}
      initial="idle"
      animate={isPressed ? "pressed" : "idle"}
      transition={{ type: "spring", stiffness: 500, damping: 20, delay: isPressed ? delay : 0 }}
      className="min-w-[34px] h-[34px] px-2 flex items-center justify-center rounded-lg border text-[11px] font-bold text-ink"
      style={{
        borderWidth: "1.5px",
      }}
    >
      {label}
    </motion.div>
  );
}

// Visual Simulation 3: Puzzle extension bar pin simulator
// Visual Simulation 3: Puzzle extension bar pin simulator
function PinSimulation({ isActive }: { isActive: boolean }) {
  const dropdownVariants = {
    active: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.3, delay: 3.0, ease: "easeOut" as const },
    },
    initial: { opacity: 0, y: -4, scale: 0.95 },
  };

  const cursorVariants = {
    active: {
      x: [100, 192, 192, 192, 192, 188, 188, 188, 188, 154],
      y: [85, 12, 12, 12, 12, 62, 62, 62, 62, 75],
      scale: [1, 1, 0.82, 1, 1, 1, 0.82, 1, 1, 1],
      transition: { duration: 2.6, delay: 2.0, times: [0, 0.3, 0.38, 0.42, 0.5, 0.73, 0.8, 0.85, 0.92, 1.0], ease: "easeInOut" as const },
    },
    initial: { x: 100, y: 85, scale: 1 },
  };

  const pinIconVariants = {
    active: {
      color: ["#8A93B0", "#8A93B0", "#285CCC"], // pin lights up in Stash accent blue
      scale: [1, 1, 1.25, 1],
      transition: { duration: 0.4, delay: 4.1 },
    },
    initial: { color: "#8A93B0" },
  };

  const extensionIconVariants = {
    active: {
      opacity: [0, 0, 1],
      scale: [0, 0, 1.15, 1],
      transition: { duration: 0.4, delay: 4.3, ease: "backOut" as const },
    },
    initial: { opacity: 0, scale: 0 },
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-3">
      {/* Anchor both toolbar and cursor inside a relative frame so coordinate translation matches perfectly */}
      <div className="relative w-[220px] h-[96px] flex flex-col justify-between">
        {/* Extensions bar header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-1.5 relative w-full h-[28px]">
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-16 bg-ink/10 rounded ml-1" />
          </div>

          {/* Extensions icons */}
          <div className="flex gap-2 items-center absolute right-1.5 top-0.5">
            {/* Mocked newly pinned icon */}
            <motion.div
              variants={extensionIconVariants}
              initial="initial"
              animate={isActive ? "active" : "initial"}
              className="text-accent-text h-5 w-5 flex items-center justify-center"
            >
              <PanelTopClose size={12} strokeWidth={2.5} />
            </motion.div>

            {/* Puzzle Icon */}
            <div className="text-muted-2 flex h-5 w-5 items-center justify-center rounded hover:bg-chip">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="M12 6v12M6 12h12" />
              </svg>
            </div>
          </div>
        </div>

        {/* Visual Simulation Main body */}
        <div className="flex-1 flex items-center justify-center relative w-full">
          <AnimatePresence>
            {isActive && (
              <motion.div
                variants={dropdownVariants}
                initial="initial"
                animate="active"
                exit="initial"
                className="absolute top-0 right-1 w-[130px] bg-[#FFFEFA] border border-border rounded shadow-pop p-1.5 z-10"
              >
                <div className="flex items-center justify-between px-1 py-0.5 text-[8px] font-bold text-ink">
                  <span>Extensions</span>
                </div>
                <div className="mt-1 h-px bg-border/50" />
                {/* Row Stash */}
                <div className="mt-1 flex items-center justify-between bg-chip/50 rounded px-1.5 py-1 text-[7.5px] font-medium text-ink">
                  <div className="flex items-center gap-1.5">
                    <span className="text-accent-text"><PanelTopClose size={9} strokeWidth={2.5} /></span>
                    <span>Stash</span>
                  </div>
                  <motion.span
                    variants={pinIconVariants}
                    initial="initial"
                    animate={isActive ? "active" : "initial"}
                    className="text-muted-2"
                  >
                    <Pin size={8} fill={isActive ? "#285CCC" : "none"} />
                  </motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Moving cursor pointer inside relative frame targeting center coordinates perfectly */}
        <motion.div
          variants={cursorVariants}
          initial="initial"
          animate={isActive ? "active" : "initial"}
          className="absolute left-0 top-0 pointer-events-none z-20 text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.5,0 L20.5,12.5 L12,14.5 L20.5,24 L17,24 L8.5,15 L4.5,18 Z" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
