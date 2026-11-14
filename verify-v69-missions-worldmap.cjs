const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');

function readDist(file) {
  return fs.readFileSync(path.join(distDir, file), 'utf8');
}

// 1. Verify valid JavaScript syntax for all modified runtime scripts
const jsFiles = [
  'region.js',
  'airways-nav.js',
  'taiwan-city.js',
  'taiwan-overview.js',
  'flight.js',
  'campaign-story.js'
];
for (const file of jsFiles) {
  const code = readDist(file);
  assert.doesNotThrow(() => new vm.Script(code, { filename: file }), `${file} parses without syntax errors`);
}

// 2. Execute region.js + airways-nav.js in a VM and verify RJBB/VTBS, 9 regions, and 16+ VORs
{
  const regionCode = readDist('region.js');
  const airwaysCode = readDist('airways-nav.js');
  const sandbox = {
    console,
    Math,
    Number,
    Array,
    Object,
    String,
    Set,
    Map,
    module: { exports: {} },
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.global = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(regionCode, sandbox, { filename: 'region.js' });
  vm.runInContext(airwaysCode, sandbox, { filename: 'airways-nav.js' });

  assert.strictEqual(sandbox.internationalRegions.length, 9, 'internationalRegions has all 9 theatres (TW + 8 overseas)');
  const regionIds = sandbox.internationalRegions.map(r => r.id);
  for (const id of ['TW', 'JP_TYO', 'JP_KIX', 'JP_OKA', 'HK_HKG', 'KR_ICN', 'SG_SIN', 'PH_MNL', 'TH_BKK']) {
    assert.ok(regionIds.includes(id), `internationalRegions includes ${id}`);
  }

  const airportCodes = sandbox.allAirports.map(a => a.code);
  assert.ok(airportCodes.includes('RJBB'), 'allAirports includes RJBB (Osaka Kansai)');
  assert.ok(airportCodes.includes('VTBS'), 'allAirports includes VTBS (Bangkok Suvarnabhumi)');

  const rjbb = sandbox.allAirports.find(a => a.code === 'RJBB');
  const rjtt = sandbox.allAirports.find(a => a.code === 'RJTT');
  const vtbs = sandbox.allAirports.find(a => a.code === 'VTBS');
  const osakaRoute = sandbox.regionalRoute(rjbb, rjtt);
  assert.ok(Array.isArray(osakaRoute) && osakaRoute.length >= 2, 'regionalRoute(RJBB, RJTT) returns corridor waypoints');

  const osakaH = sandbox.internationalTerrainHeight(rjbb.x + 18000, rjbb.z - 14000);
  const bkkH = sandbox.internationalTerrainHeight(vtbs.x, vtbs.z);
  assert.ok(Number.isFinite(osakaH) && Number.isFinite(bkkH), 'internationalTerrainHeight computes finite relief near RJBB and VTBS');

  assert.strictEqual(sandbox.airwaysNav.getVORStations().length, 7, 'getVORStations() preserves 7 Taiwan VORs invariant');
  assert.ok(sandbox.airwaysNav.getAllVORStations().length >= 16, 'getAllVORStations() combines Taiwan + 9 international VORs');
}

// 3. Execute campaign-story.js in VM and verify 15 chapters, 6 challenges, Sky Gates, and medals
{
  const campaignCode = readDist('campaign-story.js');
  const elements = new Map();
  const makeEl = (tag) => {
    let _id = '';
    let _html = '';
    const el = {
      tagName: String(tag || 'DIV').toUpperCase(),
      get id() { return _id; },
      set id(v) { _id = String(v || ''); if (_id) elements.set(_id, el); },
      className: '',
      get innerHTML() { return _html; },
      set innerHTML(v) {
        _html = String(v || '');
        for (const m of _html.matchAll(/id="([^"]+)"/g)) {
          if (!elements.has(m[1])) {
            const sub = makeEl('DIV');
            sub.id = m[1];
          }
        }
      },
      textContent: '',
    value: '',
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    classList: {
      toggle() {},
      add() {},
      remove() {},
      contains() { return false; }
    },
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    appendChild() {},
    insertBefore() {},
    remove() {},
    scrollTo() {},
    getBoundingClientRect: () => ({ top: 0, bottom: 52, left: 0, right: 320, width: 320, height: 52 }),
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getContext() { return null; },
    closest() { return null; }
    };
    return el;
  };
  const storage = new Map();
  const sandbox = {
    console,
    Math,
    Number,
    Array,
    Object,
    String,
    JSON,
    Date,
    Set,
    Map,
    parseInt,
    parseFloat,
    isFinite,
    requestAnimationFrame: () => 0,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    performance: { now: () => Date.now() },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k)
    },
    document: {
      readyState: 'loading',
      documentElement: { style: { setProperty() {} } },
      body: makeEl('BODY'),
      createElement: makeEl,
      getElementById: id => elements.get(id) || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {}
    },
    CustomEvent: function CustomEvent(name, detail) { this.type = name; this.detail = detail; }
  };
  let walletSyncCalls = 0;
  sandbox.__skyboundSyncWallet = () => { walletSyncCalls += 1; };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.dispatchEvent = () => {};
  vm.createContext(sandbox);
  vm.runInContext(campaignCode, sandbox, { filename: 'campaign-story.js' });

  const camp = sandbox.SkyboundCampaign;
  assert.ok(camp, 'SkyboundCampaign global is exposed');
  assert.strictEqual(camp.chapters.length, 7, 'Story chapters length === 7 (Taiwan mainline)');
  assert.strictEqual(camp.worldChapters.length, 8, 'World expedition chapters length === 8 (WP.08..WP.15)');
  assert.strictEqual(camp.allChapters.length, 15, 'allChapters combines to 15 total missions');
  assert.strictEqual(typeof camp.isOnlineFlight, 'function', 'SkyboundCampaign exposes isOnlineFlight()');
  assert.strictEqual(typeof camp.refreshCareerUI, 'function', 'SkyboundCampaign exposes refreshCareerUI()');
  assert.strictEqual(camp.isOnlineFlight(), false, 'isOnlineFlight() defaults to false for solo play');
  camp.openHub('welcome');
  assert.ok(walletSyncCalls >= 1, 'openHub / ensureStarterMoney triggers __skyboundSyncWallet on startup');
  assert.ok(JSON.parse(storage.get('skybound.career.v1')).money >= 18000, 'Starter grant seeds $18,000 into skybound.career.v1');

  const ep1 = camp.chapters.find(c => c.id === 1);
  assert.ok(ep1.targetText.includes('600+ ft'), 'EP.01 targetText advertises 600+ ft');
  assert.strictEqual(ep1.stages[1].check({ ended: false, ground: false, y: 152 }, { flownM: 1800 }), false, 'EP.01 stage 2 requires >= 183m (600 ft)');
  assert.strictEqual(ep1.stages[1].check({ ended: false, ground: false, y: 183 }, { flownM: 1800 }), true, 'EP.01 stage 2 passes at 183m (600 ft)');
  assert.strictEqual(ep1.winCondition({ ended: false, ground: false, y: 183 }, { flownM: 3200 }), true, 'EP.01 winCondition passes without f.airborne');
  assert.strictEqual(ep1.winCondition({ ended: false, ground: true, y: 183 }, { flownM: 3200 }), false, 'EP.01 winCondition requires !ground');
  assert.ok(!campaignCode.includes('f.airborne'), 'campaign-story.js removes dead f.airborne checks');

  camp.startChapter(1);
  assert.strictEqual(camp.isOnlineFlight(), false, 'Starting story chapter keeps isOnlineFlight() false');

  const ids = camp.allChapters.map(c => c.id);
  const wp14 = camp.allChapters.find(c => c.id === 14);
  const wp15 = camp.allChapters.find(c => c.id === 15);
  assert.ok(wp14 && wp14.code === 'WP.14' && wp14.departure === 'RJBB', 'allChapters includes WP.14 Osaka Kansai (RJBB)');
  assert.ok(wp15 && wp15.code === 'WP.15' && wp15.departure === 'VTBS', 'allChapters includes WP.15 Bangkok Suvarnabhumi (VTBS)');
  assert.strictEqual(ids.length, 15, 'allChapters has 15 unique chapters');
  assert.ok(camp.medals.some(m => m.id === 'world_conqueror'), 'MEDALS includes world_conqueror');
  assert.ok(camp.medals.some(m => m.id === 'aerobatic_ace'), 'MEDALS includes aerobatic_ace');

  assert.ok(campaignCode.includes('aerobatic_show') && campaignCode.includes('world_tour'), 'Challenge modes include aerobatic_show & world_tour');
  assert.ok(campaignCode.includes('function getBonusObjective(') && campaignCode.includes('function buildMissionSkyGates('), 'Campaign includes bonus objective & Sky Gate builders');
  assert.ok(campaignCode.includes('function drawCampaignRoutePreview(') && campaignCode.includes('worldQuickHubs'), 'Campaign hub includes 2D route preview & 9-region quick hubs');
  assert.ok(campaignCode.includes('hubExportSaveBtn') && campaignCode.includes('hubImportSaveInput') && campaignCode.includes('skybound-save-v1'), 'Settings includes JSON save backup export/import');
  assert.ok(campaignCode.includes('/55 kt') && campaignCode.includes('按 [↑] 或輕拉滑鼠抬頭離地'), 'Story HUD shows beginner step-by-step takeoff guidance');
}

