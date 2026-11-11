from pathlib import Path
exec((Path(__file__).parent/'verify_menus.py').read_text(encoding='utf-8').split('with sync_playwright() as p:')[0])
def instrument(route):
 response=route.fetch();body=response.text().replace('  const buildingGeo = new THREE.BoxGeometry();',"window.sceneQA={airports:airportDetails,scene,camera,renderer};const buildingGeo = new THREE.BoxGeometry();")
 route.fulfill(response=response,body=body)
with sync_playwright() as p:
 for mobile in [False,True]:
  browser=p.webkit.launch() if mobile else p.chromium.launch(channel='msedge')
  page=browser.new_page(**({**p.devices['iPhone 13'],'viewport':{'width':844,'height':390}} if mobile else {'viewport':{'width':1440,'height':900}}))
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/flight.js?*',instrument)
  page.goto(base+('/iphone.html' if mobile else '/index.html'),timeout=90000)
  expect(page.locator('#startupNotice')).to_be_hidden(timeout=60000)
  page.select_option('#quality','satellite' if mobile else 'high')
  page.locator('#inspect').evaluate('e=>e.closest("details").open=true');page.select_option('#inspect','tour-landside');page.locator('#viewScene').click()
  page.wait_for_timeout(4000)
  stats=page.evaluate("()=>{let a=sceneQA.airports.find(a=>a.root.name.startsWith('RCSS'));return {stats:a.stats,draws:sceneQA.renderer.info.render.calls,meshes:a.root.children.length}}")
  assert stats['stats']['movingVehicles']==3 and stats['stats']['facadeBays']>100
  assert stats['meshes']<42
  position=page.evaluate("sceneQA.scene.getObjectByName('Landside shuttle traffic').children[0].position.toArray()")
  page.wait_for_timeout(1200)
  later=page.evaluate("sceneQA.scene.getObjectByName('Landside shuttle traffic').children[0].position.toArray()")
  # The first named group belongs to RCSS, and the bus must move only horizontally.
  assert position!=later and position[1]==later[1]==0,(position,later)
  page.screenshot(path=str(ROOT.parent/('airport30-mobile.png' if mobile else 'airport30-day.png')))
  page.locator('#exitInspection').click();page.locator('#time').evaluate('e=>e.closest("details").open=true');page.locator('#time').fill('20:00');page.locator('#viewScene').click();page.wait_for_timeout(2000)
  glow=page.evaluate("sceneQA.airports.find(a=>a.root.name.startsWith('RCSS')).root.children.filter(m=>m.material?.transparent).map(m=>m.material.opacity)")
  assert max(glow)>.5,glow
  page.screenshot(path=str(ROOT.parent/('airport30-night-mobile.png' if mobile else 'airport30-night.png')))
  page.locator('#exitInspection').click();assert not errors,errors
  print('Airport detail passed',mobile,json.dumps(stats),flush=True);browser.close()
server.shutdown()
