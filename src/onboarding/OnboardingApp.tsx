import { Check, Keyboard, Loader2, MousePointerClick, PanelTopClose, Pin } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { sendBackgroundRequest } from "../shared/messages";
import { getSettings } from "../shared/storage";
import type { SaveTarget } from "../shared/types";

type Phase = "idle" | "saving" | "saved" | "error";

export function OnboardingApp() {
  const reduceMotion = useReducedMotion();
  const [saveTarget, setSaveTarget] = useState<SaveTarget>("current-window");
  const [phase, setPhase] = useState<Phase>("idle");
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then((s) => setSaveTarget(s.saveTarget));
  }, []);

  async function handleSave() {
    setPhase("saving");
    setError(null);
    const response = await sendBackgroundRequest({ type: "SAVE_TABS", target: saveTarget });
    if (!response.ok || !response.session) {
      setError(response.ok ? "There were no saveable tabs in this window." : response.error);
      setPhase("error");
      return;
    }
    setSavedCount(response.session.tabs.length);
    setPhase("saved");
  }

  return (
    <main className="paper-bg relative flex min-h-screen items-center justify-center px-6 py-16 text-ink">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[460px] text-center"
      >
        <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">
          Welcome to
        </p>
        <h1 className="wordmark text-[56px] leading-none text-ink">Stash</h1>

        <p className="mx-auto mt-5 max-w-[380px] text-[15px] leading-relaxed text-muted">
          Save the tabs you don't need now, and bring the whole set back in a single click.
          Close the clutter without losing the trail.
        </p>

        <AnimatePresence mode="wait" initial={false}>
          {phase === "saved" ? (
            <motion.div
              key="saved"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="mt-9"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-[#FFF2BD] shadow-[var(--shadow-primary)]">
                <Check size={24} strokeWidth={3} />
              </div>
              <p className="mt-4 font-display display-emphasis text-[20px] text-ink">
                Saved {savedCount} {savedCount === 1 ? "tab" : "tabs"}.
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                Open the Stash icon in your toolbar anytime to find and restore it.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="cta"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-9"
            >
              <motion.div
                whileHover={phase === "saving" ? undefined : { scale: 1.03 }}
                whileTap={phase === "saving" ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 480, damping: 26 }}
                className="inline-block"
              >
                <Button variant="primary" size="lg" onClick={handleSave} disabled={phase === "saving"} className="gap-2">
                  {phase === "saving" ? <Loader2 size={16} className="animate-spin" /> : <PanelTopClose size={16} />}
                  {phase === "saving" ? "Saving..." : "Save my tabs now"}
                </Button>
              </motion.div>
              {phase === "error" && error && (
                <p className="mt-3 text-[13px] font-medium text-danger-ink">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mx-auto mt-12 grid max-w-[400px] gap-3 text-left">
          <Hint icon={<MousePointerClick size={15} />} text="Click the toolbar icon to save every open tab at once." />
          <Hint icon={<Keyboard size={15} />} text="Press Ctrl+Shift+S (Cmd+Shift+S on Mac) to save without clicking." />
          <Hint icon={<Pin size={15} />} text="Pin Stash to your toolbar so it is always one click away." />
        </div>
      </motion.div>
    </main>
  );
}

function Hint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 shadow-[var(--shadow-xs)]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
        {icon}
      </span>
      <span className="text-[13px] leading-snug text-muted">{text}</span>
    </div>
  );
}
