// Generates the local, dependency-free touch-control artwork used by game.json.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'assets','touch');
fs.mkdirSync(out,{recursive:true});
const defs=`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#234b61"/><stop offset="1" stop-color="#102838"/></linearGradient><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#74fff0"/><stop offset="1" stop-color="#31b9d3"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#00121d" flood-opacity=".5"/></filter></defs>`;
function button(label,glyph,{accent='url(#a)',w=128,h=128,labelY=108}={}){
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}<g filter="url(#s)"><rect x="4" y="4" width="${w-8}" height="${h-8}" rx="28" fill="url(#g)" stroke="#9df9ef" stroke-width="3" stroke-opacity=".72"/><path d="M20 20h${w-40}" stroke="${accent}" stroke-width="5" stroke-linecap="round" opacity=".9"/></g>${glyph}<text x="${w/2}" y="${labelY}" text-anchor="middle" font-family="Microsoft YaHei,Noto Sans SC,sans-serif" font-size="${label.length>3?21:25}" font-weight="800" fill="#f1ffff">${label}</text></svg>`;
}
const assets={
 'touch-left.svg':button('左',`<path d="M73 39 43 64l30 25" fill="none" stroke="#f3ffff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`),
 'touch-right.svg':button('右',`<path d="m55 39 30 25-30 25" fill="none" stroke="#f3ffff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`),
 'touch-jump.svg':button('跳跃',`<path d="M64 69V29m0 0L45 49m19-20 19 20" fill="none" stroke="#f3ffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 76c7 17 53 17 60 0" fill="none" stroke="#72f2db" stroke-width="7" stroke-linecap="round"/>`),
 'touch-attack.svg':button('攻击',`<path d="m64 24 11 26 28 3-21 19 6 29-24-15-24 15 6-29-21-19 28-3Z" fill="#ffe36a" stroke="#fff7bd" stroke-width="3" stroke-linejoin="round"/><circle cx="64" cy="62" r="10" fill="#ff835f"/>`,{w:136,h:136,labelY:122}),
 'touch-weapon.svg':button('武器',`<path d="M31 54h58l12 9-12 9H31Z" fill="#bff9ef"/><path d="M39 48V34h25v14M91 55l14-9v24l-14-6" fill="none" stroke="#74fff0" stroke-width="7" stroke-linejoin="round"/><circle cx="45" cy="78" r="11" fill="#5bd8d2" stroke="#eaffff" stroke-width="4"/>`),
 'touch-interact.svg':button('交互',`<rect x="35" y="31" width="58" height="65" rx="16" fill="none" stroke="#f4ffff" stroke-width="8"/><path d="M53 50h22M53 66h22M53 82h13" stroke="#72f2db" stroke-width="7" stroke-linecap="round"/>`),
 'touch-confirm.svg':button('确认',`<path d="m31 64 20 20 46-47" fill="none" stroke="#ffe36a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`),
 'touch-back.svg':button('返回',`<path d="M94 64H37m22-24L35 64l24 24" fill="none" stroke="#ffe36a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`),
 'touch-restart.svg':`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96" viewBox="0 0 128 96">${defs}<rect x="4" y="4" width="120" height="88" rx="21" fill="url(#g)" stroke="#9df9ef" stroke-width="3" stroke-opacity=".72"/><path d="M88 34a31 31 0 1 0 4 33" fill="none" stroke="#ffe36a" stroke-width="10" stroke-linecap="round"/><path d="m77 24 18 10-19 9" fill="#ffe36a"/><text x="64" y="78" text-anchor="middle" font-family="Microsoft YaHei,Noto Sans SC,sans-serif" font-size="20" font-weight="800" fill="#f1ffff">重开</text></svg>`
};
for(const [name,content] of Object.entries(assets))fs.writeFileSync(path.join(out,name),content,'utf8');
const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="#071621" fill-opacity=".96"/><rect x="178" y="186" width="604" height="268" rx="34" fill="#153448" stroke="#48dcca" stroke-width="3"/><g transform="rotate(-8 480 286)"><rect x="420" y="230" width="120" height="190" rx="20" fill="none" stroke="#ffe36a" stroke-width="9"/><path d="M466 266h28" stroke="#ffe36a" stroke-width="7" stroke-linecap="round"/></g><path d="M346 322c42-42 74-42 116 0" fill="none" stroke="#54e7d5" stroke-width="10" stroke-linecap="round"/><path d="m346 322 24-4-7-23" fill="#54e7d5"/><text x="480" y="390" text-anchor="middle" font-family="Microsoft YaHei,Noto Sans SC,sans-serif" font-size="34" font-weight="800" fill="#f4ffff">请把设备横过来</text><text x="480" y="430" text-anchor="middle" font-family="Microsoft YaHei,Noto Sans SC,sans-serif" font-size="20" fill="#b9d7e1">横屏后继续救援训练</text></svg>`;
fs.writeFileSync(path.join(out,'touch-rotate-overlay.svg'),overlay,'utf8');
console.log(`Generated ${Object.keys(assets).length+1} touch assets in ${out}`);