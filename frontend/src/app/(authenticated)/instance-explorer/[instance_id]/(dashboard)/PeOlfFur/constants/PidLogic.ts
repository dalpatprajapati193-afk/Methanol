import { PidVars } from '../store/FmsAtoms';

type Val = 0 | 1 | null;

export const FIXED_KEYS = [
  'rcy_eth_to_nap','rcy_pro_to_nap','rcy_but_to_nap',
  'nap_to_gen_fr','nap_to_gen_tf',
  'eth_spill_eth','pro_spill_pro','but_spill_but',
  'eth_spill_nap','pro_spill_nap','but_spill_nap',
  'nap_spill_eth','nap_spill_pro','nap_spill_but','nap_spill_nap',
];

export const INFERRED_KEYS = ['eth_exists','pro_exists','but_exists','nap_exists','gen_fr_exists','gen_tf_exists'];

export const KEY_TO_SEG: Record<string,string> = {
  rcy_eth_to_eth:'sg-er2eth', rcy_eth_to_pro:'sg-er2pro', rcy_eth_to_but:'sg-er2but',
  rcy_pro_to_eth:'sg-pr2eth', rcy_pro_to_pro:'sg-pr2pro', rcy_pro_to_but:'sg-pr2but',
  rcy_but_to_eth:'sg-br2eth', rcy_but_to_pro:'sg-br2pro', rcy_but_to_but:'sg-br2but',
  eth_to_gen_fr:'sg-eth-gfr', pro_to_gen_fr:'sg-pro-gfr', but_to_gen_fr:'sg-but-gfr',
  eth_to_gen_tf:'sg-eth-gtf', pro_to_gen_tf:'sg-pro-gtf', but_to_gen_tf:'sg-but-gtf',
  eth_spill_pro:'sg-eth-spill-pro', eth_spill_but:'sg-eth-spill-but',
  pro_spill_eth:'sg-pro-spill-eth', pro_spill_but:'sg-pro-spill-but',
  but_spill_eth:'sg-but-spill-eth', but_spill_pro:'sg-but-spill-pro',
};

export const SECTION_KEYS = {
  s1:['ff_eth','ff_pro','ff_but','ff_nap','rcy_eth','rcy_pro','rcy_but','rcy_nap'],
  s2:['rcy_eth_to_eth','rcy_eth_to_pro','rcy_eth_to_but',
      'rcy_pro_to_eth','rcy_pro_to_pro','rcy_pro_to_but',
      'rcy_but_to_eth','rcy_but_to_pro','rcy_but_to_but'],
  s3:['eth_to_gen_fr','pro_to_gen_fr','but_to_gen_fr',
      'eth_to_gen_tf','pro_to_gen_tf','but_to_gen_tf'],
  s4:['eth_spill_pro','eth_spill_but','pro_spill_eth','pro_spill_but','but_spill_eth','but_spill_pro'],
};

export function reapplyFixedDefaults(v: PidVars): PidVars {
  const out = { ...v };
  out['rcy_eth_to_nap']=0; out['rcy_pro_to_nap']=0; out['rcy_but_to_nap']=0;
  out['nap_to_gen_fr']=0;  out['nap_to_gen_tf']=0;
  out['eth_spill_eth']=0;  out['pro_spill_pro']=0;  out['but_spill_but']=0;
  out['eth_spill_nap']=0;  out['pro_spill_nap']=0;  out['but_spill_nap']=0;
  out['nap_spill_eth']=0;  out['nap_spill_pro']=0;  out['nap_spill_but']=0;  out['nap_spill_nap']=0;
  return out;
}

