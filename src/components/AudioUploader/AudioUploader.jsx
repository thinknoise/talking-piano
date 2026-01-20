import { useState } from "react";
import "./AudioUploader.css";

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

      // Decode audio data (context only used for decoding)
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      onAudioLoaded(audioBuffer);
    } catch (err) {
      console.error("Audio decoding error:", err);
      setError(
        `Failed to decode audio file. Please try a different format (WAV, MP3, OGG, etc.). Error: ${err.message}`,
      );
      setFileName("");
    }
  };

  return (
    <div>
      <input type="file" accept="audio/*" onChange={handleFileChange} />
      {fileName && (
        <span className="audio-uploader-success">Loaded: {fileName}</span>
      )}
      {error && <div className="message message-error mt-10">{error}</div>}
    </div>
  );
}
