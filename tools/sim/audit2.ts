import { SKILLS } from '../../src/data/skills';
import { FORMS } from '../../src/data/creatures';
import FX from '../../src/art/vfx_skills.json';
import MOXU_FX from '../../src/art/moxu_vfx.json';
import fs from 'fs';
const fx = { ...FX, ...MOXU_FX } as Record<string, unknown>;
const ids = Object.keys(SKILLS);
console.log('skills', ids.length, 'no VFX:', ids.filter((k) => !fx[k]).join(','));
const used = new Set<string>(); for (const f of Object.values(FORMS)) for (const [, s] of f.learn) used.add(s);
console.log('skills no one learns:', ids.filter((k) => !used.has(k) && !k.startsWith('gh_')).join(','));
console.log('learn refs missing:', [...used].filter((k) => !SKILLS[k]).join(','));
const forms = Object.values(FORMS);
console.log('forms', forms.length, 'placeholder:', forms.filter((f) => f.placeholder).map((f) => f.id).join(','));
console.log('recolor-shared art:', forms.filter((f) => f.sprite !== f.id).map((f) => `${f.id}->${f.sprite}`).join(','));
const spr = new Set(fs.readdirSync('src/art/sprites').map((x) => x.replace('.png', '')));
const shy = new Set(fs.readdirSync('src/art/shiny').map((x) => x.replace('.png', '')));
console.log('missing sprite:', forms.filter((f) => !spr.has(f.sprite)).map((f) => f.id).join(','), '| missing shiny:', forms.filter((f) => !shy.has(f.sprite) && !f.secret).map((f) => f.id).join(','));
// 每個形態在滿級時技能數夠不夠
const thin = forms.filter((f) => !f.secret && new Set(f.learn.map((x) => x[1])).size < 3).map((f) => `${f.id}(${f.learn.length})`);
console.log('forms with <3 learnable skills (own list):', thin.join(','));
const byElem: Record<string, number> = {}; for (const s of Object.values(SKILLS)) { const e = s.elem ?? 'none'; byElem[e] = (byElem[e] ?? 0) + 1; }
console.log('skills per elem:', JSON.stringify(byElem));
