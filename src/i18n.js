// Canonical UI copy is English. Translate complete text nodes, never player input,
// club names, option values, IDs or simulation/save data.
const pairs = `
THE SMALL-SIDED GAME|작은 경기장의 축구
EVERY TOUCH COUNTS|한 번의 터치가 승부를 바꾼다
Small pitch.|작은 경기장.
Big|커다란
moments.|순간들.
Six a side. Two minutes.|6인제 축구. 2분의 승부.
Your next great goal is one touch away.|당신의 멋진 골이 다음 터치를 기다립니다.
PLAY|플레이
CAREER|커리어
SETTINGS|설정
OFFLINE CAREER|오프라인 커리어
NO SIGN-IN|로그인 불필요
JUST FOOTBALL|오직 축구
WELCOME TO THE NEIGHBORHOOD|우리 동네 리그에 오신 것을 환영합니다
VS|대
vs|대
FLOODLIGHT PARK / 6V6|플러드라이트 파크 / 6인제
Made for quick matches.|짧고 신나는 경기.
Built for the long career.|꾸준히 이어가는 선수 생활.
KEYBOARD + TOUCH|키보드 + 터치
KICK OFF / 6V6|친선 경기 / 6인제
Pick your colours.|우리 팀을 골라보세요.
MAIN MENU|메인 메뉴
KICK OFF|경기 시작
LOCAL ASSETS|기기 이미지
YOUR CLUB|우리 팀
OPPONENT|상대 팀
All clubs|모든 구단
No matching clubs.|검색 결과가 없습니다.
Search clubs…|구단 검색…
Search clubs|구단 검색
Filter league|리그 선택
Premier League|프리미어리그
Bundesliga|분데스리가
Serie A|세리에 A
La Liga|라리가
Original Mini FC|오리지널 미니 FC
IPAD CONTROL ROOM|아이패드 조작 설정
Your touch. Your layout.|나에게 맞는 터치 배치.
Changes apply immediately and save in this browser.|변경 사항은 즉시 적용되며 이 브라우저에 저장됩니다.
PASS|패스
SHOOT|슛
SPRINT|질주
THROUGH|스루
CHIP|칩슛
SKILL|개인기
TACKLE|태클
SLIDE|슬라이딩
PRESS|압박
SWITCH|선수 전환
CALL PASS|패스 요청
HOLD: LOB|길게: 로빙
HOLD: POWER|길게: 파워슛
HOLD: SHIELD|길게: 볼 보호
Button size|버튼 크기
Opacity|불투명도
Edge spacing|가장자리 간격
RESET LAYOUT|배치 초기화
YOUR LOCAL ASSETS|내 기기의 이미지
Make it personal.|나만의 구단 꾸미기.
Choose licensed images from your device. Files stay in this tab and are never uploaded or committed.|사용 권한이 있는 이미지를 기기에서 선택하세요. 이미지는 현재 탭에서만 사용되며 업로드되지 않습니다.
original career|오리지널 커리어
CLUB|구단
CREST · PNG, JPEG OR WEBP|엠블럼 · PNG, JPEG 또는 WEBP
JERSEY TEXTURE · PNG, JPEG OR WEBP|유니폼 이미지 · PNG, JPEG 또는 WEBP
Maximum 2 MB per image. A flat jersey texture maps onto the procedural torso. Crests appear in club selection. Local assets reset on refresh; career progress remains saved. Automatic contrast kits can override an away texture to keep teams readable.|이미지당 최대 2MB입니다. 유니폼 이미지는 상의에, 엠블럼은 구단 선택에 표시됩니다. 이미지는 새로고침하면 초기화되지만 커리어는 유지됩니다. 팀 구별을 위해 원정 유니폼이 대체될 수 있습니다.
Choose a PNG, JPEG or WebP image under 2 MB.|2MB 미만의 PNG, JPEG, WebP 이미지를 선택하세요.
Could not read this image.|이미지를 읽지 못했습니다.
YOUR STORY STARTS HERE|당신의 이야기가 시작됩니다
Make your mark.|나만의 선수를 만드세요.
Create your captain. All three attributes start at 60.|주장을 만드세요. 세 가지 능력치는 모두 60으로 시작합니다.
PLAYER NAME|선수 이름
PREFERRED POSITION|선호 포지션
STARTING CLUB|시작 구단
SIGNATURE SKILL|고유 개인기
Your name|이름 입력
Striker|공격수
Midfielder|미드필더
Defender|수비수
STRIKER|공격수
MIDFIELDER|미드필더
DEFENDER|수비수
GOALKEEPER|골키퍼
YOU|내 선수
You control only your created footballer. Position sets your formation role. Use PASS to call for the ball when a teammate has it.|만든 선수만 조종합니다. 포지션은 시작 위치를 정합니다. 동료가 공을 갖고 있을 때 패스를 누르면 공을 요청합니다.
SIGN FOR MINI FC|선수 등록
The next chapter.|다음 이야기를 향해.
Build your player. Bring the title home.|선수를 성장시키고 우승에 도전하세요.
CAPTAIN|주장
SIGNATURE|고유 개인기
OVR|종합
PAC|속도
SHO|슈팅
PAS|패스
SEASON COMPLETE|시즌 종료
Champions.|우승입니다!
A season to build on.|다음 시즌을 위한 발판.
Two minutes to make a difference.|승부를 바꿀 2분의 시간.
START NEXT SEASON|다음 시즌 시작
PLAY MATCH|경기하기
PLAYER DEVELOPMENT|선수 성장
TRAIN|훈련
PLAYED|경기 수
WINS|승리
YOUR GOALS|내 득점
TITLES|우승
ASSISTS|도움
AVG RATING|평균 평점
ALL TIME|통산 기록
NEIGHBORHOOD LEAGUE|동네 리그
EUROPEAN INVITATION|유럽 초청 리그
SIX-CLUB SEASON|6팀 시즌
P|경기
GD|득실
PTS|승점
Win 3 pts · Draw 1 pt|승리 3점 · 무승부 1점
Ties: goal difference, goals scored, club name.|동률 기준: 득실 차, 득점, 구단 이름.
60 XP per match · 80 per win|경기당 60 XP · 승리 시 80 XP
40 per goal you score · 30 per draw|내 득점당 40 XP · 무승부 30 XP
100 XP = 1 point · 1 point = +0.4 attribute|100 XP = 성장 포인트 1점 · 1점 = 능력치 +0.4
Focused training develops only your player, +0.4 per point. Growth stops at potential; age can cause decline.|집중 훈련은 내 선수의 능력치를 포인트당 0.4 올립니다. 잠재력까지 성장하며, 나이가 들면 하락할 수 있습니다.
TRAINING GROUND|훈련장
Earn it. Improve it.|경험을 쌓고 성장하세요.
Pace|속도
Shooting|슈팅
Passing|패스
Movement and sprint speed|이동과 질주 속도
Shot speed and accuracy|슛 속도와 정확도
Pass travel speed|패스 속도
MAX|최대
+0.4 / 1 PT|+0.4 / 1점
Upgrades improve your own footballer in career matches. Attributes cap at 99.|능력치 강화는 커리어의 내 선수에게 적용됩니다. 최대 능력치는 99입니다.
MAKE IT YOUR GAME|나에게 맞는 경기
Settings.|설정.
Language|언어
Choose one language for menus, skills and match controls.|메뉴, 개인기 설명, 경기 조작에 사용할 언어를 선택하세요.
Controls|조작 방식
Full techniques in both modes. Balanced adds light aiming and movement assistance.|두 모드에서 모든 기술을 씁니다. 보조 모드는 조준과 움직임을 살짝 돕습니다.
Balanced · full techniques|보조 조작 · 모든 기술
Manual · full techniques|수동 조작 · 모든 기술
Difficulty|난이도
Decisions, positioning and keeper reactions. Applies immediately.|AI 판단, 위치 선정, 골키퍼 반응에 즉시 적용됩니다.
Easy|쉬움
Normal|보통
Hard|어려움
Graphics|그래픽
Lower resolution can improve battery life.|해상도를 낮추면 배터리를 절약할 수 있습니다.
High|높음
Battery saver|배터리 절약
Match sound|경기 소리
Procedural kicks, goals, and whistles.|킥, 득점, 휘슬 소리.
On|켜기
Off|끄기
Touch controls|터치 조작
Automatic on iPad and touch devices.|아이패드와 터치 기기에서는 자동으로 표시됩니다.
Automatic|자동
Always show|항상 표시
TOUCH LAYOUT|터치 배치
LOCAL KIT / CREST ASSETS|기기 유니폼 / 엠블럼
The playbook|조작 안내
WASD / ARROWS|WASD / 방향키
Move|이동
Sprint|질주
Pass|패스
Tap / hold and release to shoot|탭: 일반슛 / 길게 눌렀다 떼기: 파워슛
Through|스루패스
Lob|로빙패스
Chip|칩슛
Finesse|감아차기
Signature skill|고유 개인기
Shield|볼 보호
Tackle|태클
Slide|슬라이딩
Hold to press|길게: 압박
Switch|선수 전환
Balanced keeps every technique with light goal aiming assistance, responsive movement and a green pass receiver ring. Manual gives full directional aim and heavier momentum. On iPad, touch the left movement area for the floating stick. Tap PASS for a short pass or hold to lob; THROUGH leads a run. Tap SHOOT for a normal shot, hold for power, swipe up to chip or sideways for finesse. CHIP is also available directly. Tap SKILL to use your footballer’s signature move, hold to shield. See Pause → Player Skills for every player’s signature. Aim passes with movement. Hold PRESS to close down; your movement overrides the assisted chase. SPRINT is optional and stays in a fixed slot.|보조 조작은 모든 기술을 유지하면서 조준과 움직임을 돕고 패스받을 선수를 초록색 원으로 표시합니다. 수동 조작은 방향 조준과 관성을 직접 다룹니다. 아이패드는 왼쪽 영역에서 이동합니다. 패스를 탭하면 짧은 패스, 길게 누르면 로빙이며 스루는 달리는 동료에게 보냅니다. 슛을 탭하면 일반슛, 길게 누르면 파워슛, 위로 밀면 칩슛, 옆으로 밀면 감아차기입니다. 칩슛 버튼도 있습니다. 개인기를 탭하면 선수 고유 기술, 길게 누르면 볼 보호입니다. 일시정지의 선수 스킬에서 모두 확인하세요. 이동 방향으로 패스를 조준하고 압박을 길게 누르면 상대에게 접근합니다. 직접 이동하면 그 방향이 우선합니다. 질주는 선택 사항이며 버튼 위치는 고정입니다.
You attack the far goal ↑. Kick Off switches to the receiver; Q switches defenders. Career stays locked to your created player. Tap PASS to call for a teammate pass. Tackle at close range; missed slides leave recovery time. Touchline boards keep the ball in play.|위쪽 골대로 공격합니다 ↑. 친선 경기는 패스받을 선수로 전환되고 Q로 수비수를 바꿉니다. 커리어는 내 선수에게 고정됩니다. 패스를 누르면 동료에게 요청합니다. 가까이서 태클하세요. 슬라이딩 실패 뒤에는 회복 시간이 필요합니다. 경기장 벽으로 공이 튕깁니다.
Career goals count shots you take. AI teammate goals help the team score. Quitting or restarting an unfinished match earns no rewards.|커리어 개인 득점은 직접 찬 슛만 계산합니다. 동료의 득점은 팀 점수에 반영됩니다. 미완료 경기를 나가거나 다시 시작하면 보상을 받지 못합니다.
RESET CAREER|커리어 초기화
Delete your saved player and all career progress?|저장된 선수와 모든 커리어 진행을 삭제할까요?
YES, DELETE CAREER|네, 커리어 삭제
Could not delete the saved career.|저장된 커리어를 삭제하지 못했습니다.
Career reset.|커리어가 초기화됐습니다.
TAKE A BREATHER|잠깐 쉬어가기
Match paused.|일시정지.
RESUME MATCH|경기 계속
RESTART MATCH|경기 다시 시작
PLAYER SKILLS|선수 스킬
RETURN TO MAIN MENU|메인 메뉴로
Unfinished matches do not award XP or count toward your season.|미완료 경기는 경험치나 시즌 기록에 반영되지 않습니다.
EVERY PLAYER HAS A SIGNATURE|모든 선수에게 고유 스킬이 있습니다
Player signatures|선수별 고유 스킬
C / tap SKILL activates the selected footballer's own move. Goalkeeper traits work automatically.|C 또는 개인기 탭으로 선택한 선수의 기술을 씁니다. 골키퍼 특성은 자동 적용됩니다.
BACK|뒤로
YOU ATTACK ↑|위쪽으로 공격 ↑
ATTACK ↑|공격 방향 ↑
LOCKED|고정
READY|준비 완료
ON THE BALL|공 소유 시 사용
TAP|탭
FEINT|페인트
STEP OVER|스텝오버
ROULETTE|룰렛
DOUBLE|더블 터치
HEEL BURST|힐 투 힐
DRAG BACK|드래그 백
ELASTICO|엘라스티코
REVERSE|리버스
CROQUETA|크로케타
BALL ROLL|볼 롤
HEEL CHOP|힐 촙
MCGEADY|맥기디
DRAG PUSH|드래그 푸시
STOP GO|스톱 앤 고
SCOOP|스쿱 턴
V DRAG|브이 드래그
FULL TIME / FLOODLIGHT PARK|경기 종료 / 플러드라이트 파크
Made it count.|승리를 만들었습니다.
Honours even.|승부는 무승부.
We go again.|다시 도전합시다.
YOUR SHOTS|내 슛
PASSES MADE|성공 패스
RATING|평점
LEAGUE CHAMPIONS!|리그 우승!
Take your game further. Start a career to earn XP and improve your squad.|커리어를 시작해 경험치를 모으고 선수를 성장시키세요.
BACK TO CAREER|커리어로
PLAY AGAIN|다시 경기
Save unavailable. Progress is kept in this tab only. Allow browser storage to save it.|저장할 수 없습니다. 현재 탭에서만 진행을 유지합니다. 브라우저 저장을 허용하세요.
Settings cannot be saved in this browser.|이 브라우저에 설정을 저장할 수 없습니다.
Graphics interrupted. Waiting for the browser to restore the pitch.|화면이 중단됐습니다. 브라우저의 그래픽 복구를 기다립니다.
A pitch needs a little power.|경기장을 표시하지 못했습니다.
WebGL could not start. Enable hardware acceleration, close other tabs, then reload Safari or your desktop browser.|WebGL을 시작하지 못했습니다. 하드웨어 가속을 켜고 다른 탭을 닫은 뒤 새로고침하세요.
TRY AGAIN|다시 시도
Pause match|경기 일시정지
Floating movement joystick|이동 조이스틱
Mini FC football pitch|미니 FC 축구 경기장
`;
export const KO = Object.freeze(
  Object.fromEntries(
    pairs
      .trim()
      .split("\n")
      .map((line) => line.split("|")),
  ),
);
const patterns = [
  [
    /^(\d+) clubs from your supplied roster · traditional procedural kits$/,
    (m) => `제공된 명단의 ${m[1]}개 구단 · 전통 색상 유니폼`,
  ],
  [/^PLAYER CAREER \/ SEASON (\d+)$/, (m) => `선수 커리어 / 시즌 ${m[1]}`],
  [/^NEXT FIXTURE \/ (\d+) OF 5$/, (m) => `다음 경기 / 5경기 중 ${m[1]}번째`],
  [/^Season (\d+) standings$/, (m) => `시즌 ${m[1]} 순위`],
  [/^(\d+) upgrade points?$/, (m) => `성장 포인트 ${m[1]}점`],
  [
    /^(\d+) upgrade points? available$/,
    (m) => `사용 가능한 성장 포인트 ${m[1]}점`,
  ],
  [/^Overall (\d+)$/, (m) => `종합 ${m[1]}`],
  [/^\+(\d+) upgrade points?$/, (m) => `성장 포인트 +${m[1]}점`],
  [/^(\d+) TOTAL XP$/, (m) => `누적 ${m[1]} XP`],
  [/^(\d+) XP TO NEXT POINT$/, (m) => `다음 포인트까지 ${m[1]} XP`],
  [
    /^(\d+) WINS \/ (\d+) DRAWS \/ (\d+) LOSSES$/,
    (m) => `${m[1]}승 / ${m[2]}무 / ${m[3]}패`,
  ],
  [
    /^You finished (\d+)(?:st|nd|th)\. (.+)$/,
    (m) =>
      `${m[1]}위로 마쳤습니다. ${m[2] === "Championship bonus: 3 upgrade points." ? "우승 보너스: 성장 포인트 3점." : "새 시즌에 다시 도전하세요."}`,
  ],
  [/^(\d\d:\d\d) remaining$/, (m) => `${m[1]} 남음`],
  [/^(\d+\.\d)s$/, (m) => `${m[1]}초`],
  [/^POWER (\d+)%$/, (m) => `슛 파워 ${m[1]}%`],
  [
    /^#(\d+) · (STRIKER|MIDFIELDER|DEFENDER|GOALKEEPER)( · YOU)?$/,
    (m) => `#${m[1]} · ${KO[m[2]]}${m[3] ? " · 내 선수" : ""}`,
  ],
  [
    /^PC: C · TOUCH: tap SKILL · ([\d.]+)s cooldown · Hold V \/ SKILL to shield\.$/,
    (m) =>
      `PC: C · 터치: 개인기 탭 · 대기 ${m[1]}초 · V / 개인기 길게: 볼 보호.`,
  ],
  [
    /^2026\/27 membership: user-provided list; official-site verification unavailable\. Home\/away colours are traditional approximations, not exact verified 2026\/27 kits\. (\d+)\/18 Bundesliga clubs included by user preference\.$/,
    (m) =>
      `2026/27 참가 구단은 사용자 제공 명단입니다. 공식 명단 확인은 불가하며 유니폼은 해당 시즌의 확정 디자인 대신 전통 색상을 사용합니다. 분데스리가는 요청에 따라 18팀 중 ${m[1]}팀을 포함합니다.`,
  ],
  [
    /^Local (crest|kit) applied to (.+)\.$/,
    (m) =>
      `${m[2]}에 기기 ${m[1] === "crest" ? "엠블럼" : "유니폼"}을 적용했습니다.`,
  ],
];
export function translateText(value, language = "en") {
  const source = String(value);
  if (language !== "ko") return source;
  const text = source.trim();
  if (!text) return source;
  let result = Object.hasOwn(KO, text) ? KO[text] : undefined;
  if (!result)
    for (const [pattern, format] of patterns) {
      const match = text.match(pattern);
      if (match) {
        result = format(match);
        break;
      }
    }
  if (!result && /^[←→↗]\s*/.test(text))
    result = text[0] + " " + translateText(text.slice(1).trim(), language);
  if (!result && /[\s]+[↗]$/.test(text))
    result = translateText(text.slice(0, -1).trim(), language) + " ↗";
  if (!result && text.includes(" · "))
    result = text
      .split(" · ")
      .map((part) => translateText(part, language))
      .join(" · ");
  if (!result && text.includes(" / "))
    result = text
      .split(" / ")
      .map((part) => translateText(part, language))
      .join(" / ");
  return result ? source.replace(text, result) : source;
}
const originals = new WeakMap();
export function localize(root, language = "en") {
  // Preserve canonical form values before translating visible position/club options.
  root.querySelectorAll("option").forEach((option) => {
    if (!option.hasAttribute("value")) option.value = option.textContent;
  });
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  while (walker.nextNode()) {
    const node = walker.currentNode,
      parent = node.parentElement;
    if (
      parent.closest(
        "script,style,input,textarea,[data-raw],#language option,.player-card h2,[data-club] b,#choose-home b,#choose-away b,.result-score b,.shirt-club",
      )
    )
      continue;
    if (parent.closest(".control-guide b") && node.nodeValue.trim() === "P")
      continue;
    if (!originals.has(node)) originals.set(node, node.nodeValue);
    node.nodeValue = translateText(originals.get(node), language);
  }
  for (const node of root.querySelectorAll(
    "[placeholder],[aria-label],[title],optgroup[label]",
  ))
    for (const attr of ["placeholder", "aria-label", "title", "label"]) {
      const value = node.getAttribute(attr);
      if (value) node.setAttribute(attr, translateText(value, language));
    }
}
