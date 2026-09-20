export default function MiseOnLogo({ size = 160, className = '' }: { size?: number, className?: string }) {
  return (
    <span
      role="img"
      aria-label="MiseOn — Sistema de Gestão para Food Service e Restaurantes"
      className={`inline-flex items-center gap-[0.04em] ${className}`}
      style={{ width: size, maxWidth: '100%' }}
    >
      <img
        src="/brand/icon.png"
        alt=""
        aria-hidden="true"
        className="h-auto w-[34%] shrink-0 object-contain"
      />
      <span
        aria-hidden="true"
        className="whitespace-nowrap font-['Sora'] font-extrabold leading-none tracking-[-0.075em] text-[#EAF1FB] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
        style={{ fontSize: `${size * 0.265}px` }}
      >
        Mise<span className="ml-[0.08em] text-[#FC5B24]">ON</span>
      </span>
    </span>
  );
}