export function inferPidVars(v: PidVars): PidVars {
  const out = { ...v };
  const allBaseFilled = ['ff_eth','ff_pro','ff_but','ff_nap','rcy_eth','rcy_pro','rcy_but','rcy_nap']
    .every(k => v[k] === 0 || v[k] === 1);

  if (!allBaseFilled) {
    ['eth','pro','but'].forEach(c => { out[c+'_exists'] = null; });
    out['nap_exists'] = null;
    out['gen_fr_exists'] = null; out['gen_tf_exists'] = null;
    return out;
  }

  ['eth','pro','but'].forEach(c => {
    const ff = v['ff_'+c], rcy = v['rcy_'+c], r2s = v[`rcy_${c}_to_${c}`];
    out[c+'_exists'] = ff===0 && (rcy===0 || (rcy===1 && r2s===0)) ? 0
                     : ff===1 || (rcy===1 && r2s===1) ? 1 : null;
  });
  out['nap_exists'] = v['ff_nap'];
  out['gen_fr_exists'] = v['eth_to_gen_fr']===0 && v['pro_to_gen_fr']===0 && v['but_to_gen_fr']===0 ? 0
                       : v['eth_to_gen_fr']===1 || v['pro_to_gen_fr']===1 || v['but_to_gen_fr']===1 ? 1 : null;
  out['gen_tf_exists'] = v['eth_to_gen_tf']===0 && v['pro_to_gen_tf']===0 && v['but_to_gen_tf']===0 ? 0
                       : v['eth_to_gen_tf']===1 || v['pro_to_gen_tf']===1 || v['but_to_gen_tf']===1 ? 1 : null;
  return out;
}

export function computeAutoLocks(v: PidVars): Map<string, { val: Val; mode: 'locked-no'|'locked-yes' }> {
  const locks = new Map<string, { val: Val; mode: 'locked-no'|'locked-yes' }>();
  const X = ['eth','pro','but'];
  const isActive = (c: string) => v['ff_'+c]===1 || v['rcy_'+c]===1;
  const lock0 = (k: string) => { if (!locks.has(k)) locks.set(k, {val:0, mode:'locked-no'}); };
  const lock1 = (k: string) => locks.set(k, {val:1, mode:'locked-yes'});

  X.forEach(c => {
    if (v['ff_'+c]===0 && v['rcy_'+c]===0) {
      X.forEach(t => lock0(`rcy_${c}_to_${t}`));
      X.filter(t=>t!==c).forEach(t => lock0(`rcy_${t}_to_${c}`));
      lock0(`${c}_to_gen_fr`); lock0(`${c}_to_gen_tf`);
      X.filter(t=>t!==c).forEach(t => { lock0(`${c}_spill_${t}`); lock0(`${t}_spill_${c}`); });
    }
  });

  const activeCount = X.filter(isActive).length;
  if (activeCount === 1) {
    X.forEach(c => { lock0(`${c}_to_gen_fr`); lock0(`${c}_to_gen_tf`); });
    X.forEach(c => { X.filter(t=>t!==c).forEach(t => lock0(`${c}_spill_${t}`)); });
  }

  X.forEach(c => {
    if (v['rcy_'+c]===1) { lock1(`rcy_${c}_to_${c}`); }
    // No recycle stream exists for c → it cannot be routed to ANY header
    else if (v['rcy_'+c]===0) { X.forEach(t => lock0(`rcy_${c}_to_${t}`)); }
  });

  if (activeCount !== 1) {
    X.forEach(c => {
      const selfRouted = v[`rcy_${c}_to_${c}`]===1;
      const crossRoutes = X.filter(t=>t!==c);
      const allCrossResolved = crossRoutes.every(t => {
        const lk = locks.get(`rcy_${c}_to_${t}`);
        return lk ? lk.val===0 : v[`rcy_${c}_to_${t}`]===0;
      });
      if (selfRouted && allCrossResolved) { if (!locks.has(`${c}_to_gen_tf`)) lock0(`${c}_to_gen_tf`); }
    });
  }
  return locks;
}

export function applyLocksToVars(v: PidVars, vUser: PidVars, prevLocked: Set<string>): { vars: PidVars; locked: Set<string> } {
  const locks = computeAutoLocks(v);
  const out = { ...v };

  // Restore unlocked keys from user store
  prevLocked.forEach(key => {
    if (!locks.has(key) && key in vUser) out[key] = vUser[key] as Val;
  });

  // Apply new locks
  locks.forEach(({ val }, key) => { out[key] = val; });

  return { vars: out, locked: new Set(locks.keys()) };
}

