import { useState } from "react";

import { autoCorrelate } from "../../utils/pitchDetection";
import "./PitchDetector.css";

export default function PitchDetector({
  audioBuffer,
  onPitchDetected,
  detectionMethod,
  onDetectionMethodChange,
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
        pitches.push({
          time: time.toFixed(3),
          hz: Math.round(hz * 100) / 100,
        });
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
    const json = JSON.stringify(
      {
        pitches: pitchData,
      },

      null,
      2,
    );

    const blob = new Blob([json], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pitch_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pitch-detector-container">
      <h2>🎼 Pitch Detection (Autocorrelation)</h2>
      <div className="detection-method-selector">
        <h3>Choose Pitch Detection Method:</h3>
        <div className="detection-methods">
          <label className="detection-method-label">
            <input
              type="radio"
              value="autocorrelation"
              checked={detectionMethod === "autocorrelation"}
              onChange={(e) => onDetectionMethodChange(e.target.value)}
            />
            <div>
              <strong>Autocorrelation (Simple)</strong>
              <p className="detection-method-info">
                Fast, monophonic (single note at a time), good for melodies
              </p>
            </div>
          </label>
          <label className="detection-method-label">
            <input
              type="radio"
              value="spectral"
              checked={detectionMethod === "spectral"}
              onChange={(e) => onDetectionMethodChange(e.target.value)}
            />
            <div>
              <strong>Spectral (Advanced)</strong>
              <p className="detection-method-info">
                Polyphonic (chords), velocity-sensitive, harmonic filtering
              </p>
            </div>
          </label>
        </div>
      </div>
      <button
        onClick={detectPitches}
        disabled={!audioBuffer || isDetecting}
        className={`btn ${
          audioBuffer && !isDetecting ? "btn-primary" : "btn-disabled"
        }`}
      >
        {isDetecting ? `Detecting... ${progress}%` : "Detect Pitches"}
      </button>
      {pitchData.length > 0 && (
        <button onClick={downloadJSON} className="btn btn-primary">
          Download Pitch Data (JSON)
        </button>
      )}
      {pitchData.length > 0 && (
        <div className="pitch-results">
          <h3>Detected Pitches: {pitchData.length} samples</h3>
          <div className="pitch-list">
            {pitchData.slice(0, 50).map((p, i) => (
              <div key={i}>
                {p.time}s: {p.hz}Hz
              </div>
            ))}
            {pitchData.length > 50 && (
              <div>... and {pitchData.length - 50} more</div>
            )}
          </div>
          <p className="pitch-range-info">
            Range: {Math.min(...pitchData.map((p) => p.hz))}Hz -{" "}
            {Math.max(...pitchData.map((p) => p.hz))}Hz
          </p>
        </div>
      )}
      <p className="pitch-algorithm-note">
        This extracts the dominant pitch (frequency) throughout the audio using
        autocorrelation.
      </p>
    </div>
  );
}
