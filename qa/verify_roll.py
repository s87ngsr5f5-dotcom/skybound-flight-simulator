import sys,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'browser-qa'))
from playwright.sync_api import sync_playwright,expect
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8798'
def instrument(route):
 response=route.fetch()
 body=response.text().replace('  const buildingGeo = new THREE.BoxGeometry();',"window.rollQA={get flight(){return flight},get model(){return models.get(flight?.aircraft.id)},camera,scene,travel:0};const buildingGeo = new THREE.BoxGeometry();")
 route.fulfill(response=response,body=body)
with sync_playwright() as p:
 for mobile in [False,True]:
  browser=p.webkit.launch() if mobile else p.chromium.launch(channel='msedge')
  page=browser.new_page(**({**p.devices['iPhone 13'],'viewport':{'width':844,'height':390}} if mobile else {'viewport':{'width':1440,'height':900}}))
  page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/flight.js?*',instrument)
  page.goto(base+('/iphone.html' if mobile else '/index.html'),timeout=90000)
  expect(page.locator('#startupNotice')).to_be_hidden(timeout=60000);expect(page.locator('#edition')).to_have_text('0.31')
  page.select_option('#quality','satellite')
  page.locator('#quickControls summary').click();page.locator('#keepBank').check();page.locator('#quickControls summary').click()
  page.select_option('#aircraft','f16v');page.select_option('#departure','RCSS');page.select_option('#destination','RCYU');page.select_option('#startType','air');page.locator('#fly').click()
  page.evaluate('''()=>{let previous=rollQA.flight.bank;function watch(){const f=rollQA.flight;if(!f)return;rollQA.travel+=Math.atan2(Math.sin(f.bank-previous),Math.cos(f.bank-previous));previous=f.bank;requestAnimationFrame(watch);}watch();}''')
  if mobile:
   s=page.locator('#touchStick').bounding_box();x=s['x']+s['width']/2;y=s['y']+s['height']/2
   page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+s['width']*.45,y)
  else:page.evaluate('document.activeElement.blur()');page.keyboard.down('ArrowRight')
  page.wait_for_function('rollQA.travel>Math.PI*2+.1',timeout=30000)
  if mobile:page.mouse.up()
  else:page.keyboard.up('ArrowRight')
  page.wait_for_function('Math.abs(rollQA.flight.bankRate)<.025')
  settled=page.evaluate('({roll:rollQA.travel,bank:rollQA.flight.bank,y:rollQA.flight.y})');page.wait_for_timeout(600)
  assert abs(page.evaluate('rollQA.flight.bank')-settled['bank'])<.05
  print('Complete right roll and neutral stop',mobile,settled,flush=True)
  page.evaluate('rollQA.travel=0')
  if mobile:
   page.mouse.move(x,y);page.mouse.down();page.mouse.move(x-s['width']*.45,y)
  else:page.keyboard.down('ArrowLeft')
  page.wait_for_function('rollQA.travel<-Math.PI*2-.1',timeout=30000)
  if mobile:page.mouse.up()
  else:page.keyboard.up('ArrowLeft')
  page.wait_for_function('Math.abs(rollQA.flight.bankRate)<.025')
  # Real cockpit camera must inherit the aircraft roll, including an inverted pose.
  if mobile:page.locator('#touchQuick [data-action="KeyC"]').click()
  else:page.keyboard.press('c')
  page.wait_for_timeout(200)
  assert page.evaluate('rollQA.camera.up.clone().normalize().dot(new THREE.Vector3(0,1,0).applyQuaternion(rollQA.model.quaternion))>.99')
  page.screenshot(path=str(ROOT.parent/('roll31-mobile.png' if mobile else 'roll31-desktop.png')))
  page.locator('#flightBar [data-panel="more"]').click();page.locator('#helpCenter').click()
  page.wait_for_function('Math.abs(rollQA.flight.bank)<.035',timeout=10000)
  page.locator('#menu').click();expect(page.locator('#plan')).to_be_visible()
  assert not errors,errors;print('Left roll, cockpit, wings-level recovery and menus passed',mobile,flush=True);browser.close()
