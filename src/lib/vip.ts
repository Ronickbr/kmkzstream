export type VipLevel = {
  name: string;
  min: number;
  next: number | null;
  color: string;
  emoji: string;
};

const TIERS: Array<Omit<VipLevel, "next">> = [
  { name: "Bronze", min: 0, color: "#b45309", emoji: "🥉" },
  { name: "Prata", min: 500, color: "#94a3b8", emoji: "🥈" },
  { name: "Ouro", min: 2000, color: "#facc15", emoji: "🥇" },
  { name: "Platina", min: 5000, color: "#67e8f9", emoji: "💎" },
  { name: "Diamante", min: 10000, color: "#ec4899", emoji: "💠" },
];

export function getVipLevel(points: number): VipLevel {
  let current = TIERS[0];
  let nextMin: number | null = TIERS[1]?.min ?? null;
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].min) {
      current = TIERS[i];
      nextMin = TIERS[i + 1]?.min ?? null;
    }
  }
  return { ...current, next: nextMin };
}

export function maskName(name: string | null | undefined): string {
  if (!name) return "Usuário";
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed;
  if (trimmed.includes("@")) {
    const [u, d] = trimmed.split("@");
    return `${u.slice(0, 2)}***@${d}`;
  }
  const parts = trimmed.split(/\s+/);
  return parts
    .map((p, i) =>
      i === 0 ? p : p.length > 2 ? `${p[0]}${"*".repeat(Math.max(1, p.length - 2))}${p.at(-1)}` : p,
    )
    .join(" ");
}
