import confetti from "canvas-confetti";

export function celebrate() {
  const defaults = {
    spread: 70,
    ticks: 60,
    gravity: 0.9,
    decay: 0.94,
    startVelocity: 30,
    colors: ["#9333ea", "#ec4899", "#c084fc", "#f472b6", "#fbbf24"],
  };
  confetti({ ...defaults, particleCount: 60, origin: { x: 0.2, y: 0.7 } });
  confetti({ ...defaults, particleCount: 60, origin: { x: 0.8, y: 0.7 } });
  confetti({ ...defaults, particleCount: 40, origin: { x: 0.5, y: 0.4 } });
}
