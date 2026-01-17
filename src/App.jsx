import { useState } from "react";
import AudioUploader from "./components/AudioUploader";
import SpectrumVisualizer from "./components/SpectrumVisualizer";
import Spectrogram from "./components/Spectrogram";
import PitchDetector from "./components/PitchDetector";
import SpectralPitchDetector from "./components/SpectralPitchDetector";
import MIDIGenerator from "./components/MIDIGenerator";
import MIDIPlayer from "./components/MIDIPlayer";
import MicrophoneInput from "./components/MicrophoneInput";
import "./App.css";

function App() {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [pitchData, setPitchData] = useState([]);
  const [recordedAudioBuffer, setRecordedAudioBuffer] = useState(null);
  const [recordedAudioContext, setRecordedAudioContext] = useState(null);
  const [detectionMethod, setDetectionMethod] = useState("spectral"); // "autocorrelation" or "spectral"

  const handleAudioLoaded = (buffer, context) => {
    setAudioBuffer(buffer);
    setAudioContext(context);
    setPitchData([]); // Reset pitch data when new audio is loaded
  };

  const handlePitchDetected = (pitches) => {
    setPitchData(pitches);
  };

  const handleMicrophonePitches = (pitches) => {
    setPitchData(pitches);
  };

  const handleRecordedAudio = (buffer, context) => {
    setRecordedAudioBuffer(buffer);
    setRecordedAudioContext(context);
  };

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>🎹 Talking Piano</h1>
      <p style={{ fontSize: "18px", color: "#555", marginBottom: "30px" }}>
        Audio Spectrum Analyzer & Pitch-to-MIDI Converter
      </p>

      <div
        style={{
          marginBottom: "40px",
          padding: "20px",
          background: "#f0f8ff",
          borderRadius: "8px",
          border: "2px solid #4a90e2",
        }}
      >
        <h2>🎤 Live Microphone Input</h2>
        <p style={{ color: "#555", marginBottom: "15px" }}>
          Record audio from your microphone with real-time pitch detection and
          visualization
        </p>
        <MicrophoneInput 
          onPitchesRecorded={handleMicrophonePitches}
          onAudioRecorded={handleRecordedAudio}
        />
        
        {recordedAudioBuffer && (
          <>
            <Spectrogram
              audioBuffer={recordedAudioBuffer}
              audioContext={recordedAudioContext}
            />
            
            <div style={{ marginBottom: "20px", padding: "15px", background: "#fff", borderRadius: "8px", border: "2px solid #666" }}>
              <h3 style={{ marginTop: 0 }}>Choose Pitch Detection Method:</h3>
              <div style={{ display: "flex", gap: "20px" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="radio"
                    value="autocorrelation"
                    checked={detectionMethod === "autocorrelation"}
                    onChange={(e) => setDetectionMethod(e.target.value)}
                    style={{ marginRight: "8px" }}
                  />
                  <div>
                    <strong>Autocorrelation (Simple)</strong>
                    <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#666" }}>
                      Fast, monophonic (single note at a time)
                    </p>
                  </div>
                </label>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="radio"
                    value="spectral"
                    checked={detectionMethod === "spectral"}
                    onChange={(e) => setDetectionMethod(e.target.value)}
                    style={{ marginRight: "8px" }}
                  />
                  <div>
                    <strong>Spectral (Advanced)</strong>
                    <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#666" }}>
                      Polyphonic (chords), velocity-sensitive
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {detectionMethod === "autocorrelation" ? (
              <PitchDetector
                audioBuffer={recordedAudioBuffer}
                audioContext={recordedAudioContext}
                onPitchDetected={handlePitchDetected}
              />
            ) : (
              <SpectralPitchDetector
                audioBuffer={recordedAudioBuffer}
                onPitchDetected={handlePitchDetected}
              />
            )}
          </>
        )}
      </div>

      <div
        style={{
          marginBottom: "40px",
          padding: "20px",
          background: "#fff7e6",
          borderRadius: "8px",
          border: "2px solid #ffa500",
        }}
      >
        <AudioUploader onAudioLoaded={handleAudioLoaded} />

        {audioBuffer && (
          <>
            <SpectrumVisualizer
              audioBuffer={audioBuffer}
              audioContext={audioContext}
            />
            <Spectrogram
              audioBuffer={audioBuffer}
              audioContext={audioContext}
            />
            
            <div style={{ marginBottom: "20px", padding: "15px", background: "#fff", borderRadius: "8px", border: "2px solid #666" }}>
              <h3 style={{ marginTop: 0 }}>Choose Pitch Detection Method:</h3>
              <div style={{ display: "flex", gap: "20px" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="radio"
                    value="autocorrelation"
                    checked={detectionMethod === "autocorrelation"}
                    onChange={(e) => setDetectionMethod(e.target.value)}
                    style={{ marginRight: "8px" }}
                  />
                  <div>
                    <strong>Autocorrelation (Simple)</strong>
                    <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#666" }}>
                      Fast, monophonic (single note at a time), good for melodies
                    </p>
                  </div>
                </label>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="radio"
                    value="spectral"
                    checked={detectionMethod === "spectral"}
                    onChange={(e) => setDetectionMethod(e.target.value)}
                    style={{ marginRight: "8px" }}
                  />
                  <div>
                    <strong>Spectral (Advanced)</strong>
                    <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#666" }}>
                      Polyphonic (chords), velocity-sensitive, harmonic filtering
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {detectionMethod === "autocorrelation" ? (
              <PitchDetector
                audioBuffer={audioBuffer}
                audioContext={audioContext}
                onPitchDetected={handlePitchDetected}
              />
            ) : (
              <SpectralPitchDetector
                audioBuffer={audioBuffer}
                onPitchDetected={handlePitchDetected}
              />
            )}
          </>
        )}
      </div>

      {pitchData.length > 0 && (
        <div
          style={{
            marginBottom: "40px",
            padding: "20px",
            background: "#e8ffe8",
            borderRadius: "8px",
            border: "2px solid #4caf50",
          }}
        >
          <h2>🎵 MIDI Generation & Playback</h2>
          <MIDIPlayer pitchData={pitchData} />
          <MIDIGenerator pitchData={pitchData} audioBuffer={audioBuffer} />
        </div>
      )}
    </div>
  );
}

export default App;
