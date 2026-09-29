import * as T from "three";

/**
 * The room behind the doors.
 *
 * It used to be ten cylinders and a grey box, and that was the reason the
 * entrance never landed: the camera flew through a photographed facade and
 * arrived somewhere that was obviously not the same building. The cut
 * between the two was the moment the whole sequence stopped being a place.
 *
 * So this is built to match the doorway it sits behind — warm stone, gold
 * banding, a coffered dome, a polished floor that carries the light back
 * up, and the blue wall of screens that is the only thing in the room that
 * is not architecture. The light does most of the work: gold from behind
 * the camera where the street is, cold blue from the screens ahead, and
 * the floor between them holding both.
 *
 * Everything here is geometry rather than photographs, because the camera
 * moves through it. A photograph holds still the moment you translate past
 * it, and holding still is exactly what a room must not do.
 */

export type TradingHall = {
  group: T.Group;
  /** Screens redraw only when prices change, never per frame. */
  setQuotes(rows: { symbol: string; price: number | null; change: number | null }[]): void;
  dispose(): void;
};

const disposables: { dispose(): void }[] = [];
const track = <V extends { dispose(): void }>(v: V): V => {
  disposables.push(v);
  return v;
};

/** One fluted marble column with a banded capital and base. */
function column(height: number, radius: number, stone: T.Material, gold: T.Material) {
  const group = new T.Group();

  const shaft = new T.Mesh(
    track(new T.CylinderGeometry(radius * 0.86, radius, height, 24, 1, true)),
    stone,
  );
  shaft.position.y = height / 2;
  group.add(shaft);

  /* Flutes: shallow vertical grooves. Twenty thin boxes read as carving
     under this lighting and cost nothing next to a lathed profile. */
  const fluteGeo = track(new T.BoxGeometry(radius * 0.13, height * 0.92, radius * 0.13));
  for (let i = 0; i < 20; i++) {
    const flute = new T.Mesh(fluteGeo, stone);
    const a = (i / 20) * Math.PI * 2;
    flute.position.set(Math.cos(a) * radius * 0.9, height / 2, Math.sin(a) * radius * 0.9);
    flute.rotation.y = -a;
    group.add(flute);
  }

  const capital = new T.Mesh(track(new T.CylinderGeometry(radius * 1.5, radius * 0.9, height * 0.09, 24)), stone);
  capital.position.y = height * 0.955;
  group.add(capital);

  const collar = new T.Mesh(track(new T.CylinderGeometry(radius * 1.05, radius * 1.05, height * 0.018, 24)), gold);
  collar.position.y = height * 0.9;
  group.add(collar);

  const base = new T.Mesh(track(new T.BoxGeometry(radius * 3, height * 0.05, radius * 3)), stone);
  base.position.y = height * 0.025;
  group.add(base);

  const plinth = new T.Mesh(track(new T.BoxGeometry(radius * 3.4, height * 0.022, radius * 3.4)), gold);
  plinth.position.y = height * 0.006;
  group.add(plinth);

  return group;
}

/** A market board: ticker rows down one side, a candlestick run on the
 *  other. Drawn once to a canvas, then only redrawn when prices arrive. */
function boardTexture(width = 1024, height = 576) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;

  function draw(rows: { symbol: string; price: number | null; change: number | null }[], seed: number) {
    ctx.fillStyle = "#04121f";
    ctx.fillRect(0, 0, width, height);

    /* Candlesticks. Deterministic from the seed so a board does not
       reshuffle itself every time a quote lands. */
    const candles = 30;
    const cw = (width * 0.55) / candles;
    let level = height * 0.55;
    for (let i = 0; i < candles; i++) {
      const n = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
      const drift = ((n - Math.floor(n)) - 0.45) * height * 0.06;
      const open = level;
      level = Math.max(height * 0.18, Math.min(height * 0.82, level + drift));
      const up = level < open;
      const x = width * 0.42 + i * cw;
      ctx.strokeStyle = up ? "#31e0a0" : "#ff6b7d";
      ctx.fillStyle = up ? "#31e0a0" : "#ff6b7d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + cw / 2, Math.min(open, level) - 14);
      ctx.lineTo(x + cw / 2, Math.max(open, level) + 14);
      ctx.stroke();
      ctx.fillRect(x + 2, Math.min(open, level), cw - 5, Math.max(3, Math.abs(level - open)));
    }

    /* Ticker rows. */
    ctx.font = "600 27px monospace";
    rows.slice(0, 11).forEach((row, i) => {
      const y = 52 + i * 46;
      ctx.fillStyle = "#8fd9ff";
      ctx.fillText(row.symbol.padEnd(6), 30, y);
      ctx.fillStyle = "#e8f4ff";
      ctx.fillText(row.price != null ? row.price.toFixed(2).padStart(9) : "     ----", 150, y);
      if (row.change != null) {
        ctx.fillStyle = row.change >= 0 ? "#31e0a0" : "#ff6b7d";
        ctx.fillText((row.change >= 0 ? "+" : "") + row.change.toFixed(2) + "%", 330, y);
      }
    });

    ctx.fillStyle = "rgba(143,217,255,.22)";
    ctx.fillRect(0, height - 4, width, 4);
    texture.needsUpdate = true;
  }

  return { texture, draw };
}

