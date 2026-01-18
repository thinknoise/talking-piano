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
  const [activeAudioBuffer, setActiveAudioBuffer] = useState(null);
  const [activeAudioContext, setActiveAudioContext] = useState(null);
  const [pitchData, setPitchData] = useState([]);
  const [detectionMethod, setDetectionMethod] = useState("spectral"); // "autocorrelation" or "spectral"
  const [audioSource, setAudioSource] = useState(null); // "microphone" or "file"

  const handleAudioLoaded = (buffer, context) => {
    setActiveAudioBuffer(buffer);
    setActiveAudioContext(context);
    setAudioSource("file");
    setPitchData([]); // Reset pitch data when new audio is loaded
  };

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

      <div className="section section-microphone">
        <h2>🎤 Live Microphone Input</h2>
        <p className="section-description">
          Record audio from your microphone with real-time pitch detection and
          visualization
        </p>
        <MicrophoneInput
          onPitchesRecorded={handleMicrophonePitches}
          onAudioRecorded={handleRecordedAudio}
        />
      </div>

      <div className="section section-upload">
        <h2>📁 Audio File Upload</h2>
        <p className="section-description">
          Upload an audio file for spectrum analysis and pitch-to-MIDI
          conversion
        </p>
        <AudioUploader onAudioLoaded={handleAudioLoaded} />
      </div>

      {activeAudioBuffer && (
        <div className="section section-analysis">
          <h2>
            📊 Audio Analysis{" "}
            {audioSource &&
              `(${audioSource === "microphone" ? "Microphone Recording" : "Uploaded File"})`}
          </h2>

          <SpectrumVisualizer
            audioBuffer={activeAudioBuffer}
            audioContext={activeAudioContext}
          />

          <Spectrogram
            audioBuffer={activeAudioBuffer}
            audioContext={activeAudioContext}
          />

          <div className="detection-method-selector">
            <h3>Choose Pitch Detection Method:</h3>
            <div className="detection-methods">
              <label className="detection-method-label">
                <input
                  type="radio"
                  value="autocorrelation"
                  checked={detectionMethod === "autocorrelation"}
                  onChange={(e) => setDetectionMethod(e.target.value)}
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
                  onChange={(e) => setDetectionMethod(e.target.value)}
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

          {detectionMethod === "autocorrelation" ? (
            <PitchDetector
              audioBuffer={activeAudioBuffer}
              audioContext={activeAudioContext}
              onPitchDetected={handlePitchDetected}
            />
          ) : (
            <SpectralPitchDetector
              audioBuffer={activeAudioBuffer}
              onPitchDetected={handlePitchDetected}
            />
          )}
        </div>
      )}

      {pitchData.length > 0 && (
        <div className="section section-midi">
          <h2>🎵 MIDI Generation & Playback</h2>
          <MIDIPlayer pitchData={pitchData} />
          <MIDIGenerator
            pitchData={pitchData}
            audioBuffer={activeAudioBuffer}
          />
        </div>
      )}
    </div>
  );
}

export default App;
