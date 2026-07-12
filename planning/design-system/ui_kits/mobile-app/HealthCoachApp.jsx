// Health Coach — mobile app, v2 (Home / Training / Map / Nutrition / Social)
// Bespoke screen-level compositions ported from the design brief. These are
// intentionally NOT wired to the component library (Button/Card/etc.) — the
// brief specifies exact bespoke layouts per screen, same as the RN source's
// bespoke screens noted in the readme. Self-contained fonts + palette below.
const { useState } = React;

const FONTS = "'DM Sans',system-ui,sans-serif";

function pal(dark) {
  const el = dark
    ? { earth: '#8A7049', sky: '#5E84A6', water: '#4C8E85', body: '#C15A39', glacial: '#6E8E90' }
    : { earth: '#7A6440', sky: '#4E7594', water: '#3A7A71', body: '#AE5330', glacial: '#5E8082' };
  const g = dark
    ? { bg:'#0E1214', bgElev:'#141A1D', card:'#1A2329', cardHi:'#212C33', line:'#2A363C',
        dim:'#5C6E72', muted:'#8CA0A2', sec:'#C4CDCE', text:'#E7ECEA', statusText:'#E7ECEA',
        tabBg:'#0B0F11', island:'#000', bezelRing:'#1c2226', homeInd:'rgba(231,236,234,.75)' }
    : { bg:'#DFE4E1', bgElev:'#E9EDEA', card:'#FFFFFF', cardHi:'#F3F6F3', line:'#CFD6D2',
        dim:'#94A5A6', muted:'#5C6B6E', sec:'#3C4A4D', text:'#0E1214', statusText:'#0E1214',
        tabBg:'#EAEEEB', island:'#111', bezelRing:'#c7cdc9', homeInd:'rgba(14,18,20,.28)' };
  return { ...g, ...el };
}

const TABS = ['Home', 'Training', 'Map', 'Nutrition', 'Social'];

