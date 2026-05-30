import * as THREE from "../vendor/three.module.js";

const BLENDER_TO_THREE_POSITIONS = [
  [-1.8781, 0.0685, 1.2139],
  [-0.2784, 0.0685, 1.2139],
  [1.451, 0.0685, -0.3957],
  [1.4184, 0.0685, 1.6762],
  [-1.4434, 0.0685, -0.3957],
];

const scratch = new THREE.Vector3();

export class Collectibles {
  constructor(scene, source) {
    this.items = [];
    this.collected = 0;
    this.radius = 0.26;

    for (const [index, position] of BLENDER_TO_THREE_POSITIONS.entries()) {
      const root = source.clone(true);
      root.position.set(position[0], position[1], position[2]);
      root.scale.setScalar(1.55);
      root.rotation.y = index * 0.78;

      const light = new THREE.PointLight(0x58b7e7, 0.5, 0.8);
      light.position.set(0, 0.12, 0);
      root.add(light);

      scene.add(root);
      this.items.push({
        root,
        baseY: root.position.y,
        collected: false,
      });
    }
  }

  update(delta, playerPosition, onCollect) {
    for (const item of this.items) {
      if (item.collected) continue;

      item.root.rotation.y += delta * 1.7;
      item.root.position.y = item.baseY + Math.sin(performance.now() * 0.004) * 0.018;

      scratch.copy(item.root.position);
      scratch.y = playerPosition.y;
      if (scratch.distanceTo(playerPosition) <= this.radius) {
        item.collected = true;
        item.root.visible = false;
        this.collected += 1;
        onCollect(this.collected, this.items.length);
      }
    }
  }
}

export const TOTAL_COLLECTIBLES = BLENDER_TO_THREE_POSITIONS.length;
