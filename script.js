"use strict";

const phases = Array.from(document.querySelectorAll(".phase"));
const phaseDots = Array.from(document.querySelectorAll(".phase-dot"));
const progressFill = document.getElementById("progress-fill");
const progressTrack = document.querySelector(".progress-track");
const progressLabel = document.getElementById("progress-label");
const footerPhase = document.getElementById("footer-phase");
const previousButton = document.getElementById("previous-phase");
const nextButton = document.getElementById("next-phase");
const phaseLoader = document.getElementById("phase-loader");
const canvas = document.getElementById("game-canvas");
const context = canvas.getContext("2d");
const starCount = document.getElementById("star-count");
const headerStars = document.getElementById("header-stars");
const gameMessage = document.getElementById("game-message");
const hintButton = document.getElementById("hint-button");
const portalButton = document.getElementById("portal-button");
const joystick = document.getElementById("game-joystick");
const joystickThumb = document.getElementById("joystick-thumb");
const startAudio = document.getElementById("start-audio");
const startAudioStatus = document.getElementById("start-audio-status");
const choiceAudio = document.getElementById("choice-audio");
const choiceAudioStatus = document.getElementById("choice-audio-status");
const finalAudio = document.getElementById("final-audio");
const finalAudioStatus = document.getElementById("final-audio-status");
const chalkboardCanvas = document.getElementById("chalkboard-canvas");
const chalkboardContext = chalkboardCanvas.getContext("2d");

const player = { x: 90, y: 260, radius: 16, speed: 235 };
const portal = { x: 870, y: 260, radius: 42 };
const stars = [
  { x: 205, y: 135, collected: false },
  { x: 360, y: 375, collected: false },
  { x: 515, y: 155, collected: false },
  { x: 680, y: 365, collected: false },
  { x: 790, y: 170, collected: false }
];
const keys = new Set();
const sparkles = [];
const chalkColors = ["#ff77bf", "#53d8ed", "#b98aff", "#ffcb69"];
const joystickInput = { x: 0, y: 0, pointerId: null };
let currentPhase = 1;
let isTransitioning = false;
let collectedStars = 0;
let gameComplete = false;
let messageTimer;
let hintTarget = null;
let lastFrame = 0;
let lastDraw = 0;
let isDrawing = false;
let chalkColorIndex = 0;

function showPhase(number) {
  const previousPhase = currentPhase;
  const requestedPhase = Math.max(1, Math.min(phases.length, number));
  currentPhase = gameComplete ? requestedPhase : Math.min(requestedPhase, 3);
  if (currentPhase !== 3) resetJoystick();
  document.querySelector(".app-shell").classList.toggle("is-start-screen", currentPhase === 1);

  phases.forEach((phase, index) => {
    const active = index + 1 === currentPhase;
    phase.hidden = !active;
    phase.classList.toggle("is-active", active);
  });
  phaseDots.forEach((dot, index) => {
    const active = index + 1 === currentPhase;
    dot.classList.toggle("is-current", active);
    dot.disabled = index > 2 && !gameComplete;
    if (active) dot.setAttribute("aria-current", "step");
    else dot.removeAttribute("aria-current");
  });

  const progress = (currentPhase / phases.length) * 100;
  progressFill.style.width = `${progress}%`;
  progressTrack.setAttribute("aria-valuenow", String(currentPhase));
  const phaseTotal = String(phases.length).padStart(2, "0");
  progressLabel.textContent = `${String(currentPhase).padStart(2, "0")} / ${phaseTotal}`;
  footerPhase.textContent = `PANTALLA ${String(currentPhase).padStart(2, "0")} / ${phaseTotal}`;
  previousButton.disabled = currentPhase === 1;
  nextButton.disabled = currentPhase === phases.length || (currentPhase === 3 && !gameComplete);

  if (currentPhase === 3) {
    drawWorld();
    canvas.focus({ preventScroll: true });
  }

  if (currentPhase === 2 || currentPhase === 3) {
    choiceAudio.pause();
    finalAudio.pause();
  } else if (currentPhase === 4 || currentPhase === 5 || currentPhase === 6) {
    startAudio.pause();
    finalAudio.pause();
    choiceAudio.pause();
  } else if (currentPhase === 7) {
    startAudio.pause();
    choiceAudio.pause();
  }
}

