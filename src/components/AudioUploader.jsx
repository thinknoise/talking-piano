import { useState } from "react";

export default function AudioUploader({ onAudioLoaded }) {
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setError("");

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Decode audio data
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      onAudioLoaded(audioBuffer, audioContext);
    } catch (err) {
      console.error("Audio decoding error:", err);
      setError(
        `Failed to decode audio file. Please try a different format (WAV, MP3, OGG, etc.). Error: ${err.message}`
      );
      setFileName("");
    }
  };

  return (
    <div>
      <p style={{ color: "#555", marginBottom: "15px" }}>
        Upload an audio file for analysis
      </p>

      <input
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        style={{ marginRight: "10px" }}
      />
      {fileName && <span style={{ color: "green" }}>Loaded: {fileName}</span>}
      {error && (
        <div style={{ color: "red", marginTop: "10px", fontSize: "14px" }}>
          {error}
        </div>
      )}
    </div>
  );
}
