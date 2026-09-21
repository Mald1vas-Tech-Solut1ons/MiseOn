export default function MiseOnLogo({ size = 160, className = '' }: { size?: number, className?: string }) {
  // O arquivo oficial possui transparência ao redor da arte. O recorte abaixo
  // remove somente essa área vazia por CSS; nenhum traço, cor ou lettering da
  // marca é redesenhado.
  const scale = size / 459;

  return (
    <span
      role="img"
      aria-label="MiseOn — Sistema de Gestão para Food Service e Restaurantes"
      className={`relative inline-block shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        maxWidth: '100%',
        height: 170 * scale,
      }}
    >
      <img
        src="/MiseOn-repagina-removebg-preview.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          width: 823 * scale,
          height: 303 * scale,
          left: -185 * scale,
          top: -51 * scale,
        }}
      />
    </span>
  );
}
