const FAQ_ITEMS = [
  {
    q: 'What is Dots?',
    a: 'Dots is an open edition of generative tokens. Every mint is an 8\u00d710 grid of 80 coloured MegaETH logomarks at a unique seed.',
  },
  {
    q: 'How does merging work?',
    a: 'Merge two dots of the same level to burn one and halve the dots on the other. The ladder runs 80 \u2192 40 \u2192 20 \u2192 10 \u2192 5 \u2192 4 \u2192 1.',
  },
  {
    q: 'Where is the art stored?',
    a: 'Fully onchain. tokenURI returns a base64-encoded JSON document containing a base64-encoded SVG. No IPFS, no HTTP, no mutable metadata. The contract renders the full image on demand for every view call.',
  },
  {
    q: 'Do colors change when I merge?',
    a: 'The seed stays stable. Colours are derived from the seed plus the merges history, so a merged dot inherits traces of every ancestor. The palette itself is 80 hand-picked hex values sorted as a smooth pink-through-purple gradient.',
  },
  {
    q: 'What is the Mega Dot?',
    a: 'The terminal state at level 7. Reached only by burning 64 single dots in one call via infinity(). Rendered as a single white MegaETH logomark on a black disc, on a white canvas \u2014 the one inverted state in the collection.',
  },
  {
    q: 'What gas does merge cost?',
    a: 'A single merge runs around 120k gas \u2014 two storage reads, one storage write, one burn. A full 80 \u2192 1 ladder across 63 merges is well within a single testnet transaction budget.',
  },
];

export function FaqPage() {
  return (
    <section id="faq" className="is-page">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">04 &mdash; FAQ</span>
          <h2>Questions you probably have.</h2>
        </div>
        <div className="items">
          {FAQ_ITEMS.map(({ q, a }) => (
            <div className="item" key={q}>
              <div className="q">{q}</div>
              <div className="a">{a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
