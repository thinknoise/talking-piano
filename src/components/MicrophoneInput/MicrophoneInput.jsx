import { useState, useRef, useEffect } from "react";
import Soundfont from "soundfont-player";
import "./MicrophoneInput.css";

// Autocorrelation pitch detection (same as PitchDetector)
function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let best_offset = -1;
  let best_correlation = 0;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }

  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.0005) return -1;

  let lastCorrelation = 1;

  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;

    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }

    correlation = 1 - correlation / MAX_SAMPLES;

    if (correlation > 0.9 && correlation > lastCorrelation) {
      const foundGoodCorrelation = correlation > best_correlation;

      if (foundGoodCorrelation) {
        best_correlation = correlation;
        best_offset = offset;
      }
    }

    lastCorrelation = correlation;
  }

  if (best_offset === -1) return -1;

  const hz = sampleRate / best_offset;
  return hz;
}

export default function MicrophoneInput({
  onPitchesRecorded,
  onAudioRecorded,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentPitch, setCurrentPitch] = useState(null);
  const [recordedPitches, setRecordedPitches] = useState([]);
  const [error, setError] = useState("");
  const [livePlayback, setLivePlayback] = useState(false);
  const [instrument, setInstrument] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState(
    "acoustic_grand_piano",
  );

  const availableInstruments = [
    { value: "acoustic_grand_piano", label: "Acoustic Grand Piano" },
    { value: "bright_acoustic_piano", label: "Bright Acoustic Piano" },
    { value: "electric_grand_piano", label: "Electric Grand Piano" },
    { value: "honkytonk_piano", label: "Honky-tonk Piano" },
    { value: "electric_piano_1", label: "Electric Piano 1" },
    { value: "electric_piano_2", label: "Electric Piano 2" },
    { value: "harpsichord", label: "Harpsichord" },
    { value: "clavinet", label: "Clavinet" },
    { value: "celesta", label: "Celesta" },
    { value: "glockenspiel", label: "Glockenspiel" },
    { value: "music_box", label: "Music Box" },
    { value: "vibraphone", label: "Vibraphone" },
    { value: "marimba", label: "Marimba" },
    { value: "xylophone", label: "Xylophone" },
    { value: "tubular_bells", label: "Tubular Bells" },
    { value: "dulcimer", label: "Dulcimer" },
    { value: "drawbar_organ", label: "Drawbar Organ" },
    { value: "percussive_organ", label: "Percussive Organ" },
    { value: "rock_organ", label: "Rock Organ" },
    { value: "church_organ", label: "Church Organ" },
    { value: "reed_organ", label: "Reed Organ" },
    { value: "accordion", label: "Accordion" },
    { value: "harmonica", label: "Harmonica" },
    { value: "tango_accordion", label: "Tango Accordion" },
    { value: "acoustic_guitar_nylon", label: "Acoustic Guitar (nylon)" },
    { value: "acoustic_guitar_steel", label: "Acoustic Guitar (steel)" },
    { value: "electric_guitar_jazz", label: "Electric Guitar (jazz)" },
    { value: "electric_guitar_clean", label: "Electric Guitar (clean)" },
    { value: "electric_guitar_muted", label: "Electric Guitar (muted)" },
    { value: "overdriven_guitar", label: "Overdriven Guitar" },
    { value: "distortion_guitar", label: "Distortion Guitar" },
    { value: "acoustic_bass", label: "Acoustic Bass" },
    { value: "electric_bass_finger", label: "Electric Bass (finger)" },
    { value: "electric_bass_pick", label: "Electric Bass (pick)" },
    { value: "fretless_bass", label: "Fretless Bass" },
    { value: "slap_bass_1", label: "Slap Bass 1" },
    { value: "slap_bass_2", label: "Slap Bass 2" },
    { value: "synth_bass_1", label: "Synth Bass 1" },
    { value: "synth_bass_2", label: "Synth Bass 2" },
    { value: "violin", label: "Violin" },
    { value: "viola", label: "Viola" },
    { value: "cello", label: "Cello" },
    { value: "contrabass", label: "Contrabass" },
    { value: "tremolo_strings", label: "Tremolo Strings" },
    { value: "pizzicato_strings", label: "Pizzicato Strings" },
    { value: "orchestral_harp", label: "Orchestral Harp" },
    { value: "timpani", label: "Timpani" },
    { value: "string_ensemble_1", label: "String Ensemble 1" },
    { value: "string_ensemble_2", label: "String Ensemble 2" },
    { value: "synthstrings_1", label: "SynthStrings 1" },
    { value: "synthstrings_2", label: "SynthStrings 2" },
    { value: "choir_aahs", label: "Choir Aahs" },
    { value: "voice_oohs", label: "Voice Oohs" },
    { value: "synth_voice", label: "Synth Voice" },
    { value: "orchestra_hit", label: "Orchestra Hit" },
    { value: "trumpet", label: "Trumpet" },
    { value: "trombone", label: "Trombone" },
    { value: "tuba", label: "Tuba" },
    { value: "muted_trumpet", label: "Muted Trumpet" },
    { value: "french_horn", label: "French Horn" },
    { value: "brass_section", label: "Brass Section" },
    { value: "synthbrass_1", label: "SynthBrass 1" },
    { value: "synthbrass_2", label: "SynthBrass 2" },
    { value: "soprano_sax", label: "Soprano Sax" },
    { value: "alto_sax", label: "Alto Sax" },
    { value: "tenor_sax", label: "Tenor Sax" },
    { value: "baritone_sax", label: "Baritone Sax" },
    { value: "oboe", label: "Oboe" },
    { value: "english_horn", label: "English Horn" },
    { value: "bassoon", label: "Bassoon" },
    { value: "clarinet", label: "Clarinet" },
    { value: "piccolo", label: "Piccolo" },
    { value: "flute", label: "Flute" },
    { value: "recorder", label: "Recorder" },
    { value: "pan_flute", label: "Pan Flute" },
    { value: "blown_bottle", label: "Blown Bottle" },
    { value: "shakuhachi", label: "Shakuhachi" },
    { value: "whistle", label: "Whistle" },
    { value: "ocarina", label: "Ocarina" },
  ];

  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animationRef = useRef(null);
  const startTimeRef = useRef(0);
  const pitchesRef = useRef([]);
  const currentNoteRef = useRef(null);
  const playbackAudioContextRef = useRef(null);
  const statsIntervalRef = useRef(null);

  const [liveStats, setLiveStats] = useState({
    duration: 0,
    minHz: 0,
    maxHz: 0,
    pitchCount: 0,
  });

  // Load soundfont instrument on mount and when instrument changes
  useEffect(() => {
    const loadInstrument = async () => {
      if (
        playbackAudioContextRef.current &&
        playbackAudioContextRef.current.state !== "closed"
      ) {
        playbackAudioContextRef.current.close();
      }
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      playbackAudioContextRef.current = ac;

      // Resume AudioContext if it's suspended (required by browsers for autoplay policy)
      if (ac.state === "suspended") {
        await ac.resume();
      }

      const instr = await Soundfont.instrument(ac, selectedInstrument);
      setInstrument(instr);
    };

    loadInstrument();

    return () => {
      if (
        playbackAudioContextRef.current &&
        playbackAudioContextRef.current.state !== "closed"
      ) {
        playbackAudioContextRef.current.close();
      }
    };
  }, [selectedInstrument]);

  const startRecording = async () => {
    try {
      setError("");

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      micStreamRef.current = stream;

      // Create audio context
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      audioContextRef.current = audioContext;

      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Set up MediaRecorder to capture raw audio
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();

      setIsRecording(true);
      // eslint-disable-next-line react-hooks/purity
      startTimeRef.current = performance.now();
      pitchesRef.current = [];
      setRecordedPitches([]);

      // Start stats update interval (every second)
      statsIntervalRef.current = setInterval(() => {
        const pitches = pitchesRef.current;
        if (pitches.length > 0) {
          setLiveStats({
            duration: parseFloat(pitches[pitches.length - 1]?.time || 0),
            minHz: Math.min(...pitches.map((p) => p.hz)),
            maxHz: Math.max(...pitches.map((p) => p.hz)),
            pitchCount: pitches.length,
          });
        }
      }, 1000);

      // Start visualization and pitch detection loop
      analyze();
    } catch (err) {
      console.error("Microphone error:", err);

      setError(`Failed to access microphone: $ {
          err.message
        }

        `);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    // Stop any currently playing MIDI note
    if (instrument && currentNoteRef.current !== null) {
      instrument.stop();
      currentNoteRef.current = null;
    }

    // Stop stats interval
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    // Stop animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Stop MediaRecorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();

      // Wait for final data and process audio
      await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          // Only process if we have audio data
          if (audioBlob.size > 0) {
            // Convert to AudioBuffer - create a new context for playback
            try {
              const arrayBuffer = await audioBlob.arrayBuffer();
              const playbackContext = new (
                window.AudioContext || window.webkitAudioContext
              )();
              const audioBuffer =
                await playbackContext.decodeAudioData(arrayBuffer);

              // Send to parent for spectrogram analysis with the new playback context
              if (onAudioRecorded) {
                onAudioRecorded(audioBuffer, playbackContext);
              }
            } catch (err) {
              console.error("Failed to decode recorded audio:", err);
            }
          }

          resolve();
        };
      });
    }

    // Stop microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close the recording audio context (not the playback context)
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }

    // Save recorded pitches
    const pitches = pitchesRef.current;
    setRecordedPitches(pitches);

    // Notify parent
    if (onPitchesRecorded && pitches.length > 0) {
      onPitchesRecorded(pitches);
    }
  };

  const analyze = () => {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;

    if (!analyser || !audioContext) return;

    animationRef.current = requestAnimationFrame(analyze);

    // Get time domain data for pitch detection
    const bufferLength = analyser.fftSize;
    const timeDomainData = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(timeDomainData);

    // Detect pitch
    const hz = autoCorrelate(timeDomainData, audioContext.sampleRate);

    if (hz > 50 && hz < 1000) {
      // eslint-disable-next-line react-hooks/purity
      const time = (performance.now() - startTimeRef.current) / 1000;

      const pitch = {
        time: time.toFixed(3),
        hz: Math.round(hz * 100) / 100,
      };

      setCurrentPitch(pitch);
      pitchesRef.current.push(pitch);

      // Live MIDI playback
      if (livePlayback && instrument) {
        const midiNote = Math.round(69 + 12 * Math.log2(hz / 440));

        // If note changed, stop previous and play new
        if (currentNoteRef.current !== midiNote) {
          if (currentNoteRef.current !== null) {
            instrument.stop();
          }

          instrument.play(
            midiNote,
            playbackAudioContextRef.current.currentTime,
            {
              gain: 1.0,
            },
          );
          currentNoteRef.current = midiNote;
        }
      }
    } else {
      setCurrentPitch(null);

      // Stop playing when no pitch detected
      if (livePlayback && instrument && currentNoteRef.current !== null) {
        instrument.stop();
        currentNoteRef.current = null;
      }
    }

    // Get frequency data for visualization
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    // Draw spectrum
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    const barWidth = (width / frequencyData.length) * 2.5;
    let x = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      const barHeight = (frequencyData[i] / 255) * height;
      const hue = (i / frequencyData.length) * 240;

      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }

    // Draw current pitch indicator
    if (currentPitch) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px monospace";

      ctx.fillText(`${currentPitch.hz} Hz`, 10, 30);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="microphone-container">
      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        className="microphone-canvas"
      />
      <div className="controls-row">
        {/* Section 1: Live Playback Toggle */}
        <div className="controls-section">
          <button
            onClick={() => setLivePlayback(!livePlayback)}
            disabled={!instrument || isRecording}
            className={`live-playback-button ${livePlayback ? "active" : ""} ${instrument ? "enabled" : "disabled"}`}
          >
            <span className="emoji-mic">🎤</span>
            <span className="live-text">LIVE</span>
            <span className="emoji-speaker">🔊</span>
          </button>
          {!instrument && (
            <span className="loading-text">(loading piano...)</span>
          )}
        </div>
        {/* Section 2: Instrument Selector */}
        <div className="controls-section">
          <select
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value)}
            disabled={isRecording}
            className="instrument-selector"
          >
            {availableInstruments.map((instr) => (
              <option key={instr.value} value={instr.value}>
                {instr.label}
              </option>
            ))}
          </select>
        </div>
        {/* Section 3: Start button */}
        <div className="controls-section">
          {!isRecording ? (
            <button onClick={startRecording} className="btn btn-danger">
              {livePlayback ? "Fuck it! Do it LIVE!" : "Start Recording"}
            </button>
          ) : (
            <button onClick={stopRecording} className="btn btn-primary">
              ⏹ Stop Recording
            </button>
          )}
        </div>
        {/* Section 4: Stats */}
        <div className="stats-section">
          {isRecording && (
            <div className="recording-results">
              <p className="result-title">
                ● RECORDING - {liveStats.pitchCount} pitches detected
              </p>
              <p className="result-details">
                Duration: {liveStats.duration.toFixed(1)}s
                {liveStats.minHz > 0 && (
                  <>
                    {" | "}
                    Range: {Math.round(liveStats.minHz)}Hz -{" "}
                    {Math.round(liveStats.maxHz)}Hz
                  </>
                )}
              </p>
            </div>
          )}
          {recordedPitches.length > 0 && !isRecording && (
            <div className="recording-results">
              <p className="result-title">
                ✓ Recorded {recordedPitches.length} pitch samples
              </p>
              <p className="result-details">
                Duration: {recordedPitches[recordedPitches.length - 1]?.time}s |
                Range: {Math.min(...recordedPitches.map((p) => p.hz))}Hz -{" "}
                {Math.max(...recordedPitches.map((p) => p.hz))}Hz
              </p>
            </div>
          )}
        </div>
      </div>
      {error && <div className="message message-error mt-10"> {error}</div>}
    </div>
  );
}
