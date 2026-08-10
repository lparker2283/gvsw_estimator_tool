import { page, money, esc, CO } from './shared';

/** Client-facing, mirrors Dan's existing GVSW template sections 1-7. */
export function proposal(spec: any) {
  const T = spec.totals;
  const sec = (n: string, t: string) => `<div class="sec"><div class="n">${n}</div><h2>${esc(t)}</h2></div>`;
  const rows = (arr: any[], cells: (x: any, i: number) => string) => (arr || []).map(cells).join('');

  return page('Project proposal', `
    <table style="margin:0 0 6px"><tr>
      <td style="border:none;padding:0;width:40%;font-size:8.5pt;color:#807b72">
        ${esc(CO.city)}<br>${esc(CO.phone)}<br>${esc(CO.email)}<br>${esc(CO.web)}</td>
      <td style="border:none;padding:0;text-align:center">
        <div style="font-size:16pt;font-weight:700;letter-spacing:.06em">PROJECT PROPOSAL</div>
        <div style="font-size:9pt;color:#3f4a3c;letter-spacing:.08em">${esc(CO.name)}</div></td>
      <td style="border:none;padding:0;width:28%;font-size:8.5pt;text-align:right">
        <b>${esc(spec.proposal_no || '')}</b><br>${esc(spec.date_issued || '')}<br>Prepared by Dan Quinn</td>
    </tr></table>
    <div class="rule"></div>

    ${sec('1', 'Project overview')}
    ${(spec.overview || '').split('\n\n').map((p: string) => `<p>${esc(p)}</p>`).join('')}

    ${sec('2', 'Scope of work')}
    <table><thead><tr><th>#</th><th>Task / item</th><th>Description</th><th>Unit</th><th style="text-align:right">Est. cost</th></tr></thead><tbody>
    ${rows(spec.scope, (s, i) => `<tr><td>${i + 1}</td><td class="k">${esc(s.task)}</td><td>${esc(s.description)}</td>
      <td>${esc(s.unit)}</td><td class="r${s.cost === null ? ' warn' : ''}">${money(s.cost)}${s.contingent && s.cost !== null ? ' *' : ''}</td></tr>`)}
    </tbody></table>
    ${(spec.scope || []).some((s: any) => s.contingent) ? '<p class="note">* Contingent line — confirmed at the site visit before any work begins. If it changes, it changes in writing before you are billed for it.</p>' : ''}

    ${sec('3', 'Proposed materials')}
    <table><thead><tr><th>Material</th><th>Spec / grade</th><th>Supplier</th><th>Qty</th><th style="text-align:right">Est. cost</th></tr></thead><tbody>
    ${rows(spec.materials, m => `<tr><td class="k">${esc(m.material)}</td><td>${esc(m.spec)}</td>
      <td>${esc(m.supplier || 'TBD')}</td><td>${esc(m.qty)} ${esc(m.unit || '')}</td><td class="r">${money(m.cost)}</td></tr>`)}
    </tbody></table>

    ${sec('4', 'Timeline & milestones')}
    <table><thead><tr><th>#</th><th>Phase</th><th>Target</th><th>Duration</th><th>Notes</th></tr></thead><tbody>
    ${rows(spec.timeline, (t, i) => `<tr><td>${i + 1}</td><td class="k">${esc(t.phase)}</td><td>${esc(t.target)}</td>
      <td>${esc(t.duration)}</td><td>${esc(t.notes || '')}</td></tr>`)}
    </tbody></table>

    ${sec('5', 'Pricing')}
    <table><tbody>
      <tr><td style="text-align:right">Labour</td><td class="r">${money(T?.labor)}</td></tr>
      <tr><td style="text-align:right">Materials</td><td class="r">${money(T?.materials)}</td></tr>
      <tr><td style="text-align:right">Equipment / access</td><td class="r warn">${money(T?.equipment)}</td></tr>
      <tr><td style="text-align:right">Tax</td><td class="r">${T?.tax_rate_pct ? money(T.tax) : '—'}</td></tr>
      <tr class="strong"><td style="text-align:right"><b>TOTAL PROJECT COST</b></td><td class="r${T?.total === null ? ' warn' : ''}">${money(T?.total)}</td></tr>
    </tbody></table>
    <p class="note">${esc(T?.tax_note || '')}</p>

    ${sec('6', 'Exclusions')}
    <p>This proposal does not include:</p>
    <ul>${(spec.exclusions || []).map((x: string) => `<li>${esc(x)}</li>`).join('')}</ul>

    ${sec('7', 'Terms & conditions')}
    ${[['Proposal validity','This proposal is valid for 30 days from the date issued. Prices are subject to change after expiration due to material cost fluctuations.'],
       ['Change orders','Any work beyond the agreed scope must be approved in writing via a signed change order before work proceeds.'],
       ['Weather & conditions','Masonry cannot be performed in freezing temperatures or heavy precipitation. Weather delays are not the responsibility of Genesee Valley Stone Works.'],
       ['Unforeseen conditions','If conditions are discovered that differ materially from expectations, the client will be notified before proceeding. Additional costs approved via change order.'],
       ['Materials','All materials remain the property of Genesee Valley Stone Works until final payment is received in full.'],
       ['Warranty','Labour and workmanship warranted for ________ from completion. Material warranties per manufacturer.'],
       ['Late payment','Balances unpaid after 30 days subject to a 1.5% monthly finance charge.'],
       ['Insurance','Genesee Valley Stone Works carries general liability insurance. Certificates available upon request.'],
      ].map(([h, b]) => `<p><b>${h}:</b> ${b}</p>`).join('')}

    <table style="margin-top:26px"><tr>
      <td style="border:none;width:50%;padding-right:24px">
        <div class="eyebrow">Genesee Valley Stone Works</div>
        <div class="writein"></div><p class="note">Signature / date</p></td>
      <td style="border:none;width:50%;padding-left:24px">
        <div class="eyebrow">Client acceptance</div>
        <div class="writein"></div><p class="note">Signature / date</p></td>
    </tr></table>

    <footer>${esc(CO.name)} · ${esc(CO.footer)}<br><em>${esc(CO.tagline)}</em></footer>
  `);
}
