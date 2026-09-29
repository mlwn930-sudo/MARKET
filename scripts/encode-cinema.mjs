/**
 * Re-encode the entrance films for the web.
 *
 * The clips arrive from the generator at around 37 Mb/s, which is a
 * mastering bitrate, not a delivery one — four seconds of it weighs
 * eighteen megabytes. One arrived as HEVC in ten bits, which Safari
 * decodes and Chrome does not: the browser reports the file ready and
 * paints nothing.
 *
 * This normalises both problems. H.264 High at CRF 20 is visually the
 * same picture at roughly a third of the weight, 8-bit 4:2:0 plays
 * everywhere, and faststart puts the index at the front of the file so
 * playback can begin before the download finishes rather than after.
 *
 *   node scripts/encode-cinema.mjs            all of public/cinema
 *   node scripts/encode-cinema.mjs a.mp4 b.mp4  just those
 *
 * Originals are left alone; output lands beside them with .web.mp4 and
 * is renamed over the original only once it has been checked.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";

const DIR = "public/cinema";
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(DIR).filter((f) => f.endsWith(".mp4"));

const mb = (p) => (statSync(p).size / 1048576).toFixed(1) + " MB";

for (const name of files) {
  const from = join(DIR, name);
  const to = join(DIR, name.replace(/\.mp4$/, ".web.mp4"));
  const before = mb(from);

  const run = spawnSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", "-i", from,
     "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
     "-preset", "slow", "-crf", "20",
     "-c:a", "aac", "-b:a", "128k",
     "-movflags", "+faststart", to],
    { stdio: "inherit" },
  );

  if (run.status !== 0) {
    console.error(`${name}: failed`);
    continue;
  }
  console.log(`${name}: ${before} -> ${mb(to)}`);
}
