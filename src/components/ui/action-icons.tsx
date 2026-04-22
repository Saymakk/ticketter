/** Иконки «Изменить» / «Удалить» для кнопок-действий. */

export function EditActionIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

/** Рисунок из `/public/delete-svg-icon.svg` (красная заливка в файле). */
export function DeleteActionIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- статичная svg из public */}
      <img
        src="/delete-svg-icon.svg"
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}

export function CopyLinkActionIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H9.375A3.375 3.375 0 0 0 6 9.375v8.25A3.375 3.375 0 0 0 9.375 21h8.25A3.375 3.375 0 0 0 21 17.625V13.5m-7.5-7.5h4.125A3.375 3.375 0 0 1 21 9.375V13.5M13.5 6v3.75A3.75 3.75 0 0 0 17.25 13.5H21"
      />
    </svg>
  );
}

export function DownloadActionIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 15.5v2A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-2" />
    </svg>
  );
}

export function QrActionIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 14h2m4 0h-2m-2 2v4m4-2h-4" />
    </svg>
  );
}
