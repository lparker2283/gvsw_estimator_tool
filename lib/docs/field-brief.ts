import { page, money, esc, CO } from './shared';

/** The short one. Four sections, room to write, sized for a reMarkable. */
export function fieldBrief(spec: any) {
  const X = spec.cross_check, T = spec.totals;
  const sec = (n: string, t: string) => `<div class="sec"><div class="n">${n}</div><h2>${esc(t)}</h2></div>`;

  const lines = (spec.scope || []).map((s: any) => `
    <tr${s.cost === null ? ' class="strong"' : ''}>
      <td class="k${s.cost === null ? ' warn' : ''}">${esc(s.task)}</td>
      <td class="r${s.cost === null ? ' warn' : ''}">${money(s.cost)}</td>
      <td>${esc(s.description)}${s.contingency_note ? ` <span class="muted">(${esc(s.contingency_note)})</span>` : ''}</td>
    </tr>`).join('');

  const assumptions = (spec.assumptions || []).map((a: any) =>
    `<tr><td class="k">${esc(a.what)}</td><td>${esc(a.why_it_matters)}</td></tr>`).join('');

  return page('Field brief', `
    <div class="eyebrow">${esc(CO.name)} · Field brief</div>
    <h1>${esc(spec.project_name || 'Estimate')}</h1>
    <div class="rule"></div>
    <p class="sub">${esc(spec.proposal_no || '')} · from your memo · nothing here is committed until you say so</p>

    ${sec('1', "How I'd price it")}
    <p class="lead">${esc(X?.recommendation_headline || 'Day rate. Not per square foot.')}</p>
    <p>${esc(X?.reading || '')}</p>
    <p>${esc(X?.gap || '')}</p>
    <p>${esc(X?.recommendation || '')}</p>

    ${sec('2', 'How long it takes')}
    <p class="lead">${spec.onsite_days || '—'} days on site, plus a site visit first and material lead time before that.</p>
    <p>${esc((spec.timeline || []).filter((t: any) => t.duration && t.duration !== '—')
        .map((t: any) => `${t.phase} — ${t.duration}`).join('. '))}.</p>
    <p class="warn"><em>Every duration here is my guess — nothing in your memo covered scheduling. Correct them first, because the lift bills by the day.</em></p>

    ${sec('3', 'The numbers')}
    <table><thead><tr><th>Line</th><th style="text-align:right">Cost</th><th>Why</th></tr></thead><tbody>
      ${lines}
      <tr class="strong"><td class="k">Masonry subtotal</td><td class="r">${money(T?.subtotal_ex_access)}</td><td>Unit-priced. Treat this as the floor, not the price.</td></tr>
      <tr class="strong"><td class="k warn">PROJECT TOTAL</td><td class="r warn">${money(T?.total)}</td><td>${esc(T?.total === null ? 'No total until the access is quoted. A total built on an invented rental figure is a number the client holds you to and you cannot honour.' : '')}</td></tr>
    </tbody></table>

    ${sec('4', 'Where I guessed')}
    <table><tbody>${assumptions}</tbody></table>
    <p class="note">One site visit usually closes all of these.</p>

    <div class="sec"><div class="n">✎</div><h2>What I'd change</h2></div>
    <p class="note">Mark it up and send it back. Quantity changed means I misheard you; rate changed means the card is drifting; line added or removed means I mis-scoped it. Different mistakes, different fixes.</p>
    ${'<div class="writein"></div>'.repeat(6)}

    <footer>${esc(CO.name)} · ${esc(CO.footer)}<br><em>${esc(CO.tagline)}</em></footer>
  `);
}
