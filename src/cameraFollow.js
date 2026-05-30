import * as THREE from "../vendor/three.module.js";

const desiredPosition = new THREE.Vector3();
const lookAtPosition = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);

export class CameraFollow {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.height = 0.72;
    this.distance = 1.34;
  }

  setForward(direction) {
    if (direction.lengthSq() > 0.0001) {
      this.forward.copy(direction).normalize();
    }
  }

  getForward(target) {
    target.copy(this.forward);
    target.y = 0;
    if (target.lengthSq() < 0.0001) {
      target.set(0, 0, -1);
    }
    return target.normalize();
  }

  rotateYaw(angle) {
    this.forward.applyAxisAngle(yAxis, angle).normalize();
  }

  snap() {
    this.update(1, true);
  }

  update(delta, immediate = false) {
    desiredPosition
      .copy(this.target.position)
      .addScaledVector(this.forward, -this.distance);
    desiredPosition.y += this.height;

    lookAtPosition.copy(this.target.position);
    lookAtPosition.y += 0.15;

    const blend = immediate ? 1 : 1 - Math.pow(0.001, delta);
    this.camera.position.lerp(desiredPosition, blend);
    this.camera.lookAt(lookAtPosition);
  }
}
