import { page, esc, CO } from './shared';
import { highlights, daySpan, dollars, effectiveRateLine, ROWS, type Highlights } from '../highlights';

/**
 * The document. Singular, internal, and not a proposal.
 *
 * Dan writes the proposal himself, later, and better. This exists to get him
 * from a voice memo to being able to quote with a straight face — the pricing
 * recommendation, how long it runs, what is blocking a firm quote and the steps
 * that clear it, a range with its four rows, and the justification he needs
 * when a client pushes back.
 *
 * The section names are his, from a markup pass on a real brief. "How to charge
 * it" became "Pricing recommendation" and "When they push back" became "Pricing
 * justification", because he is not reading this to be told what to say — he is
 * reading it to remember why the number is the number.
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
  const scope: any[] = spec.scope || [];

  const present = [
    H.model && 'Pricing recommendation',
    H.duration && 'Estimated job length',
    (H.blockers.length || H.nextSteps.length) && 'Factors blocking a firm quote',
    H.range && 'The range',
    (H.objections.length || H.explanation) && 'Pricing justification',
    scope.length && 'Project scope & line cost basis',
    findings.length && 'Worth knowing',
    'How to correct this doc',
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

    ${has('Pricing recommendation') ? `
      ${sec('Pricing recommendation')}
      <p class="lead">${esc(H.model!.recommendation)}</p>
      <p>${esc(H.model!.why)}</p>` : ''}

    ${has('Estimated job length') ? `
      ${sec('Estimated job length')}
      <p class="lead">${esc(daySpan(H.duration))} on site${H.duration!.drivers?.length ? ' depending on:' : '.'}</p>
      ${H.duration!.drivers?.length
        ? `<ul>${H.duration!.drivers.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}` : ''}

    ${has('Factors blocking a firm quote') ? `
      ${sec('Factors blocking a firm quote')}
      ${H.blockers.length ? `<ul>${H.blockers.map(b => `
        <li><b>${esc(b.item)}.</b> ${esc(b.why)}${b.critical ? ' <span class="crit">Critical</span>' : ''}</li>`).join('')}</ul>` : ''}
      ${H.nextSteps.length ? `
        <div class="minor">Next steps for a firm quote</div>
        <ul>${H.nextSteps.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}` : ''}

    ${has('The range') ? `
      ${sec('The range')}
      ${rangeTable(H)}
      ${H.range!.equipment_note ? `<p class="note">${esc(H.range!.equipment_note)}</p>` : ''}
      ${H.effectiveRate ? `<p class="rate">${esc(effectiveRateLine(H.effectiveRate))}</p>` : ''}
      ${(H.range!.swing?.length || H.validity) ? `
        <div class="minor">Charging on the low end vs high end depends on:</div>
        <ul>
          ${(H.range!.swing || []).map(s => `<li>${esc(s)}</li>`).join('')}
          ${sentences(H.validity).map(n => `<li class="muted">Note: ${esc(n)}</li>`).join('')}
        </ul>` : ''}` : ''}

    ${has('Pricing justification') ? `
      ${sec('Pricing justification')}
      ${H.explanation ? `<p class="summary">“${esc(H.explanation)}”</p>` : ''}
      ${H.objections.map(o => `
        <p class="lead">“${esc(o.objection)}”</p>
        <p>${esc(o.response)}</p>`).join('')}` : ''}

    ${has('Project scope & line cost basis') ? `
      ${sec('Project scope & line cost basis')}
      <table><thead><tr><th style="width:26px">#</th><th>Line</th>
        <th style="text-align:right;width:70px">Low</th><th style="text-align:right;width:70px">High</th>
        <th style="width:28%">Basis</th></tr></thead><tbody>
        ${scope.map((s: any, i: number) => {
          const unpriced = s.low == null && s.high == null;
          const star = s.contingent && !unpriced ? ' *' : '';
          return `
          <tr>
            <td class="num">${i + 1}</td>
            <td class="k">${esc(s.task)}<div class="sub-line">${esc(s.description)}</div></td>
            ${unpriced
              ? `<td class="r warn" colspan="2">NOT PRICED</td>`
              : `<td class="r">${dollars(s.low ?? null)}${star}</td><td class="r">${dollars(s.high ?? null)}${star}</td>`}
            <td class="basis">${basisFor(s.task, i)}${s.unit ? `<div class="sub-line">${esc(s.unit)}</div>` : ''}</td>
          </tr>`; }).join('')}
        <tr class="strong">
          <td class="num"></td><td class="k">Scope subtotal</td>
          <td class="r">${dollars(spec.totals?.scope_low ?? null)}</td>
          <td class="r">${dollars(spec.totals?.scope_high ?? null)}</td>
          <td class="basis">${scope.some((s: any) => s.low == null && s.high == null) ? 'excludes the unpriced lines' : ''}</td>
        </tr>
      </tbody></table>
      ${scope.some((s: any) => s.contingent) ? '<p class="note">* Contingent — in the high column, out of the low.</p>' : ''}
      ${H.taxAction
        ? `<p class="first">${esc(H.taxAction)}</p>`
        : ((spec.tax_lines || []).length
            ? `<p class="note">Tax: ${(spec.tax_lines || []).map((t: any) => `${esc(t.line)} — ${esc(t.cls)}`).join('; ')}.</p>` : '')}
      ${(spec.materials || []).length ? `
        <div class="minor">Materials to order</div>
        <table><tbody>${(spec.materials || []).map((m: any) => `<tr>
          <td class="k">${esc(m.material)}</td><td>${esc(m.spec || '')}</td>
          <td>${esc(m.qty || '')} ${esc(m.unit || '')}</td>
          <td>${esc(m.supplier || 'supplier TBD')}</td></tr>`).join('')}</tbody></table>` : ''}
      ${(spec.assumptions || []).length ? `
        <div class="minor">Assumptions — check these closely</div>
        <table><tbody>${(spec.assumptions || []).map((a: any) =>
          `<tr><td class="k">${esc(a.what)}</td><td>${esc(a.why_it_matters)}</td></tr>`).join('')}</tbody></table>` : ''}` : ''}

    ${has('Worth knowing') ? `
      ${sec('Worth knowing')}
      <table><tbody>${findings.map((f: any) =>
        `<tr><td class="k">${esc(f.finding)}</td><td>${esc(f.implication)}</td></tr>`).join('')}</tbody></table>
      <p class="note">Your call, not mine.</p>` : ''}

    ${sec('How to correct this doc')}
    <p class="note">Circle a line number and write the right figure. Quantity means I misheard you;
    rate means the card is drifting; a line added or crossed out means I mis-scoped it.
    Mark it up, email this page back, and I will log it.</p>
    ${'<div class="writein"></div>'.repeat(7)}

    <footer>${esc(CO.name)} · ${esc(CO.footer)}<br><em>${esc(CO.tagline)}</em></footer>
  `);
}

/**
 * `validity` arrives as prose — how long the range holds, and what would move
 * it. It reads as two notes at the end of the list that decides low versus
 * high, rather than as a paragraph after it, so split it where it was written.
 */
function sentences(text: string): string[] {
  return String(text || '').split(/(?<=\.)\s+/).map(t => t.trim()).filter(Boolean);
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