/**
 * V418 two-feed linkage: when exactly 2 X-feeds (eth/pro/but) are active, setting a
 * `{feed}_to_gen_fr|gen_tf` cell mirrors that value onto the peer feed's same gen cell —
 * unless the peer cell is currently auto-locked. The mirrored value is treated as a user
 * entry (written to both vars and vUser). Call AFTER applyLocksToVars, with its `locked` set.
 */
export function applyTwoFeedLinkage(
  vars: PidVars, vUser: PidVars, locked: Set<string>, changedKey: string, val: Val
): { vars: PidVars; vUser: PidVars } {
  if (val === null) return { vars, vUser };
  const X = ['eth', 'pro', 'but'];
  const isActive = (c: string) => vars['ff_' + c] === 1 || vars['rcy_' + c] === 1;
  const active = X.filter(isActive);
  if (active.length !== 2) return { vars, vUser };

  let row: string | null = null, srcFeed: string | null = null;
  for (const c of X) {
    if (changedKey === `${c}_to_gen_fr`) { row = 'gen_fr'; srcFeed = c; break; }
    if (changedKey === `${c}_to_gen_tf`) { row = 'gen_tf'; srcFeed = c; break; }
  }
  if (!row || !srcFeed) return { vars, vUser };

  const peer = active.find(c => c !== srcFeed);
  if (!peer) return { vars, vUser };
  const peerKey = `${peer}_to_${row}`;
  if (locked.has(peerKey)) return { vars, vUser };

  return { vars: { ...vars, [peerKey]: val }, vUser: { ...vUser, [peerKey]: val } };
}

export function computePidPct(v: PidVars): number {
  const userKeys = Object.keys(SECTION_KEYS).flatMap(s => (SECTION_KEYS as Record<string,string[]>)[s])
    .filter(k => !FIXED_KEYS.includes(k) && !INFERRED_KEYS.includes(k));
  const answered = userKeys.filter(k => v[k] === 0 || v[k] === 1).length;
  return Math.round((answered / userKeys.length) * 100);
}

export function computeActiveFeeds(v: PidVars): { key: string; label: string }[] {
  const feeds: { key: string; label: string }[] = [];
  const LABELS: Record<string, string> = { eth:'Ethane', pro:'Propane', but:'Butane', nap:'Naphtha', gen_fr:'Gen F+R', gen_tf:'Gen TF' };
  ['eth','pro','but','nap'].forEach(c => {
    if (v[c+'_exists'] === 1) feeds.push({ key: c, label: LABELS[c] });
  });
  if (v['gen_fr_exists']===1) feeds.push({ key:'gen_fr', label:'Gen F+R' });
  if (v['gen_tf_exists']===1) feeds.push({ key:'gen_tf', label:'Gen TF' });
  return feeds;
}

// SVG helpers for React-controlled rendering
export const CR: Record<string, string> = {1:'#34c472', 0:'#4b5563', null:'#f87171'};
export const FEED_COL: Record<string, string> = {
  eth:'#60a5fa', pro:'#a78bfa', but:'#fbbf24', nap:'#34c472', gfr:'#f472b6', gtf:'#22d3ee'
};

export function strokeCol(id: string, val: Val): string {
  if (val !== 1) return CR[String(val)];
  const f = feedFromId(id);
  return f ? FEED_COL[f] : CR['1'];
}

export function feedFromId(id: string): string | null {
  if (id.includes('-ercy')) return 'eth';
  if (id.includes('-prcy')) return 'pro';
  if (id.includes('-brcy')) return 'but';
  const legMatch = id.match(/^s-(gfr|gtf)-leg-(eth|pro|but)$/);
  if (legMatch) return legMatch[2];
  if (id.startsWith('s-gfr') || id.startsWith('gfr-')) return 'gfr';
  if (id.startsWith('s-gtf') || id.startsWith('gtf-')) return 'gtf';
  if (id.startsWith('hump-gtf')) return 'gfr';
  if (id.includes('nap')) return 'nap';
  return id.match(/-(eth|pro|but|nap)/)?.[1] || null;
}
