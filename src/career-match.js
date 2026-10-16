// Fast-forward the real 6v6 engine. No synthetic player goals or fabricated ratings.
export function simulateTo(match, target = 120) {
  match.autoUser = true;
  let frames = 0;
  while (
    !match.finished &&
    match.elapsed + 1e-8 < target &&
    frames++ < 60 * 240
  ) {
    match.step(1 / 60, {});
    match.takeEvents();
  }
  match.autoUser = false;
  if (frames >= 60 * 240) throw new Error("Match simulation did not finish.");
  // Floating point may leave the entry one simulation tick ahead of the target.
  if (
    !match.finished &&
    match.career &&
    !match.careerActive &&
    match.careerEntry !== null &&
    match.elapsed + 1e-6 >= match.careerEntry
  )
    match.enterCareer();
  return match;
}
export function performance(match, fixtureId, simulated = false) {
  return {
    ...match.stats,
    fixtureId,
    minutes: Math.round(match.careerMinutes),
    started: match.careerStarted,
    rating: match.rating(),
    stamina: match.players[0].stamina,
    simulated,
  };
}
