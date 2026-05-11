/**
 * Fortnite .replay file parser
 *
 * Fortnite replay files use Epic's Unreal Engine replay format.
 * Structure:
 *   - Magic header (4 bytes): 0x1CA2E27F
 *   - File version (4 bytes)
 *   - Length in MS (4 bytes)
 *   - Friendly name string (length-prefixed)
 *   - Chunks (type + size + data)
 *
 * Each chunk is typed: Header=0, ReplayData=1, Checkpoint=2, Event=3
 * Event chunks contain named game events (eliminations, damage, etc.)
 *
 * References:
 *   https://github.com/EpicGames/UnrealEngine (ReplayTypes.h)
 *   https://github.com/Shiqan/FortniteReplayDecompressor
 */

export interface ReplayEvent {
  type: string;
  timeMs: number;
  data: Record<string, unknown>;
}

export interface ReplayMeta {
  durationMs: number;
  friendlyName: string;
  fileVersion: number;
  totalEvents: number;
}

export interface ParsedReplay {
  meta: ReplayMeta;
  events: ReplayEvent[];
  gameStats: GameStats;
}

export interface GameStats {
  eliminations: EliminationEvent[];
  damageTaken: DamageEvent[];
  builds: BuildEvent[];
  rotations: RotationEvent[];
  stormEvents: StormEvent[];
  playerName: string;
  placement: number | null;
  kills: number;
  totalDamageTaken: number;
  totalDamageDealt: number;
  materialsUsed: { wood: number; brick: number; metal: number };
}

export interface EliminationEvent {
  timeMs: number;
  timeSec: number;
  eliminated: string;
  eliminator: string;
  weapon: string;
  isPlayerDeath: boolean;
}

export interface DamageEvent {
  timeMs: number;
  timeSec: number;
  amount: number;
  source: string;
  direction: string;
  wasShielded: boolean;
}

export interface BuildEvent {
  timeMs: number;
  timeSec: number;
  buildType: "wall" | "floor" | "ramp" | "cone";
  material: "wood" | "brick" | "metal";
}

export interface RotationEvent {
  timeMs: number;
  timeSec: number;
  x: number;
  y: number;
}

export interface StormEvent {
  timeMs: number;
  timeSec: number;
  phase: number;
  inStorm: boolean;
}

const REPLAY_MAGIC = 0x1ca2e27f;
const CHUNK_TYPE_HEADER = 0;
const CHUNK_TYPE_REPLAY_DATA = 1;
const CHUNK_TYPE_CHECKPOINT = 2;
const CHUNK_TYPE_EVENT = 3;

// Known Fortnite event group names
const EVENT_ELIMINATION = "playerElim";
const EVENT_DAMAGE = "AbnormalMove"; // damage events appear here
const EVENT_STATS = "Athena.MatchStats";
const EVENT_TEAM_STATS = "Athena.TeamStats";

export function parseReplayFile(buffer: Buffer): ParsedReplay {
  const reader = new BinaryReader(buffer);

  // Validate magic
  const magic = reader.readUInt32();
  if (magic !== REPLAY_MAGIC) {
    throw new Error(
      `Invalid replay file: bad magic (got 0x${magic.toString(16)}, expected 0x${REPLAY_MAGIC.toString(16)})`
    );
  }

  const fileVersion = reader.readUInt32();
  const durationMs = reader.readUInt32();
  const friendlyName = reader.readFString();

  // Skip game-specific header fields
  reader.readUInt32(); // isLive
  if (fileVersion >= 3) {
    reader.readUInt64(); // timestamp
  }
  if (fileVersion >= 2) {
    reader.readUInt32(); // isCompressed
  }
  if (fileVersion >= 4) {
    reader.readUInt32(); // isEncrypted
    const encKeyLen = reader.readUInt32();
    reader.skip(encKeyLen); // encryption key bytes
  }

  const events: ReplayEvent[] = [];
  let playerName = "Player";
  let placement: number | null = null;
  let kills = 0;
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  const materialsUsed = { wood: 0, brick: 0, metal: 0 };
  const eliminations: EliminationEvent[] = [];
  const damageTaken: DamageEvent[] = [];
  const builds: BuildEvent[] = [];
  const rotations: RotationEvent[] = [];
  const stormEvents: StormEvent[] = [];

  // Read all chunks
  while (reader.hasMore()) {
    if (reader.remaining() < 8) break;

    const chunkType = reader.readUInt32();
    const chunkSize = reader.readInt32();

    if (chunkSize < 0 || chunkSize > reader.remaining()) break;

    if (chunkType === CHUNK_TYPE_EVENT) {
      const chunkStart = reader.pos;

      try {
        const eventId = reader.readFString();
        const group = reader.readFString();
        const metadata = reader.readFString();
        const startTime = reader.readUInt32();
        const endTime = reader.readUInt32();
        const sizeInBytes = reader.readUInt32();

        const eventData = buffer.slice(reader.pos, reader.pos + sizeInBytes);
        reader.skip(sizeInBytes);

        const rawEvent: ReplayEvent = {
          type: group,
          timeMs: startTime,
          data: { id: eventId, metadata, endTime },
        };
        events.push(rawEvent);

        // Parse known event types
        if (group === EVENT_ELIMINATION && eventData.length > 0) {
          const elim = parseEliminationEvent(eventData, startTime);
          if (elim) {
            eliminations.push(elim);
            if (elim.isPlayerDeath) {
              placement = null; // will be set from stats
            } else {
              kills++;
            }
          }
        }

        if (group === EVENT_STATS) {
          const stats = parseMatchStats(eventData);
          if (stats) {
            placement = stats.placement ?? placement;
            kills = stats.kills ?? kills;
            totalDamageDealt = stats.damageDealt ?? totalDamageDealt;
            totalDamageTaken = stats.damageTaken ?? totalDamageTaken;
          }
        }
      } catch {
        // Skip malformed event chunk
        reader.pos = chunkStart + chunkSize;
      }
    } else {
      reader.skip(chunkSize);
    }
  }

  // Build synthetic rotation snapshots from elimination timestamps
  // (true position data requires full netcode parsing — future enhancement)
  eliminations.forEach((e) => {
    rotations.push({ timeMs: e.timeMs, timeSec: e.timeSec, x: 0, y: 0 });
  });

  const meta: ReplayMeta = {
    durationMs,
    friendlyName: friendlyName || "Unknown Match",
    fileVersion,
    totalEvents: events.length,
  };

  const gameStats: GameStats = {
    eliminations,
    damageTaken,
    builds,
    rotations,
    stormEvents,
    playerName,
    placement,
    kills,
    totalDamageTaken,
    totalDamageDealt,
    materialsUsed,
  };

  return { meta, events, gameStats };
}

