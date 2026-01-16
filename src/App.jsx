import { useState } from "react";
import AudioUploader from "./components/AudioUploader";
import SpectrumVisualizer from "./components/SpectrumVisualizer";
import PitchDetector from "./components/PitchDetector";
import MIDIGenerator from "./components/MIDIGenerator";
import MIDIPlayer from "./components/MIDIPlayer";
import MicrophoneInput from "./components/MicrophoneInput";
import "./App.css";

function App() {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [pitchData, setPitchData] = useState([]);

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

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Talking Piano</h1>
      <div>
        <MicrophoneInput onPitchesRecorded={handleMicrophonePitches} />
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
            <PitchDetector
              audioBuffer={audioBuffer}
              audioContext={audioContext}
              onPitchDetected={handlePitchDetected}
            />
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
