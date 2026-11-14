'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const distDir = path.join(__dirname, 'dist');
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const mobileCss = fs.readFileSync(path.join(distDir, 'mobile-flight.css'), 'utf8');
const touchJs = fs.readFileSync(path.join(distDir, 'touch-controls.js'), 'utf8');
const flightJs = fs.readFileSync(path.join(distDir, 'flight.js'), 'utf8');

console.log('1. Verifying meta viewport anti-zoom configuration...');
assert(/maximum-scale=1/.test(indexHtml), 'index.html must include maximum-scale=1');
assert(/user-scalable=no/.test(indexHtml), 'index.html must include user-scalable=no');
assert(/viewport-fit=cover/.test(indexHtml), 'index.html must include viewport-fit=cover');

console.log('2. Verifying canvas.world fullscreen CSS...');
assert(/canvas\.world\{[^}]*width:100%!important;height:100%!important/.test(indexHtml), 'canvas.world must force 100% width and height');
assert(/min-height:100dvh/.test(indexHtml), 'body must use 100dvh to support mobile dynamic bars');

console.log('3. Verifying mobile anti-long-press CSS rules...');
assert(/-webkit-touch-callout:\s*none/.test(mobileCss), 'mobile-flight.css must disable webkit touch callout');
assert(/user-select:\s*none/.test(mobileCss), 'mobile-flight.css must disable text selection on mobile controls');
assert(/touch-action:\s*none/.test(mobileCss), 'mobile-flight.css must enforce touch-action: none on flight stick/throttle');
assert(/@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*550px\)/.test(mobileCss), 'mobile-flight.css must handle landscape mobile layout');

console.log('4. Verifying flight.js orientation & visualViewport resize handling...');
assert(/function getViewportSize\(\)/.test(flightJs), 'flight.js must define getViewportSize()');
assert(/renderer\.setSize\(w,h,false\)/.test(flightJs), 'flight.js must call renderer.setSize(w, h, false) so canvas style is never locked in pixels');
assert(/addEventListener\('orientationchange',scheduleOrientationResize\)/.test(flightJs), 'flight.js must listen for orientationchange');
assert(/window\.visualViewport\.addEventListener\('resize',resize\)/.test(flightJs), 'flight.js must listen for visualViewport resize');

console.log('5. Verifying touch-controls.js gesture & double-tap guards...');
assert(/gesturestart/.test(touchJs), 'touch-controls.js must guard gesturestart');
assert(/selectstart/.test(touchJs), 'touch-controls.js must guard selectstart');
assert(/orientationchange/.test(touchJs), 'touch-controls.js must reset controls on orientationchange');

// Functional VM check for touchControls guards
const listeners = new Map();
const makeEl = () => ({
  value: 'desktop',
  disabled: false,
  hidden: false,
  textContent: '',
  style: {},
  classList: { toggle: () => {} },
  setAttribute: () => {},
  getBoundingClientRect: () => ({ width: 120, height: 120, top: 0, left: 0 }),
  querySelector: () => makeEl(),
  addEventListener: (name, fn) => {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
  },
  dispatchEvent: () => {},
  setPointerCapture: () => {},
  releasePointerCapture: () => {}
});
const mockElements = {
  deviceMode: makeEl(),
  touchFlight: makeEl(),
  touchStick: makeEl(),
  touchRudder: makeEl(),
  touchThrottle: makeEl(),
  touchMotion: makeEl(),
  motionStatus: makeEl()
};
const docListeners = new Map();
const sandbox = {
  document: {
    documentElement: { dataset: {} },
    body: { classList: { toggle: () => {}, contains: () => true } },
    getElementById: (id) => mockElements[id] || makeEl(),
    addEventListener: (name, fn) => {
      if (!docListeners.has(name)) docListeners.set(name, []);
      docListeners.get(name).push(fn);
    }
  },
  window: {},
  localStorage: { getItem: () => 'mobile', setItem: () => {} },
  matchMedia: () => ({ matches: true }),
  addEventListener: () => {},
  setTimeout, clearTimeout,
  console, Math, Date, Number, String, Set, Event: class {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(touchJs, sandbox);

// Test contextmenu prevention on non-input target
let defaultPrevented = false;
const ctxHandlers = docListeners.get('contextmenu') || [];
assert(ctxHandlers.length > 0, 'contextmenu guard should be registered');
ctxHandlers[0]({
  target: { closest: () => null },
  preventDefault: () => { defaultPrevented = true; }
});
assert.strictEqual(defaultPrevented, true, 'Long-press contextmenu must be prevented on non-editable mobile HUD');

// Input target must still allow selection/contextmenu
let inputPrevented = false;
ctxHandlers[0]({
  target: { closest: (sel) => sel.includes('input') ? {} : null },
  preventDefault: () => { inputPrevented = true; }
});
assert.strictEqual(inputPrevented, false, 'Input elements must preserve native interaction');

// Title hub & mobile portrait/landscape launch CTA checks
const aeroUiV63 = fs.readFileSync(path.join(distDir, 'aero-ui-v63.css'), 'utf8');
const campaignJs = fs.readFileSync(path.join(distDir, 'campaign-story.js'), 'utf8');
assert(/--hub-top/.test(aeroUiV63) && /syncHubTop/.test(campaignJs), 'Hub dynamically tracks header bottom via --hub-top');
assert(/@media\s*\(max-width:\s*900px\)[\s\S]*flex-direction:\s*row[\s\S]*overflow-x:\s*auto/.test(aeroUiV63), 'Portrait mobile turns .hub-menu-list into compact horizontal tab strip');
assert(/#campaignRouteCanvas\s*\{\s*display:\s*none\s*!important/.test(aeroUiV63), 'Landscape compact rule keeps campaign launch CTA above the fold');
assert(/hubQuickStartBtn/.test(campaignJs) && /hubQuickFreeBtn/.test(campaignJs), 'Welcome stage provides immediate 1-tap quick launch buttons above the fold');
assert(/document\.body\.classList\.contains\('flight-ui'\)\s*&&\s*event\.target\.closest\('#touchFlight,\.hud button'\)/.test(touchJs), 'touchend guard only blocks rapid double-tap during active flight-ui HUD');

console.log('All mobile viewport & anti-zoom tests passed successfully!');
