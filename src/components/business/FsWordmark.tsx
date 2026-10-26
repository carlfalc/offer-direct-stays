/** Animated "findastay" wordmark — letters fire in and gently float (teal 'a'). */
export default function FsWordmark({ word = 'findastay' }: { word?: string }) {
  return (
    <div className="fo-mark fo-disp" aria-hidden="true">
      {word.split('').map((c, i) => (
        <span key={i} className={c === 'a' && i === 4 ? 'teal' : ''} style={{ animationDelay: `${(i * 0.07).toFixed(2)}s, ${(0.6 + i * 0.12).toFixed(2)}s` }}>{c}</span>
      ))}
    </div>
  );
}