function transitionToPhase(number) {
  const requestedPhase = Math.max(1, Math.min(phases.length, number));
  const reachablePhase = gameComplete ? requestedPhase : Math.min(requestedPhase, 3);
  if (isTransitioning || reachablePhase === currentPhase) return;

  if (reachablePhase === 2 && currentPhase === 1 && startAudio.paused) {
    playTrack(startAudio, startAudioStatus);
  } else if ((reachablePhase === 2 || reachablePhase === 3) && currentPhase >= 4 && startAudio.paused) {
    playTrack(startAudio, startAudioStatus);
  }
  if (reachablePhase === 7 && currentPhase !== 7) {
    finalAudio.currentTime = 0;
    playTrack(finalAudio, finalAudioStatus);
  }

  isTransitioning = true;
  phaseLoader.hidden = false;
  phaseLoader.setAttribute("aria-hidden", "false");
  window.setTimeout(() => {
    showPhase(reachablePhase);
    phaseLoader.hidden = true;
    phaseLoader.setAttribute("aria-hidden", "true");
    isTransitioning = false;
  }, 460);
}

function playTrack(audioElement, statusElement) {
  audioElement.play().then(() => {
    statusElement.textContent = "Ya está sonando.";
    statusElement.classList.remove("audio-error");
  }).catch((error) => {
    if (error.name === "NotAllowedError") {
      statusElement.textContent = "Toca reproducir para escucharla.";
    } else {
      statusElement.textContent = "Esta canción todavía no está lista.";
      statusElement.classList.add("audio-error");
    }
  });
}

function reportAudioError(statusElement) {
  statusElement.textContent = "Esta canción todavía no está lista.";
  statusElement.classList.add("audio-error");
}

function setMessage(message) {
  gameMessage.textContent = message;
  gameMessage.classList.remove("message-pop");
  void gameMessage.offsetWidth;
  gameMessage.classList.add("message-pop");
  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => gameMessage.classList.remove("message-pop"), 280);
}

function resetGameState() {
  player.x = 90;
  player.y = 260;
  stars.forEach((star) => { star.collected = false; });
  sparkles.length = 0;
  collectedStars = 0;
  gameComplete = false;
  hintTarget = null;
  keys.clear();
  resetJoystick();
  starCount.textContent = "0";
  headerStars.textContent = "0/5";
  portalButton.disabled = true;
  portalButton.textContent = "🌀 Ir al portal · 0/5";
  setMessage("Mira esos luceritos, están por ahí.");
}

function resetGame() {
  resetGameState();
  [startAudio, choiceAudio, finalAudio].forEach((audioElement) => {
    audioElement.pause();
    audioElement.currentTime = 0;
  });
  [startAudioStatus, choiceAudioStatus, finalAudioStatus].forEach((statusElement) => {
    statusElement.textContent = "";
    statusElement.classList.remove("audio-error");
  });
  resetProposalScreens();
  showPhase(1);
  drawWorld();
}

function resetProposalScreens() {
  document.getElementById("proposal-question").hidden = false;
  document.getElementById("proposal-yes-intro").hidden = true;
  document.getElementById("compliment-screen").hidden = true;
  document.getElementById("proposal-no-result").hidden = true;
}

function startGame() {
  resetGameState();
  transitionToPhase(3);
}

function setSkip() {
  gameComplete = true;
  keys.clear();
  setMessage("Listo, pasamos al siguiente plan.");
  transitionToPhase(4);
}

function collectNearbyStars() {
  stars.forEach((star) => {
    if (star.collected || Math.hypot(player.x - star.x, player.y - star.y) > 31) return;
    star.collected = true;
    collectedStars += 1;
    starCount.textContent = String(collectedStars);
    headerStars.textContent = `${collectedStars}/5`;
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      sparkles.push({
        x: star.x,
        y: star.y,
        vx: Math.cos(angle) * (22 + Math.random() * 42),
        vy: Math.sin(angle) * (22 + Math.random() * 42),
        born: performance.now(),
        color: chalkColors[index % chalkColors.length]
      });
    }
    hintTarget = null;
    if (collectedStars === stars.length) {
      setMessage("Ya están los cinco, busca el portal lila.");
    } else {
      setMessage(`Qué bonito, ya van ${collectedStars} de 5.`);
    }
  });
  updatePortalButton();
}

function updatePortalButton() {
  const closeToPortal = Math.hypot(player.x - portal.x, player.y - portal.y) <= portal.radius + 22;
  portalButton.disabled = collectedStars < stars.length || !closeToPortal;
  if (collectedStars < stars.length) {
    portalButton.textContent = `🌀 Ir al portal · ${collectedStars}/5`;
  } else if (!closeToPortal) {
    portalButton.textContent = "🌀 Acércate al portal";
  } else {
    portalButton.textContent = "🌀 Entrar al portal";
  }
}

