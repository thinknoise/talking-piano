import { useRef, useEffect, useState } from "react";

export default function Spectrogram({ audioBuffer, audioContext }) {
  const canvasRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [spectrogramData, setSpectrogramData] = useState(null);

  useEffect(() => {
    if (audioBuffer && audioContext && canvasRef.current) {
      generateSpectrogram();
    }
  }, [audioBuffer, audioContext]);

  const generateSpectrogram = async () => {
    setIsGenerating(true);
    setProgress(0);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Create offline context for analysis
    const offlineContext = new OfflineAudioContext(
      1,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Create analyser
    const analyser = offlineContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;

    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);
    analyser.connect(offlineContext.destination);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Calculate time steps
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    const timeStep = 0.01; // 10ms per column
    const numTimeSteps = Math.floor(duration / timeStep);

    // Set canvas dimensions
    canvas.width = Math.min(numTimeSteps, 2000); // Max 2000px wide
    canvas.height = 400;

    const timeStepsPerPixel = numTimeSteps / canvas.width;
    const freqBinsPerPixel = bufferLength / canvas.height;

    // Get channel data
    const channelData = audioBuffer.getChannelData(0);

    // Process in chunks to avoid blocking
    const spectrogramArray = [];

    for (let t = 0; t < canvas.width; t++) {
      const timeIndex = Math.floor(
        t * timeStepsPerPixel * timeStep * sampleRate
      );

      if (timeIndex + analyser.fftSize < channelData.length) {
        // Perform FFT on this time slice
        const slice = channelData.slice(
          timeIndex,
          timeIndex + analyser.fftSize
        );
        const fftData = performFFT(slice);
        spectrogramArray.push(fftData);
      }

      // Update progress
      if (t % 50 === 0) {
        setProgress(Math.round((t / canvas.width) * 100));
        await new Promise((resolve) => setTimeout(resolve, 0)); // Yield to UI
      }
    }

    setSpectrogramData(spectrogramArray);
    drawSpectrogram(spectrogramArray, canvas, ctx);
    setIsGenerating(false);
    setProgress(100);
  };

  const performFFT = (buffer) => {
    const fftSize = 2048;
    const fft = new Float32Array(fftSize);

    // Simple magnitude spectrum calculation
    for (let i = 0; i < Math.min(buffer.length, fftSize); i++) {
      fft[i] = Math.abs(buffer[i]);
    }

    // Apply basic frequency binning
    const bins = 400; // Match canvas height
    const result = new Uint8Array(bins);
    const binSize = fftSize / bins;

    for (let i = 0; i < bins; i++) {
      let sum = 0;
      const start = Math.floor(i * binSize);
      const end = Math.floor((i + 1) * binSize);

      for (let j = start; j < end && j < fft.length; j++) {
        sum += fft[j] * fft[j]; // Power spectrum
      }

      const avg = sum / (end - start);
      result[i] = Math.min(255, Math.sqrt(avg) * 255 * 10); // Normalize
    }

    return result;
  };

  const drawSpectrogram = (data, canvas, ctx) => {
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Draw spectrogram
    for (let x = 0; x < data.length; x++) {
      const column = data[x];

      for (let y = 0; y < height; y++) {
        const freqIndex = height - y - 1; // Flip Y axis (low freq at bottom)
        const binIndex = Math.floor((freqIndex / height) * column.length);
        const value = column[binIndex];

        // Color mapping: black -> blue -> cyan -> yellow -> red
        const intensity = value / 255;
        let r, g, b;

        if (intensity < 0.25) {
          // Black to blue
          r = 0;
          g = 0;
          b = Math.floor(intensity * 4 * 255);
        } else if (intensity < 0.5) {
          // Blue to cyan
          r = 0;
          g = Math.floor((intensity - 0.25) * 4 * 255);
          b = 255;
        } else if (intensity < 0.75) {
          // Cyan to yellow
          r = Math.floor((intensity - 0.5) * 4 * 255);
          g = 255;
          b = Math.floor((1 - (intensity - 0.5) * 4) * 255);
        } else {
          // Yellow to red
          r = 255;
          g = Math.floor((1 - (intensity - 0.75) * 4) * 255);
          b = 0;
        }

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Draw frequency labels
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";

    const maxFreq = 22050; // Nyquist frequency
    const labelFreqs = [100, 500, 1000, 2000, 5000, 10000, 20000];

    labelFreqs.forEach((freq) => {
      const y = height - (freq / maxFreq) * height;
      ctx.fillText(`${freq}Hz`, 50, y);
      ctx.strokeStyle = "#444";
      ctx.beginPath();
      ctx.moveTo(55, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    // Draw time labels
    ctx.textAlign = "center";
    const duration = audioBuffer.duration;
    const numLabels = 10;

    for (let i = 0; i <= numLabels; i++) {
      const time = (duration / numLabels) * i;
      const x = (width / numLabels) * i;
      ctx.fillText(`${time.toFixed(1)}s`, x, height - 5);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "#1a1a1a",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <h2 style={{ color: "#fff" }}>Spectrogram</h2>
      <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "15px" }}>
        Time-frequency visualization showing harmonic content and pitch
        evolution
      </p>

      {isGenerating && (
        <div style={{ marginBottom: "15px" }}>
          <div
            style={{
              width: "100%",
              height: "6px",
              background: "#333",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "#4caf50",
                transition: "width 0.1s linear",
              }}
            />
          </div>
          <p style={{ color: "#aaa", fontSize: "12px", marginTop: "5px" }}>
            Generating spectrogram... {progress}%
          </p>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          border: "2px solid #333",
          borderRadius: "4px",
          display: "block",
          background: "#000",
          maxWidth: "100%",
        }}
      />

      <div
        style={{
          marginTop: "15px",
          padding: "10px",
          background: "#2a2a2a",
          borderRadius: "4px",
        }}
      >
        <p style={{ color: "#aaa", fontSize: "12px", margin: 0 }}>
          🔵 Blue = Low intensity | 🟡 Yellow = Medium | 🔴 Red = High intensity
        </p>
        <p style={{ color: "#aaa", fontSize: "12px", margin: "5px 0 0 0" }}>
          Y-axis: Frequency (Hz) | X-axis: Time (seconds)
        </p>
      </div>
    </div>
  );
}
