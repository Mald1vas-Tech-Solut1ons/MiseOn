// Ícones de bandeira/pagamento em SVG local — nunca dependem de CDN externo
// (hotlink da Wikipedia/afins quebra em produção e deixa "bandeiras bugadas").
export function BandeiraMark({ id, className = 'h-6 w-auto' }: { id: string; className?: string }) {
  const p = { viewBox: '0 0 40 26', className, role: 'img', 'aria-label': id } as const;
  switch (id) {
    case 'visa':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#fff" stroke="#E6E8EF" />
          <text x="20" y="17.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#1A1F71">VISA</text>
        </svg>
      );
    case 'mastercard':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#fff" stroke="#E6E8EF" />
          <circle cx="16.5" cy="13" r="7.5" fill="#EB001B" />
          <circle cx="23.5" cy="13" r="7.5" fill="#F79E1B" fillOpacity="0.9" />
        </svg>
      );
    case 'amex':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#1F72CF" />
          <text x="20" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="7.5" fill="#fff">AMEX</text>
        </svg>
      );
    case 'elo':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#000" />
          <text x="20" y="17.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#fff">elo</text>
        </svg>
      );
    case 'hipercard':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#822124" />
          <text x="20" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="6" fill="#fff">Hipercard</text>
        </svg>
      );
    case 'diners':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#0079BE" />
          <text x="20" y="16.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="6.5" fill="#fff">Diners</text>
        </svg>
      );
    case 'discover':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#fff" stroke="#E6E8EF" />
          <circle cx="31" cy="17" r="6" fill="#F79E1B" />
          <text x="16" y="16.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="6" fill="#111">Discover</text>
        </svg>
      );
    case 'pix':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#fff" stroke="#E6E8EF" />
          <g transform="translate(20 13)">
            <path d="M-6.2 0 L-1.6 -4.6 a2.2 2.2 0 0 1 3.2 0 L6.2 0 L1.6 4.6 a2.2 2.2 0 0 1 -3.2 0 Z" fill="none" stroke="#32BCAD" strokeWidth="2" strokeLinejoin="round" />
          </g>
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#E5E7EB" />
        </svg>
      );
  }
}

export default BandeiraMark;