function enterPortal() {
  if (portalButton.disabled || currentPhase !== 3) return;
  gameComplete = true;
  portalButton.disabled = true;
  portalButton.textContent = "✓ Portal abierto";
  setMessage("Portal abierto, vamos al siguiente plan.");
  window.setTimeout(() => transitionToPhase(4), 650);
}

function showHint() {
  const nextStar = stars.find((star) => !star.collected);
  if (!nextStar) {
    hintTarget = null;
    setMessage("Ya tienes los cinco, falta el portal lila.");
    return;
  }
  hintTarget = nextStar;
  const direction = [];
  if (nextStar.x < player.x - 25) direction.push("izquierda");
  if (nextStar.x > player.x + 25) direction.push("derecha");
  if (nextStar.y < player.y - 25) direction.push("arriba");
  if (nextStar.y > player.y + 25) direction.push("abajo");
  setMessage(`El siguiente lucerito está hacia ${direction.join(" y ") || "aquí cerquita"}.`);
}

function updatePlayer(deltaSeconds) {
  let dx = joystickInput.x;
  let dy = joystickInput.y;
  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;
  if (!dx && !dy) return;

  const magnitude = Math.hypot(dx, dy);
  const step = player.speed * deltaSeconds * Math.min(magnitude, 1) / magnitude;
  player.x = Math.max(player.radius + 12, Math.min(canvas.width - player.radius - 12, player.x + dx * step));
  player.y = Math.max(player.radius + 12, Math.min(canvas.height - player.radius - 12, player.y + dy * step));
  collectNearbyStars();
  updatePortalButton();
}

