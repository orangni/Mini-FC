"""Production tablet controls/fairness regressions. Chromium emulation, not real Safari."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('MINI_FC_URL', 'http://127.0.0.1:4173/')
ARTIFACTS = Path(os.environ.get('MINI_FC_ARTIFACTS', 'playwright-results'))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    options = {'headless': True, 'args': ['--enable-unsafe-swiftshader']}
    if os.environ.get('MINI_FC_BROWSER'):
        options['executable_path'] = os.environ['MINI_FC_BROWSER']
    browser = p.chromium.launch(**options)
    context = browser.new_context(viewport={'width':1024,'height':768}, is_mobile=True, has_touch=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL + '?test=1'); page.click('#play'); page.click('#kickoff')
    page.evaluate('''() => {
      const m=__miniFC.match; m.kickoffWait=0; m.ai=()=>{};
      m.players.forEach((p,i)=>Object.assign(p,{x:i%2?20:-20,z:20,cooldown:10,protected:0}));
      Object.assign(m.players[0],{x:0,z:0,cooldown:0});m.ball.owner=0;
    }''')
    layouts = []
    for width, height, scale in [(1024,768,100),(1180,820,100),(1366,1024,135),(768,1024,135),(667,375,100),(1024,768,80)]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate(f'document.documentElement.style.setProperty("--control-size", "{scale/100}")')
        page.wait_for_timeout(80)
        boxes = page.evaluate('''() => [...document.querySelectorAll('#touch-controls button')]
          .filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return {id:b.id,x:r.x,y:r.y,w:r.width,h:r.height}})''')
        for b in boxes:
            assert b['w'] >= (63 if height < 500 else 79), b
            assert b['h'] >= (63 if height < 500 else 79), b
            assert b['x'] >= 0 and b['x']+b['w'] <= width+1, (width,b)
            assert b['y'] >= 0 and b['y']+b['h'] <= height+1, (height,b)
            for q in boxes:
                if b['id'] != q['id']:
                    assert min(b['x']+b['w'],q['x']+q['w']) <= max(b['x'],q['x']) or min(b['y']+b['h'],q['y']+q['h']) <= max(b['y'],q['y']), (b,q)
        zone=page.locator('#joystick-zone').bounding_box()
        assert zone['x']+zone['width'] <= min(b['x'] for b in boxes)-5
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        layouts.append([width,height,scale])
    page.set_viewport_size({'width':1024,'height':768})
    page.evaluate('document.documentElement.style.setProperty("--control-size", "1")')
    session = context.new_cdp_session(page)
    def touch(kind, points):
        session.send('Input.dispatchTouchEvent', {'type':kind,'touchPoints':[{'id':i,'x':x,'y':y} for i,x,y in points]})
    def center(selector):
        b=page.locator(selector).bounding_box();return b['x']+b['width']/2,b['y']+b['height']/2
    # A floating stick at its visual clamp must start neutral, without a phantom run.
    zone=page.locator('#joystick-zone').bounding_box();x,y=zone['x']+4,zone['y']+4
    touch('touchStart',[(1,x,y)])
    assert page.evaluate('__miniFC.input.axes.x === 0 && __miniFC.input.axes.z === 0')
    touch('touchMove',[(1,x+2,y+2)])
    assert page.evaluate('__miniFC.input.axes.x === 0 && __miniFC.input.axes.z === 0')
    touch('touchMove',[(1,x+35,y+25)])
    assert page.evaluate('__miniFC.input.axes.x > .3 && __miniFC.input.axes.z > .2')
    touch('touchEnd',[])
    # Keep a held shot captured across a possession change and regain before release.
    sx,sy=center('#shoot-button');touch('touchStart',[(2,sx,sy)])
    page.evaluate('__miniFC.match.ball.owner=3')
    page.wait_for_timeout(120)
    assert page.evaluate('!document.querySelector("#shoot-button").hidden && __miniFC.input.shooting !== null')
    page.evaluate('__miniFC.match.ball.owner=0')
    touch('touchEnd',[])
    page.wait_for_function('__miniFC.match.stats.shots === 1')
    # Defence targets occupy fixed slots; sprint remains at exactly the same point.
    sprint_before=page.locator('#sprint-button').bounding_box()
    page.evaluate('__miniFC.match.ball.owner=3')
    page.wait_for_function('!document.querySelector("#tackle-button").hidden')
    assert page.locator('#sprint-button').bounding_box() == sprint_before
    # Stray cancellation cannot release another finger's PRESS hold.
    px,py=center('#press-button');touch('touchStart',[(3,px,py)])
    assert page.evaluate('__miniFC.input.press')
    page.evaluate('document.querySelector("#press-button").dispatchEvent(new PointerEvent("pointercancel",{pointerId:999}))')
    assert page.evaluate('__miniFC.input.press')
    touch('touchCancel',[])
    assert page.evaluate('!__miniFC.input.press && !__miniFC.input.shooting && __miniFC.input.buttonHolds.size === 0')
    page.evaluate('__miniFC.match.ball.owner=0')
    page.wait_for_function('!document.querySelector("#shoot-button").hidden')
    page.screenshot(path=str(ARTIFACTS/'mobile-controls.png'))
    page.evaluate('__miniFC.match.queuedAction={action:"shoot",id:0,input:{},time:.35}')
    page.click('#pause')
    assert page.evaluate('__miniFC.mode === "pause" && __miniFC.match.queuedAction === null')
    assert not errors, errors
    print(json.dumps({'result':'PASS','layouts':layouts,'touch':'neutral edge/deadzone, held shot across possession, fixed sprint, multi-pointer cancellation','javascript_errors':errors}))
    browser.close()
