// Each footballer owns one signature. Assignments are stable across matches and reloads.
export const OUTFIELD_SKILLS = Object.freeze(
  [
    {
      id: "body-feint",
      name: "바디 페인트",
      label: "Body feint",
      short: "FEINT",
      duration: 0.26,
      cooldown: 2.8,
      description:
        "어깨로 속이고 옆으로 빠져나갑니다. 가까운 수비수를 피할 때 좋습니다.",
    },
    {
      id: "step-over",
      name: "스텝오버",
      label: "Step over",
      short: "STEP OVER",
      duration: 0.42,
      cooldown: 3.2,
      description: "공 위로 발을 교차한 뒤 전방 대각선으로 치고 나갑니다.",
    },
    {
      id: "roulette",
      name: "룰렛",
      label: "Roulette",
      short: "ROULETTE",
      duration: 0.48,
      cooldown: 3.6,
      description: "몸을 한 바퀴 돌리며 공을 감싸고 수비수 옆을 돌아갑니다.",
    },
    {
      id: "double-touch",
      name: "더블 터치",
      label: "Double touch",
      short: "DOUBLE",
      duration: 0.38,
      cooldown: 3.1,
      description: "한쪽 발로 밀고 반대 발로 받아 방향을 두 번 바꿉니다.",
    },
    {
      id: "heel-burst",
      name: "힐 투 힐",
      label: "Heel to heel",
      short: "HEEL BURST",
      duration: 0.36,
      cooldown: 3.3,
      description:
        "공을 뒤로 살짝 건드린 뒤 앞으로 가속합니다. 앞 공간이 있을 때 좋습니다.",
    },
    {
      id: "drag-back",
      name: "드래그 백",
      label: "Drag back",
      short: "DRAG BACK",
      duration: 0.44,
      cooldown: 3.0,
      description:
        "발바닥으로 공을 뒤로 끌고 옆으로 빠집니다. 정면 압박을 피할 때 좋습니다.",
    },
  ].map(Object.freeze),
);
export const KEEPER_SKILLS = Object.freeze(
  [
    {
      id: "safe-hands",
      name: "안정적인 캐치",
      label: "Safe hands",
      short: "SAFE HANDS",
      description:
        "조금 더 빠른 공도 잡아냅니다. 캐치 가능한 공 속도가 24에서 25m/s로 늘어납니다.",
    },
    {
      id: "quick-release",
      name: "빠른 배급",
      label: "Quick release",
      short: "QUICK RELEASE",
      description:
        "공을 잡은 뒤 0.75초에 배급합니다. 기본 배급보다 0.1초 빠릅니다.",
    },
  ].map(Object.freeze),
);
export const SKILLS = Object.freeze([...OUTFIELD_SKILLS, ...KEEPER_SKILLS]);
export function outfieldSkill(id) {
  return OUTFIELD_SKILLS.find((s) => s.id === id) || OUTFIELD_SKILLS[0];
}
export function getSkill(id) {
  return SKILLS.find((s) => s.id === id) || OUTFIELD_SKILLS[0];
}
export function assignedSkill(clubId, slot) {
  let hash = 0;
  if (clubId !== "mini-fc")
    for (const char of clubId)
      hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return slot === 5
    ? KEEPER_SKILLS[hash % KEEPER_SKILLS.length].id
    : OUTFIELD_SKILLS[(hash + slot) % OUTFIELD_SKILLS.length].id;
}
// Local forward/side motion and the ball's angle around the player. All movement
// is integrated through normal acceleration and field bounds, never teleported.
export function signatureMotion(id, progress) {
  const t = Math.max(0, Math.min(1, progress));
  switch (id) {
    case "step-over":
      return {
        forward: t < 0.42 ? 0.25 : 0.95,
        side: t < 0.42 ? -0.45 : 0.6,
        ball: Math.sin(t * Math.PI * 2) * 0.8,
      };
    case "roulette":
      return {
        forward: 0.45 + 0.3 * Math.cos(t * Math.PI * 2),
        side: Math.sin(t * Math.PI) * 0.75,
        ball: t * Math.PI * 2,
      };
    case "double-touch":
      return {
        forward: t < 0.45 ? 0.25 : 0.8,
        side: t < 0.45 ? 0.95 : -0.8,
        ball: Math.sin(t * Math.PI * 2) * 1.1,
      };
    case "heel-burst":
      return {
        forward: t < 0.28 ? -0.55 : 1.2,
        side: 0,
        ball: t < 0.28 ? Math.PI * 0.8 : 0,
      };
    case "drag-back":
      return {
        forward: t < 0.55 ? -0.9 : 0.35,
        side: t < 0.55 ? 0 : 0.9,
        ball: Math.PI * (1 - t),
      };
    default:
      return { forward: 0.15, side: 0.9, ball: Math.sin(t * Math.PI) * 0.9 };
  }
}
