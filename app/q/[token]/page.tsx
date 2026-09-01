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

  /**
   * One phase, not a `done` flag and a `busy` flag.
   *
   * Those two were independent booleans, and submitting used to leave the
   * question screen on the page with every option quietly disabled and nothing
   * else changed. From the outside that is indistinguishable from a page that
   * has broken — so the natural move is to press back, which was still live,
   * landing on an earlier question where the options were also disabled. The
   * page looked dead for the thirty to ninety seconds the submit actually takes.
   *
   * A single phase makes that state impossible: while it is submitting there is
   * no question screen to press.
   */
  const [phase, setPhase] = useState<'asking' | 'submitting' | 'done' | 'failed'>('asking');
  const [failure, setFailure] = useState('');

  /**
   * The first screen: what's this job? Client and town, prefilled with what the
   * extractor heard, confirmed by him.
   *
   * It exists because of one word. The first real memo transcribed "Pittsford"
   * as "Pittsburgh", and nothing between the transcript and the priced page
   * was in a position to notice — the model read it, believed it, and would
   * have priced a Monroe County job to Allegheny County. The person who knows
   * where the job is has to say so, once, in a box he can see. Both fields
   * may be left blank; the screen is never skipped.
   */
  const [intake, setIntake] = useState<{ client: string; area: string }>({ client: '', area: '' });
  const [onIntake, setOnIntake] = useState(true);

  useEffect(() => {
    fetch(`/api/job/${token}`).then(r => r.json()).then(j => {
      setJob(j);
      setIntake({ client: j?.intake?.client || '', area: j?.intake?.area || '' });
    });
  }, [token]);

  const brand = brandFor(job?.brand);
  const S = styles(brand);

  const qs: any[] = job?.questions || [];

  /**
   * Submitting is slow and it is slow for real reasons — a pricing call, a PDF
   * rendered in headless Chromium, a Drive upload, an email. Half a minute at
   * best. So it gets a screen of its own rather than a disabled button, and the
   * screen says what is happening. Silence for that long reads as failure.
   */
  const submit = async (final: Record<string, string>) => {
    setPhase('submitting');
    setFailure('');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answers: final, job: intake }),
      });
      // fetch does not throw on 4xx/5xx. Without this the page announced "Done."
      // over a failed submit, which is the worst of the available outcomes.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `submit failed (${res.status})`);
      }
      setPhase('done');
    } catch (e: any) {
      // Every path out of the try sets a phase. The old code cleared `busy`
      // after the await with no catch, so a failure left every control disabled
      // for good and the only way out was reloading the page.
      setFailure(e?.message || 'Something went wrong.');
      setPhase('failed');
    }
  };

  if (!job) return <Shell brand={brand}><p style={S.dim}>Loading…</p></Shell>;

  if (job.error || !qs.length) return (
    <Shell brand={brand}>
      <h1 style={S.h1}>This link has nothing on it.</h1>
      <p style={S.body}>It may already have been answered. Send the memo again and I&apos;ll send a fresh one.</p>
    </Shell>
  );

  if (phase === 'submitting') return (
    <Shell brand={brand}>
      <h1 style={S.h1}>Pricing it.</h1>
      <p style={S.body}>Around a minute — the numbers, then the page itself. Leave this open.</p>
      <div style={S.barTrack}><div style={S.barFill} /></div>
      <style>{'@keyframes gvsw-slide{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}'}</style>
    </Shell>
  );

  if (phase === 'failed') return (
    <Shell brand={brand}>
      <h1 style={S.h1}>That didn&apos;t go through.</h1>
      <p style={S.body}>{failure}</p>
      <p style={S.body}>Your answers are still here.</p>
      <button onClick={() => submit(answers)} style={S.retry}>Try again</button>
    </Shell>
  );

  if (phase === 'done') return (
    <Shell brand={brand}>
      <h1 style={S.h1}>Done.</h1>
      <p style={S.body}>
        Documents in your email and in {brand.driveFolder} in a few minutes. Nothing is committed.
      </p>
    </Shell>
  );

  // One segment per screen, the intake included. He can count them; nobody has to say it.
  const segs = (
    <div style={S.segs}>
      {[null, ...qs].map((_: any, n: number) => (
        <div key={n} style={{ ...S.seg, background: n <= (onIntake ? 0 : i + 1) ? brand.accent : brand.lineSoft }} />
      ))}
    </div>
  );

  if (onIntake) {
    const field = (key: 'client' | 'area', label: string, placeholder: string, last: boolean) => (
      <label style={S.field}>
        <span style={S.label}>{label}</span>
        <input value={intake[key]} placeholder={placeholder} autoFocus={key === 'client'}
          onChange={e => setIntake({ ...intake, [key]: e.target.value })} style={S.input}
          onKeyDown={e => { if (e.key === 'Enter' && last) setOnIntake(false); }} />
      </label>
    );
    return (
      <Shell brand={brand}>
        {segs}
        <h1 style={S.h1}>What&apos;s this job?</h1>
        {field('client', 'Client', 'Name on the job', false)}
        {field('area', 'Where', 'Town', true)}
        <button onClick={() => setOnIntake(false)} style={S.retry}>Next</button>
      </Shell>
    );
  }

  const q = qs[i];
  const last = i === qs.length - 1;

  // Every move between questions starts clean: an opened note or an opened
  // keyboard belongs to the question it was opened on, not the next one.
  const go = (n: number) => { setI(n); setFree(''); setTyping(false); setWhy(false); };

  const answer = (val: string) => {
    // A double tap on the last option used to be able to start two submits —
    // two proposal numbers, two emails, two rows. The phase is the guard.
    if (phase !== 'asking') return;
    const next = { ...answers, [q.id]: val };
    setAnswers(next);
    if (!last) { go(i + 1); return; }
    submit(next);
  };

  const entry = (
    <div style={S.freeWrap}>
      <input autoFocus value={free} onChange={e => setFree(e.target.value)}
        placeholder={q.unit || ''} inputMode={q.unit ? 'decimal' : 'text'} style={S.input}
        onKeyDown={e => { if (e.key === 'Enter' && free.trim()) answer(free.trim()); }} />
      {free.trim() && (
        <button onClick={() => answer(free.trim())} style={S.go}>
          {last ? 'Done' : 'Next'}
        </button>
      )}
    </div>
  );

  return (
    <Shell brand={brand}>
      {segs}

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
            <button key={o} onClick={() => answer(label)}
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

      {/* Back from the first question lands on the intake, so a wrong town is one tap away. */}
      <button onClick={() => { if (i > 0) go(i - 1); else { go(0); setOnIntake(true); } }} style={S.back}>← back</button>
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
    // The two intake fields. A label above each because a placeholder vanishes
    // the moment the prefill lands, and "Henderson" alone does not say client.
    field:   { display:'block', marginBottom:'14px' },
    label:   { display:'block', fontSize:'11px', letterSpacing:'.14em', textTransform:'uppercase', color:b.muted,
               fontWeight:700, marginBottom:'6px' },
    freeWrap:{ display:'flex', gap:'8px' },
    freeAbove:{ marginBottom:'14px' },
    freeBelow:{ marginTop:'14px' },
    input:   { flex:1, minWidth:0, width:'100%', boxSizing:'border-box', padding:'15px 18px', fontSize:'17px', fontFamily:'inherit',
               border:`1.5px solid ${b.line}`, borderRadius:'9px', background:b.surface, color:b.ink, outline:'none' },
    go:      { padding:'0 22px', fontSize:'16px', fontFamily:'inherit', fontWeight:600, background:b.accent,
               color:b.surface, border:'none', borderRadius:'9px', cursor:'pointer' },
    footer:  { display:'flex', gap:'18px', marginTop:'16px' },
    link:    { background:'none', border:'none', padding:0, color:b.muted, fontSize:'14px', fontFamily:'inherit',
               cursor:'pointer', textDecoration:'underline', textUnderlineOffset:'3px' },
    back:    { marginTop:'22px', background:'none', border:'none', color:b.muted, fontSize:'14px',
               fontFamily:'inherit', cursor:'pointer', padding:0 },
    // Movement, not a percentage. Nothing here knows how far along it is, and a
    // progress bar that invents a percentage is a progress bar that lies at 90%.
    barTrack:{ marginTop:'28px', height:'3px', borderRadius:'2px', background:b.lineSoft, overflow:'hidden' },
    barFill: { width:'30%', height:'100%', borderRadius:'2px', background:b.accent,
               animation:'gvsw-slide 1.5s ease-in-out infinite' },
    retry:   { marginTop:'22px', padding:'15px 26px', fontSize:'17px', fontFamily:'inherit', fontWeight:600,
               background:b.accent, color:b.surface, border:'none', borderRadius:'9px', cursor:'pointer' },
  };
}
