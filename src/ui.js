export function createUI(totalCollectibles) {
  const loading = document.querySelector("#loading");
  const loadingText = document.querySelector("#loadingText");
  const startButton = document.querySelector("#startButton");
  const restartButton = document.querySelector("#restartButton");
  const counterText = document.querySelector("#counterText");
  const missionText = document.querySelector("#missionText");
  const hud = document.querySelector("#hud");
  const winScreen = document.querySelector("#winScreen");
  const joystick = document.querySelector("#joystick");
  const joystickKnob = document.querySelector("#joystickKnob");
  const lookPad = document.querySelector("#lookPad");

  const joystickVector = { x: 0, z: 0 };
  const lookDelta = { x: 0, y: 0 };
  let activePointerId = null;
  let lookPointerId = null;
  let lastLookX = 0;
  let lastLookY = 0;

  function setLoading(text) {
    loadingText.textContent = text;
  }

  function showReady(onStart) {
    setLoading("Find all 5 ice creams.");
    startButton.disabled = false;
    startButton.addEventListener("click", onStart, { once: true });
  }

  function hideLoading() {
    loading.classList.remove("is-visible");
    hud.classList.remove("is-hidden");
    joystick.classList.remove("is-hidden");
    lookPad.classList.remove("is-hidden");
  }

  function updateCounter(value) {
    counterText.textContent = `${value} / ${totalCollectibles}`;
  }

  function setMission(text) {
    missionText.textContent = text;
  }

  function showWin() {
    setMission("You collected all ice creams!");
    joystick.classList.add("is-hidden");
    lookPad.classList.add("is-hidden");
    winScreen.classList.add("is-visible");
  }

  function bindRestart(callback) {
    restartButton.addEventListener("click", callback);
  }

  function resetJoystick() {
    joystickVector.x = 0;
    joystickVector.z = 0;
    activePointerId = null;
    joystickKnob.style.transform = "translate(-50%, -50%)";
  }

  function updateJoystick(event) {
    event.preventDefault();
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width * 0.36;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const length = Math.hypot(dx, dy);
    const clamped = Math.min(length, radius);
    const normalX = length > 0 ? dx / length : 0;
    const normalY = length > 0 ? dy / length : 0;

    joystickVector.x = (normalX * clamped) / radius;
    joystickVector.z = (normalY * clamped) / radius;
    joystickKnob.style.transform = `translate(calc(-50% + ${normalX * clamped}px), calc(-50% + ${normalY * clamped}px))`;
  }

  joystick.addEventListener("pointerdown", (event) => {
    activePointerId = event.pointerId;
    joystick.setPointerCapture(activePointerId);
    updateJoystick(event);
  });

  joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId === activePointerId) {
      updateJoystick(event);
    }
  });

  joystick.addEventListener("pointerup", resetJoystick);
  joystick.addEventListener("pointercancel", resetJoystick);

  lookPad.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    lookPointerId = event.pointerId;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    lookPad.setPointerCapture(lookPointerId);
  });

  lookPad.addEventListener("pointermove", (event) => {
    if (event.pointerId !== lookPointerId) return;
    event.preventDefault();
    lookDelta.x += event.clientX - lastLookX;
    lookDelta.y += event.clientY - lastLookY;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
  });

  function resetLook() {
    lookPointerId = null;
    lastLookX = 0;
    lastLookY = 0;
  }

  lookPad.addEventListener("pointerup", resetLook);
  lookPad.addEventListener("pointercancel", resetLook);

  function consumeLookDelta() {
    const delta = { x: lookDelta.x, y: lookDelta.y };
    lookDelta.x = 0;
    lookDelta.y = 0;
    return delta;
  }

  return {
    setLoading,
    showReady,
    hideLoading,
    updateCounter,
    setMission,
    showWin,
    bindRestart,
    consumeLookDelta,
    joystickVector,
  };
}
