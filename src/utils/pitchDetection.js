/**
 * Autocorrelation pitch detection algorithm
 * Detects the fundamental frequency (pitch) from audio buffer data
 * @param {Float32Array} buffer - Audio time domain data
 * @param {number} sampleRate - Audio sample rate in Hz
 * @returns {number} Detected frequency in Hz, or -1 if no pitch detected
 */
export function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let best_offset = -1;
  let best_correlation = 0;
  let rms = 0;

  // Calculate RMS (Root Mean Square) to check signal strength
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }

  rms = Math.sqrt(rms / SIZE);

  // Signal too weak, no pitch detected
  if (rms < 0.0005) return -1;

  let lastCorrelation = 1;

  // Find the best autocorrelation offset
  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;

    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }

    correlation = 1 - correlation / MAX_SAMPLES;

    if (correlation > 0.9 && correlation > lastCorrelation) {
      const foundGoodCorrelation = correlation > best_correlation;

      if (foundGoodCorrelation) {
        best_correlation = correlation;
        best_offset = offset;
      }
    }

    lastCorrelation = correlation;
  }

  if (best_offset === -1) return -1;

  const hz = sampleRate / best_offset;
  return hz;
}

/**
 * Convert frequency (Hz) to MIDI note number
 * @param {number} hz - Frequency in Hz
 * @returns {number} MIDI note number (0-127)
 */
export function hzToMidi(hz) {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

/**
 * Convert MIDI note number to frequency (Hz)
 * @param {number} midiNote - MIDI note number (0-127)
 * @returns {number} Frequency in Hz
 */
export function midiToHz(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}
