/**
 * Shared AudioContext utility
 * Ensures only one AudioContext is used throughout the application
 * for MIDI playback and audio processing (excluding microphone recording)
 */

let sharedAudioContext = null;

/**
 * Get the shared AudioContext instance
 * Creates a new one if it doesn't exist or was closed
 * @returns {AudioContext}
 */
export function getAudioContext() {
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
  }
  return sharedAudioContext;
}

/**
 * Resume the AudioContext if it's suspended
 * Required by browser autoplay policies
 * @returns {Promise<AudioContext>}
 */
export async function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

/**
 * Get the current state of the AudioContext
 * @returns {AudioContextState} "suspended" | "running" | "closed"
 */
export function getAudioContextState() {
  return sharedAudioContext?.state || "closed";
}

/**
 * Close the shared AudioContext
 * Should only be called when the app is shutting down
 */
export function closeAudioContext() {
  if (sharedAudioContext && sharedAudioContext.state !== "closed") {
    sharedAudioContext.close();
    sharedAudioContext = null;
  }
}
