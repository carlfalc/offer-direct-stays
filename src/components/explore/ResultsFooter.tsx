import { Link } from 'react-router-dom';

const COLS: { h: string; links: { label: string; to?: string }[] }[] = [
  { h: 'Company', links: [{ label: 'About us' }, { label: 'How it works' }, { label: 'Careers' }, { label: 'Press' }] },
  { h: 'For hosts', links: [{ label: 'List your property', to: '/business/onboarding' }, { label: 'Business dashboard', to: '/business/dashboard' }, { label: 'Pricing & fees', to: '/business/pricing' }, { label: 'Host help' }] },
  { h: 'Support', links: [{ label: 'Help centre' }, { label: 'Contact us' }, { label: 'Trust & safety' }, { label: 'Terms & privacy' }] },
];

export default function ResultsFooter() {
  return (
    <footer className="bg-[#0C1A22] text-[#cdd7dc]">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-6 py-9 md:grid-cols-4">
          <div>
            <div className="font-display text-xl font-extrabold text-white">find<span className="text-primary">a</span>stay</div>
            <p className="mt-2 max-w-[34ch] text-sm text-[#cdd7dc]">
              Name your price on stays across New Zealand &amp; Australia. Direct to the owner, flat fee, no commission.
            </p>
          </div>
          {COLS.map((col) => (
            <div key={col.h}>
              <h5 className="mb-2.5 font-mono text-[0.8rem] font-bold uppercase tracking-[0.12em] text-white">{col.h}</h5>
              <ul className="flex flex-col gap-2 text-[0.86rem]">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} className="text-[#cdd7dc] transition hover:text-white">{l.label}</Link>
                    ) : (
                      <span className="cursor-pointer text-[#cdd7dc] transition hover:text-white">{l.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 py-4 text-[0.78rem] text-[#8ea2aa]">
          <span>© {new Date().getFullYear()} findastay · Worldwide</span>
          <span>NZ &amp; AU</span>
        </div>
      </div>
    </footer>
  );
}
