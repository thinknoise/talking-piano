import { useState } from "react";

// Convert frequency to MIDI note number
function hzToMidi(hz) {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

// Check if a frequency is likely a harmonic of another
function isHarmonic(freq, fundamental, tolerance = 0.1) {
  const ratio = freq / fundamental;
  const nearestInteger = Math.round(ratio);
  return Math.abs(ratio - nearestInteger) < tolerance && nearestInteger > 1;
}

export default function SpectralPitchDetector({
  audioBuffer,
  onPitchDetected,
}) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detectedNotes, setDetectedNotes] = useState([]);
  const [sensitivity, setSensitivity] = useState(0.05); // Adjustable threshold

  const detectPitches = async () => {
    if (!audioBuffer) return;

    setIsDetecting(true);
    setProgress(0);
    setDetectedNotes([]);

    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    const fftSize = 4096; // Larger FFT for better frequency resolution
    const hopSize = 512;
    const allPitches = [];

    // Process audio in chunks
    for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
      const slice = channelData.slice(i, i + fftSize);
      const time = i / sampleRate;

      // Perform FFT and find peaks
      const spectrum = performFFT(slice, fftSize);
      const peaks = findSpectralPeaks(
        spectrum,
        sampleRate,
        fftSize,
        sensitivity
      );

      // Filter harmonics and keep fundamentals
      const fundamentals = filterHarmonics(peaks);

      // Convert to MIDI notes with velocity
      if (fundamentals.length > 0) {
        const notes = fundamentals.map((peak) => ({
          time: time.toFixed(3),
          hz: peak.frequency,
          midi: hzToMidi(peak.frequency),
          velocity: Math.min(127, Math.round(peak.amplitude * 127)),
        }));

        allPitches.push({
          time: time.toFixed(3),
          notes: notes,
        });
      }

      // Update progress
      if (i % (hopSize * 50) === 0) {
        setProgress(Math.round((i / channelData.length) * 100));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // Flatten for display and MIDI generation
    const flatPitches = [];
    allPitches.forEach((frame) => {
      frame.notes.forEach((note) => {
        flatPitches.push({
          time: frame.time,
          hz: note.hz,
          midi: note.midi,
          velocity: note.velocity,
        });
      });
    });

    setDetectedNotes(flatPitches);
    setProgress(100);
    setIsDetecting(false);

    // Notify parent
    if (onPitchDetected) {
      onPitchDetected(flatPitches);
    }
  };

  const performFFT = (buffer, size) => {
    // Simple DFT implementation for magnitude spectrum
    const spectrum = new Float32Array(size / 2);

    for (let k = 0; k < size / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let n = 0; n < buffer.length; n++) {
        const angle = (-2 * Math.PI * k * n) / size;
        real += buffer[n] * Math.cos(angle);
        imag += buffer[n] * Math.sin(angle);
      }

      // Magnitude
      spectrum[k] = Math.sqrt(real * real + imag * imag) / size;
    }

    return spectrum;
  };

  const findSpectralPeaks = (
    spectrum,
    sampleRate,
    fftSize,
    threshold = 0.01
  ) => {
    const peaks = [];
    const binWidth = sampleRate / fftSize;

    // Find local maxima
    for (let i = 10; i < spectrum.length - 10; i++) {
      const value = spectrum[i];

      // Must be above threshold
      if (value < threshold) continue;

      // Must be local maximum
      let isMax = true;
      for (let j = -5; j <= 5; j++) {
        if (j !== 0 && spectrum[i + j] >= value) {
          isMax = false;
          break;
        }
      }

      if (isMax) {
        const frequency = i * binWidth;

        // Filter to musical range (50Hz - 4000Hz)
        if (frequency >= 50 && frequency <= 4000) {
          peaks.push({
            frequency: frequency,
            amplitude: value,
            bin: i,
          });
        }
      }
    }

    // Sort by amplitude (loudest first)
    peaks.sort((a, b) => b.amplitude - a.amplitude);

    // Keep top 10 peaks
    return peaks.slice(0, 10);
  };

  const filterHarmonics = (peaks) => {
    if (peaks.length === 0) return [];

    const fundamentals = [];
    const used = new Set();

    // Sort by frequency (lowest first)
    const sorted = [...peaks].sort((a, b) => a.frequency - b.frequency);

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;

      const candidate = sorted[i];
      let isFundamental = true;

      // Check if this is a harmonic of any lower frequency
      for (let j = 0; j < i; j++) {
        if (used.has(j)) continue;
        if (isHarmonic(candidate.frequency, sorted[j].frequency)) {
          isFundamental = false;
          break;
        }
      }

      if (isFundamental) {
        fundamentals.push(candidate);
        used.add(i);

        // Mark harmonics as used
        for (let j = i + 1; j < sorted.length; j++) {
          if (isHarmonic(sorted[j].frequency, candidate.frequency)) {
            used.add(j);
          }
        }
      }
    }

    return fundamentals;
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "#f9f9f9",
        borderRadius: "8px",
        marginBottom: "20px",
        border: "2px solid #9c27b0",
      }}
    >
      <h2>🎼 Spectral Pitch Detection (Polyphonic)</h2>
      <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
        Advanced pitch detection using FFT spectrum analysis. Detects multiple
        simultaneous notes (chords) with velocity information.
      </p>

      <div style={{ marginBottom: "15px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            color: "#666",
          }}
        >
          Sensitivity (filter weak signals for faster processing):
        </label>
        <input
          type="range"
          min="0.01"
          max="0.2"
          step="0.01"
          value={sensitivity}
          onChange={(e) => setSensitivity(parseFloat(e.target.value))}
          disabled={isDetecting}
          style={{ width: "200px", marginRight: "10px" }}
        />
        <span style={{ fontSize: "14px", color: "#666" }}>
          {sensitivity.toFixed(2)}{" "}
          {sensitivity < 0.05
            ? "(very sensitive)"
            : sensitivity < 0.1
            ? "(balanced)"
            : "(fast)"}
        </span>
      </div>

      <button
        onClick={detectPitches}
        disabled={!audioBuffer || isDetecting}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          cursor: audioBuffer && !isDetecting ? "pointer" : "not-allowed",
          background: audioBuffer && !isDetecting ? "#9c27b0" : "#ccc",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          fontWeight: "bold",
        }}
      >
        {isDetecting
          ? `Analyzing... ${progress}%`
          : "🔬 Detect Polyphonic Pitches"}
      </button>

      {isDetecting && (
        <div style={{ marginTop: "15px" }}>
          <div
            style={{
              width: "100%",
              height: "6px",
              background: "#ddd",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "#9c27b0",
                transition: "width 0.1s linear",
              }}
            />
          </div>
        </div>
      )}

      {detectedNotes.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>✓ Detected {detectedNotes.length} notes with velocity</h3>
          <div
            style={{
              maxHeight: "150px",
              overflowY: "auto",
              background: "#fff",
              padding: "10px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
              border: "1px solid #ddd",
            }}
          >
            {detectedNotes.slice(0, 50).map((note, i) => (
              <div key={i}>
                {note.time}s: {note.hz.toFixed(1)}Hz (MIDI {note.midi}) vel=
                {note.velocity}
              </div>
            ))}
            {detectedNotes.length > 50 && (
              <div style={{ color: "#999", marginTop: "5px" }}>
                ... and {detectedNotes.length - 50} more
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              background: "#f0e6f6",
              borderRadius: "4px",
            }}
          >
            <p
              style={{
                fontSize: "13px",
                margin: "0 0 5px 0",
                color: "#6a1b9a",
              }}
            >
              <strong>Range:</strong>{" "}
              {Math.min(...detectedNotes.map((n) => n.hz)).toFixed(1)}Hz -{" "}
              {Math.max(...detectedNotes.map((n) => n.hz)).toFixed(1)}Hz
            </p>
            <p style={{ fontSize: "13px", margin: "0", color: "#6a1b9a" }}>
              <strong>Features:</strong> Polyphonic detection • Harmonic
              filtering • MIDI velocity
            </p>
          </div>
        </div>
      )}

      <p style={{ marginTop: "15px", fontSize: "12px", color: "#999" }}>
        This method uses FFT spectrum analysis to identify multiple simultaneous
        pitches, filter out harmonics, and extract velocity information for
        realistic MIDI generation.
      </p>
    </div>
  );
}
