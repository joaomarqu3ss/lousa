/**
 * Checkpoint policy (ADR-0011): a change set is "one agent turn" — the first
 * mutation after an idle gap snapshots the scene, and every mutation inside
 * the window belongs to the same set. "Revert AI changes" restores the
 * snapshot atomically.
 */

export const TURN_IDLE_MS = 120_000;

export function isNewTurn(lastMutationAt: number | null, now: number): boolean {
  return lastMutationAt === null || now - lastMutationAt > TURN_IDLE_MS;
}
