import { useState, useRef, useEffect } from "react";
import Soundfont from "soundfont-player";

export default function MIDIPlayer({ pitchData }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [instrument, setInstrument] = useState(null);
  const [progress, setProgress] = useState(0);
  const audioContextRef = useRef(null);
  const playbackRef = useRef(null);

  useEffect(() => {
    // Initialize AudioContext and load instrument
    const initAudio = async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ac;

      // Load acoustic grand piano soundfont
      const instr = await Soundfont.instrument(ac, "acoustic_grand_piano");
      setInstrument(instr);
    };

    initAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playMIDI = async () => {
    if (!instrument || !pitchData || pitchData.length === 0) return;

    setIsPlaying(true);
    setProgress(0);

    // Convert Hz to MIDI note numbers
    const notes = pitchData.map((pitch) => {
      const hz = pitch.hz;
      const midiNote = Math.round(69 + 12 * Math.log2(hz / 440));
      return {
        time: parseFloat(pitch.time),
        midi: midiNote,
        hz: hz,
      };
    });

    // Group notes by time windows (20ms)
    const timeWindowSize = 0.02;
    const noteGroups = [];
    let currentGroup = [];
    let currentTime = 0;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.time - currentTime < timeWindowSize) {
        currentGroup.push(note);
      } else {
        if (currentGroup.length > 0) {
          noteGroups.push({
            time: currentTime,
            notes: currentGroup,
          });
        }
        currentGroup = [note];
        currentTime = note.time;
      }
    }

    if (currentGroup.length > 0) {
      noteGroups.push({
        time: currentTime,
        notes: currentGroup,
      });
    }

    // Play notes
    const startTime = audioContextRef.current.currentTime;
    const totalDuration = noteGroups[noteGroups.length - 1]?.time || 0;

    playbackRef.current = { active: true };

    for (let i = 0; i < noteGroups.length; i++) {
      if (!playbackRef.current?.active) break;

      const group = noteGroups[i];
      const playTime = startTime + group.time;

      // Play all notes in the group as a chord
      group.notes.forEach((note) => {
        instrument.play(note.midi, playTime, { duration: 0.2 });
      });

      // Update progress
      setProgress(Math.round((group.time / totalDuration) * 100));

      // Wait for next group
      if (i < noteGroups.length - 1) {
        const delay = (noteGroups[i + 1].time - group.time) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    setIsPlaying(false);
    setProgress(100);
  };

  const stopPlayback = () => {
    if (playbackRef.current) {
      playbackRef.current.active = false;
    }
    setIsPlaying(false);
    setProgress(0);
  };

  if (!pitchData || pitchData.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: "20px",
        background: "#f0f0f0",
        borderRadius: "8px",
        marginTop: "20px",
      }}
    >
      <h3>🎹 MIDI Player</h3>
      <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
        Play your detected pitches as MIDI audio in the browser
      </p>

      <div style={{ marginBottom: "15px" }}>
        {!isPlaying ? (
          <button
            onClick={playMIDI}
            disabled={!instrument}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              cursor: instrument ? "pointer" : "not-allowed",
              background: instrument ? "#4caf50" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
            }}
          >
            ▶️ Play MIDI
          </button>
        ) : (
          <button
            onClick={stopPlayback}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              cursor: "pointer",
              background: "#e74c3c",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
            }}
          >
            ⏹ Stop
          </button>
        )}

        {!instrument && (
          <span
            style={{
              marginLeft: "10px",
              color: "#999",
              fontSize: "14px",
            }}
          >
            Loading piano soundfont...
          </span>
        )}
      </div>

      {isPlaying && (
        <div>
          <div
            style={{
              width: "100%",
              height: "6px",
              background: "#ddd",
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
          <p style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
            Playing... {progress}%
          </p>
        </div>
      )}

      <p
        style={{
          marginTop: "15px",
          fontSize: "12px",
          color: "#999",
        }}
      >
        Using acoustic grand piano soundfont • {pitchData.length} pitch samples
      </p>
    </div>
  );
}
