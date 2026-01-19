import { useState, useEffect, useRef } from "react";
import AudioUploader from "./components/AudioUploader";
import Spectrogram from "./components/Spectrogram";
import PitchDetector from "./components/PitchDetector";
import SpectralPitchDetector from "./components/SpectralPitchDetector";
import MIDIGenerator from "./components/MIDIGenerator";
import MIDIPlayer from "./components/MIDIPlayer";
import MicrophoneInput from "./components/MicrophoneInput";
import WaveformVisualizer from "./components/WaveformVisualizer";
import "./App.css";

// Helper function for pitch detection
function hzToMidi(hz) {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

function isHarmonic(freq, fundamental, tolerance = 0.1) {
  const ratio = freq / fundamental;
  const nearestInteger = Math.round(ratio);
  return Math.abs(ratio - nearestInteger) < tolerance && nearestInteger > 1;
}

function App() {
  const [activeAudioBuffer, setActiveAudioBuffer] = useState(null);
  const [activeAudioContext, setActiveAudioContext] = useState(null);
  const [pitchData, setPitchData] = useState([]);
  const [audioSource, setAudioSource] = useState(null); // "microphone" or "file"
  const [activeTab, setActiveTab] = useState("microphone"); // Current active tab
  const [isDetecting, setIsDetecting] = useState(false);
  const isAutoDetectingRef = useRef(false);

  const handleAudioLoaded = (buffer, context) => {
    setActiveAudioBuffer(buffer);
    setActiveAudioContext(context);
    setAudioSource("file");
    setPitchData([]); // Reset pitch data when new audio is loaded
    setActiveTab("waveform"); // Navigate to waveform tab
  };

  // Auto-detect pitches when file is uploaded
  useEffect(() => {
    let cancelled = false;

    if (
      audioSource === "file" &&
      activeAudioBuffer &&
      pitchData.length === 0 &&
      !isAutoDetectingRef.current
    ) {
      isAutoDetectingRef.current = true;

      const detectPitches = async () => {
        setIsDetecting(true);
        const sampleRate = activeAudioBuffer.sampleRate;
        const channelData = activeAudioBuffer.getChannelData(0);
        const fftSize = 4096;
        const hopSize = 512;
        const sensitivity = 0.05;
        const allPitches = [];

        // Process audio in chunks
        for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
          const slice = channelData.slice(i, i + fftSize);
          const time = i / sampleRate;

          // Perform FFT
          const spectrum = performFFT(slice, fftSize);
          const peaks = findSpectralPeaks(
            spectrum,
            sampleRate,
            fftSize,
            sensitivity,
          );
          const fundamentals = filterHarmonics(peaks);

          if (fundamentals.length > 0) {
            const notes = fundamentals.map((peak) => ({
              time: time.toFixed(3),
              hz: peak.frequency,
              midi: hzToMidi(peak.frequency),
              velocity: Math.min(127, Math.round(peak.amplitude * 127)),
            }));

            allPitches.push({
              time: time.toFixed(3),
              notes,
            });
          }

          // Yield to prevent blocking
          if (i % (hopSize * 50) === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }

        // Flatten results
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

        if (cancelled) {
          return;
        }

        setPitchData(flatPitches);
        isAutoDetectingRef.current = false;
        setIsDetecting(false);
      };

      const performFFT = (buffer, size) => {
        const spectrum = new Float32Array(size / 2);

        for (let k = 0; k < size / 2; k++) {
          let real = 0,
            imag = 0;

          for (let n = 0; n < buffer.length; n++) {
            const angle = (-2 * Math.PI * k * n) / size;
            real += buffer[n] * Math.cos(angle);
            imag += buffer[n] * Math.sin(angle);
          }

          spectrum[k] = Math.sqrt(real * real + imag * imag) / size;
        }

        return spectrum;
      };

      const findSpectralPeaks = (spectrum, sampleRate, fftSize, threshold) => {
        const peaks = [];
        const binWidth = sampleRate / fftSize;

        for (let i = 10; i < spectrum.length - 10; i++) {
          const value = spectrum[i];
          if (value < threshold) continue;
          let isMax = true;

          for (let j = -5; j <= 5; j++) {
            if (j !== 0 && spectrum[i + j] >= value) {
              isMax = false;
              break;
            }
          }

          if (isMax) {
            const frequency = i * binWidth;

            if (frequency >= 50 && frequency <= 4000) {
              peaks.push({
                frequency,
                amplitude: value,
                bin: i,
              });
            }
          }
        }

        peaks.sort((a, b) => b.amplitude - a.amplitude);
        return peaks.slice(0, 10);
      };

      const filterHarmonics = (peaks) => {
        if (peaks.length === 0) return [];
        const fundamentals = [];
        const used = new Set();
        const sorted = [...peaks].sort((a, b) => a.frequency - b.frequency);

        for (let i = 0; i < sorted.length; i++) {
          if (used.has(i)) continue;
          const candidate = sorted[i];
          let isFundamental = true;

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

            for (let j = i + 1; j < sorted.length; j++) {
              if (isHarmonic(sorted[j].frequency, candidate.frequency)) {
                used.add(j);
              }
            }
          }
        }

        return fundamentals;
      };

      detectPitches();
    }

    return () => {
      cancelled = true;
      isAutoDetectingRef.current = false;
    };
  }, [audioSource, activeAudioBuffer, pitchData.length]);

  const handlePitchDetected = (pitches) => {
    setPitchData(pitches);
  };

  const handleMicrophonePitches = (pitches) => {
    setPitchData(pitches);
  };

  const handleRecordedAudio = (buffer, context) => {
    setActiveAudioBuffer(buffer);
    setActiveAudioContext(context);
    setAudioSource("microphone");
    setPitchData([]); // Reset pitch data when new recording is made
  };

  return (
    <div className="app-container">
      <h1 className="app-title">
        <span className="title-container">
          <span className="title-text title-primary">🗣🎹 Talking Piano</span>
          <span className="title-text title-alternate">
            🗣🧥 Singing Jacket
          </span>
        </span>
      </h1>
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "microphone" ? "active" : ""}`}
            onClick={() => setActiveTab("microphone")}
          >
            🎤
          </button>
          <button
            className={`tab ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            📁
          </button>
          {activeAudioBuffer && (
            <>
              <button
                className={`tab ${activeTab === "waveform" ? "active" : ""}`}
                onClick={() => setActiveTab("waveform")}
              >
                〰️
              </button>
              <button
                className={`tab ${activeTab === "spectrogram" ? "active" : ""}`}
                onClick={() => setActiveTab("spectrogram")}
              >
                📈
              </button>
            </>
          )}
        </div>
        <div className="tab-content">
          {activeTab === "microphone" && (
            <div className="section section-microphone">
              <h2>Microphone Input</h2>
              <p className="section-description">
                Record audio from your microphone with real-time pitch detection
                and visualization
              </p>
              <MicrophoneInput
                onPitchesRecorded={handleMicrophonePitches}
                onAudioRecorded={handleRecordedAudio}
              />
            </div>
          )}
          {activeTab === "upload" && (
            <div className="section section-upload">
              <h2>Upload</h2>
              <p className="section-description">
                Upload an audio file for spectrum analysis and pitch-to-MIDI
                conversion
              </p>
              <AudioUploader onAudioLoaded={handleAudioLoaded} />
            </div>
          )}
          {activeTab === "waveform" && activeAudioBuffer && (
            <div className="section section-analysis">
              <h2>
                Waveform
                {audioSource &&
                  ` (${audioSource === "microphone" ? "Microphone Recording" : "Uploaded File"})`}
              </h2>
              <WaveformVisualizer audioBuffer={activeAudioBuffer} />
              {isDetecting && (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <div
                    style={{
                      display: "inline-block",
                      width: "40px",
                      height: "40px",
                      border: "4px solid #f3f3f3",
                      borderTop: "4px solid #3498db",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <p style={{ marginTop: "10px", color: "#666" }}>
                    Detecting pitches...
                  </p>
                  <style>
                    {`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                    `}
                  </style>
                </div>
              )}
              {pitchData.length > 0 && (
                <MIDIPlayer
                  pitchData={pitchData}
                  downloadButton={
                    <MIDIGenerator
                      pitchData={pitchData}
                      audioBuffer={activeAudioBuffer}
                    />
                  }
                />
              )}
            </div>
          )}
          {activeTab === "spectrogram" && activeAudioBuffer && (
            <div className="section section-analysis">
              <h2>
                Spectrogram
                {audioSource &&
                  ` (${audioSource === "microphone" ? "Microphone Recording" : "Uploaded File"})`}
              </h2>
              <Spectrogram
                audioBuffer={activeAudioBuffer}
                audioContext={activeAudioContext}
              />
              <SpectralPitchDetector
                audioBuffer={activeAudioBuffer}
                onPitchDetected={handlePitchDetected}
              />
              {pitchData.length > 0 && (
                <MIDIPlayer
                  pitchData={pitchData}
                  downloadButton={
                    <MIDIGenerator
                      pitchData={pitchData}
                      audioBuffer={activeAudioBuffer}
                    />
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
