// Each footballer owns one signature. Assignments are stable across matches and reloads.
export const OUTFIELD_SKILLS = Object.freeze(
  [
    {
      id: "body-feint",
      descriptionEn:
        "Drop the shoulder and escape sideways past a close defender.",
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
      descriptionEn:
        "Sweep the feet over the ball, then burst diagonally forward.",
      name: "스텝오버",
      label: "Step over",
      short: "STEP OVER",
      duration: 0.42,
      cooldown: 3.2,
      description: "공 위로 발을 교차한 뒤 전방 대각선으로 치고 나갑니다.",
    },
    {
      id: "roulette",
      descriptionEn:
        "Spin once around the ball and carry it around the challenge.",
      name: "룰렛",
      label: "Roulette",
      short: "ROULETTE",
      duration: 0.48,
      cooldown: 3.6,
      description: "몸을 한 바퀴 돌리며 공을 감싸고 수비수 옆을 돌아갑니다.",
    },
    {
      id: "double-touch",
      descriptionEn:
        "Cut across with one foot, receive with the other and exit forward.",
      name: "더블 터치",
      label: "Double touch",
      short: "DOUBLE",
      duration: 0.38,
      cooldown: 3.1,
      description: "한쪽 발로 밀고 반대 발로 받아 방향을 두 번 바꿉니다.",
    },
    {
      id: "heel-burst",
      descriptionEn:
        "Touch back briefly with the heel, then accelerate into the space ahead.",
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
      descriptionEn: "Pull the ball back under the sole, then escape sideways.",
      name: "드래그 백",
      label: "Drag back",
      short: "DRAG BACK",
      duration: 0.44,
      cooldown: 3.0,
      description:
        "발바닥으로 공을 뒤로 끌고 옆으로 빠집니다. 정면 압박을 피할 때 좋습니다.",
    },
    {
      id: "elastico",
      name: "엘라스티코",
      label: "Elastico",
      short: "ELASTICO",
      duration: 0.4,
      cooldown: 3.3,
      description: "공을 바깥쪽으로 밀었다가 안쪽으로 빠르게 꺾습니다.",
      descriptionEn:
        "Push outside, then snap inside to beat a planted defender.",
    },
    {
      id: "reverse-elastico",
      name: "리버스 엘라스티코",
      label: "Reverse elastico",
      short: "REVERSE",
      duration: 0.42,
      cooldown: 3.4,
      description: "안쪽 터치로 유인한 뒤 바깥쪽으로 꺾어 나갑니다.",
      descriptionEn: "Draw the defender inside, then flick the ball outside.",
    },
    {
      id: "la-croqueta",
      name: "라 크로케타",
      label: "La croqueta",
      short: "CROQUETA",
      duration: 0.46,
      cooldown: 3.3,
      description: "양발 사이로 공을 옮기며 옆으로 길게 빠집니다.",
      descriptionEn:
        "Transfer between both feet while gliding across the defender.",
    },
    {
      id: "ball-roll",
      name: "볼 롤",
      label: "Ball roll",
      short: "BALL ROLL",
      duration: 0.44,
      cooldown: 3.0,
      description: "발바닥으로 공을 옆으로 굴린 뒤 앞으로 이어 갑니다.",
      descriptionEn:
        "Roll the ball sideways under the sole, then carry forward.",
    },
    {
      id: "heel-chop",
      name: "힐 촙",
      label: "Heel chop",
      short: "HEEL CHOP",
      duration: 0.42,
      cooldown: 3.4,
      description: "전진하다 뒤꿈치로 공을 반대쪽 대각선에 보냅니다.",
      descriptionEn: "Cut diagonally behind the standing leg with the heel.",
    },
    {
      id: "mcgeady-spin",
      name: "맥기디 스핀",
      label: "McGeady spin",
      short: "MCGEADY",
      duration: 0.54,
      cooldown: 3.8,
      description: "몸을 크게 돌려 수비수 뒤쪽 방향으로 빠집니다.",
      descriptionEn:
        "Make a three-quarter spin and escape behind the challenge.",
    },
    {
      id: "drag-push",
      name: "드래그 푸시",
      label: "Drag and push",
      short: "DRAG PUSH",
      duration: 0.46,
      cooldown: 3.2,
      description: "공을 뒤로 당겨 간격을 만든 뒤 대각선 앞으로 밉니다.",
      descriptionEn: "Pull back to create space, then push diagonally forward.",
    },
    {
      id: "stop-go",
      name: "스톱 앤 고",
      label: "Stop and go",
      short: "STOP GO",
      duration: 0.4,
      cooldown: 3.1,
      description: "짧게 멈춰 상대를 유인하고 곧바로 직선 가속합니다.",
      descriptionEn:
        "Pause briefly to draw a challenge, then accelerate straight ahead.",
    },
    {
      id: "scoop-turn",
      name: "스쿱 턴",
      label: "Scoop turn",
      short: "SCOOP",
      duration: 0.48,
      cooldown: 3.6,
      description: "공을 발 안쪽으로 감싸며 반대 방향으로 돌아섭니다.",
      descriptionEn:
        "Sweep the ball around with the inside foot and turn away.",
    },
    {
      id: "v-drag",
      name: "브이 드래그",
      label: "V drag",
      short: "V DRAG",
      duration: 0.46,
      cooldown: 3.2,
      description: "공을 뒤로 끌었다가 대각선으로 밀어 브이자 경로를 만듭니다.",
      descriptionEn: "Pull back, then push across the body in a V-shaped path.",
    },
  ].map(Object.freeze),
);
export const KEEPER_SKILLS = Object.freeze(
  [
    {
      id: "safe-hands",
      descriptionEn:
        "Catch slightly faster balls: the catch threshold rises from 24 to 25 m/s.",
      name: "안정적인 캐치",
      label: "Safe hands",
      short: "SAFE HANDS",
      description:
        "조금 더 빠른 공도 잡아냅니다. 캐치 가능한 공 속도가 24에서 25m/s로 늘어납니다.",
    },
    {
      id: "quick-release",
      descriptionEn:
        "Distribute a caught ball after 0.75 seconds, 0.1 seconds sooner.",
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
    case "elastico":
      return {
        forward: 0.5 + 0.35 * t,
        side: t < 0.4 ? 1.0 : -0.95,
        ball: Math.sin(t * Math.PI * 2) * 1.4,
      };
    case "reverse-elastico":
      return {
        forward: 0.35 + 0.55 * t,
        side: t < 0.35 ? -0.9 : 1.05,
        ball: -Math.sin(t * Math.PI * 2) * 1.3,
      };
    case "la-croqueta":
      return {
        forward: 0.25 + 0.15 * Math.sin(t * Math.PI),
        side: 0.7 + 0.3 * Math.sin(t * Math.PI * 2) ** 2,
        ball: 0.55 + Math.sin(t * Math.PI * 2) * 0.35,
      };
    case "ball-roll":
      return {
        forward: t < 0.65 ? 0.1 : 1.0,
        side: t < 0.65 ? 0.8 : 0.2,
        ball: Math.sin(t * Math.PI) * 1.5,
      };
    case "heel-chop":
      return {
        forward: t < 0.45 ? 0.8 : -0.3,
        side: t < 0.45 ? 0.1 : 1.0,
        ball: t < 0.45 ? 0 : Math.PI * 0.6,
      };
    case "mcgeady-spin":
      return {
        forward: Math.cos(t * Math.PI * 1.5) * 0.8,
        side: Math.sin(t * Math.PI * 1.5) * 0.9,
        ball: t * Math.PI * 1.5,
      };
    case "drag-push":
      return {
        forward: t < 0.4 ? -0.65 : 1.1,
        side: t < 0.4 ? -0.2 : 0.5,
        ball: t < 0.4 ? Math.PI * (1 - t) : -0.4,
      };
    case "stop-go":
      return {
        forward: t < 0.38 ? 0 : 1.25,
        side: 0.08 * Math.sin(t * Math.PI),
        ball: t < 0.38 ? 0.25 : 0,
      };
    case "scoop-turn":
      return {
        forward: Math.cos(t * Math.PI) * 0.75,
        side: Math.sin(t * Math.PI) * 0.95,
        ball: t * Math.PI,
      };
    case "v-drag":
      return {
        forward: t < 0.45 ? -0.75 : 0.8,
        side: t < 0.45 ? 0.25 : 1.1,
        ball: t < 0.45 ? 2.7 : -0.6,
      };
    default:
      return { forward: 0.15, side: 0.9, ball: Math.sin(t * Math.PI) * 0.9 };
  }
}

export function skillLabel(skill, language = "en") {
  return language === "ko" ? skill.name : skill.label;
}
export function skillDescription(skill, language = "en") {
  return language === "ko" ? skill.description : skill.descriptionEn;
}
