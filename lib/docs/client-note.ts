import { page, money, esc, CO } from './shared';

export function clientNote(spec: any) {
  const T = spec.totals;
  return page('Where things stand', `
    <div class="eyebrow">${esc(CO.name)}</div>
    <h1>Where things stand</h1>
    <div class="rule"></div><div style="height:14px"></div>
    ${(spec.client_note || []).map((p: string) => `<p style="font-size:12pt">${esc(p)}</p>`).join('')}

    <div class="sec"><div class="n">$</div><h2>Where the price stands</h2></div>
    <table><tbody>
      <tr><td>Masonry work — labour and materials</td><td class="r">${money(T?.subtotal_ex_access)}</td></tr>
      <tr><td class="k">Access equipment</td><td class="r warn">Being quoted</td></tr>
      <tr class="strong"><td class="k">Project total</td><td class="r warn">To follow</td></tr>
    </tbody></table>
    <p class="note">${esc(T?.tax_note || '')}</p>

    <div class="sec"><div class="n">→</div><h2>What happens next</h2></div>
    <p><b>1.</b> I come back out to measure — about an hour, no charge.</p>
    <p><b>2.</b> I get the access equipment quoted against those measurements.</p>
    <p><b>3.</b> You get a revised proposal with a firm total. Nothing is scheduled before you approve it.</p>

    <footer>${esc(CO.name)} · ${esc(CO.phone)} · ${esc(CO.email)}<br><em>${esc(CO.tagline)}</em></footer>
  `);
}
