"use client";

import { useCallback, useRef, useState } from "react";
import type { ToolActionResult } from "./types";

/**
 * Wraps a tool server-action so the client can:
 *   - run the action normally
 *   - detect `requiresSubscription` on the result
 *   - open the ToolUnlockModal
 *   - retry the action automatically after the modal succeeds
 *
 * Usage (in any tool client component):
 *
 * ```tsx
 * const unlock = useToolUnlock((p: MyPayload) => runMyToolAction(p));
 *
 * // call where you previously called the action:
 * startTransition(async () => {
 *   const res = await unlock.run(payload);
 *   if (!res.ok || !res.data) { setError(res.error ?? "..."); return; }
 *   setResult(res.data.result);
 * });
 *
 * // then render the modal once in your tree:
 * <ToolUnlockModal
 *   open={unlock.modalOpen}
 *   tool="automation-scanner"
 *   toolName="Automation Scanner"
 *   locale={locale}
 *   onClose={unlock.closeModal}
 *   onUnlocked={unlock.retryAfterUnlock}
 * />
 * ```
 *
 * On `requiresSubscription` the hook stashes the most-recent payload so the
 * post-unlock retry can fire the exact same call without the parent having
 * to keep payload state in sync.
 */
export function useToolUnlock<TPayload, TResult extends ToolActionResult<unknown>>(
    action: (payload: TPayload) => Promise<TResult>,
) {
    const [modalOpen, setModalOpen] = useState(false);
    const [lastResult, setLastResult] = useState<TResult | null>(null);
    const actionRef = useRef(action);
    actionRef.current = action;
    const lastPayloadRef = useRef<TPayload | null>(null);
    const onResultRef = useRef<((res: TResult) => void) | null>(null);

    const run = useCallback(async (payload: TPayload): Promise<TResult> => {
        lastPayloadRef.current = payload;
        const res = await actionRef.current(payload);
        setLastResult(res);
        if (!res.ok && res.requiresSubscription) {
            setModalOpen(true);
        }
        return res;
    }, []);

    const closeModal = useCallback(() => setModalOpen(false), []);

    /** Called by the modal after a successful subscribe + unlock mint.
     * Closes the modal and re-runs the same action with the stashed payload;
     * the server now finds the unlock cookie and consumes one grant. The
     * retry result is delivered via the optional `onResult` listener so the
     * parent component can update its UI without re-implementing the
     * success / error branching. */
    const retryAfterUnlock = useCallback(async () => {
        setModalOpen(false);
        if (!lastPayloadRef.current) return;
        const res = await run(lastPayloadRef.current);
        if (onResultRef.current) onResultRef.current(res);
    }, [run]);

    /** Subscribe to the retry result. The parent's submit handler typically
     * processes results inline, so this just lets the retry path reuse the
     * same logic. */
    const onResult = useCallback((listener: (res: TResult) => void) => {
        onResultRef.current = listener;
    }, []);

    return {
        run,
        modalOpen,
        closeModal,
        retryAfterUnlock,
        onResult,
        lastResult,
    };
}