function StatusBar({ color }) {
  return (
    <div style={{ position:'absolute', top:0, left:0, right:0, height:54, zIndex:40, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 30px 0', color }}>
      <div style={{ fontFamily:'Archivo', fontWeight:600, fontSize:15, letterSpacing:.2 }}>9:41</div>
      <div style={{ display:'flex', alignItems:'center', gap:6, color }}>
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx=".7"></rect><rect x="5" y="4.5" width="3" height="6.5" rx=".7"></rect><rect x="10" y="2" width="3" height="9" rx=".7"></rect><rect x="15" y="0" width="3" height="11" rx=".7"></rect></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="19" height="10" rx="2.6" fill="none" stroke="currentColor" strokeOpacity=".4"></rect><rect x="2" y="2" width="15.5" height="7" rx="1.5" fill="currentColor"></rect><rect x="21" y="3.5" width="1.6" height="4" rx=".8" fill="currentColor" fillOpacity=".5"></rect></svg>
      </div>
    </div>
  );
}

function Avatar({ c }) {
  return (
    <div style={{ width:30, height:30, borderRadius:'50%', background:c.cardHi, border:`1px solid ${c.line}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Archivo', fontWeight:700, fontSize:11, color:c.sec, flexShrink:0 }}>DM</div>
  );
}

function OpenBadge({ c, children }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', fontFamily:'Archivo', fontWeight:700, fontSize:9, letterSpacing:1, color:c.dim, border:`1px dashed ${c.dim}`, borderRadius:20, padding:'3px 8px', whiteSpace:'nowrap' }}>{children}</span>
  );
}

function TabBar({ c, active, onSelect }) {
  const icon = (key, color) => {
    switch (key) {
      case 'Home': return <span style={{ width:13, height:13, borderRadius:'50%', border:`2px solid ${color}` }}></span>;
      case 'Training': return <span style={{ width:12, height:12, transform:'rotate(45deg)', border:`2px solid ${color}` }}></span>;
      case 'Map': return (
        <svg width="16" height="13" viewBox="0 0 16 13"><circle cx="2" cy="9" r="1.6" fill={color}></circle><circle cx="7" cy="6" r="1.6" fill={color}></circle><circle cx="12" cy="8" r="1.6" fill={color}></circle><path d="M1 11 L7 4 L15 2" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round"></path></svg>
      );
      case 'Nutrition': return <span style={{ width:0, height:0, borderLeft:'7px solid transparent', borderRight:'7px solid transparent', borderBottom:`12px solid ${color}` }}></span>;
      case 'Social': return (
        <svg width="18" height="13" viewBox="0 0 18 13"><circle cx="6" cy="6" r="4" fill="none" stroke={color} strokeWidth="2"></circle><circle cx="12" cy="6" r="4" fill="none" stroke={color} strokeWidth="2"></circle></svg>
      );
      default: return null;
    }
  };
  return (
    <div style={{ position:'absolute', left:0, right:0, bottom:0, height:83, zIndex:31, background:c.tabBg, borderTop:`1px solid ${c.line}`, display:'flex', padding:'10px 6px 0' }}>
      {TABS.map(key => {
        const on = key === active;
        const color = on ? c.text : c.dim;
        return (
          <div key={key} onClick={() => onSelect(key)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, cursor:'pointer' }}>
            {icon(key, color)}
            <span style={{ fontSize:9.5, fontFamily:'Archivo', fontWeight:600, letterSpacing:.4, color }}>{key}</span>
          </div>
        );
      })}
    </div>
  );
}

function Frame({ c, children }) {
  return (
    <div style={{ width:390, height:844, position:'relative', borderRadius:36, overflow:'hidden', background:c.bg, fontFamily:FONTS, boxShadow:`0 0 0 2px ${c.island}, 0 0 0 8px ${c.bezelRing}, 0 40px 90px rgba(0,0,0,.45)`, WebkitFontSmoothing:'antialiased' }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:'url(../../assets/basalt-texture.jpg)', backgroundPosition:'center', backgroundSize:'cover', filter:'grayscale(1) contrast(1.2) brightness(.9)', opacity:.25, mixBlendMode:'overlay', pointerEvents:'none', zIndex:0 }}></div>
      <div style={{ position:'absolute', top:11, left:'50%', transform:'translateX(-50%)', width:118, height:34, borderRadius:20, background:'#000', zIndex:50 }}></div>
      {children}
      <div style={{ position:'absolute', left:0, right:0, bottom:7, zIndex:60, display:'flex', justifyContent:'center', pointerEvents:'none' }}>
        <div style={{ width:130, height:5, borderRadius:100, background:c.homeInd }}></div>
      </div>
    </div>
  );
}

function SectionLabel({ c, children, style }) {
  return <div style={{ fontFamily:'Archivo', fontWeight:700, fontSize:11, letterSpacing:2, color:c.muted, marginBottom:10, ...style }}>{children}</div>;
}

/* ---------------- Home ---------------- */
function HomeScreen({ c }) {
  const spots = [
    { name:'White Salmon', color:c.water, val:'2,140 cfs', sub:'flowing · runnable' },
    { name:'Dog Mountain', color:c.sky, val:'12 mph NW', sub:'launchable' },
    { name:'Beacon Rock', color:c.earth, val:'68°F', sub:'dry, good grip' },
  ];
  const pins = [
    { name:'Class IV solo, unassisted', sub:'2 of 3 outings logged', val:'2/3', color:c.water },
    { name:'Flight currency', sub:'trending steady this month', val:'8/10', color:c.sky },
  ];
  return (
    <div style={{ position:'absolute', top:54, left:0, right:0, bottom:0, overflowY:'auto', overflowX:'hidden', padding:'6px 22px 220px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div style={{ fontFamily:'Archivo', fontWeight:700, fontSize:12, letterSpacing:2, color:c.muted }}>THU · JUL 9</div>
        <Avatar c={c} />
      </div>

      <SectionLabel c={c}>NUTRITION · TODAY</SectionLabel>
      <div style={{ borderRadius:5, background:c.card, padding:16, marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:28, color:c.text, letterSpacing:-1 }}>2,140</span>
            <span style={{ fontSize:12, color:c.muted }}>/ 2,400 kcal</span>
          </div>
          <span style={{ fontSize:11.5, color:c.dim }}>260 left</span>
        </div>
        <div style={{ display:'flex', height:7, borderRadius:1, overflow:'hidden', gap:2 }}>
          <div style={{ flex:172, background:c.body, opacity:.9 }}></div>
          <div style={{ flex:198, background:c.glacial, opacity:.7 }}></div>
          <div style={{ flex:71, background:c.earth, opacity:.7 }}></div>
        </div>
      </div>

      <SectionLabel c={c}>PINNED SPOTS</SectionLabel>
      <div style={{ display:'flex', gap:10, overflowX:'auto', margin:'0 -22px 22px', padding:'0 22px 4px' }}>
        {spots.map(s => (
          <div key={s.name} style={{ flex:'0 0 auto', width:148, borderRadius:5, background:c.card, padding:'13px 14px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}>
              <span style={{ width:7, height:7, borderRadius:2, background:s.color, flexShrink:0 }}></span>
              <span style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:13, color:c.text, letterSpacing:-.1 }}>{s.name}</span>
            </div>
            <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:15, color:c.text, letterSpacing:-.3 }}>{s.val}</div>
            <div style={{ fontSize:10.5, color:c.dim, marginTop:1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <SectionLabel c={c}>DUE TODAY</SectionLabel>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:5, background:c.card, padding:'14px 16px', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          <span style={{ width:8, height:8, borderRadius:2, background:c.body, flexShrink:0 }}></span>
          <div>
            <div style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:14.5, color:c.text, letterSpacing:-.2 }}>Push + Squat</div>
            <div style={{ fontSize:11, color:c.dim, marginTop:2 }}>repeats Mon · Wed · Fri</div>
          </div>
        </div>
        <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:11, letterSpacing:.5, color:c.sec }}>START ›</span>
      </div>

      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10 }}>
        <SectionLabel c={c} style={{ marginBottom:0 }}>BENCHMARKS</SectionLabel>
        <OpenBadge c={c}>OPEN · MODULE ORDER</OpenBadge>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:22 }}>
        {pins.map(p => (
          <div key={p.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:5, background:c.card, padding:'13px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:11 }}>
              <span style={{ width:8, height:8, borderRadius:2, background:p.color, flexShrink:0 }}></span>
              <div>
                <div style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:14, color:c.text, letterSpacing:-.2 }}>{p.name}</div>
                <div style={{ fontSize:11, color:c.dim, marginTop:2 }}>{p.sub}</div>
              </div>
            </div>
            <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:15, color:p.color, letterSpacing:-.3 }}>{p.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <div style={{ flex:1, borderRadius:5, background:c.card, padding:'12px 14px' }}>
          <div style={{ fontFamily:'Archivo', fontWeight:700, fontSize:9.5, letterSpacing:1.3, color:c.muted, marginBottom:4 }}>STEPS</div>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:16, color:c.sec, letterSpacing:-.3 }}>8,240</div>
        </div>
        <div style={{ flex:1, borderRadius:5, background:c.card, padding:'12px 14px' }}>
          <div style={{ fontFamily:'Archivo', fontWeight:700, fontSize:9.5, letterSpacing:1.3, color:c.muted, marginBottom:4 }}>SLEEP</div>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:16, color:c.sec, letterSpacing:-.3 }}>7h 12m</div>
        </div>
      </div>
    </div>
  );
}

function LogBar({ c, dual }) {
  return (
    <div style={{ position:'absolute', left:0, right:0, bottom:83, zIndex:30, padding:'10px 16px 12px', background:`linear-gradient(to top, ${c.bg} 62%, rgba(0,0,0,0))` }}>
      <div style={{ display:'flex', gap:8 }}>
        {dual && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, borderRadius:5, background:c.cardHi, boxShadow:`inset 0 0 0 1px ${c.line}`, padding:'13px 0' }}>
            <span style={{ width:10, height:10, transform:'rotate(45deg)', background:c.sec }}></span>
            <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:12.5, letterSpacing:.3, color:c.sec }}>Log Session</span>
          </div>
        )}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, borderRadius:5, background:c.cardHi, boxShadow:`inset 0 0 0 1px ${c.line}`, padding:'13px 0' }}>
          <span style={{ width:0, height:0, borderLeft:'5.5px solid transparent', borderRight:'5.5px solid transparent', borderBottom:`9.5px solid ${c.sec}` }}></span>
          <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:12.5, letterSpacing:.3, color:c.sec }}>Log Food</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Training ---------------- */
function TrainingScreen({ c }) {
  const [nav, setNav] = useState('Templates');
  const templates = [
    { name:'Push A', sub:'12 exercises · last Tue', color:c.body, repeat:'MON · WED · FRI' },
    { name:'Pull A', sub:'10 exercises · last Sun', color:c.body, repeat:'' },
    { name:'Flatwater · 8 km', sub:'steady state · last Jun 28', color:c.water, repeat:'SAT' },
    { name:'Trail intervals', sub:'6 reps · last Thu', color:c.earth, repeat:'' },
  ];
  return (
    <div style={{ position:'absolute', top:54, left:0, right:0, bottom:0, overflow:'hidden', padding:'6px 22px 100px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22 }}>
        <div>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:28, letterSpacing:-1.3, color:c.text }}>Training</div>
          <div style={{ fontSize:12.5, color:c.dim, marginTop:3 }}>Your saved shapes, planned or not.</div>
        </div>
        <Avatar c={c} />
      </div>

      <div style={{ display:'flex', gap:6, background:c.cardHi, borderRadius:6, padding:4, marginBottom:20 }}>
        {['Templates', 'Routes'].map(k => (
          <div key={k} onClick={() => setNav(k)} style={{ flex:1, textAlign:'center', padding:'8px 0', borderRadius:4, cursor:'pointer', background: nav===k ? c.card : 'transparent', boxShadow: nav===k ? '0 1px 3px rgba(14,18,20,.08)' : 'none' }}>
            <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:11.5, letterSpacing:1, color: nav===k ? c.text : c.dim, textTransform:'uppercase' }}>{k}</span>
          </div>
        ))}
      </div>

      {nav === 'Templates' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:24 }}>
          {templates.map(tpl => (
            <div key={tpl.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:5, background:c.card, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                <span style={{ width:8, height:8, borderRadius:2, background:tpl.color, flexShrink:0 }}></span>
                <div>
                  <div style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:14.5, color:c.text, letterSpacing:-.2 }}>{tpl.name}</div>
                  <div style={{ fontSize:11, color:c.dim, marginTop:2 }}>{tpl.sub}</div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {tpl.repeat && <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:9, letterSpacing:.8, color:c.sec, background:c.cardHi, borderRadius:20, padding:'4px 8px' }}>{tpl.repeat}</span>}
                <span style={{ fontSize:14, color:c.dim }}>›</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ borderRadius:5, background:c.card, padding:'40px 16px', textAlign:'center' }}>
          <OpenBadge c={c}>OPEN · ROUTES LIST LAYOUT</OpenBadge>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10 }}>
        <SectionLabel c={c} style={{ marginBottom:0 }}>ROUTES</SectionLabel>
        <OpenBadge c={c}>OPEN · LOGBOOK LOCATION</OpenBadge>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:5, background:c.card, padding:'14px 16px' }}>
        <div>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:14.5, color:c.text, letterSpacing:-.2 }}>Routes</div>
          <div style={{ fontSize:11, color:c.dim, marginTop:2 }}>12 saved · built &amp; followed on Map</div>
        </div>
        <span style={{ fontSize:14, color:c.dim }}>›</span>
      </div>
      <div style={{ fontSize:11, color:c.dim, marginTop:8 }}>Browse-only here — building, viewing &amp; following a route all live on Map.</div>
    </div>
  );
}

/* ---------------- Map ---------------- */
function blob(cx, cy, r, seed, amp) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const N = 36, p = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const rr = r * (1 + amp * (0.17 * Math.sin(t * 3 + seed) + 0.09 * Math.sin(t * 5 + seed * 1.7) + 0.05 * (rnd() - 0.5)));
    const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr * 0.84;
    p.push((i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1));
  }
  return p.join(' ') + 'Z';
}
function TerrainMap() {
  const T = { g0:'#D8E1BC', landHigh:'#E3EACB', forest:'#84A564', forest2:'#699150',
    contour:'#89A167', shadow:'#33472A', light:'#F5FAE2', river:'#3B7BAE', lake:'#7CB0D0',
    casing:'#F5FAE2', trackCore:'#7A6440', text:'#2E3A28' };
  const peak = { cx:250, cy:160, radii:[92,74,56,38,22], seed:5 };
  const peak2 = { cx:90, cy:230, radii:[54,40,26], seed:13 };
  const forests = [
    { cx:50, cy:120, r:56, s:2, c:T.forest }, { cx:150, cy:90, r:44, s:6, c:T.forest2 },
    { cx:340, cy:100, r:60, s:10, c:T.forest }, { cx:60, cy:340, r:56, s:14, c:T.forest2 },
    { cx:180, cy:400, r:50, s:18, c:T.forest }, { cx:320, cy:340, r:52, s:22, c:T.forest2 },
    { cx:300, cy:460, r:44, s:26, c:T.forest }, { cx:110, cy:470, r:40, s:30, c:T.forest2 },
  ];
  const riverD = 'M -10 560 C 120 548, 220 590, 340 566 C 380 558, 400 552, 410 548';
  const trackD = 'M 210 640 C 198 610, 224 596, 208 570 C 196 552, 222 538, 206 512 C 194 494, 220 480, 206 456 C 196 440, 216 424, 202 400 C 194 388, 210 372, 236 258 C 244 220, 250 190, 250 162';
  return (
    <svg viewBox="0 0 400 760" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display:'block' }}>
      <defs>
        <radialGradient id="hl"><stop offset="0%" stopColor={T.light} stopOpacity="0.9"></stop><stop offset="100%" stopColor={T.light} stopOpacity="0"></stop></radialGradient>
        <radialGradient id="sh"><stop offset="0%" stopColor={T.shadow} stopOpacity="0.6"></stop><stop offset="100%" stopColor={T.shadow} stopOpacity="0"></stop></radialGradient>
      </defs>
      <rect x="0" y="0" width="400" height="760" fill={T.g0}></rect>
      <ellipse cx={peak.cx-14} cy={peak.cy-14} rx="120" ry="104" fill="url(#hl)"></ellipse>
      <ellipse cx={peak.cx+18} cy={peak.cy+22} rx="104" ry="92" fill="url(#sh)"></ellipse>
      {peak.radii.map(r => <path key={'ph'+r} d={blob(peak.cx,peak.cy,r,peak.seed+r,0.22)} fill={T.landHigh} opacity={0.5*(r/peak.radii[0])+0.14}></path>)}
      {peak.radii.map(r => <path key={'pl'+r} d={blob(peak.cx,peak.cy,r,peak.seed+r,0.22)} fill="none" stroke={T.contour} strokeWidth="0.8" opacity="0.6"></path>)}
      {peak2.radii.map(r => <path key={'p2h'+r} d={blob(peak2.cx,peak2.cy,r,peak2.seed+r,0.24)} fill={T.landHigh} opacity="0.4"></path>)}
      {peak2.radii.map(r => <path key={'p2l'+r} d={blob(peak2.cx,peak2.cy,r,peak2.seed+r,0.24)} fill="none" stroke={T.contour} strokeWidth="0.7" opacity="0.5"></path>)}
      {forests.map(f => <path key={'f'+f.s} d={blob(f.cx,f.cy,f.r,f.s,0.32)} fill={f.c} opacity="0.5"></path>)}
      <path d={riverD} fill="none" stroke={T.lake} strokeWidth="46" strokeLinecap="round"></path>
      <path d={riverD} fill="none" stroke={T.river} strokeWidth="46" strokeLinecap="round" opacity="0.16"></path>
      <path d={trackD} fill="none" stroke={T.casing} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"></path>
      <path d={trackD} fill="none" stroke={T.trackCore} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"></path>
      <circle cx="210" cy="640" r="5.5" fill="#FFFFFF" stroke={T.trackCore} strokeWidth="2.4"></circle>
      <circle cx="250" cy="162" r="6.5" fill="none" stroke={T.trackCore} strokeWidth="2.4"></circle>
      <circle cx="250" cy="162" r="2.2" fill={T.trackCore}></circle>
      <text x="250" y="138" textAnchor="middle" fontFamily="Archivo" fontWeight="700" fontSize="12" letterSpacing=".9px" fill={T.text} stroke="#F5FAE2" strokeWidth="2.6" style={{ paintOrder:'stroke', textTransform:'uppercase' }}>Dog Mountain</text>
      <text x="240" y="596" textAnchor="middle" fontFamily="Archivo" fontWeight="700" fontSize="12" letterSpacing=".9px" fill={T.river} stroke="#F5FAE2" strokeWidth="2.6" style={{ paintOrder:'stroke', textTransform:'uppercase' }}>Columbia River</text>
      <g transform="translate(368,556)">
        <path d="M 0 14 L 0 -6" stroke={T.text} strokeWidth="1.6"></path>
        <path d="M 0 -8 L 4 -1 L -4 -1 Z" fill={T.text}></path>
        <text x="0" y="28" textAnchor="middle" fontFamily="Archivo" fontWeight="700" fontSize="10" fill={T.text}>N</text>
      </g>
    </svg>
  );
}
function MapScreen({ c }) {
  const [mode, setMode] = useState('Record');
  const chips = [{ name:'EARTH', color:c.earth }, { name:'SKY', color:c.sky }, { name:'WATER', color:c.water }];
  return (
    <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'#D8E1BC' }}>
      <div style={{ position:'absolute', inset:0, zIndex:0 }}><TerrainMap /></div>
      <div style={{ position:'absolute', top:64, left:16, right:16, zIndex:41, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ flex:1, display:'flex', gap:3, background:'rgba(255,255,255,.88)', backdropFilter:'blur(6px)', borderRadius:8, padding:4, boxShadow:'0 8px 20px -10px rgba(14,18,20,.35)' }}>
          {['Record', 'Explore'].map(k => (
            <div key={k} onClick={() => setMode(k)} style={{ flex:1, textAlign:'center', padding:'8px 0', borderRadius:6, cursor:'pointer', background: mode===k ? '#0E1214' : 'transparent' }}>
              <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:11, letterSpacing:1, color: mode===k ? '#F5FAE2' : '#3C4A4D', textTransform:'uppercase' }}>{k}</span>
            </div>
          ))}
        </div>
        <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,.9)', border:'1px solid rgba(14,18,20,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Archivo', fontWeight:700, fontSize:11, color:'#3C4A4D', flexShrink:0, boxShadow:'0 6px 16px -8px rgba(14,18,20,.35)' }}>DM</div>
      </div>

      {mode === 'Explore' ? (
        <div style={{ position:'absolute', top:112, left:16, zIndex:41 }}>
          <OpenBadge c={{ dim:'#5C6B6E' }}>OPEN · EXPLORE LAYOUT</OpenBadge>
        </div>
      ) : (
        <div style={{ position:'absolute', top:112, left:16, zIndex:41, display:'flex', gap:7 }}>
          {chips.map(ch => (
            <div key={ch.name} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.9)', borderRadius:20, padding:'6px 11px', boxShadow:'0 6px 14px -8px rgba(14,18,20,.3)' }}>
              <span style={{ width:7, height:7, borderRadius:2, background:ch.color }}></span>
              <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:9.5, letterSpacing:.8, color:'#3C4A4D' }}>{ch.name}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ position:'absolute', right:18, bottom:180, zIndex:42, width:58, height:58, borderRadius:'50%', background:'#AE5330', boxShadow:'0 14px 28px -12px rgba(14,18,20,.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ width:20, height:20, borderRadius:'50%', background:'#F5FAE2' }}></span>
      </div>

      <div style={{ position:'absolute', left:16, right:16, bottom:99, zIndex:41, background:'rgba(255,255,255,.94)', backdropFilter:'blur(8px)', borderRadius:10, padding:'14px 16px', boxShadow:'0 -8px 24px -8px rgba(14,18,20,.3)' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:2 }}>
          <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:9.5, letterSpacing:1.3, color:'#8A9799' }}>LAST ROUTE</span>
          <OpenBadge c={{ dim:'#8A9799' }}>OPEN · SESSION DETAIL LAYOUT</OpenBadge>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:15, color:'#0E1214', letterSpacing:-.2 }}>White Salmon · Dog Mtn Trail</div>
            <div style={{ fontSize:11, color:'#5C6B6E', marginTop:2 }}>Earth · yesterday, 9:12 AM</div>
          </div>
          <div style={{ display:'flex', gap:14 }}>
            <div style={{ textAlign:'right' }}><div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:15, color:'#0E1214', letterSpacing:-.3 }}>8.4</div><div style={{ fontSize:9, color:'#8A9799', letterSpacing:.5 }}>KM</div></div>
            <div style={{ textAlign:'right' }}><div style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:15, color:'#0E1214', letterSpacing:-.3 }}>840</div><div style={{ fontSize:9, color:'#8A9799', letterSpacing:.5 }}>M ↑</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Nutrition ---------------- */
function NutritionScreen({ c }) {
  const [nav, setNav] = useState('Intake');
  const days = ['M','T','W','T','F','S','S'];
  const logged = [true,true,false,true,true,true,false];
  const week = days.map((d,i) => ({ d, dot: logged[i] ? c.water : 'transparent', active: i===3 ? c.card : 'transparent', textColor: i===3 ? c.text : c.dim }));
  const fid = {
    high: { op:1, border:`1px solid ${c.line}`, dotBg:c.sec, dotBorder:'none' },
    mid: { op:.82, border:`1px solid ${c.line}`, dotBg:c.muted, dotBorder:'none' },
    low: { op:.62, border:`1px dashed ${c.dim}`, dotBg:'transparent', dotBorder:`1.3px dashed ${c.dim}` },
  };
  const mk = (name,time,kcal,items,p,cb,f,level) => ({ name,time,kcal,items,p,cb,f,...fid[level] });
  const meals = [
    mk('Breakfast','6:55 AM','620','Oats, 3 eggs, blueberries, coffee',38,58,22,'high'),
    mk('Lunch','12:40 PM','540','Chicken rice bowl · cafeteria',42,54,16,'mid'),
    mk('Snack','3:20 PM','200','Trail bar + apple (guessed)',8,34,7,'low'),
    mk('Dinner','7:30 PM','780','Salmon, potatoes, greens, olive oil',84,52,26,'high'),
  ];
  return (
    <div style={{ position:'absolute', top:54, left:0, right:0, bottom:0, overflowY:'auto', overflowX:'hidden', padding:'6px 22px 150px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:28, letterSpacing:-1.3, color:c.text }}>Nutrition</div>
        <Avatar c={c} />
      </div>

      <div style={{ display:'flex', gap:6, background:c.cardHi, borderRadius:6, padding:4, marginBottom:18 }}>
        {['Intake', 'Trend'].map(k => (
          <div key={k} onClick={() => setNav(k)} style={{ flex:1, textAlign:'center', padding:'8px 0', borderRadius:4, cursor:'pointer', background: nav===k ? c.card : 'transparent', boxShadow: nav===k ? '0 1px 3px rgba(14,18,20,.08)' : 'none' }}>
            <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:11.5, letterSpacing:1, color: nav===k ? c.text : c.dim, textTransform:'uppercase' }}>{k}</span>
          </div>
        ))}
      </div>

      {nav === 'Trend' ? (
        <div style={{ borderRadius:5, background:c.card, padding:'40px 16px', textAlign:'center', marginBottom:14 }}>
          <OpenBadge c={c}>OPEN · TREND CHART LAYOUT</OpenBadge>
        </div>
      ) : (
        <React.Fragment>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:15, color:c.dim }}>‹</span>
            <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:12, letterSpacing:1.5, color:c.muted }}>THU · JUL 9</span>
            <span style={{ fontSize:15, color:c.dim }}>›</span>
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:18 }}>
            {week.map((w,i) => (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'8px 0', borderRadius:20, background:w.active }}>
                <span style={{ fontFamily:'Archivo', fontWeight:600, fontSize:9.5, letterSpacing:.5, color:w.textColor }}>{w.d}</span>
                <span style={{ width:4, height:4, borderRadius:'50%', background:w.dot }}></span>
              </div>
            ))}
          </div>

          <div style={{ borderRadius:5, background:c.card, padding:18, marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:34, lineHeight:.9, letterSpacing:-1.5, color:c.text }}>2,140</span>
                  <span style={{ fontSize:13, color:c.muted }}>/ 2,400 kcal</span>
                </div>
                <div style={{ fontSize:12, color:c.dim, marginTop:6 }}>260 remaining today</div>
              </div>
              <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:9.5, letterSpacing:.8, color:c.water, background:'rgba(58,122,113,.12)', borderRadius:20, padding:'5px 10px', whiteSpace:'nowrap' }}>ON TRACK</span>
            </div>
            <div style={{ display:'flex', height:9, borderRadius:1, overflow:'hidden', gap:2, marginBottom:12 }}>
              <div style={{ flex:172, background:c.body }}></div>
              <div style={{ flex:198, background:c.glacial }}></div>
              <div style={{ flex:71, background:c.earth }}></div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <div><span style={{ width:8, height:8, borderRadius:2, background:c.body, display:'inline-block', marginRight:6 }}></span><span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:14, color:c.text }}>172</span><span style={{ fontSize:11, color:c.muted }}> g protein</span></div>
              <div><span style={{ width:8, height:8, borderRadius:2, background:c.glacial, display:'inline-block', marginRight:6 }}></span><span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:14, color:c.text }}>198</span><span style={{ fontSize:11, color:c.muted }}> g carb</span></div>
              <div><span style={{ width:8, height:8, borderRadius:2, background:c.earth, display:'inline-block', marginRight:6 }}></span><span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:14, color:c.text }}>71</span><span style={{ fontSize:11, color:c.muted }}> g fat</span></div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:5, background:c.card, padding:'12px 16px', marginBottom:8 }}>
            <div>
              <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:10, letterSpacing:1.5, color:c.muted }}>BENCHMARK · PROTEIN ADHERENCE</span>
              <div style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:13.5, color:c.text, letterSpacing:-.1, marginTop:3 }}>≥170g, 6 of 7 days</div>
            </div>
            <span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:15, color:c.body }}>6/7</span>
          </div>
          <div style={{ marginBottom:14 }}>
            <OpenBadge c={c}>OPEN · HIT / MISSED / UNKNOWABLE WORDING</OpenBadge>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14, padding:'0 2px' }}>
            <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:10, letterSpacing:1.5, color:c.muted }}>FIDELITY</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:10, height:10, borderRadius:3, background:c.sec }}></span><span style={{ fontSize:11, color:c.dim }}>weighed</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:10, height:10, borderRadius:3, background:c.muted, opacity:.6 }}></span><span style={{ fontSize:11, color:c.dim }}>logged</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:10, height:10, borderRadius:3, border:`1.3px dashed ${c.dim}` }}></span><span style={{ fontSize:11, color:c.dim }}>estimated</span></div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {meals.map(m => (
              <div key={m.name} style={{ borderRadius:5, background:c.card, padding:'14px 16px', opacity:m.op, border:m.border }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <span style={{ width:9, height:9, borderRadius:3, background:m.dotBg, border:m.dotBorder }}></span>
                    <span style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:15, color:c.text, letterSpacing:-.2 }}>{m.name}</span>
                    <span style={{ fontSize:10.5, color:c.dim }}>{m.time}</span>
                  </div>
                  <span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:14, color:c.text, letterSpacing:-.4 }}>{m.kcal}</span>
                </div>
                <div style={{ fontSize:11.5, color:c.sec, marginBottom:9 }}>{m.items}</div>
                <div style={{ display:'flex', height:5, borderRadius:3, overflow:'hidden', gap:2 }}>
                  <div style={{ flex:m.p, background:c.body }}></div>
                  <div style={{ flex:m.cb, background:c.glacial }}></div>
                  <div style={{ flex:m.f, background:c.earth }}></div>
                </div>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/* ---------------- Social ---------------- */
function SocialScreen({ c }) {
  const [nav, setNav] = useState('Feed');
  const feed = [
    { i:'KM', av:c.water, who:'Kai M.', did:'ran White Salmon · Green Truss', color:c.water, stat:'8.4 km · Class IV–V', when:'2h ago' },
    { i:'AL', av:c.earth, who:'Alix L.', did:'sent a project at Beacon Rock', color:c.earth, stat:'5.11d · 4 pitches', when:'5h ago' },
    { i:'RB', av:c.sky, who:'Rae B.', did:'flew from Dog Mountain', color:c.sky, stat:'42 min · 1,180 m', when:'yesterday' },
    { i:'DP', av:c.body, who:'Dana P.', did:'logged a heavy squat day', color:c.body, stat:'9.4 t · 22 sets', when:'yesterday' },
    { i:'MK', av:c.sky, who:'Mika K.', did:'joined Cascadia Alpine', color:c.sky, stat:'welcome to the cohort', when:'2d ago' },
  ];
  return (
    <div style={{ position:'absolute', top:54, left:0, right:0, bottom:0, overflow:'hidden', padding:'6px 22px 100px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:'Space Grotesk', fontWeight:600, fontSize:28, letterSpacing:-1.3, color:c.text }}>Social</div>
          <div style={{ fontSize:12.5, color:c.dim, marginTop:2 }}>What the group did — not who won.</div>
        </div>
        <Avatar c={c} />
      </div>

      <div style={{ display:'flex', gap:6, background:c.cardHi, borderRadius:6, padding:4, marginBottom:18 }}>
        {['Feed', 'Groups'].map(k => (
          <div key={k} onClick={() => setNav(k)} style={{ flex:1, textAlign:'center', padding:'8px 0', borderRadius:4, cursor:'pointer', background: nav===k ? c.card : 'transparent', boxShadow: nav===k ? '0 1px 3px rgba(14,18,20,.08)' : 'none' }}>
            <span style={{ fontFamily:'Archivo', fontWeight:700, fontSize:11.5, letterSpacing:1, color: nav===k ? c.text : c.dim, textTransform:'uppercase' }}>{k}</span>
          </div>
        ))}
      </div>

      {nav === 'Groups' ? (
        <div style={{ borderRadius:5, background:c.card, padding:'40px 16px', textAlign:'center' }}>
          <OpenBadge c={c}>OPEN · GROUPS LIST LAYOUT</OpenBadge>
        </div>
      ) : (
        <React.Fragment>
          <SectionLabel c={c} style={{ marginBottom:14 }}>RECENT · FRIENDS &amp; COHORTS</SectionLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {feed.map((f,i) => (
              <div key={i} style={{ display:'flex', gap:12 }}>
                <span style={{ width:34, height:34, borderRadius:4, background:f.av, color:'#0E1214', fontFamily:'Archivo', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{f.i}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:c.sec, lineHeight:1.35 }}><b style={{ fontFamily:'Space Grotesk', fontWeight:600, color:c.text }}>{f.who}</b> {f.did}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                    <span style={{ width:6, height:6, borderRadius:2, background:f.color }}></span>
                    <span style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:12, color:c.text, letterSpacing:-.2 }}>{f.stat}</span>
                    <span style={{ fontSize:11, color:c.dim }}>· {f.when}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/* ---------------- App ---------------- */
function HealthCoachApp() {
  const [tab, setTab] = useState('Home');
  const [dark, setDark] = useState(false);
  const c = pal(dark);
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
      <div onClick={() => setDark(d => !d)} style={{ cursor:'pointer', fontFamily:'Archivo', fontWeight:700, fontSize:11, letterSpacing:1, color:'#5C6B6E', border:'1px solid #CFD6D2', borderRadius:20, padding:'6px 14px', background:'#fff' }}>
        {dark ? 'Switch to light' : 'Switch to dark'}
      </div>
      <Frame c={c}>
        <StatusBar color={c.statusText} />
        {tab === 'Home' && <HomeScreen c={c} />}
        {tab === 'Training' && <TrainingScreen c={c} />}
        {tab === 'Map' && <MapScreen c={c} />}
        {tab === 'Nutrition' && <NutritionScreen c={c} />}
        {tab === 'Social' && <SocialScreen c={c} />}
        {(tab === 'Home' || tab === 'Nutrition') && <LogBar c={c} dual={tab === 'Home'} />}
        <TabBar c={c} active={tab} onSelect={setTab} />
      </Frame>
    </div>
  );
}

window.HealthCoachApp = HealthCoachApp;
