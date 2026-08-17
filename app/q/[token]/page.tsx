'use client';
import { use, useState, useEffect } from 'react';
import { brandFor, type Brand } from '@/lib/brand';

/**
 * One question per screen, and as little else as the screen can carry.
 *
 * The reassurance is structural, not written: a guaranteed "don't know yet"
 * option, a marked usual answer, a back button. Saying the same thing again in
 * prose reads as anxiety, which is the one thing this page must not hand a
 * perfectionist standing on a roof. So the reasoning sits behind `why?` and the
 * keyboard behind `type an answer` — both one tap away, neither in the way.
 */

// Matched against the raw option, before the label is stripped for display.
const REC = /\(recommended\)/i;
const DUNNO = /don.?t know|measure on site/i;

export default function Questions({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [job, setJob] = useState<any>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [free, setFree] = useState('');
  const [typing, setTyping] = useState(false);
  const [why, setWhy] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/job/${token}`).then(r => r.json()).then(setJob);
  }, [token]);

  const brand = brandFor(job?.brand);
  const S = styles(brand);

  if (!job) return <Shell brand={brand}><p style={S.dim}>Loading…</p></Shell>;
  if (done) return (
    <Shell brand={brand}>
      <h1 style={S.h1}>Done.</h1>
      <p style={S.body}>
        Documents in your email and in {brand.driveFolder} in a few minutes. Nothing is committed.
      </p>
    </Shell>
  );

  const qs = job.questions || [];
  const q = qs[i];
  const last = i === qs.length - 1;

  // Every move between questions starts clean: an opened note or an opened
  // keyboard belongs to the question it was opened on, not the next one.
  const go = (n: number) => { setI(n); setFree(''); setTyping(false); setWhy(false); };

  const answer = async (val: string) => {
    const next = { ...answers, [q.id]: val };
    setAnswers(next);
    if (!last) { go(i + 1); return; }
    setBusy(true);
    await fetch('/api/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, answers: next }),
    });
    setBusy(false); setDone(true);
  };

  const entry = (
    <div style={S.freeWrap}>
      <input autoFocus value={free} onChange={e => setFree(e.target.value)}
        placeholder={q.unit || ''} inputMode={q.unit ? 'decimal' : 'text'} style={S.input}
        onKeyDown={e => { if (e.key === 'Enter' && free.trim()) answer(free.trim()); }} />
      {free.trim() && (
        <button onClick={() => answer(free.trim())} disabled={busy} style={S.go}>
          {last ? (busy ? '…' : 'Done') : 'Next'}
        </button>
      )}
    </div>
  );

  return (
    <Shell brand={brand}>
      {/* One segment per question. He can count them; nobody has to say it. */}
      <div style={S.segs}>
        {qs.map((_: any, n: number) => (
          <div key={n} style={{ ...S.seg, background: n <= i ? brand.accent : brand.lineSoft }} />
        ))}
      </div>

      <h1 style={S.h1}>{q.q}</h1>

      {why && q.why && <p style={S.note}>{q.why}</p>}
      {/* On a measurement question the number IS the answer, so it goes first. */}
      {typing && q.unit && <div style={S.freeAbove}>{entry}</div>}

      <div style={S.opts}>
        {(q.options || []).map((o: string) => {
          const rec = REC.test(o);
          const dunno = DUNNO.test(o);
          const label = o.replace(REC, '').replace(/\s{2,}/g, ' ').trim();
          return (
            <button key={o} onClick={() => answer(label)} disabled={busy}
              style={{ ...S.opt, ...(rec ? S.optRec : {}), ...(dunno ? S.optDunno : {}) }}>
              <span>{label}</span>
              {rec && <span style={S.usual}>usual</span>}
            </button>
          );
        })}
      </div>

      {typing && !q.unit && <div style={S.freeBelow}>{entry}</div>}

      <div style={S.footer}>
        {q.why && <button style={S.link} onClick={() => setWhy(!why)}>why?</button>}
        <button style={S.link} onClick={() => setTyping(!typing)}>
          {q.unit ? 'type a number' : 'type an answer'}
        </button>
      </div>

      {i > 0 && <button onClick={() => go(i - 1)} style={S.back}>← back</button>}
    </Shell>
  );
}

function Shell({ brand, children }: { brand: Brand; children: React.ReactNode }) {
  const S = styles(brand);
  return (
    <main style={S.main}>
      <div style={S.card}>
        <div style={S.wordmark}>{brand.wordmark}</div>
        {children}
      </div>
    </main>
  );
}

function styles(b: Brand): Record<string, React.CSSProperties> {
  return {
    main:    { minHeight:'100dvh', background:b.bg, display:'flex', alignItems:'center', justifyContent:'center',
               padding:'20px', fontFamily:b.font, color:b.ink },
    card:    { width:'100%', maxWidth:'440px' },
    wordmark:{ fontSize:'11px', letterSpacing:'.2em', color:b.accent, fontWeight:700, marginBottom:'28px' },
    segs:    { display:'flex', gap:'5px', marginBottom:'26px' },
    seg:     { flex:1, height:'3px', borderRadius:'2px', transition:'background .25s ease' },
    h1:      { fontSize:'25px', lineHeight:1.25, margin:'0 0 18px', color:b.inkStrong, fontWeight:700, letterSpacing:'-.01em' },
    note:    { fontSize:'14px', lineHeight:1.5, color:b.muted, margin:'0 0 18px',
               paddingLeft:'12px', borderLeft:`2px solid ${b.line}` },
    body:    { fontSize:'17px', lineHeight:1.6, margin:0 },
    dim:     { color:b.muted },
    opts:    { display:'flex', flexDirection:'column', gap:'10px' },
    // fontFamily, never the `font` shorthand: React writes inline properties in
    // insertion order, and the shorthand would silently reset the fontSize above it.
    opt:     { display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px',
               padding:'17px 20px', fontSize:'17px', fontFamily:'inherit', textAlign:'left',
               background:b.surface, color:b.ink, border:`1.5px solid ${b.line}`, borderRadius:'9px',
               cursor:'pointer', lineHeight:1.4 },
    optRec:  { borderColor:b.accent, background:b.accentSoft },
    optDunno:{ border:`1.5px dashed ${b.line}`, background:'transparent', color:b.muted },
    usual:   { fontSize:'10px', letterSpacing:'.14em', textTransform:'uppercase', color:b.accent,
               fontWeight:700, flexShrink:0 },
    freeWrap:{ display:'flex', gap:'8px' },
    freeAbove:{ marginBottom:'14px' },
    freeBelow:{ marginTop:'14px' },
    input:   { flex:1, minWidth:0, padding:'15px 18px', fontSize:'17px', fontFamily:'inherit',
               border:`1.5px solid ${b.line}`, borderRadius:'9px', background:b.surface, color:b.ink, outline:'none' },
    go:      { padding:'0 22px', fontSize:'16px', fontFamily:'inherit', fontWeight:600, background:b.accent,
               color:b.surface, border:'none', borderRadius:'9px', cursor:'pointer' },
    footer:  { display:'flex', gap:'18px', marginTop:'16px' },
    link:    { background:'none', border:'none', padding:0, color:b.muted, fontSize:'14px', fontFamily:'inherit',
               cursor:'pointer', textDecoration:'underline', textUnderlineOffset:'3px' },
    back:    { marginTop:'22px', background:'none', border:'none', color:b.muted, fontSize:'14px',
               fontFamily:'inherit', cursor:'pointer', padding:0 },
  };
}
