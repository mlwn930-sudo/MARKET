import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Real models, where a real model exists.
 *
 * The products were written by hand — a cylinder for a lens, a rounded box
 * for a phone — and no amount of lighting was going to rescue that. A
 * graphics card is not a shape you can describe in forty lines; it is a
 * hundred thousand triangles and four texture maps that somebody
 * photographed.
 *
 * So anything that can be a downloaded asset is one. These are CC0 models
 * with full PBR sets — colour, normal, and a packed ambient-occlusion /
 * roughness / metalness map — which is the difference between a surface
 * that is lit and a surface that looks made of something.
 *
 * The map is deliberately incomplete. Where no CC0 model of the actual
 * product exists, the entry is absent and the hand-built one still runs:
 * a wrong real model is worse than an honest diagram, and a generic phone
 * standing in for a specific one is the kind of lie the rest of this site
 * exists not to tell.
 */

/** Product index (see product-catalog.ts) → asset under /models. */
const ASSETS: Record<number, { path: string; credit: string }> = {
  2: { path: "/models/cardboard_box_01/cardboard_box_01.gltf", credit: "Poly Haven · CC0" },
  3: { path: "/models/gamepad/gamepad.gltf", credit: "Poly Haven · CC0" },
};

export function hasAsset(index: number): boolean {
  return index in ASSETS;
}

export function assetCredit(index: number): string | null {
  return ASSETS[index]?.credit ?? null;
}

const loader = new GLTFLoader();

/** Everything a loaded model needs to behave like the hand-built ones. */
export type LoadedProduct = {
  group: T.Group;
  /** Kept for interface parity; a downloaded mesh has no separable parts. */
  animate(explode: number): void;
  dispose(): void;
};

/**
 * Loads and normalises one product.
 *
 * Downloaded models arrive at whatever scale and origin the author used —
 * a box modelled in centimetres and a gamepad modelled in metres would
 * otherwise differ by a hundred times on the same shelf. Each one is
 * measured, centred on its own bounding box and scaled so its longest
 * edge is `targetSize`, which is what makes seven unrelated assets read as
 * one set.
 */
export async function loadProduct(index: number, targetSize = 3.4): Promise<LoadedProduct | null> {
  const asset = ASSETS[index];
  if (!asset) return null;

  let gltf;
  try {
    gltf = await loader.loadAsync(asset.path);
  } catch {
    /* A missing or malformed asset is a normal state, not a crash — the
       caller falls back to the hand-built model. */
    return null;
  }

  const model = gltf.scene;
  const box = new T.Box3().setFromObject(model);
  const size = box.getSize(new T.Vector3());
  const centre = box.getCenter(new T.Vector3());
  const longest = Math.max(size.x, size.y, size.z) || 1;

  model.position.sub(centre);
  const holder = new T.Group();
  holder.add(model);
  holder.scale.setScalar(targetSize / longest);

  const group = new T.Group();
  group.add(holder);

  model.traverse((child) => {
    if (!(child instanceof T.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    /* Authors ship these with the environment in mind; without tone
       mapping on the material the whites blow out under the hall's
       key light. */
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((m) => {
      if (m instanceof T.MeshStandardMaterial) m.envMapIntensity = 0.8;
    });
  });

  return {
    group,
    animate(explode: number) {
      /* No separable parts, so the gesture is a lift and a slow turn
         rather than a fake teardown. The components are explained in the
         panel beside it, which is where that belongs anyway. */
      holder.position.y = explode * 0.35;
      holder.rotation.y = explode * 0.9;
    },
    dispose() {
      model.traverse((child) => {
        if (!(child instanceof T.Mesh)) return;
        child.geometry.dispose();
        (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v instanceof T.Texture) v.dispose();
          });
          m.dispose();
        });
      });
    },
  };
}
