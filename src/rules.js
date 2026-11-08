// Pure rules shared by the GDevelop events and Node tests. No network or engine dependencies.
export const CONFIG = Object.freeze({
  width: 3200, height: 640, floorY: 560, speed: 240, gravity: 1800, jumpSpeed: 720,
  coyote: 0.10, jumpBuffer: 0.12, fireInterval: 0.30, bulletSpeed: 720,
  range: 600, upgradeCost: 10, invulnerability: 1.2, maxHealth: 3,
});
export function segmentRect(x0, y0, x1, y1, box, padding = 0) {
  let near = 0, far = 1;
  for (const [start, delta, low, high] of [
    [x0, x1-x0, box.x-padding, box.x+box.w+padding],
    [y0, y1-y0, box.y-padding, box.y+box.h+padding],
  ]) {
    if (Math.abs(delta) < 1e-9) { if (start < low || start > high) return null; continue; }
    let a = (low-start)/delta, b = (high-start)/delta;
    if (a > b) [a,b] = [b,a];
    near = Math.max(near,a); far = Math.min(far,b);
    if (near > far) return null;
  }
  return near;
}
export function chooseTarget(origin, facing, targets, walls, range = CONFIG.range, options = {}) {
  const verticalBias = Number.isFinite(options.verticalBias) ? Math.max(0, options.verticalBias) : 0.75;
  const switchMargin = Number.isFinite(options.switchMargin) ? Math.max(0, options.switchMargin) : 0.2;
  const stickyId = options.stickyId === undefined || options.stickyId === null ? '' : String(options.stickyId);
  const valid = targets
    .filter(t => t.health > 0 && (t.x-origin.x)*facing > 0)
    .filter(t => Math.hypot(t.x-origin.x,t.y-origin.y) <= range)
    .filter(t => !walls.some(w => segmentRect(origin.x,origin.y,t.x,t.y,w) !== null))
    .map(target => ({
      target,
      id: target.id === undefined ? '' : String(target.id),
      score: Math.hypot(target.x-origin.x,target.y-origin.y) +
        Math.abs(target.y-origin.y)*verticalBias,
    }))
    .sort((a,b) =>
      a.score-b.score ||
      a.id.localeCompare(b.id) ||
      a.target.x-b.target.x ||
      a.target.y-b.target.y
    );
  if (!valid.length) return null;

  const best = valid[0];
  const sticky = stickyId ? valid.find(candidate => candidate.id === stickyId) : null;
  if (!sticky || sticky.id === best.id) return best.target;

  // Keep the child's current target unless another candidate is clearly better.
  // At exactly 20% improvement the switch happens; tiny hover/distance changes do not.
  const switchThreshold = sticky.score * (1-switchMargin);
  return best.score <= switchThreshold+1e-9 ? best.target : sticky.target;
}
export function purchase(coins, owned) {
  if (owned) return {ok:false,reason:'owned',coins,owned};
  if (coins < CONFIG.upgradeCost) return {ok:false,reason:'funds',coins,owned};
  return {ok:true,reason:'purchased',coins:coins-CONFIG.upgradeCost,owned:true};
}
export function overlaps(a,b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
export function resolveJump({grounded,coyote,count,buffer,pending}) {
  if (!buffer || pending) return null;
  if (grounded || (count === 0 && coyote > 0)) return {count:1,air:false};
  if (count < 2) return {count:2,air:true};
  return null;
}