export function createTradingHall(): TradingHall {
  const group = new T.Group();

  const stone = track(new T.MeshStandardMaterial({ color: "#a08d72", roughness: 0.58, metalness: 0.06 }));
  const paleStone = track(new T.MeshStandardMaterial({ color: "#bfae93", roughness: 0.5, metalness: 0.05 }));
  const gold = track(new T.MeshStandardMaterial({ color: "#c79a4e", roughness: 0.22, metalness: 0.95 }));
  const bronze = track(new T.MeshStandardMaterial({ color: "#8a6a3a", roughness: 0.34, metalness: 0.9 }));
  const deskWood = track(new T.MeshStandardMaterial({ color: "#1d2733", roughness: 0.38, metalness: 0.35 }));

  /* The floor. Low roughness and high metalness is not physically a marble
     slab, but it is what makes the room carry its own light back up, and
     that reflection is most of what "polished" reads as on screen. */
  const floor = new T.Mesh(
    track(new T.CircleGeometry(60, 64)),
    track(new T.MeshStandardMaterial({ color: "#2b2a28", roughness: 0.06, metalness: 0.9 })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4;
  group.add(floor);

  /* The inlay the reference floor has at the threshold — concentric bands
     that give the eye something to travel along on the way in. */
  for (let i = 0; i < 4; i++) {
    const ring = new T.Mesh(
      track(new T.RingGeometry(3.2 + i * 1.5, 3.45 + i * 1.5, 72)),
      track(new T.MeshStandardMaterial({
        color: i % 2 ? "#2d4a6b" : "#8a6a3a",
        roughness: 0.3,
        metalness: 0.8,
      })),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, -3.985, -6);
    group.add(ring);
  }

  /* Colonnades down both sides. Spacing tightens toward the back so the
     room reads as longer than the geometry actually is. */
  for (let i = 0; i < 7; i++) {
    const z = 2 - i * 9 - i * i * 0.35;
    for (const side of [-1, 1]) {
      const col = column(19, 1.15, stone, gold);
      col.position.set(side * 21, -4, z);
      group.add(col);
    }
    /* Entablature spanning the colonnade. */
    const beam = new T.Mesh(track(new T.BoxGeometry(44, 1.5, 2.2)), paleStone);
    beam.position.set(0, 15.6, z);
    group.add(beam);
    const band = new T.Mesh(track(new T.BoxGeometry(44.4, 0.28, 2.4)), gold);
    band.position.set(0, 14.7, z);
    group.add(band);
  }

  /* The dome. A hemisphere of coffers over the far half of the room; it is
     what stops the ceiling reading as a lid. */
  const dome = new T.Mesh(
    track(new T.SphereGeometry(20, 44, 24, 0, Math.PI * 2, 0, Math.PI / 2)),
    track(new T.MeshStandardMaterial({ color: "#8e8066", roughness: 0.55, metalness: 0.08, side: T.BackSide })),
  );
  dome.position.set(0, 16, -30);
  group.add(dome);

  const cofferGeo = track(new T.BoxGeometry(2.1, 0.32, 2.1));
  for (let ring = 1; ring <= 3; ring++) {
    const count = 10 + ring * 6;
    const polar = (ring / 4.2) * (Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = Math.sin(polar) * 19.2;
      const coffer = new T.Mesh(cofferGeo, paleStone);
      coffer.position.set(Math.cos(a) * r, 16 + Math.cos(polar) * 19.2, -30 + Math.sin(a) * r);
      coffer.lookAt(0, 16, -30);
      group.add(coffer);
    }
  }

  /* The ring of lamps under the dome — the warm points in the reference. */
  const lampGeo = track(new T.SphereGeometry(0.28, 10, 10));
  const lampMat = track(new T.MeshBasicMaterial({ color: "#ffe6b4" }));
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const lamp = new T.Mesh(lampGeo, lampMat);
    lamp.position.set(Math.cos(a) * 17.4, 20.4, -30 + Math.sin(a) * 17.4);
    group.add(lamp);
  }

  /* The screen wall. Curved, so it wraps the far end the way the reference
     does rather than standing flat across it. */
  const boards: { texture: T.CanvasTexture; draw: (rows: Parameters<TradingHall["setQuotes"]>[0], seed: number) => void }[] = [];
  const screenCount = 9;
  for (let i = 0; i < screenCount; i++) {
    const board = boardTexture();
    boards.push(board);
    track(board.texture);
    const a = (i / (screenCount - 1) - 0.5) * 1.5;
    const r = 25;
    const mat = track(new T.MeshBasicMaterial({ map: board.texture, toneMapped: false }));
    const panel = new T.Mesh(track(new T.PlaneGeometry(7.4, 4.2)), mat);
    panel.position.set(Math.sin(a) * r, 7.5 + Math.cos(a * 2) * 1.4, -30 + Math.cos(a) * r * -1 + r);
    panel.lookAt(0, 6, 4);
    group.add(panel);

    const frame = new T.Mesh(track(new T.BoxGeometry(7.8, 4.6, 0.25)), bronze);
    frame.position.copy(panel.position);
    frame.position.z -= 0.16;
    frame.quaternion.copy(panel.quaternion);
    group.add(frame);
  }

  /* Trading desks in the middle distance, with their own small monitors.
     They exist for silhouette and scale — the camera never reaches them. */
  const monitorMat = track(new T.MeshBasicMaterial({ color: "#2b6c9c", toneMapped: false }));
  const monitorGeo = track(new T.BoxGeometry(1.1, 0.72, 0.07));
  for (let d = 0; d < 5; d++) {
    const z = -14 - d * 7;
    const spread = 7 + d * 1.6;
    for (const side of [-1, 1]) {
      const desk = new T.Mesh(track(new T.BoxGeometry(5.2, 1.05, 2.3)), deskWood);
      desk.position.set(side * (spread+5), -3.3, z);
      group.add(desk);

      const lip = new T.Mesh(track(new T.BoxGeometry(5.4, 0.12, 2.5)), gold);
      lip.position.set(side * (spread+5), -2.74, z);
      group.add(lip);

      for (let m = -1; m <= 1; m++) {
        const monitor = new T.Mesh(monitorGeo, monitorMat);
        monitor.position.set(side * (spread+5) + m * 1.5, -2.2, z - 0.4);
        monitor.rotation.y = -side * 0.18;
        group.add(monitor);
      }
    }
  }

  /* Light. Warm from the street behind, cold from the boards ahead, and a
     soft fill so the stone never goes black in the corners. */
  const street = new T.PointLight("#ffb85c", 2600, 80, 2);
  street.position.set(0, 6, 16);
  group.add(street);

  const boardGlow = new T.PointLight("#3fa8ff", 3000, 95, 2);
  boardGlow.position.set(0, 8, -22);
  group.add(boardGlow);

  const domeGlow = new T.PointLight("#ffd79a", 1800, 62, 2);
  domeGlow.position.set(0, 17, -30);
  group.add(domeGlow);

  group.add(new T.HemisphereLight("#9dc4f0", "#2a2118", 0.28));

  return {
    group,
    setQuotes(rows) {
      boards.forEach((board, i) => {
        /* Each board shows a rotation of the same list, so the wall reads
           as many feeds rather than one repeated nine times. */
        const offset = (i * 3) % Math.max(1, rows.length);
        board.draw([...rows.slice(offset), ...rows.slice(0, offset)], i + 1);
      });
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      disposables.length = 0;
    },
  };
}
