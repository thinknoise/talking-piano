import { useState } from "react";

// Autocorrelation pitch detection algorithm
function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let best_offset = -1;
  let best_correlation = 0;
  let rms = 0;

  // Calculate RMS (root mean square) for volume detection
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);

  // Not enough signal
  if (rms < 0.01) return -1;

  // Find the best correlation
  let lastCorrelation = 1;
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

export default function PitchDetector({
  audioBuffer,
  onPitchDetected,
}) {
  const [pitchData, setPitchData] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [progress, setProgress] = useState(0);

  const detectPitches = () => {
    if (!audioBuffer) return;

    setIsDetecting(true);
    setPitchData([]);
    setProgress(0);

    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const windowSize = 2048; // Size of analysis window
    const hopSize = 512; // How much to advance between analyses
    const pitches = [];

    // Process audio in chunks
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      const buffer = channelData.slice(i, i + windowSize);
      const hz = autoCorrelate(buffer, sampleRate);

      const time = i / sampleRate;

      // Filter to reasonable pitch range (50-1000 Hz)
      if (hz > 50 && hz < 1000) {
        pitches.push({ time: time.toFixed(3), hz: Math.round(hz * 100) / 100 });
      }

      // Update progress
      if (i % (hopSize * 100) === 0) {
        setProgress(Math.round((i / channelData.length) * 100));
      }
    }

    setPitchData(pitches);
    setIsDetecting(false);
    setProgress(100);

    // Notify parent component
    if (onPitchDetected) {
      onPitchDetected(pitches);
    }
  };

  const downloadJSON = () => {
    const json = JSON.stringify({ pitches: pitchData }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pitch_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "#f0f0f0",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <h2>Pitch Detection</h2>

      <button
        onClick={detectPitches}
        disabled={!audioBuffer || isDetecting}
        style={{
          padding: "10px 20px",
          marginRight: "10px",
          fontSize: "16px",
          cursor: audioBuffer && !isDetecting ? "pointer" : "not-allowed",
        }}
      >
        {isDetecting ? `Detecting... ${progress}%` : "Detect Pitches"}
      </button>

      {pitchData.length > 0 && (
        <button
          onClick={downloadJSON}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Download Pitch Data (JSON)
        </button>
      )}

      {pitchData.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>Detected Pitches: {pitchData.length} samples</h3>
          <div
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              background: "#fff",
              padding: "10px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          >
            {pitchData.slice(0, 50).map((p, i) => (
              <div key={i}>
                {p.time}s: {p.hz} Hz
              </div>
            ))}
            {pitchData.length > 50 && (
              <div>... and {pitchData.length - 50} more</div>
            )}
          </div>
          <p style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
            Range: {Math.min(...pitchData.map((p) => p.hz))}Hz -{" "}
            {Math.max(...pitchData.map((p) => p.hz))}Hz
          </p>
        </div>
      )}

      <p style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
        This extracts the dominant pitch (frequency) throughout the audio using
        autocorrelation.
      </p>
    </div>
  );
}
