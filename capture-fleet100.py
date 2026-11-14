from pathlib import Path
import sys,json
sys.path.insert(0,str(Path.cwd().parent/'browser-qa'))
from playwright.sync_api import sync_playwright
out=Path('work-qa-fleet100');(out/'models').mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge')
 page=b.new_page(viewport={'width':1100,'height':720})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("window.__t=0;window.__q=[];performance.now=()=>__t;requestAnimationFrame=cb=>(__q.push(cb),__q.length);cancelAnimationFrame=()=>{};window.__step=()=>{__t+=33;let q=__q;__q=[];q.forEach(cb=>cb(__t))}")
 def hook(route):
  s=Path('dist/flight.js').read_text(encoding='utf-8').replace('  const buildingGeo = new THREE.BoxGeometry();','window.fleetQA={aircraftModel,get models(){return models},scene,renderer,get flight(){return flight}};const buildingGeo = new THREE.BoxGeometry();')
  route.fulfill(status=200,content_type='application/javascript',body=s)
 page.route('**/flight.js*',hook)
 page.goto('http://127.0.0.1:8803',wait_until='domcontentloaded',timeout=120000)
 page.wait_for_function('window.fleetQA',timeout=120000)
 page.locator('[data-hub-tab=freeflight]').click()
 page.locator('#hubFfCategory').select_option('business');assert page.locator('#hubFfAircraft option').count()==10
 page.locator('#hubOpenHangarBtn').click();page.locator('#hangarView').select_option('side')
 reports=[]
 for i in range(100):
  state=page.evaluate('''i=>{const p=fleet[i],e=document.querySelector('#hangarAircraft');e.value=p.id;e.dispatchEvent(new Event('change'));__step();return {id:p.id,name:p.name,n:fleetQA.models.size}}''',i)
  assert state['n']<=4,state
  page.screenshot(path=str(out/'models'/f"{i:03}-{state['id']}.png"))
  model=page.evaluate('''id=>{const m=fleetQA.models.get(id),bad=[];m.traverse(o=>{const a=o.geometry?.attributes.position?.array;if(a&&Array.from(a).some(v=>!Number.isFinite(v)))bad.push(o.name)});return {id,bad}}''',state['id'])
  assert not model['bad'],model;reports.append(state)
  if i%10==0:print('view',i,state['id'],flush=True)
 assert not errors,errors
 (out/'render-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
 # Mobile landscape - native touch viewport, not a physical iPhone/WebKit claim.
 page.set_viewport_size({'width':844,'height':390})
 page.locator('#deviceMode').select_option('mobile');page.locator('#hangarAircraft').select_option('g700');page.evaluate('__step()')
 page.screenshot(path=str(out/'mobile-hangar.png'))
 assert page.locator('#hangarFly').is_disabled()
 page.locator('#hangarUnlock').click(force=True);page.evaluate('__step()')
 assert page.evaluate('fleetQA.flight?.aircraft.id')=='c172s'
 page.screenshot(path=str(out/'unlock-mission.png'))
 (out/'capture-errors.json').write_text(json.dumps(errors),encoding='utf-8')
 print('100 models rendered; cache <=4; mobile mission link passed',flush=True)
 b.close()
