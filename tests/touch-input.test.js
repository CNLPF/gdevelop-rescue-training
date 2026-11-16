import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUCH_LAYOUT,
  blockAllTouches,
  contextTouchAction,
  contextTouchPresentation,
  createTouchInputState,
  deriveActionEdges,
  hitTouchButton,
  mergeActionDown,
  normalizeTouchControlsMode,
  pointInRect,
  shouldShowTouchControls,
  touchLayoutSafe,
  updateTouchInputState,
} from '../src/shared/touch-input.js';

const at = (button, dx = 8, dy = 8) => ({
  x: TOUCH_LAYOUT[button].x + dx,
  y: TOUCH_LAYOUT[button].y + dy,
});

test('all landscape touch buttons use readable, non-overlapping safe areas', () => {
  assert.equal(touchLayoutSafe(), true);
  assert.equal(TOUCH_LAYOUT.restart.height, 60);
  const all = Object.values(TOUCH_LAYOUT);
  for (const button of all) {
    assert.ok(button.width >= 60, `${button.action} width`);
    assert.ok(button.height >= 60, `${button.action} height`);
    assert.ok(button.x >= 12 && button.y >= 12, `${button.action} starts inside the safe area`);
    assert.ok(button.x + button.width <= 948, `${button.action} right safe area`);
    assert.ok(button.y + button.height <= 628, `${button.action} bottom safe area`);
  }
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const overlap = Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width) &&
        Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height);
      assert.equal(overlap, false, `${a.action} overlaps ${b.action}`);
    }
  }
});

test('hit testing respects every button boundary and rejects the gap', () => {
  for (const [action, button] of Object.entries(TOUCH_LAYOUT)) {
    assert.equal(pointInRect(button.x, button.y, button), true, `${action} top-left`);
    assert.equal(pointInRect(button.x + button.width, button.y + button.height, button), true, `${action} bottom-right`);
    assert.equal(pointInRect(button.x - 0.01, button.y, button), false, `${action} left release`);
    assert.equal(hitTouchButton(button.x + 2, button.y + 2)?.action, action);
  }
  assert.equal(hitTouchButton(802, 516), null, 'gap between interaction and attack is inactive');
});

test('independent fingers hold movement and attack together', () => {
  const state = createTouchInputState();
  const right = at('right');
  const fire = at('fire');
  const down = updateTouchInputState(state, [
    {id:10,...right},
    {id:12,...fire},
  ], 'Playing');
  assert.equal(down.right, true);
  assert.equal(down.fire, true);
  assert.equal(down.left, false);
});

test('one released finger cannot cancel another pointer holding the same action', () => {
  const state = createTouchInputState();
  const fire = at('fire');
  updateTouchInputState(state, [{id:10,...fire},{id:12,...fire}], 'Playing');
  const oneReleased = updateTouchInputState(state, [{id:10,...fire,ended:true},{id:12,...fire}], 'Playing');
  assert.equal(oneReleased.fire, true);
  const bothReleased = updateTouchInputState(state, [{id:10,ended:true},{id:12,ended:true}], 'Playing');
  assert.equal(bothReleased.fire, false);
});

test('leaving a button releases the action and blocks that pointer from sliding into another button', () => {
  const state = createTouchInputState();
  const left = at('left');
  updateTouchInputState(state, [{id:20,...left}], 'Playing');
  const outside = updateTouchInputState(state, [{id:20,x:190,y:550}], 'Playing');
  assert.equal(outside.left, false);
  const stolen = updateTouchInputState(state, [{id:20,...at('right')}], 'Playing');
  assert.equal(stolen.right, false);
  const afterLift = updateTouchInputState(state, [], 'Playing');
  assert.equal(afterLift.right, false);
  const newTouch = updateTouchInputState(state, [{id:21,...at('right')}], 'Playing');
  assert.equal(newTouch.right, true);
});

test('menus remap only interaction, weapon, and directional buttons', () => {
  assert.equal(contextTouchAction('interact','Shop'), 'confirm');
  assert.equal(contextTouchAction('switch','Shop'), 'cancel');
  assert.equal(contextTouchAction('left','Portal'), 'left');
  assert.equal(contextTouchAction('fire','Shop'), null);
  assert.deepEqual(contextTouchPresentation('interact','RestartConfirm'), {action:'confirm',animation:'Confirm',label:'确认'});
  assert.deepEqual(contextTouchPresentation('switch','Portal'), {action:'cancel',animation:'Back',label:'返回'});
  assert.equal(contextTouchPresentation('jump','Shop').animation, 'Jump');
});

test('opening a menu invalidates the finger that opened it until that finger lifts', () => {
  const state = createTouchInputState();
  const interact = at('interact');
  const playing = updateTouchInputState(state, [{id:30,...interact}], 'Playing');
  assert.equal(playing.interact, true);
  blockAllTouches(state);
  const shopFrame = updateTouchInputState(state, [{id:30,...interact}], 'Shop');
  assert.equal(shopFrame.confirm, false);
  updateTouchInputState(state, [{id:30,...interact,ended:true}], 'Shop');
  updateTouchInputState(state, [], 'Shop');
  const lifted = updateTouchInputState(state, [{id:31,...interact}], 'Shop');
  assert.equal(lifted.confirm, true);
});

test('button Ownership and held state stay stable while taps expose pressed and released edges', () => {
  const state = createTouchInputState();
  const jump = at('jump');
  const held = updateTouchInputState(state, [{id:40,...jump}], 'Playing');
  const previous = mergeActionDown({}, {}, true);
  const current = mergeActionDown({}, held, true);
  const edge = deriveActionEdges(previous,current);
  assert.equal(current.jump,true);
  assert.equal(edge.pressed.jump,true);
  assert.equal(edge.released.jump,false);
  const released = updateTouchInputState(state, [{id:40,...jump,ended:true}], 'Playing');
  const releaseEdge = deriveActionEdges(current,mergeActionDown({},released,true));
  assert.equal(releaseEdge.released.jump,true);
});

test('keyboard and touch aggregate into the same actions, and portrait pause disables all', () => {
  const merged = mergeActionDown({left:true,fire:true},{right:true,jump:true},true);
  assert.equal(merged.left,true);
  assert.equal(merged.right,true);
  assert.equal(merged.fire,true);
  assert.equal(merged.jump,true);
  const paused = mergeActionDown({left:true},{fire:true},false);
  assert.equal(Object.values(paused).some(Boolean),false);
});

test('touch mode supports auto, forced testing, and disabled mode', () => {
  assert.equal(normalizeTouchControlsMode('ON'), 'on');
  assert.equal(normalizeTouchControlsMode('unexpected'), 'auto');
  assert.equal(shouldShowTouchControls('auto',true), true);
  assert.equal(shouldShowTouchControls('auto',false), false);
  assert.equal(shouldShowTouchControls('on',false), true);
  assert.equal(shouldShowTouchControls('off',true), false);
});
