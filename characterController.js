import * as THREE from "../vendor/three.module.js";

function removeWalkRootDrift(clip) {
  const fixedClip = clip.clone();

  for (const track of fixedClip.tracks) {
    const isHipPosition =
      track.name.toLowerCase().includes("hips.position") ||
      track.name.toLowerCase().includes("hips.translation");

    if (!isHipPosition || track.getValueSize() !== 3) continue;

    const baseX = track.values[0];
    const baseZ = track.values[2];

    for (let index = 0; index < track.values.length; index += 3) {
      track.values[index] = baseX;
      track.values[index + 2] = baseZ;
    }
  }

  return fixedClip;
}

export class CharacterController {
  constructor(root, animations) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = new Map();
    this.ready = false;
    this.walking = false;
    this.moveAmount = 0;

    for (const clip of animations) {
      const key = clip.name.toLowerCase();
      const playableClip = key.includes("walk") ? removeWalkRootDrift(clip) : clip;
      this.actions.set(key, this.mixer.clipAction(playableClip));
    }

    this.standup = this.findAction("standup");
    this.walk = this.findAction("walk");

    if (this.walk) {
      this.walk.reset();
      this.walk.setLoop(THREE.LoopRepeat);
      this.walk.enabled = true;
      this.walk.setEffectiveWeight(0);
      this.walk.setEffectiveTimeScale(0.88);
      this.walk.play();
    }
  }

  findAction(name) {
    const exact = this.actions.get(name);
    if (exact) return exact;

    for (const [key, action] of this.actions) {
      if (key.includes(name)) return action;
    }

    return null;
  }

  playIntro(onComplete) {
    if (!this.standup) {
      this.ready = true;
      onComplete();
      return;
    }

    this.standup.reset();
    this.standup.setLoop(THREE.LoopOnce, 1);
    this.standup.clampWhenFinished = true;
    this.standup.enabled = true;
    this.standup.setEffectiveWeight(1);
    this.standup.play();

    const handleFinished = (event) => {
      if (event.action !== this.standup) return;
      this.mixer.removeEventListener("finished", handleFinished);
      this.standup.paused = true;
      this.ready = true;
      onComplete();
    };

    this.mixer.addEventListener("finished", handleFinished);
  }

  setMoveAmount(amount) {
    this.moveAmount = THREE.MathUtils.clamp(amount, 0, 1);
    if (!this.ready || !this.walk) return;

    const isWalking = this.moveAmount > 0.08;
    this.walk.setEffectiveTimeScale(THREE.MathUtils.lerp(0.72, 1.18, this.moveAmount));

    if (isWalking) {
      if (this.standup) {
        this.standup.stop();
        this.standup.enabled = false;
      }

      this.walking = true;
      this.walk.enabled = true;
      this.walk.paused = false;
      this.walk.setEffectiveWeight(1);
      this.walk.play();
      return;
    }

    this.walking = false;
    this.walk.setEffectiveWeight(0);
    this.walk.paused = true;
  }

  setWalking(isWalking) {
    this.setMoveAmount(isWalking ? 1 : 0);
  }

  update(delta) {
    this.mixer.update(delta);
  }
}