function drawBackground() {
  const sky = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  sky.addColorStop(0, "#34204f");
  sky.addColorStop(.52, "#513267");
  sky.addColorStop(1, "#38254f");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(228, 187, 255, .09)";
  context.lineWidth = 1;
  for (let x = 24; x < canvas.width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 20; y < canvas.height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(99, 222, 245, .18)";
  context.lineWidth = 2;
  context.setLineDash([6, 12]);
  context.beginPath();
  context.moveTo(42, 260);
  context.bezierCurveTo(240, 455, 315, 70, 510, 260);
  context.bezierCurveTo(660, 450, 745, 60, 890, 260);
  context.stroke();
  context.setLineDash([]);

  for (let index = 0; index < 34; index += 1) {
    const x = (index * 173 + 61) % canvas.width;
    const y = (index * 97 + 38) % canvas.height;
    context.fillStyle = index % 3 === 0 ? "rgba(255, 139, 218, .7)" : "rgba(123, 233, 255, .62)";
    context.beginPath();
    context.arc(x, y, index % 5 === 0 ? 2 : 1, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "rgba(246, 194, 255, .48)";
  context.font = "700 12px DM Mono, monospace";
  context.fillText("LUNA.exe", 28, 36);
  context.fillText("SECTOR 01", canvas.width - 112, 36);
  context.fillStyle = "rgba(146, 234, 255, .54)";
  context.fillText("AR-AI / ONLINE", 28, canvas.height - 20);
}

function drawStar(star, animationTime) {
  if (star.collected) return;
  const float = Math.sin(animationTime / 380 + star.x) * 5;
  const y = star.y + float;
  const size = hintTarget === star ? 25 : 19;
  context.save();
  context.translate(star.x, y);
  context.rotate(animationTime / 900 + star.y);
  context.shadowColor = "#8ff4ff";
  context.shadowBlur = hintTarget === star ? 30 : 20;
  context.fillStyle = hintTarget === star ? "#fff3a5" : "#7cecff";
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const radius = point % 2 === 0 ? size : size * .48;
    const x = Math.cos(angle) * radius;
    const pointY = Math.sin(angle) * radius;
    if (point === 0) context.moveTo(x, pointY);
    else context.lineTo(x, pointY);
  }
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.rotate(-animationTime / 900 - star.y);
  context.fillStyle = "#47345e";
  context.beginPath();
  context.arc(-4, -1, 1.8, 0, Math.PI * 2);
  context.arc(4, -1, 1.8, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#47345e";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(0, 1, 3, .15, Math.PI - .15);
  context.stroke();
  context.fillStyle = "rgba(255, 120, 185, .9)";
  context.beginPath();
  context.arc(-8, 3, 2, 0, Math.PI * 2);
  context.arc(8, 3, 2, 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (hintTarget === star) {
    context.strokeStyle = "rgba(255, 243, 165, .62)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(star.x, y, 34 + Math.sin(animationTime / 120) * 4, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawPortal(animationTime) {
  const pulse = 1 + Math.sin(animationTime / 260) * .06;
  context.save();
  context.translate(portal.x, portal.y);
  context.scale(pulse, pulse);
  context.shadowColor = "#ea83ff";
  context.shadowBlur = 28;
  context.fillStyle = "rgba(198, 104, 239, .2)";
  context.beginPath();
  context.ellipse(0, 0, 43, 62, 0, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 15;
  context.strokeStyle = "#f4b4ff";
  context.lineWidth = 5;
  context.beginPath();
  context.ellipse(0, 0, 34, 52, 0, animationTime / 1200, Math.PI * 2 + animationTime / 1200);
  context.stroke();
  context.strokeStyle = "#78edff";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(0, 0, 24, 43, 0, -animationTime / 950, Math.PI * 2 - animationTime / 950);
  context.stroke();
  const portalGlow = context.createRadialGradient(0, 0, 2, 0, 0, 37);
  portalGlow.addColorStop(0, "rgba(255, 255, 255, .92)");
  portalGlow.addColorStop(.34, "rgba(192, 243, 255, .72)");
  portalGlow.addColorStop(1, "rgba(168, 91, 220, .16)");
  context.fillStyle = portalGlow;
  context.beginPath();
  context.ellipse(0, 0, 23, 40, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.fillStyle = "#f6d8ff";
  context.font = "700 10px DM Mono, monospace";
  context.textAlign = "center";
  context.fillText("PORTAL", portal.x, portal.y + 73);
  context.textAlign = "start";
}

function drawPlayer(animationTime) {
  const bob = Math.sin(animationTime / 150) * 2.5;
  const x = player.x;
  const y = player.y + bob;
  context.save();
  context.translate(x, y);
  context.fillStyle = "rgba(17, 12, 31, .3)";
  context.beginPath();
  context.ellipse(0, 23, 18, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = "rgba(255, 105, 209, .8)";
  context.shadowBlur = 15;
  context.fillStyle = "#ee83d5";
  context.beginPath();
  context.moveTo(-13, 5);
  context.lineTo(-20, 17);
  context.lineTo(-5, 14);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "#a377f4";
  context.beginPath();
  context.roundRect(-14, -4, 28, 32, 10);
  context.fill();
  context.fillStyle = "#f3c8ff";
  context.beginPath();
  context.moveTo(-13, -13);
  context.lineTo(-12, -30);
  context.lineTo(0, -20);
  context.lineTo(12, -30);
  context.lineTo(14, -13);
  context.arc(0, -12, 14, 0, Math.PI, true);
  context.closePath();
  context.fill();
  context.fillStyle = "#ed83d7";
  context.beginPath();
  context.moveTo(-10, -20);
  context.lineTo(-11, -27);
  context.lineTo(-4, -21);
  context.moveTo(10, -20);
  context.lineTo(11, -27);
  context.lineTo(4, -21);
  context.fill();
  context.fillStyle = "#533b6b";
  context.beginPath();
  context.ellipse(-5, -12, 1.7, 3, 0, 0, Math.PI * 2);
  context.ellipse(5, -12, 1.7, 3, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#80557e";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(0, -9, 3, .15, Math.PI - .15);
  context.stroke();
  context.fillStyle = "#ff86c6";
  context.beginPath();
  context.arc(-9, -8, 2.5, 0, Math.PI * 2);
  context.arc(9, -8, 2.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#8bf2ff";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, -26);
  context.lineTo(0, -34);
  context.stroke();
  context.fillStyle = "#8bf2ff";
  context.beginPath();
  context.arc(0, -36, 3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSparkles(animationTime) {
  for (let index = sparkles.length - 1; index >= 0; index -= 1) {
    const sparkle = sparkles[index];
    const age = animationTime - sparkle.born;
    if (age > 800) {
      sparkles.splice(index, 1);
      continue;
    }
    context.globalAlpha = 1 - age / 800;
    context.fillStyle = sparkle.color;
    context.beginPath();
    context.arc(sparkle.x + sparkle.vx * age / 1000, sparkle.y + sparkle.vy * age / 1000, 3, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawWorld(animationTime = performance.now()) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPortal(animationTime);
  stars.forEach((star) => drawStar(star, animationTime));
  drawPlayer(animationTime);
  drawSparkles(animationTime);
}

function handleKeyDown(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(key)) event.preventDefault();
  if (currentPhase === 3 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key)) keys.add(key);
  if (currentPhase === 3 && key === "h") showHint();
  if (currentPhase === 3 && (key === "e" || key === " ")) enterPortal();
  if (key === "Escape" && currentPhase > 1) transitionToPhase(currentPhase - 1);
}

function handleKeyUp(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
}

function resizeChalkboard() {
  const pixelRatio = window.devicePixelRatio || 1;
  chalkboardCanvas.width = Math.round(window.innerWidth * pixelRatio);
  chalkboardCanvas.height = Math.round(window.innerHeight * pixelRatio);
  chalkboardContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  chalkboardContext.lineCap = "round";
  chalkboardContext.lineJoin = "round";
}

function drawChalkLine(event) {
  chalkboardContext.lineTo(event.clientX, event.clientY);
  chalkboardContext.stroke();
}

function updateJoystick(event) {
  const bounds = joystick.getBoundingClientRect();
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const travel = bounds.width / 2 - joystickThumb.getBoundingClientRect().width / 2;
  const deltaX = event.clientX - centerX;
  const deltaY = event.clientY - centerY;
  const distance = Math.hypot(deltaX, deltaY);
  const limitedDistance = Math.min(distance, travel);
  const scale = distance ? limitedDistance / distance : 0;

  joystickThumb.style.setProperty("--stick-x", `${deltaX * scale}px`);
  joystickThumb.style.setProperty("--stick-y", `${deltaY * scale}px`);
  if (distance < travel * .12) {
    joystickInput.x = 0;
    joystickInput.y = 0;
    return;
  }
  joystickInput.x = (deltaX * scale) / travel;
  joystickInput.y = (deltaY * scale) / travel;
}

function resetJoystick() {
  joystickInput.x = 0;
  joystickInput.y = 0;
  joystickInput.pointerId = null;
  joystickThumb.style.setProperty("--stick-x", "0px");
  joystickThumb.style.setProperty("--stick-y", "0px");
  joystick.classList.remove("is-active");
}

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => transitionToPhase(Number(button.dataset.go)));
});
document.querySelectorAll("[data-home]").forEach((button) => {
  button.addEventListener("click", (event) => {
    if (button.tagName === "A") event.preventDefault();
    resetGame();
  });
});
document.querySelector("[data-start-game]").addEventListener("click", startGame);
document.querySelectorAll("[data-skip-game]").forEach((button) => button.addEventListener("click", setSkip));
document.querySelectorAll("[data-phase]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!button.disabled) transitionToPhase(Number(button.dataset.phase));
  });
});
joystick.addEventListener("pointerdown", (event) => {
  if (joystickInput.pointerId !== null) return;
  event.preventDefault();
  joystickInput.pointerId = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  joystick.classList.add("is-active");
  updateJoystick(event);
});
joystick.addEventListener("pointermove", (event) => {
  if (event.pointerId === joystickInput.pointerId) updateJoystick(event);
});
["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
  joystick.addEventListener(eventName, (event) => {
    if (event.pointerId === joystickInput.pointerId) resetJoystick();
  });
});
previousButton.addEventListener("click", () => transitionToPhase(currentPhase - 1));
nextButton.addEventListener("click", () => transitionToPhase(currentPhase + 1));
hintButton.addEventListener("click", showHint);
document.getElementById("mobile-hint").addEventListener("click", showHint);
portalButton.addEventListener("click", enterPortal);
startAudio.addEventListener("error", () => reportAudioError(startAudioStatus));
choiceAudio.addEventListener("error", () => reportAudioError(choiceAudioStatus));
finalAudio.addEventListener("error", () => reportAudioError(finalAudioStatus));

document.getElementById("yes-button").addEventListener("click", () => {
  document.getElementById("proposal-question").hidden = true;
  document.getElementById("proposal-yes-intro").hidden = false;
  for (let index = 0; index < 22; index += 1) {
    const piece = document.createElement("span");
    piece.className = "celebration-piece";
    piece.setAttribute("aria-hidden", "true");
    piece.textContent = index % 2 ? "✦" : "●";
    piece.style.setProperty("--piece-x", `${Math.random() * 100}%`);
    piece.style.setProperty("--piece-delay", `${Math.random() * .6}s`);
    piece.style.setProperty("--piece-color", ["#ff77bf", "#53d8ed", "#b98aff", "#ffcb69"][index % 4]);
    document.getElementById("proposal-yes-intro").append(piece);
    window.setTimeout(() => piece.remove(), 2200);
  }
});
document.getElementById("no-button").addEventListener("click", () => {
  document.getElementById("proposal-question").hidden = true;
  document.getElementById("proposal-no-result").hidden = false;
});
document.getElementById("show-compliments").addEventListener("click", () => {
  const phraseSeeds = [
    "verte sonreír con esa alegría tan tuya",
    "escucharte hablar de lo que te emociona",
    "compartir contigo esas conversaciones que se alargan",
    "notar el cariño que pones en los pequeños detalles",
    "conocer cada día un poquito más de ti",
    "ver la emoción con la que cuentas tus planes",
    "leer tus mensajes y sentirte cerquita",
    "reírme contigo hasta por las cosas más sencillas",
    "admirar la fuerza que tienes",
    "ver cómo sigues adelante incluso cuando cuesta",
    "aprender de tu manera de mirar la vida",
    "celebrar cada logro tuyo, grande o pequeño",
    "encontrar calma en tus palabras",
    "descubrir canciones nuevas para compartir",
    "pensar en todas las cosas lindas que aún nos esperan",
    "ver tu lado más espontáneo",
    "confiar en lo bonito que estamos construyendo",
    "sentir que la distancia no borra lo que nos une",
    "tenerte presente en mis días",
    "imaginar todas las risas que todavía nos faltan"
  ];
  const complimentTemplates = [
    (phrase) => `Me encanta ${phrase}.`,
    (phrase) => `Qué bonito es ${phrase}.`,
    (phrase) => `Siempre me alegra ${phrase}.`,
    (phrase) => `No me canso de ${phrase}.`,
    (phrase) => `Una de mis cosas favoritas es ${phrase}.`,
    (phrase) => `Me hace feliz ${phrase}.`,
    (phrase) => `Admiro mucho ${phrase}.`,
    (phrase) => `A la distancia, disfruto ${phrase}.`,
    (phrase) => `Me parece muy especial ${phrase}.`,
    (phrase) => `Siempre voy a valorar ${phrase}.`
  ];
  const list = document.getElementById("compliment-list");
  const compliments = complimentTemplates.flatMap((template) => phraseSeeds.map(template));
  const fragment = document.createDocumentFragment();

  compliments.forEach((compliment, index) => {
    const item = document.createElement("li");
    const number = document.createElement("span");
    const text = document.createElement("p");
    number.className = "compliment-number";
    number.textContent = String(index + 1).padStart(3, "0");
    text.textContent = compliment;
    item.append(number, text);
    fragment.append(item);
  });

  list.replaceChildren(fragment);
  document.getElementById("compliment-count").textContent = String(compliments.length);
  document.getElementById("proposal-yes-intro").hidden = true;
  document.getElementById("compliment-screen").hidden = false;
});
document.querySelectorAll("[data-return-question]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById("proposal-yes-intro").hidden = true;
    document.getElementById("compliment-screen").hidden = true;
    document.getElementById("proposal-no-result").hidden = true;
    document.getElementById("proposal-question").hidden = false;
  });
});
document.getElementById("clear-doodles").addEventListener("click", () => {
  chalkboardContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
});
window.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target.closest("button, a, audio, input, select, textarea, canvas, .joystick")) return;
  isDrawing = true;
  chalkboardContext.strokeStyle = chalkColors[chalkColorIndex % chalkColors.length];
  chalkColorIndex += 1;
  chalkboardContext.lineWidth = 4;
  chalkboardContext.beginPath();
  chalkboardContext.moveTo(event.clientX, event.clientY);
});
window.addEventListener("pointermove", (event) => {
  if (isDrawing) drawChalkLine(event);
});
window.addEventListener("pointerup", () => {
  isDrawing = false;
});
window.addEventListener("pointercancel", () => {
  isDrawing = false;
});
window.addEventListener("resize", resizeChalkboard);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => keys.clear());

function gameLoop(timestamp) {
  const deltaSeconds = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 0;
  lastFrame = timestamp;
  if (currentPhase === 3 && deltaSeconds) {
    updatePlayer(deltaSeconds);
    if (timestamp - lastDraw > 40) {
      drawWorld(timestamp);
      lastDraw = timestamp;
    }
  }
  window.requestAnimationFrame(gameLoop);
}

resizeChalkboard();
updatePortalButton();
showPhase(1);
drawWorld();
window.requestAnimationFrame(gameLoop);
