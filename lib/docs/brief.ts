import { page, money, esc, CO } from './shared';

/**
 * The document. Singular.
 *
 * There were four: a field brief, an equipment call sheet, a client proposal
 * and a client covering note. Three of them were written against one job — a
 * chimney in Pittsford reached by a narrow path — and they said so whatever
 * job they were handed. A call sheet that always asks about spider lifts is
 * not a call sheet; it is a memory of one afternoon.
 *
 * So: one page, for Dan, and nothing on it that this job did not produce.
 * Every section below is conditional. A job with no unpriced items has no
 * errand section. A job with nothing worth flagging has no flags. The document
 * gets shorter as the tool gets surer, which is the correct direction.
 *
 * The line numbers are load-bearing. They are what a circled mark and a
 * scribbled figure attach to when the marked-up page comes back, and they are
 * why the correction ledger can say "line 3, rate" instead of "something was
 * wrong somewhere".
 */
export function brief(spec: any, extraction: any) {
  const X = spec.cross_check || {};
  const T = spec.totals || {};
  const scope: any[] = spec.scope || [];
  const unpriced: any[] = spec.unpriced || [];
  const findings: any[] = (extraction?.findings || []).filter((f: any) => f.severity !== 'low');
  const flags: string[] = spec._validation || [];

  /**
   * Section numbers are computed, not written down. Half the sections are
   * conditional, and a hardcoded "4" on a job that has no section 3 is the same
   * class of mistake as a call sheet that always asks about spider lifts.
   */
  const present = [
    'The call',
    'The lines',
    ((spec.unpriced || []).length || (spec.open_items || []).length || (spec.assumptions || []).length) && 'Before this is real',
    findings.length && 'Worth knowing',
    flags.length && 'Check these',
    'Corrections',
  ].filter(Boolean) as string[];

  const sec = (t: string) =>
    `<div class="sec"><div class="n">${present.indexOf(t) + 1}</div><h2>${esc(t)}</h2></div>`;

  /** The rate-card citation for a scope line, matched by name and then by position. */
  const basisFor = (task: string, i: number) => {
    const d = (spec.derivation || []).find((x: any) =>
      String(x.line || '').toLowerCase().trim() === String(task || '').toLowerCase().trim())
      || (spec.derivation || [])[i];
    if (!d) return '';
    return [d.card, d.range].filter(Boolean).map(esc).join(' · ');
  };

  const lines = scope.map((s: any, i: number) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="k">${esc(s.task)}<div class="sub-line">${esc(s.description)}</div></td>
      <td class="r${s.cost === null ? ' warn' : ''}">${money(s.cost)}${s.contingent && s.cost !== null ? ' *' : ''}</td>
      <td class="basis">${basisFor(s.task, i)}${s.unit ? `<div class="sub-line">${esc(s.unit)}</div>` : ''}</td>
    </tr>`).join('');

  const materials = (spec.materials || []).length ? `
    <div class="minor">Materials to order</div>
    <table><tbody>
      ${(spec.materials || []).map((m: any) => `<tr>
        <td class="k">${esc(m.material)}</td>
        <td>${esc(m.spec || '')}</td>
        <td>${esc(m.qty || '')} ${esc(m.unit || '')}</td>
        <td>${esc(m.supplier || 'supplier TBD')}</td></tr>`).join('')}
    </tbody></table>` : '';

  /** What the call sheet used to be, when there is actually something to call about. */
  const errands = unpriced.map((u: any, i: number) => `
    <p class="lead">${esc(u.item)} — <span class="warn">not priced</span></p>
    <p>${esc(u.why)}</p>
    ${u.first ? `<p class="first">Lead with: ${esc(u.first)}</p>` : ''}
    ${(u.ask || []).length ? `<div class="minor">Ask</div><ul>${(u.ask || []).map((a: string) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    ${(u.measure || []).length ? `<div class="minor">Measure first</div><ul>${(u.measure || []).map((a: string) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    ${i < unpriced.length - 1 ? '<div style="height:14px"></div>' : ''}`).join('');

  const openItems = (spec.open_items || []).map((o: any) =>
    `<tr><td class="k">${esc(o.item)}</td><td>${esc(o.impact)}</td></tr>`).join('');

  const assumptions = (spec.assumptions || []).map((a: any) =>
    `<tr><td class="k">${esc(a.what)}</td><td>${esc(a.why_it_matters)}</td></tr>`).join('');

  const gaps = (errands || openItems || assumptions) ? `
    ${sec('Before this is real')}
    ${errands}
    ${openItems ? `<div class="minor">Still open</div><table><tbody>${openItems}</tbody></table>` : ''}
    ${assumptions ? `<div class="minor">Where I guessed</div><table><tbody>${assumptions}</tbody></table>` : ''}` : '';

  const worthKnowing = findings.length ? `
    ${sec('Worth knowing')}
    <table><tbody>${findings.map((f: any) =>
      `<tr><td class="k">${esc(f.finding)}</td><td>${esc(f.implication)}</td></tr>`).join('')}</tbody></table>
    <p class="note">Your call, not mine.</p>` : '';

  // The tool's own arithmetic doubts, on the page he can mark up rather than
  // buried in an email he read on a phone and closed.
  const validation = flags.length ? `
    ${sec('Check these')}
    <ul>${flags.map(f => `<li class="warn">${esc(f)}</li>`).join('')}</ul>` : '';

  const taxNote = (spec.tax_lines || []).length
    ? `<p class="note">Tax: ${(spec.tax_lines || []).map((t: any) => `${esc(t.line)} — ${esc(t.cls)}`).join('; ')}.</p>`
    : (T.tax_note ? `<p class="note">${esc(T.tax_note)}</p>` : '');

  return page('Brief', `
    <div class="eyebrow">${esc(CO.name)}</div>
    <h1>${esc(spec.project_name || 'Estimate')}</h1>
    <div class="rule"></div>
    <p class="sub">${esc(spec.proposal_no || '')}${spec.date_issued ? ` · ${esc(spec.date_issued)}` : ''} · from your memo</p>

    ${sec('The call')}
    <p class="lead">${esc(X.headline || 'See the numbers below.')}</p>
    <div class="stats">
      <div class="stat"><div class="statv${T.total === null ? ' warn' : ''}">${T.total === null ? 'NOT PRICED' : money(T.total)}</div>
        <div class="statk">${T.total === null ? `waiting on ${unpriced.length} item${unpriced.length === 1 ? '' : 's'}` : 'project total'}</div></div>
      <div class="stat"><div class="statv">${money(T.subtotal_ex_access)}</div><div class="statk">masonry, unit-priced</div></div>
      ${spec.onsite_days ? `<div class="stat"><div class="statv">${esc(spec.onsite_days)}</div><div class="statk">days on site</div></div>` : ''}
    </div>
    ${X.reading ? `<p>${esc(X.reading)}</p>` : ''}
    ${X.gap ? `<p class="muted">${esc(X.gap)}</p>` : ''}
    ${X.recommendation ? `<p>${esc(X.recommendation)}</p>` : ''}

    ${sec('The lines')}
    <table><thead><tr><th style="width:26px">#</th><th>Line</th><th style="text-align:right;width:88px">Cost</th><th style="width:32%">Basis</th></tr></thead><tbody>
      ${lines}
      <tr class="strong"><td class="num"></td><td class="k">Masonry subtotal</td>
        <td class="r">${money(T.subtotal_ex_access)}</td><td class="basis">floor, not the price</td></tr>
    </tbody></table>
    ${scope.some((s: any) => s.contingent) ? '<p class="note">* Contingent — confirmed on site before it is billed.</p>' : ''}
    ${taxNote}
    ${materials}

    ${gaps}
    ${worthKnowing}
    ${validation}

    ${sec('Corrections')}
    <p class="note">Circle a line number and write the right figure. Quantity means I misheard you;
    rate means the card is drifting; a line added or crossed out means I mis-scoped it.
    Mark it up, email this page back, and I will log it.</p>
    ${'<div class="writein"></div>'.repeat(7)}

    <footer>${esc(CO.name)} · ${esc(CO.footer)}<br><em>${esc(CO.tagline)}</em></footer>
  `);
}
