import { useEffect, useRef, useState } from "react";
import "./WaveformVisualizer.css";

export default function WaveformVisualizer({ audioBuffer }) {
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);

  const playAudio = async () => {
    if (!audioBuffer || isPlaying) return;

    setIsPlaying(true);

    // Create audio context for playback
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    audioContextRef.current = audioContext;

    // Create source and connect to destination
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    sourceNodeRef.current = source;

    // Start playback
    source.start(0);

    // Stop when audio ends
    source.onended = () => {
      stopAudio();
    };
  };

  const stopAudio = () => {
    setIsPlaying(false);

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // Already stopped
      }
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
  };

  // Draw waveform
  useEffect(() => {
    if (!audioBuffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Get audio data from first channel
    const channelData = audioBuffer.getChannelData(0);
    const samples = channelData.length;

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Calculate how many samples per pixel
    const samplesPerPixel = Math.floor(samples / width);
    const centerY = height / 2;

    for (let x = 0; x < width; x++) {
      // Get min and max values for this pixel
      const startSample = x * samplesPerPixel;
      const endSample = startSample + samplesPerPixel;

      let min = 1.0;
      let max = -1.0;

      for (let i = startSample; i < endSample && i < samples; i++) {
        const value = channelData[i];
        if (value < min) min = value;
        if (value > max) max = value;
      }

      // Draw vertical line from min to max
      const yMin = centerY - min * centerY;
      const yMax = centerY - max * centerY;

      if (x === 0) {
        ctx.moveTo(x, yMin);
      } else {
        ctx.lineTo(x, yMin);
        ctx.lineTo(x, yMax);
      }
    }

    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText(`Duration: ${audioBuffer.duration.toFixed(2)}s`, 10, 20);
    ctx.fillText(`Sample Rate: ${audioBuffer.sampleRate} Hz`, 10, 40);
    ctx.fillText(`Channels: ${audioBuffer.numberOfChannels}`, 10, 60);
  }, [audioBuffer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  if (!audioBuffer) {
    return (
      <div className="waveform-container">
        <p>No audio buffer available</p>
      </div>
    );
  }

  return (
    <div className="waveform-container">
      <div className="waveform-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={870}
          height={300}
          className="waveform-canvas"
        />
        <button
          onClick={isPlaying ? stopAudio : playAudio}
          className="waveform-play-button"
          title={isPlaying ? "Stop playback" : "Play audio"}
        >
          {isPlaying ? "⏸" : "🔊"}
        </button>
      </div>
    </div>
  );
}
