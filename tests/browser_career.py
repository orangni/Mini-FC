"""Production hub/substitution/simulation/persistence checks in tablet Chromium emulation."""
import json, os
from playwright.sync_api import sync_playwright, expect
URL = os.environ.get('MINI_FC_URL', 'http://127.0.0.1:4173/')
with sync_playwright() as p:
    options = {'headless': True, 'args': ['--enable-unsafe-swiftshader']}
    if os.environ.get('MINI_FC_BROWSER'):
        options['executable_path'] = os.environ['MINI_FC_BROWSER']
    browser = p.chromium.launch(**options)
    context = browser.new_context(viewport={'width': 1024, 'height': 768}, is_mobile=True, has_touch=True)
    page = context.new_page(); errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL + '?test=1')
    page.click('#career'); page.fill('#player-name', 'Young Captain'); page.click('#create-career')
    expect(page.locator('.player-card h2')).to_have_text('Young Captain')
    assert page.evaluate('__miniFC.career.age===18 && __miniFC.career.seasonMatch===0')
    page.click('[data-activity="passing"]')
    assert page.evaluate('__miniFC.career.attributes.passing===60.14')
    assert page.locator('[data-activity]:enabled').count() == 0
    page.click('#fixture')
    assert page.evaluate('__miniFC.match.careerActive && !__miniFC.match.careerStarted && Math.abs(__miniFC.match.elapsed-80)<1')
    assert page.evaluate('__miniFC.match.controlled') == 0
    expect(page.locator('#joystick')).to_be_visible()
    page.keyboard.press('KeyQ'); assert page.evaluate('__miniFC.match.controlled') == 0
    page.click('#pause'); stopped=page.evaluate('__miniFC.match.elapsed')
    page.wait_for_timeout(100); assert page.evaluate('__miniFC.match.elapsed') == stopped
    page.click('#resume')
    # Complete the remaining actual simulation steps, rather than jumping its clock.
    page.evaluate('''() => {const m=__miniFC.match;m.autoUser=true;for(let i=0;i<8000&&!m.finished;i++)m.step(1/60,{});m.autoUser=false;}''')
    page.wait_for_function('__miniFC.mode==="results"')
    assert page.evaluate('__miniFC.career.seasonMatch===1 && __miniFC.career.appearances===1 && __miniFC.career.starts===0 && __miniFC.career.minutes===30 && __miniFC.career.fixtureLog.length===1')
    saved = page.evaluate('JSON.stringify(__miniFC.career)')
    page.evaluate('__miniFC.results()'); assert page.evaluate('JSON.stringify(__miniFC.career)') == saved
    page.click('#next'); page.click('#simulate'); page.wait_for_function('__miniFC.mode==="results"')
    assert page.evaluate('__miniFC.career.seasonMatch===2 && __miniFC.career.fixtureLog.length===2 && __miniFC.career.table.every(r=>r.played===2)')
    page.click('#next')
    expect(page.locator('#event-accept')).to_be_visible()
    page.click('#event-accept')
    assert page.evaluate('__miniFC.career.event===null')
    page.reload(); page.click('#career')
    assert page.evaluate('__miniFC.career.seasonMatch===2 && __miniFC.career.appearances>=1 && __miniFC.career.minutes>=30')
    # A fresh optional activity consumes the same slot as focused point training.
    page.evaluate('__miniFC.career.points=2'); page.click('#upgrades'); page.click('[data-upgrade="pace"]')
    assert page.locator('[data-upgrade]:enabled').count() == 0
    page.click('#back'); assert page.locator('[data-activity]:enabled').count() == 0
    assert not errors, errors
    print(json.dumps({'result':'PASS','checks':'tablet hub, optional activity limit, real substitute entry/minutes, captain lock, pause, full simulation, idempotent results, manager event, reload, focused training limit','javascript_errors':errors}))
    browser.close()
