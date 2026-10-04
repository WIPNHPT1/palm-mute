// Standard MIDI File (type 1) writing and reading, with no dependencies and no app imports (the tests and
// verify read the exported files back with `parseMidi`). docs/song-builder-prd.md §7.

export type MidiNote = { tick: number; dur: number; pitch: number; velocity: number };
export type MidiTrack = {
  name: string;
  channel: number;
  /** General MIDI program (0-based); omitted for drums. */
  program?: number;
  notes: MidiNote[];
  /** Pitch bends (−8192…8191, centre 0), e.g. a lead guitar's string bends. */
  bends?: { tick: number; value: number }[];
};
export type MidiSong = {
  ppq: number;
  bpm: number;
  /** Key signature: sharps (+) or flats (−), major. */
  keySharps: number;
  title: string;
  markers: { tick: number; text: string }[];
  tracks: MidiTrack[];
};

const text = (s: string) => [...new TextEncoder().encode(s)];

/** A variable-length quantity (MIDI's delta-time encoding). */
function vlq(n: number): number[] {
  const out = [n & 0x7f];
  for (n >>= 7; n > 0; n >>= 7) out.unshift((n & 0x7f) | 0x80);
  return out;
}

function chunk(type: string, body: number[]): number[] {
  const len = body.length;
  return [...text(type), (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...body];
}

/** Events at absolute ticks → a track chunk with delta times, ending with End of Track. */
function trackChunk(events: { tick: number; order: number; bytes: number[] }[]): number[] {
  const sorted = events.map((e, i) => ({ ...e, i })).sort((a, b) => a.tick - b.tick || a.order - b.order || a.i - b.i);
  const body: number[] = [];
  let last = 0;
  for (const e of sorted) {
    body.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  body.push(0, 0xff, 0x2f, 0);
  return chunk("MTrk", body);
}

const meta = (type: number, data: number[]) => [0xff, type, ...vlq(data.length), ...data];

export function writeMidi(song: MidiSong): Uint8Array {
  const tempo = Math.round(60_000_000 / song.bpm);
  const conductor = trackChunk([
    { tick: 0, order: 0, bytes: meta(0x03, text(song.title)) },
    { tick: 0, order: 0, bytes: meta(0x51, [(tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255]) },
    { tick: 0, order: 0, bytes: meta(0x58, [4, 2, 24, 8]) },
    { tick: 0, order: 0, bytes: meta(0x59, [song.keySharps & 255, 0]) },
    ...song.markers.map((m) => ({ tick: m.tick, order: 1, bytes: meta(0x06, text(m.text)) })),
  ]);
  const tracks = song.tracks.map((t) => {
    const ch = t.channel & 15;
    const events: { tick: number; order: number; bytes: number[] }[] = [{ tick: 0, order: 0, bytes: meta(0x03, text(t.name)) }];
    if (t.program !== undefined) events.push({ tick: 0, order: 0, bytes: [0xc0 | ch, t.program & 127] });
    for (const b of t.bends ?? []) {
      const v = Math.max(0, Math.min(16383, b.value + 8192));
      events.push({ tick: b.tick, order: 2, bytes: [0xe0 | ch, v & 127, (v >> 7) & 127] });
    }
    for (const n of t.notes) {
      // At the same tick, note-offs go before note-ons, so a repeated pitch restarts cleanly.
      events.push({ tick: n.tick, order: 3, bytes: [0x90 | ch, n.pitch & 127, Math.max(1, Math.min(127, Math.round(n.velocity)))] });
      events.push({ tick: n.tick + Math.max(1, n.dur), order: 1, bytes: [0x80 | ch, n.pitch & 127, 0] });
    }
    return trackChunk(events);
  });
  const header = chunk("MThd", [0, 1, 0, tracks.length + 1, (song.ppq >> 8) & 255, song.ppq & 255]);
  return new Uint8Array([...header, ...conductor, ...tracks.flat()]);
}

// ---------------------------------------------------------------------------
// Reading (for verify and the browser tests)

export type ParsedMidi = {
  format: number;
  ppq: number;
  tracks: {
    name?: string;
    events: { tick: number; kind: "on" | "off" | "program" | "bend" | "meta"; channel?: number; pitch?: number; velocity?: number; value?: number; type?: number; text?: string; data?: number[] }[];
  }[];
};

export function parseMidi(bytes: Uint8Array): ParsedMidi {
  let p = 0;
  const str = (n: number) => String.fromCharCode(...bytes.slice(p, (p += n)));
  const u32 = () => ((bytes[p++] << 24) | (bytes[p++] << 16) | (bytes[p++] << 8) | bytes[p++]) >>> 0;
  const u16 = () => (bytes[p++] << 8) | bytes[p++];
  const readVlq = () => {
    let n = 0;
    for (;;) {
      const b = bytes[p++];
      n = (n << 7) | (b & 0x7f);
      if (!(b & 0x80)) return n;
    }
  };
  if (str(4) !== "MThd") throw new Error("not a MIDI file");
  if (u32() !== 6) throw new Error("bad header length");
  const format = u16();
  const count = u16();
  const ppq = u16();
  const tracks: ParsedMidi["tracks"] = [];
  for (let t = 0; t < count; t++) {
    if (str(4) !== "MTrk") throw new Error(`track ${t}: no MTrk`);
    const end = u32() + p;
    const track: ParsedMidi["tracks"][number] = { events: [] };
    let tick = 0;
    let status = 0;
    let ended = false;
    while (p < end) {
      tick += readVlq();
      let b = bytes[p++];
      if (b === 0xff) {
        const type = bytes[p++];
        const len = readVlq();
        const data = [...bytes.slice(p, (p += len))];
        const txt = new TextDecoder().decode(new Uint8Array(data));
        if (type === 0x03) track.name = txt;
        if (type === 0x2f) ended = true;
        track.events.push({ tick, kind: "meta", type, data, text: txt });
        continue;
      }
      if (b & 0x80) status = b;
      else p--; // running status
      b = status;
      const channel = b & 15;
      const kind = b & 0xf0;
      if (kind === 0x90 || kind === 0x80) {
        const pitch = bytes[p++];
        const velocity = bytes[p++];
        track.events.push({ tick, kind: kind === 0x90 && velocity > 0 ? "on" : "off", channel, pitch, velocity });
      } else if (kind === 0xc0) track.events.push({ tick, kind: "program", channel, value: bytes[p++] });
      else if (kind === 0xe0) {
        const lsb = bytes[p++];
        const msb = bytes[p++];
        track.events.push({ tick, kind: "bend", channel, value: ((msb << 7) | lsb) - 8192 });
      } else if (kind === 0xb0 || kind === 0xa0) p += 2;
      else if (kind === 0xd0) p += 1;
      else throw new Error(`track ${t}: unknown event ${b.toString(16)}`);
    }
    if (!ended) throw new Error(`track ${t}: no End of Track`);
    tracks.push(track);
  }
  return { format, ppq, tracks };
}

/** A parsed track's notes, with each note-on matched to its note-off. */
export function notesOf(track: ParsedMidi["tracks"][number]): MidiNote[] {
  const open = new Map<number, { tick: number; velocity: number }[]>();
  const out: MidiNote[] = [];
  for (const e of track.events) {
    if (e.kind === "on") (open.get(e.pitch!) ?? open.set(e.pitch!, []).get(e.pitch!)!).push({ tick: e.tick, velocity: e.velocity! });
    if (e.kind === "off") {
      const on = open.get(e.pitch!)?.shift();
      if (on) out.push({ tick: on.tick, dur: e.tick - on.tick, pitch: e.pitch!, velocity: on.velocity });
    }
  }
  return out.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
}
