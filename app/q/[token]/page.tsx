'use client';
import { use, useState, useEffect } from 'react';

/**
 * One question per screen. "Q1 of 3" is computed before the first is shown,
 * so the promise is true. Every question carries a "don't know" escape hatch —
 * for a perfectionist, removing the failure state is the whole design.
 */
export default function Questions({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [job, setJob] = useState<any>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [free, setFree] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/job/${token}`).then(r => r.json()).then(setJob);
  }, [token]);

  if (!job) return <Shell><p style={S.dim}>Loading…</p></Shell>;
  if (done) return (
    <Shell>
      <h1 style={S.h1}>That's everything.</h1>
      <p style={S.body}>Your documents are being built. They'll be in your email and in the GVSW Estimates folder in a few minutes — the brief, the proposal, and the equipment call sheet.</p>
      <p style={S.body}>Nothing is committed. Mark up the brief and send it back.</p>
    </Shell>
  );

  const qs = job.questions || [];
  const q = qs[i];
  const last = i === qs.length - 1;

  const answer = async (val: string) => {
    const next = { ...answers, [q.id]: val };
    setAnswers(next); setFree('');
    if (!last) { setI(i + 1); return; }
    setBusy(true);
    await fetch('/api/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, answers: next }),
    });
    setBusy(false); setDone(true);
  };

  return (
    <Shell>
      <div style={S.progress}>
        <span style={S.count}>Question {i + 1} of {qs.length}</span>
        <div style={S.track}>
          <div style={{ ...S.fill, width: `${((i + 1) / qs.length) * 100}%` }} />
        </div>
      </div>

      <h1 style={S.h1}>{q.q}</h1>
      <p style={S.why}>{q.why}</p>

      <div style={S.opts}>
        {(q.options || []).map((o: string) => {
          const rec = /recommended/i.test(o);
          const dunno = /don.?t know|measure on site/i.test(o);
          return (
            <button key={o} onClick={() => answer(o)} disabled={busy}
              style={{ ...S.opt, ...(rec ? S.optRec : {}), ...(dunno ? S.optDunno : {}) }}>
              {o}
            </button>
          );
        })}
      </div>

      <div style={S.freeWrap}>
        <input value={free} onChange={e => setFree(e.target.value)}
          placeholder={q.unit ? `Or type it — ${q.unit}` : 'Or type your own answer'}
          style={S.input}
          onKeyDown={e => { if (e.key === 'Enter' && free.trim()) answer(free.trim()); }} />
        {free.trim() && (
          <button onClick={() => answer(free.trim())} disabled={busy} style={S.go}>
            {last ? (busy ? 'Building…' : 'Done') : 'Next'}
          </button>
        )}
      </div>

      {i > 0 && <button onClick={() => setI(i - 1)} style={S.back}>← back</button>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={S.main}>
      <div style={S.card}>
        <div style={S.brand}>GENESEE VALLEY STONE WORKS</div>
        {children}
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main:   { minHeight:'100dvh', background:'#fbfaf7', display:'flex', alignItems:'center', justifyContent:'center',
            padding:'20px', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif', color:'#33322e' },
  card:   { width:'100%', maxWidth:'520px' },
  brand:  { fontSize:'11px', letterSpacing:'.2em', color:'#3f4a3c', fontWeight:700, marginBottom:'28px' },
  progress:{ marginBottom:'26px' },
  count:  { fontSize:'13px', color:'#807b72', display:'block', marginBottom:'8px' },
  track:  { height:'3px', background:'#e5e1d8', borderRadius:'2px', overflow:'hidden' },
  fill:   { height:'100%', background:'#3f4a3c', transition:'width .25s ease' },
  h1:     { fontSize:'25px', lineHeight:1.25, margin:'0 0 10px', color:'#1a1a19', fontWeight:700, letterSpacing:'-.01em' },
  why:    { fontSize:'15px', color:'#807b72', margin:'0 0 26px', lineHeight:1.55 },
  body:   { fontSize:'17px', lineHeight:1.6, margin:'0 0 14px' },
  dim:    { color:'#807b72' },
  opts:   { display:'flex', flexDirection:'column', gap:'10px' },
  opt:    { padding:'17px 20px', fontSize:'17px', textAlign:'left', background:'#fff', color:'#33322e',
            border:'1.5px solid #ddd8ce', borderRadius:'9px', cursor:'pointer', lineHeight:1.4 },
  optRec: { borderColor:'#3f4a3c', borderWidth:'2px', fontWeight:600 },
  optDunno:{ background:'#f4f2ee', color:'#6e6a62', fontStyle:'italic' },
  freeWrap:{ display:'flex', gap:'8px', marginTop:'18px' },
  input:  { flex:1, padding:'16px 18px', fontSize:'17px', border:'1.5px solid #ddd8ce', borderRadius:'9px',
            background:'#fff', outline:'none' },
  go:     { padding:'0 24px', fontSize:'16px', fontWeight:600, background:'#3f4a3c', color:'#fff',
            border:'none', borderRadius:'9px', cursor:'pointer' },
  back:   { marginTop:'22px', background:'none', border:'none', color:'#807b72', fontSize:'14px', cursor:'pointer', padding:0 },
};