// 4. Inspect international scenery, 3D overview, HUD Sky Gates, radar & HTML wiring
{
  const twCity = readDist('taiwan-city.js');
  for (const key of ['osaka_castle', 'osaka_umeda', 'bangkok_palace', 'bangkok_mahanakhon', 'intl_city_cluster']) {
    assert.ok(twCity.includes(key), `taiwan-city.js defines ${key}`);
  }

  const overview = readDist('taiwan-overview.js');
  for (const key of ['intlTerrainGroup', 'centerOnCoords', 'getAllVORStations', '3500000']) {
    assert.ok(overview.includes(key), `taiwan-overview.js includes ${key}`);
  }

  const flight = readDist('flight.js');
  for (const key of ['missionSkyGatesGroup', 'drawMissionSkyGates', 'radarRegionSelect', 'getAllVORStations', "'RJBB'", "'VTBS'", 'const pts=Array.isArray(br)?br:br?.pts', 'wantsOnline', '__skyboundSyncWallet=updateAirlinePlan', '🔒 單人離線']) {
    assert.ok(flight.includes(key), `flight.js includes ${key}`);
  }

  // Verify region.js internationalRegions bridges objects ({ name, pts }) iterate cleanly without br.forEach throwing
  const regSandbox = {};
  regSandbox.window = regSandbox;
  regSandbox.globalThis = regSandbox;
  vm.createContext(regSandbox);
  const intlRegions = vm.runInContext(readDist('region.js') + '; internationalRegions;', regSandbox, { filename: 'region.js' });
  assert.ok(Array.isArray(intlRegions) && intlRegions.length >= 6, 'region.js exposes internationalRegions');
  let visitedBridgePts = 0;
  for (const reg of intlRegions) {
    for (const br of (reg.bridges || [])) {
      const pts = Array.isArray(br) ? br : br?.pts;
      if (Array.isArray(pts)) pts.forEach(() => { visitedBridgePts += 1; });
    }
  }
  assert.ok(visitedBridgePts >= 4, 'internationalRegions bridges ({name, pts}) safely unpack into point arrays');

  const css = readDist('aero-ui-v63.css');
  assert.ok(css.includes('flex-wrap: wrap;') && css.includes('#campaignRouteCanvas'), 'aero-ui-v63.css styles radar-direct-row wrapping & campaignRouteCanvas');

  for (const htmlName of ['index.html', 'iphone.html']) {
    const html = readDist(htmlName);
    assert.ok(html.includes('>0.63<'), `${htmlName} retains >0.63< badge invariant`);
    assert.ok(html.includes('<option value="RJBB">桃園 → 大阪關西</option>'), `${htmlName} adds RJBB route option`);
    assert.ok(html.includes('<option value="VTBS">桃園 → 曼谷蘇凡納布</option>'), `${htmlName} adds VTBS route option`);
    for (const tag of [
      'aero-ui-v63.css?v=63&r=69',
      'region.js?v=satellite26&r=69',
      'taiwan-overview.js?v=satellite26&r=69',
      'taiwan-city.js?v=62&r=69',
      'airways-nav.js?r=69',
      'flight.js?v=roll31&r=69',
      'campaign-story.js?v=63&r=69'
    ]) {
      assert.ok(html.includes(tag), `${htmlName} loads cache-busted asset ${tag}`);
    }
  }
}

console.log('verify-v69-missions-worldmap: OK (15 chapters, Sky Gates, 2 challenges, 9 regions, Osaka & Bangkok scenery/VOR/routes verified)');
