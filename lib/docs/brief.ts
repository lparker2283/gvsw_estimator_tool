import { page, esc, CO } from './shared';
import { highlights, daySpan, dollars, effectiveRateLine, ROWS, type Highlights } from '../highlights';

/**
 * The document. Two pages, internal, and not a proposal.
 *
 * Dan writes the proposal himself, later, and better. This gets him from a voice
 * memo to being able to quote with a straight face, and nothing else earns space.
 *
 * It was four pages. Not from wordiness — from printing the same six facts three
 * times. A crown nobody had inspected appeared as a blocker ("Crown condition —
 * repair or rebuild"), as a swing factor ("crown repair vs rebuild") and as an
 * assumption ("cracked but not structurally failed"), in three sections a page
 * apart, so the question never sat beside the thing that would settle it.
 * Twenty-one bullets carrying six facts.
 *
 * They are one thing, and section 2 is now that thing: the question, what was
 * assumed, and what the answer moves. One row per unknown.
 *
 * Also gone: a cross-check of two pricing methods and a plain-words scope
 * sentence, both generated on every job and rendered on none; a materials list,
 * which is how to do the work rather than how to price it; a nine-row tax table
 * behind a one-line instruction; and a findings section that repeated the open
 * questions a third time. The scope sentence came back — it is the only prose
 * description of the job on the page now.
 *
 * The line numbers are load-bearing. They are what a circled mark and a
 * scribbled figure attach to when the page comes back.
 */
export function brief(spec: any, _extraction: any) {
  const H = highlights(spec);
  const scope: any[] = spec.scope || [];

  const present = [
    'Recommended range',
    H.openQuestions.length && "What's still open",
    H.nextSteps.length && 'Next steps',
    scope.length && 'Scope of work',
    H.objections.length && 'If they push back',
  ].filter(Boolean) as string[];

  const sec = (t: string) =>
    `<div class="sec"><div class="n">${present.indexOf(t) + 1}</div><h2>${esc(t)}</h2></div>`;
  const has = (t: string) => present.includes(t);

  return page('Brief', `
    <div class="eyebrow">${esc(CO.name)}</div>
    <h1>${esc(H.projectName)}</h1>
    <div class="rule"></div>
    <p class="sub">${esc(H.proposalNo)}${H.dateIssued ? ` · ${esc(H.dateIssued)}` : ''} · from your memo · not a proposal</p>

    ${sec('Recommended range')}
    <p class="lead">${esc(H.model?.recommendation || 'See the range below.')}${
      H.duration ? ` · ${esc(daySpan(H.duration))} on site` : ''}</p>
    ${H.model?.why ? `<p>${esc(H.model.why)}</p>` : ''}
    ${H.range ? rangeTable(H) : ''}
    ${H.range?.equipment_note ? `<p class="note">${esc(H.range.equipment_note)}</p>` : ''}
    ${H.effectiveRate ? `<p class="rate">${esc(effectiveRateLine(H.effectiveRate))}</p>` : ''}
    ${H.validity ? `<p class="note">${esc(H.validity)}</p>` : ''}

    ${has("What's still open") ? `
      ${sec("What's still open")}
      <table><thead><tr>
        <th style="width:30%">Question</th><th style="width:34%">What I assumed</th><th>What the answer moves</th>
      </tr></thead><tbody>
        ${H.openQuestions.map(q => `
          <tr>
            <td class="k">${esc(q.question)}${q.critical ? ' <span class="crit">Critical</span>' : ''}</td>
            <td>${esc(q.assumed)}</td>
            <td>${esc(q.swing)}</td>
          </tr>`).join('')}
      </tbody></table>` : ''}

    ${has('Next steps') ? `
      ${sec('Next steps')}
      <ol>${H.nextSteps.map(n => `<li>${esc(n)}</li>`).join('')}</ol>` : ''}

    ${has('Scope of work') ? `
      ${sec('Scope of work')}
      <table><tbody>
        ${scope.map((s: any, i: number) => {
          /**
           * Two states earn a word, and only two. A line with no figure at
           * either end is not quoted yet — the access rental. A line that sits
           * in the high column but not the low is a genuine maybe — a crown
           * rebuild that happens only if the crown proves shot. Everything else
           * is the job: it happens, and the range already carries the spread in
           * its quantity, so it needs no tag. `contingent` in the data means
           * "amount confirmed on site", not "optional" — mapping it to "if
           * needed" mislabelled the repoint, which is the whole point of the job.
           */
          const tag = s.low == null && s.high == null ? 'not yet quoted'
                    : s.low == null && s.high != null ? 'if needed'
                    : '';
          return `
          <tr>
            <td class="num">${i + 1}</td>
            <td class="k">${esc(s.task)}<div class="sub-line">${esc(s.description)}</div></td>
            <td class="r tag">${tag ? esc(tag) : ''}</td>
          </tr>`; }).join('')}
      </tbody></table>
      ${H.taxAction ? `<p class="first">${esc(H.taxAction)}</p>` : ''}
      ${H.scopeSentence ? `<p class="summary">“${esc(H.scopeSentence)}”</p>` : ''}` : ''}

    ${has('If they push back') ? `
      ${sec('If they push back')}
      ${H.objections.map(o => `
        <p class="lead">“${esc(o.objection)}”</p>
        <p>${esc(o.response)}</p>`).join('')}` : ''}

    <!--
      How to correct this doc is an instruction about the page, not a section of
      the estimate, and giving it a numbered band pushed it onto a third sheet
      of its own. It closes the document instead.
    -->
    <div class="correct">
      <div class="minor">How to correct this doc</div>
      <p class="note">Circle a line number and write the right figure. Quantity means I misheard you;
      rate means the card is drifting; a line added or crossed out means I mis-scoped it.
      Mark it up, email this page back, and I will log it.</p>
    </div>

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
