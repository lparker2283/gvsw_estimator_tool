import { page, esc, CO } from './shared';

/** What the tool produces INSTEAD of an invented equipment price. */
export function callSheet(spec: any, extraction: any) {
  const refusals = (extraction?.refusals || []).map((r: any) =>
    `<tr><td class="k">${esc(r.item)}</td><td>${esc(r.reason)}</td></tr>`).join('');
  return page('Equipment call sheet', `
    <div class="eyebrow warn">Internal · action required before this job can be priced</div>
    <h1>Equipment call sheet</h1>
    <div class="rule"></div>
    <p class="sub">${esc(spec.proposal_no || '')} · the one number this estimate is waiting on</p>

    <p style="font-size:12pt">The tool did not price the access because you had not called a rental yard. Here is what to ask for so one call settles it.</p>

    <div class="sec"><div class="n">!</div><h2>Ask this first</h2></div>
    <p style="font-size:12pt">${esc(spec.call_sheet_priority || 'Ask for the WEEKLY rate before the day rate. At Rochester multiples a week often costs less than three days.')}</p>

    <div class="sec"><div class="n">1</div><h2>The machine</h2></div>
    <table><thead><tr><th>Ask for</th><th>Because</th></tr></thead><tbody>
      <tr><td class="k">Tracked / "spider" lift</td><td>A conventional self-propelled boom is too wide for a narrow path and heavy enough to crack landscaping. Tracked lifts exist for this — pedestrian-width chassis, low ground pressure, outriggers that level on uneven ground.</td></tr>
      <tr><td class="k">Working height with margin</td><td>Must clear the top with platform height to spare. Lift heights come in fixed steps; the wrong step is a wasted delivery.</td></tr>
      <tr><td class="k">Stowed chassis width, in inches</td><td>Get the number, not a category name.</td></tr>
      <tr><td class="k">Platform capacity + material rack</td><td>You go up alone with stone. Capacity has to cover you, tools and the unit — and somewhere to put it that is not your arms.</td></tr>
      <tr><td class="k">Ground bearing pressure</td><td>Decides whether matting is enough over unpaved ground.</td></tr>
    </tbody></table>

    <div class="sec"><div class="n">2</div><h2>The commercials</h2></div>
    <ul>
      <li>Weekly rate versus day rate — get both.</li>
      <li>Delivery and pickup, both ways, quoted separately. This is where these rentals surprise people.</li>
      <li>Who sites the machine, and whether unpaved ground affects their terms.</li>
      <li>Damage waiver — and specifically whether it covers the customer's property, not just the machine.</li>
      <li>Operator certification requirements for the class.</li>
    </ul>

    <div class="sec"><div class="n">3</div><h2>Measure before you call</h2></div>
    <p class="note">Without these the rental yard is guessing too.</p>
    <ul>
      <li>Path width at its narrowest point, in inches.</li>
      <li>Path length from where a truck can stand to the work.</li>
      <li>Height, measured rather than estimated.</li>
      <li>Face area in the work zone — this also firms up the masonry lines.</li>
      <li>Ground condition: firm, soft, sloped, and by how much.</li>
      <li>Turning space at the far end.</li>
    </ul>

    ${refusals ? `<div class="sec"><div class="n">?</div><h2>Everything else I would not guess</h2></div>
    <table><tbody>${refusals}</tbody></table>` : ''}

    <footer>${esc(CO.name)} · ${esc(CO.footer)}</footer>
  `);
}
