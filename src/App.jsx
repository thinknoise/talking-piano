import { useState } from "react";
import AudioUploader from "./components/AudioUploader";
import Spectrogram from "./components/Spectrogram";
import PitchDetector from "./components/PitchDetector";
import SpectralPitchDetector from "./components/SpectralPitchDetector";
import MIDIGenerator from "./components/MIDIGenerator";
import MIDIPlayer from "./components/MIDIPlayer";
import MicrophoneInput from "./components/MicrophoneInput";
import WaveformVisualizer from "./components/WaveformVisualizer";
import "./App.css";

function App() {
  const [activeAudioBuffer, setActiveAudioBuffer] = useState(null);
  const [activeAudioContext, setActiveAudioContext] = useState(null);
  const [pitchData, setPitchData] = useState([]);
  const [audioSource, setAudioSource] = useState(null); // "microphone" or "file"
  const [activeTab, setActiveTab] = useState("microphone"); // Current active tab

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
