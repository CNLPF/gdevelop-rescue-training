// Pure touch layout and state helpers. GDevelop provides raw touch identifiers;
// this module maps them to the same named actions used by the keyboard.
export const TOUCH_ACTIONS = [
  'left','right','up','down','jump','fire','switch','interact',
  'confirm','cancel','restart',
];

export const TOUCH_PHYSICAL_ACTIONS = [
  'left','right','jump','fire','switch','interact','restart',
];

// Reference canvas: 960x640 landscape. Bottom buttons leave at least 32 px of
// safe margin; the HUD occupies the top-left and the compact restart button sits
// in the top-right. No hit rectangles overlap.
export const TOUCH_LAYOUT = Object.freeze({
  left:     Object.freeze({x:24,  y:532, width:72, height:72, action:'left',     animation:'Left',     label:'左'}),
  right:    Object.freeze({x:108, y:532, width:72, height:72, action:'right',    animation:'Right',    label:'右'}),
  jump:     Object.freeze({x:724, y:536, width:72, height:72, action:'jump',     animation:'Jump',     label:'跳跃'}),
  fire:     Object.freeze({x:812, y:520, width:88, height:88, action:'fire',     animation:'Attack',   label:'攻击'}),
  switch:   Object.freeze({x:726, y:446, width:70, height:66, action:'switch',   animation:'Weapon',   label:'武器'}),
  interact: Object.freeze({x:824, y:446, width:70, height:66, action:'interact', animation:'Interact', label:'交互'}),
  restart:  Object.freeze({x:878, y:16,  width:62, height:60, action:'restart',  animation:'Restart',  label:'重开'}),
});

export const TOUCH_BUTTON_ACTIONS = Object.freeze(TOUCH_PHYSICAL_ACTIONS.slice());

export function pointInRect(x, y, rect) {
  return !!rect && x >= rect.x && x <= rect.x + rect.width &&
    y >= rect.y && y <= rect.y + rect.height;
}

export function hitTouchButton(x, y) {
  for (const button of Object.values(TOUCH_LAYOUT)) {
    if (pointInRect(x, y, button)) return button;
  }
  return null;
}

export function normalizeTouchControlsMode(value) {
  const mode = String(value || 'auto').toLowerCase();
  return mode === 'on' || mode === 'off' ? mode : 'auto';
}

export function shouldShowTouchControls(mode, coarsePointer) {
  const normalized = normalizeTouchControlsMode(mode);
  return normalized === 'on' || (normalized === 'auto' && !!coarsePointer);
}

const MENU_MODES = new Set(['Shop', 'Portal', 'RestartConfirm']);

// The button identity remains stable for ownership, while its semantic action
// changes in menus. This prevents one menu frame from falling back to gameplay.
export function contextTouchAction(buttonAction, gameMode) {
  if (!TOUCH_PHYSICAL_ACTIONS.includes(buttonAction)) return null;
  if (MENU_MODES.has(gameMode)) {
    if (buttonAction === 'interact') return 'confirm';
    if (buttonAction === 'switch') return 'cancel';
    if (buttonAction === 'left' || buttonAction === 'right') return buttonAction;
    return null;
  }
  if (gameMode === 'Playing') return buttonAction;
  if (buttonAction === 'restart' && gameMode !== 'Respawning') return 'restart';
  return null;
}

export function contextTouchPresentation(buttonAction, gameMode) {
  if (MENU_MODES.has(gameMode)) {
    if (buttonAction === 'interact') return {action:'confirm',animation:'Confirm',label:'确认'};
    if (buttonAction === 'switch') return {action:'cancel',animation:'Back',label:'返回'};
  }
  const button = Object.values(TOUCH_LAYOUT).find(item => item.action === buttonAction);
  return button ? {action:button.action,animation:button.animation,label:button.label} : null;
}

export function createTouchInputState() {
  return {owners:{},blocked:{},down:{},activeIds:[]};
}

function emptyTouchActions() {
  const result = {};
  for (const action of TOUCH_ACTIONS) result[action] = false;
  return result;
}

function markDown(result, action) {
  if (action) result[action] = true;
}

// A pointer owns at most one button until it ends. Leaving its original button
// blocks reacquisition, which prevents a sliding finger from stealing another
// action. Multiple pointers may own the same action and remain active together.
export function updateTouchInputState(state, touches, gameMode) {
  const working = state || createTouchInputState();
  const down = emptyTouchActions();
  const present = {};
  for (const touch of touches || []) {
    const id = String(touch && touch.id);
    if (id === 'undefined' || id === 'null' || !touch || touch.id === 1) continue;
    present[id] = true;
    if (working.blocked[id]) continue;
    if (touch.ended) {
      delete working.owners[id];
      working.blocked[id] = true;
      continue;
    }
    let buttonAction = working.owners[id];
    if (buttonAction) {
      const button = Object.values(TOUCH_LAYOUT).find(item => item.action === buttonAction);
      if (!button || !pointInRect(Number(touch.x), Number(touch.y), button)) {
        delete working.owners[id];
        working.blocked[id] = true;
        continue;
      }
    } else {
      const button = hitTouchButton(Number(touch.x), Number(touch.y));
      if (button) {
        buttonAction = button.action;
        working.owners[id] = buttonAction;
      }
    }
    if (buttonAction) markDown(down, contextTouchAction(buttonAction, gameMode));
  }
  for (const id of Object.keys(working.owners)) if (!present[id]) delete working.owners[id];
  for (const id of Object.keys(working.blocked)) if (!present[id]) delete working.blocked[id];
  working.down = down;
  working.activeIds = Object.keys(working.owners);
  return down;
}

// Called after any GameMode change. A finger used to open or close a menu must
// lift before the contextual action becomes active (for example, opening a shop
// with Interact must not immediately buy through Confirm).
export function blockTouchActions(state, actions = ['interact','switch','restart']) {
  if (!state) return;
  const blockedActions = new Set(actions);
  for (const [id, action] of Object.entries(state.owners || {})) {
    if (blockedActions.has(action)) {
      delete state.owners[id];
      state.blocked[id] = true;
    }
  }
  for (const action of TOUCH_ACTIONS) state.down[action] = false;
}

export function blockAllTouches(state) {
  if (!state) return;
  for (const id of Object.keys(state.owners || {})) state.blocked[id] = true;
  state.owners = {};
  state.down = emptyTouchActions();
}

export function mergeActionDown(keyboardDown, touchDown, gameplayAllowed = true) {
  const merged = {};
  for (const action of TOUCH_ACTIONS) {
    merged[action] = !!gameplayAllowed && (!!(keyboardDown && keyboardDown[action]) || !!(touchDown && touchDown[action]));
  }
  return merged;
}

export function deriveActionEdges(previous, current) {
  const pressed = {}, released = {};
  for (const action of TOUCH_ACTIONS) {
    pressed[action] = !!current[action] && !previous[action];
    released[action] = !current[action] && !!previous[action];
  }
  return {pressed,released};
}

export function touchLayoutSafe(layout = TOUCH_LAYOUT, width = 960, height = 640) {
  const values = Object.values(layout);
  const outside = values.some(rect => rect.x < 12 || rect.y < 12 || rect.x + rect.width > width - 12 || rect.y + rect.height > height - 12);
  const overlap = values.some((a, index) => values.slice(index + 1).some(b =>
    Math.max(a.x,b.x) < Math.min(a.x+a.width,b.x+b.width) &&
    Math.max(a.y,b.y) < Math.min(a.y+a.height,b.y+b.height)
  ));
  const tooSmall = values.some(rect => rect.width < 60 || rect.height < 60);
  return !outside && !overlap && !tooSmall;
}