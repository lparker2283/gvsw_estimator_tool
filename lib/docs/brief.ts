import { page, money, esc, CO } from './shared';
import { highlights, daySpan, dollars, effectiveRateLine, ROWS, type Highlights } from '../highlights';

/**
 * The document. Singular, internal, and not a proposal.
 *
 * Dan writes the proposal himself, later, and better. This exists to get him
 * from a voice memo to being able to quote with a straight face — the business
 * model, how long, what is blocking a confident number, a range with its four
 * rows, and what to say when the client pushes back.
 *
 * There were four documents once: a field brief, an equipment call sheet, a
 * client proposal and a covering note. Three were written against one job — a
 * chimney in Pittsford reached by a narrow path — and said so whatever job they
 * were handed. A call sheet that always asks about spider lifts is not a call
 * sheet; it is a memory of one afternoon.
 *
 * The line numbers are load-bearing. They are what a circled mark and a
 * scribbled figure attach to when the page comes back.
 */
export function brief(spec: any, extraction: any) {
  const H = highlights(spec);
  const findings: any[] = (extraction?.findings || []).filter((f: any) => f.severity !== 'low');
  const flags: string[] = spec._validation || [];
  const scope: any[] = spec.scope || [];

  const present = [
    H.model && 'How to charge it',
    H.duration && 'How long',
    H.blockers.length && 'What is blocking a firm number',
    H.range && 'The range',
    (H.objections.length || H.explanation) && 'When they push back',
    scope.length && 'The lines',
    findings.length && 'Worth knowing',
    flags.length && 'Check these',
    'Corrections',
  ].filter(Boolean) as string[];

  const sec = (t: string) =>
    `<div class="sec"><div class="n">${present.indexOf(t) + 1}</div><h2>${esc(t)}</h2></div>`;
  const has = (t: string) => present.includes(t);

  const basisFor = (task: string, i: number) => {
    const d = (spec.derivation || []).find((x: any) =>
      String(x.line || '').toLowerCase().trim() === String(task || '').toLowerCase().trim())
      || (spec.derivation || [])[i];
    return d ? [d.card, d.range].filter(Boolean).map(esc).join(' · ') : '';
  };

  return page('Brief', `
    <div class="eyebrow">${esc(CO.name)}</div>
    <h1>${esc(H.projectName)}</h1>
    <div class="rule"></div>
    <p class="sub">${esc(H.proposalNo)}${H.dateIssued ? ` · ${esc(H.dateIssued)}` : ''} · from your memo · not a proposal</p>

    ${has('How to charge it') ? `
      ${sec('How to charge it')}
      <p class="lead">${esc(H.model!.recommendation)}</p>
      <p>${esc(H.model!.why)}</p>` : ''}

    ${has('How long') ? `
      ${sec('How long')}
      <p class="lead">${esc(daySpan(H.duration))} on site.</p>
      ${H.duration!.drivers?.length
        ? `<div class="minor">What decides where it lands</div>
           <ul>${H.duration!.drivers.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}` : ''}

    ${has('What is blocking a firm number') ? `
      ${sec('What is blocking a firm number')}
      ${H.blockers.map(b => `
        <p class="lead">${esc(b.item)}</p>
        <p>${esc(b.why)}</p>
        <p class="first">${esc(b.resolves_by)}</p>
        ${(b.ask || []).length ? `<div class="minor">Ask</div><ul>${b.ask!.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
        ${(b.measure || []).length ? `<div class="minor">Measure first</div><ul>${b.measure!.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      `).join('')}` : ''}

    ${has('The range') ? `
      ${sec('The range')}
      ${rangeTable(H)}
      ${H.range!.equipment_note ? `<p class="note">${esc(H.range!.equipment_note)}</p>` : ''}
      ${H.effectiveRate ? `<p class="rate">${esc(effectiveRateLine(H.effectiveRate))}</p>` : ''}
      ${H.range!.swing?.length ? `
        <div class="minor">What moves it from one end to the other</div>
        <ul>${H.range!.swing.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${H.validity ? `<p class="note">${esc(H.validity)}</p>` : ''}` : ''}

    ${has('When they push back') ? `
      ${sec('When they push back')}
      ${H.explanation ? `<p>${esc(H.explanation)}</p>` : ''}
      ${H.objections.map(o => `
        <p class="lead">“${esc(o.objection)}”</p>
        <p>${esc(o.response)}</p>
        <p class="note">${esc(o.grounded_in)}</p>`).join('')}` : ''}

    ${has('The lines') ? `
      ${sec('The lines')}
      <table><thead><tr><th style="width:26px">#</th><th>Line</th>
        <th style="text-align:right;width:88px">Cost</th><th style="width:30%">Basis</th></tr></thead><tbody>
        ${scope.map((s: any, i: number) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td class="k">${esc(s.task)}<div class="sub-line">${esc(s.description)}</div></td>
            <td class="r${s.cost === null ? ' warn' : ''}">${money(s.cost)}${s.contingent && s.cost !== null ? ' *' : ''}</td>
            <td class="basis">${basisFor(s.task, i)}${s.unit ? `<div class="sub-line">${esc(s.unit)}</div>` : ''}</td>
          </tr>`).join('')}
      </tbody></table>
      ${scope.some((s: any) => s.contingent) ? '<p class="note">* Contingent — in the high column, out of the low.</p>' : ''}
      ${(spec.tax_lines || []).length
        ? `<p class="note">Tax: ${(spec.tax_lines || []).map((t: any) => `${esc(t.line)} — ${esc(t.cls)}`).join('; ')}.</p>` : ''}
      ${(spec.materials || []).length ? `
        <div class="minor">Materials to order</div>
        <table><tbody>${(spec.materials || []).map((m: any) => `<tr>
          <td class="k">${esc(m.material)}</td><td>${esc(m.spec || '')}</td>
          <td>${esc(m.qty || '')} ${esc(m.unit || '')}</td>
          <td>${esc(m.supplier || 'supplier TBD')}</td></tr>`).join('')}</tbody></table>` : ''}
      ${(spec.assumptions || []).length ? `
        <div class="minor">Where I guessed</div>
        <table><tbody>${(spec.assumptions || []).map((a: any) =>
          `<tr><td class="k">${esc(a.what)}</td><td>${esc(a.why_it_matters)}</td></tr>`).join('')}</tbody></table>` : ''}` : ''}

    ${has('Worth knowing') ? `
      ${sec('Worth knowing')}
      <table><tbody>${findings.map((f: any) =>
        `<tr><td class="k">${esc(f.finding)}</td><td>${esc(f.implication)}</td></tr>`).join('')}</tbody></table>
      <p class="note">Your call, not mine.</p>` : ''}

    ${has('Check these') ? `
      ${sec('Check these')}
      <ul>${flags.map(f => `<li class="warn">${esc(f)}</li>`).join('')}</ul>` : ''}

    ${sec('Corrections')}
    <p class="note">Circle a line number and write the right figure. Quantity means I misheard you;
    rate means the card is drifting; a line added or crossed out means I mis-scoped it.
    Mark it up, email this page back, and I will log it.</p>
    ${'<div class="writein"></div>'.repeat(7)}

    <footer>${esc(CO.name)} · ${esc(CO.footer)}<br><em>${esc(CO.tagline)}</em></footer>
  `);
}

/** Two columns, four rows. A dash is a real state and is never a zero. */
function rangeTable(H: Highlights): string {
  const { low, high } = H.range!;
  return `
    <table class="range"><thead><tr>
      <th></th><th style="text-align:right">Low</th><th style="text-align:right">High</th><th style="width:34%">Basis</th>
    </tr></thead><tbody>
      ${ROWS.map(({ key, label }) => `
        <tr>
          <td class="k">${esc(label)}</td>
          <td class="r${low[key] === null ? ' warn' : ''}">${dollars(low[key] as any)}</td>
          <td class="r${high[key] === null ? ' warn' : ''}">${dollars(high[key] as any)}</td>
          <td class="basis">${key === 'conditions' ? esc(high.conditions_basis || low.conditions_basis || '') : ''}</td>
        </tr>`).join('')}
      <tr class="strong">
        <td class="k">${low.partial || high.partial ? 'Range, so far' : 'Range'}</td>
        <td class="r big">${dollars(low.total ?? null)}</td>
        <td class="r big">${dollars(high.total ?? null)}</td>
        <td class="basis">${low.partial || high.partial ? 'a row is still unpriced' : ''}</td>
      </tr>
    </tbody></table>`;
}