function parseEliminationEvent(
  data: Buffer,
  timeMs: number
): EliminationEvent | null {
  try {
    const reader = new BinaryReader(data);
    // Elimination event layout (varies by game version — this covers Season 20+):
    // eliminated player name, eliminator name, gun type, knocked/killed
    const eliminated = reader.readFString() || "Unknown";
    const eliminator = reader.readFString() || "Unknown";
    const weapon = reader.readFString() || "Unknown";
    const knocked = reader.readUInt32(); // 1 = knocked, 0 = eliminated

    return {
      timeMs,
      timeSec: Math.round(timeMs / 1000),
      eliminated,
      eliminator,
      weapon,
      isPlayerDeath: knocked === 0,
    };
  } catch {
    return null;
  }
}

function parseMatchStats(
  data: Buffer
): Partial<{
  placement: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
}> | null {
  try {
    const reader = new BinaryReader(data);
    const accuracy = reader.readFloat();
    const kills = reader.readUInt32();
    const placement = reader.readUInt32();
    const timeAliveSeconds = reader.readUInt32();
    const damageDealt = reader.readFloat();
    const damageTaken = reader.readFloat();

    void accuracy;
    void timeAliveSeconds;

    return { placement, kills, damageDealt, damageTaken };
  } catch {
    return null;
  }
}

class BinaryReader {
  pos = 0;
  private buf: Buffer;

  constructor(buf: Buffer) {
    this.buf = buf;
  }

  hasMore(): boolean {
    return this.pos < this.buf.length;
  }

  remaining(): number {
    return this.buf.length - this.pos;
  }

  skip(n: number) {
    this.pos += n;
  }

  readUInt8(): number {
    const v = this.buf.readUInt8(this.pos);
    this.pos += 1;
    return v;
  }

  readUInt32(): number {
    const v = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  readInt32(): number {
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  readUInt64(): bigint {
    const v = this.buf.readBigUInt64LE(this.pos);
    this.pos += 8;
    return v;
  }

  readFloat(): number {
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }

  // Unreal Engine FString: int32 length (negative = UTF-16), then chars
  readFString(): string {
    const len = this.readInt32();
    if (len === 0) return "";

    if (len < 0) {
      // UTF-16 LE
      const byteLen = -len * 2;
      const str = this.buf.toString("utf16le", this.pos, this.pos + byteLen - 2);
      this.pos += byteLen;
      return str;
    }

    const str = this.buf.toString("utf8", this.pos, this.pos + len - 1);
    this.pos += len;
    return str;
  }
}

/**
 * Returns a structured summary of the replay suitable for AI analysis.
 * Caps game time at maxSecs for the free tier.
 */
export function summarizeForAnalysis(
  replay: ParsedReplay,
  maxSecs: number
): string {
  const { meta, gameStats } = replay;
  const capMs = maxSecs * 1000;

  const elims = gameStats.eliminations.filter((e) => e.timeMs <= capMs);
  const damage = gameStats.damageTaken.filter((e) => e.timeMs <= capMs);

  const lines: string[] = [
    `MATCH SUMMARY`,
    `Match: ${meta.friendlyName}`,
    `Total duration: ${Math.round(meta.durationMs / 1000)}s (analyzed: ${maxSecs}s)`,
    `Placement: ${gameStats.placement ?? "Unknown"}`,
    `Kills: ${gameStats.kills}`,
    `Damage dealt: ${Math.round(gameStats.totalDamageDealt)}`,
    `Damage taken: ${Math.round(gameStats.totalDamageTaken)}`,
    `Materials used — Wood: ${gameStats.materialsUsed.wood}, Brick: ${gameStats.materialsUsed.brick}, Metal: ${gameStats.materialsUsed.metal}`,
    ``,
    `ELIMINATIONS (${elims.length}):`,
  ];

  elims.forEach((e) => {
    const t = formatTime(e.timeSec);
    if (e.isPlayerDeath) {
      lines.push(`  [${t}] PLAYER DIED — eliminated by ${e.eliminator} using ${e.weapon}`);
    } else {
      lines.push(`  [${t}] Player eliminated ${e.eliminated} with ${e.weapon}`);
    }
  });

  if (damage.length > 0) {
    lines.push(``, `DAMAGE TAKEN (${damage.length} events):`);
    damage.forEach((d) => {
      lines.push(`  [${formatTime(d.timeSec)}] Took ${d.amount} dmg from ${d.source} (direction: ${d.direction})`);
    });
  }

  return lines.join("\n");
}

function formatTime(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
