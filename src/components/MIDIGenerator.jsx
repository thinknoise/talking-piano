import { useState } from "react";
import MidiWriter from "midi-writer-js";

export default function MIDIGenerator({ pitchData, audioBuffer }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMIDI = () => {
    if (!pitchData || pitchData.length === 0) return;

    setIsGenerating(true);

    try {
      const track = new MidiWriter.Track();
      const BPM = 120;
      track.setTempo(BPM);

      const ticksPerBeat = 128;
      const secondsPerBeat = 60 / BPM;
      const ticksPerSecond = ticksPerBeat / secondsPerBeat;

      // Hz to MIDI note conversion
      const hzToMidi = (hz) => {
        if (!hz || hz <= 0) return null;
        const midiFloat = 69 + 12 * Math.log2(hz / 440);
        return Math.max(0, Math.min(127, Math.round(midiFloat)));
      };

      // Group pitches into time windows (20ms)
      const timeWindowSize = 0.02;
      const pitchGroups = [];
      let currentGroup = { startTime: 0, pitches: [] };

      for (const item of pitchData) {
        const time = parseFloat(item.time);
        const hz = item.hz;

        if (time > currentGroup.startTime + timeWindowSize) {
          if (currentGroup.pitches.length > 0) {
            pitchGroups.push({ ...currentGroup });
          }
          currentGroup = { startTime: time, pitches: [hz] };
        } else {
          currentGroup.pitches.push(hz);
        }
      }

      if (currentGroup.pitches.length > 0) {
        pitchGroups.push(currentGroup);
      }

      let currentTimeTicks = 0;

      // Convert pitch groups to MIDI notes
      for (let i = 0; i < pitchGroups.length; i++) {
        const group = pitchGroups[i];
        const time = group.startTime;

        // Get unique MIDI notes from all pitches in this window
        const uniquePitches = [...new Set(group.pitches)];
        const midiNotes = uniquePitches
          .map((hz) => hzToMidi(hz))
          .filter((note) => note !== null)
          .filter((note, idx, arr) => arr.indexOf(note) === idx)
          .sort((a, b) => a - b);

        if (midiNotes.length === 0) continue;

        // Calculate timing
        const targetTimeTicks = Math.round(time * ticksPerSecond);

        // Add rest if needed
        if (targetTimeTicks > currentTimeTicks) {
          const waitTicks = targetTimeTicks - currentTimeTicks;
          track.addEvent(
            new MidiWriter.NoteEvent({
              pitch: ["C4"],
              duration: `T${waitTicks}`,
              velocity: 0,
            })
          );
          currentTimeTicks = targetTimeTicks;
        }

        // Calculate duration
        let durationTicks = 16;
        if (i + 1 < pitchGroups.length) {
          const nextTime = pitchGroups[i + 1].startTime;
          const timeDiff = nextTime - time;
          durationTicks = Math.max(
            8,
            Math.min(64, Math.round(timeDiff * ticksPerSecond))
          );
        }

        // Add note(s) as chord
        track.addEvent(
          new MidiWriter.NoteEvent({
            pitch: midiNotes,
            duration: `T${durationTicks}`,
            velocity: 80,
          })
        );

        currentTimeTicks += durationTicks;
      }

      // Create MIDI file
      const write = new MidiWriter.Writer([track]);
      const midiData = write.buildFile();

      // Download
      const blob = new Blob([midiData], { type: "audio/midi" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audio_pitch.mid";
      a.click();
      URL.revokeObjectURL(url);

      setIsGenerating(false);
    } catch (err) {
      console.error("MIDI generation error:", err);
      alert(`Failed to generate MIDI: ${err.message}`);
      setIsGenerating(false);
    }
  };

  const hasPitchData = pitchData && pitchData.length > 0;

  return (
    <div
      style={{
        padding: "20px",
        background: "#f0f0f0",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <h2>MIDI Generation</h2>

      <button
        onClick={generateMIDI}
        disabled={!hasPitchData || isGenerating}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          cursor: hasPitchData && !isGenerating ? "pointer" : "not-allowed",
          background: hasPitchData ? "#4CAF50" : "#ccc",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
        }}
      >
        {isGenerating ? "Generating..." : "🎵 Generate MIDI File"}
      </button>

      {hasPitchData && (
        <div style={{ marginTop: "15px", fontSize: "14px", color: "#666" }}>
          <p>✓ Ready to generate MIDI from {pitchData.length} pitch samples</p>
          <p style={{ marginTop: "5px" }}>
            This will create a MIDI file where each detected pitch becomes a
            MIDI note with accurate timing at 120 BPM.
          </p>
        </div>
      )}

      {!hasPitchData && (
        <p style={{ marginTop: "10px", fontSize: "14px", color: "#999" }}>
          Detect pitches first to enable MIDI generation
        </p>
      )}
    </div>
  );
}
