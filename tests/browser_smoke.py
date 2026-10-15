"""Optional production-browser integration checks.
Run after npm run build and npm run preview -- --port 4173.
Requires: python -m pip install playwright; python -m playwright install chromium
MINI_FC_BROWSER can point to an existing Chromium executable.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('MINI_FC_URL', 'http://127.0.0.1:4173/')
ARTIFACTS = Path(os.environ.get('MINI_FC_ARTIFACTS', 'playwright-results'))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
PREPARE_SHOT = """() => {
 const m = __miniFC.match; m.kickoffWait = 0;
 m.players.forEach((p,i) => {p.x=i%2?18:-18;p.z=10;p.cooldown=10;p.moving=0;});
 const p=m.players[0]; Object.assign(p,{x:0,z:-24,dx:0,dz:-1,cooldown:0});
 Object.assign(m.ball,{x:0,z:-25,y:.35,owner:0,vx:0,vz:0,vy:0});m.controlled=0;
}"""
with sync_playwright() as p:
    options = {'headless': True, 'args': ['--enable-unsafe-swiftshader']}
    if os.environ.get('MINI_FC_BROWSER'):
        options['executable_path'] = os.environ['MINI_FC_BROWSER']
    browser = p.chromium.launch(**options)
    context = browser.new_context(viewport={'width':1366,'height':900})
    page = context.new_page()
    errors, requests = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('response', lambda r: requests.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    page.goto(URL + '?test=1')
    expect(page.locator('#play')).to_be_visible()
    page.screenshot(path=str(ARTIFACTS / 'main.png'))
    page.click('#play')
    page.click('#kickoff')
    page.wait_for_function('__miniFC.mode === "playing"')
    page.evaluate('__miniFC.match.kickoffWait=0')
    start = page.evaluate('__miniFC.match.players[0].x')
    page.keyboard.down('KeyD')
    page.wait_for_function(f'__miniFC.match.players[0].x > {start + 0.8}')
    page.keyboard.up('KeyD')
    page.keyboard.press('Escape')
    page.wait_for_function('__miniFC.mode === "pause"')
    stopped = page.evaluate('__miniFC.match.elapsed')
    page.wait_for_timeout(350)
    assert page.evaluate('__miniFC.match.elapsed') == stopped, 'Paused clock moved'
    page.keyboard.press('Escape')
    page.wait_for_function('__miniFC.mode === "playing"')
    page.evaluate(PREPARE_SHOT)
    page.keyboard.press('KeyJ')
    page.wait_for_function('__miniFC.match.score[0] === 1')
    assert page.evaluate('__miniFC.match.stats.goals') == 1
    page.click('#pause')
    page.click('#restart')
    assert page.evaluate('__miniFC.match.score[0]') == 0
    page.click('#pause')
    page.click('#quit')
    page.click('#career')
    page.fill('#player-name', 'Safari Captain')
    page.select_option('#position', 'Midfielder')
    page.click('#create-career')
    expect(page.get_by_role('heading', name='Safari Captain')).to_be_visible()
    assert page.evaluate('__miniFC.career.attributes.pace') == 60
    page.screenshot(path=str(ARTIFACTS / 'career.png'))
    page.click('#fixture')
    page.evaluate(PREPARE_SHOT)
    page.keyboard.press('KeyJ')
    page.wait_for_function('__miniFC.match.score[0] === 1')
    # Advance the clock through the real simulation's full-time event.
    page.evaluate('__miniFC.match.kickoffWait=0;__miniFC.match.elapsed=119.99')
    page.wait_for_function('__miniFC.mode === "results"')
    assert page.evaluate('__miniFC.career.played') == 1
    assert page.evaluate('__miniFC.career.xp') == 180
    assert page.evaluate('__miniFC.career.points') == 1
    page.screenshot(path=str(ARTIFACTS / 'results.png'))
    page.click('#next')
    page.click('#upgrades')
    page.click('[data-upgrade="pace"]')
    assert page.evaluate('__miniFC.career.attributes.pace') == 63
    assert page.evaluate('__miniFC.career.points') == 0
    page.reload()
    page.wait_for_selector('#career')
    page.click('#career')
    assert page.evaluate('__miniFC.career.name') == 'Safari Captain'
    assert page.evaluate('__miniFC.career.attributes.pace') == 63
    assert page.evaluate('__miniFC.career.seasonMatch') == 1
    # Every season result travels through the normal full-time/reward UI.
    for expected in range(2, 6):
        page.click('#fixture')
        page.evaluate('__miniFC.match.kickoffWait=0;__miniFC.match.score=[4,0];__miniFC.match.elapsed=119.99')
        page.wait_for_function('__miniFC.mode === "results"')
        assert page.evaluate('__miniFC.career.played') == expected
        page.click('#next')
    assert page.evaluate('__miniFC.career.championships') == 1
    assert page.evaluate('__miniFC.career.table.every(r=>r.played===5)')
    page.click('#fixture')
    assert page.evaluate('__miniFC.career.season') == 2
    assert page.evaluate('__miniFC.career.seasonMatch') == 0
    assert page.evaluate('__miniFC.career.table.every(r=>r.played===0)')
    page.click('#back')
    page.click('#play')
    page.click('#kickoff')
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    page.wait_for_function('__miniFC.mode === "pause"')
    assert not errors, errors
    assert not requests, requests
    context.close()

    # Chromium tablet emulation checks touch logic, not real iPad hardware or Safari.
    tablet = browser.new_context(viewport={'width':1180,'height':820}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = tablet.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL + '?test=1')
    page.click('#play')
    page.click('#kickoff')
    expect(page.locator('#joystick')).to_be_visible()
    page.evaluate('__miniFC.match.kickoffWait=0')
    page.screenshot(path=str(ARTIFACTS / 'tablet.png'))
    stick = page.locator('#joystick').bounding_box()
    sprint = page.locator('#sprint-button').bounding_box()
    sx, sy = stick['x'] + stick['width']/2, stick['y'] + stick['height']/2
    bx, by = sprint['x'] + sprint['width']/2, sprint['y'] + sprint['height']/2
    cdp = tablet.new_cdp_session(page)
    def touches(kind, points):
        cdp.send('Input.dispatchTouchEvent', {'type':kind,'touchPoints':[{'x':x,'y':y,'id':i} for i,x,y in points]})
    touches('touchStart', [(1,sx,sy)])
    touches('touchMove', [(1,sx+35,sy-30)])
    touches('touchStart', [(1,sx+35,sy-30),(2,bx,by)])
    assert page.evaluate('__miniFC.input.axes.x') > 0.4
    assert page.evaluate('__miniFC.input.axes.z') < -0.3
    assert page.evaluate('__miniFC.input.sprint') is True
    x = page.evaluate('__miniFC.match.players[0].x')
    page.wait_for_function(f'__miniFC.match.players[0].x > {x+0.5}')
    touches('touchEnd', [])
    assert page.evaluate('__miniFC.input.axes.x') == 0
    assert page.evaluate('__miniFC.input.sprint') is False
    page.evaluate(PREPARE_SHOT)
    page.tap('#shoot-button')
    page.wait_for_function('__miniFC.match.score[0] === 1')
    page.evaluate(PREPARE_SHOT)
    passes_before = page.evaluate('__miniFC.match.stats.passes')
    page.tap('#pass-button')
    page.wait_for_function(f'__miniFC.match.stats.passes > {passes_before}')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.set_viewport_size({'width':820,'height':1180})
    page.wait_for_timeout(100)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    # Pointer cancellation must release the analog stick and sprint.
    page.evaluate('''() => {
      const stick=document.querySelector('#joystick'), sprint=document.querySelector('#sprint-button');
      __miniFC.input.pointer=99;__miniFC.input.axes={x:1,z:1};
      stick.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99}));
      __miniFC.input.sprintPointers.add(98);__miniFC.input.sprint=true;
      sprint.dispatchEvent(new PointerEvent('pointercancel',{pointerId:98}));
    }''')
    assert page.evaluate('__miniFC.input.axes.x===0 && !__miniFC.input.sprint')
    assert not errors, errors
    print(json.dumps({'result':'PASS','desktop':'keyboard, goal, pause/resume, restart, blur pause','career':'creation, results, XP, upgrade, reload, five-match championship, next season','touch':'simultaneous joystick + sprint, release/cancel, shoot, pass, landscape/portrait layout','javascript_errors':errors,'failed_http_responses':requests}))
    browser.close()
