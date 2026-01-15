import { useEffect, useRef, useState } from "react";

export default function SpectrumVisualizer({ audioBuffer, audioContext }) {
  const canvasRef = useRef(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const animationRef = useRef(null);

  const analyze = () => {
    if (!audioBuffer || !audioContext) return;

    setIsAnalyzing(true);

    // Create analyzer node
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048; // Higher = better frequency resolution
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Create source from buffer
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    // Start playback
    source.start(0);

    // Visualization loop
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      // Draw frequency bars
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;

        // Color gradient based on frequency
        const hue = (i / bufferLength) * 240; // Blue to red
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      // Draw frequency labels
      ctx.fillStyle = "#fff";
      ctx.font = "12px monospace";
      const sampleRate = audioContext.sampleRate;
      const nyquist = sampleRate / 2;
      ctx.fillText(`0 Hz`, 10, height - 10);
      ctx.fillText(
        `${Math.round(nyquist / 2)} Hz`,
        width / 2 - 30,
        height - 10
      );
      ctx.fillText(`${Math.round(nyquist)} Hz`, width - 80, height - 10);
    };

    draw();

    source.onended = () => {
      setIsAnalyzing(false);
      cancelAnimationFrame(animationRef.current);
    };
  };

  const stop = () => {
    setIsAnalyzing(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (audioContext) {
      audioContext.close();
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        padding: "20px",
        background: "#f0f0f0",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <h2>Spectrum Visualization</h2>
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        style={{
          border: "2px solid #333",
          borderRadius: "4px",
          display: "block",
          marginBottom: "10px",
          background: "#000",
        }}
      />
      <button
        onClick={analyze}
        disabled={!audioBuffer || isAnalyzing}
        style={{
          padding: "10px 20px",
          marginRight: "10px",
          fontSize: "16px",
          cursor: audioBuffer && !isAnalyzing ? "pointer" : "not-allowed",
        }}
      >
        {isAnalyzing ? "Analyzing..." : "Analyze & Play"}
      </button>
      <button
        onClick={stop}
        disabled={!isAnalyzing}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          cursor: isAnalyzing ? "pointer" : "not-allowed",
        }}
      >
        Stop
      </button>
      <p style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
        This shows the real-time frequency spectrum (0-22kHz). Taller bars =
        louder frequencies.
      </p>
    </div>
  );
}
