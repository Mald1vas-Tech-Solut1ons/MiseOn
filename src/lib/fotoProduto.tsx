import { useContext, useEffect, useRef, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { obterFotoFallback } from './fotoProdutoUtils';
import { FotoIlustrativaContext } from './fotoIlustrativaContext';

/**
 * Foto de produto com prazo para carregar.
 *
 * `onError` so dispara quando o servidor RESPONDE com falha. Se a URL externa
 * simplesmente nao responde — foi o caso medido em 03/09, com 6 produtos
 * apontando para loremflickr.com, que deu TIMEOUT — nenhum evento acontece: a
 * imagem fica pendurada para sempre e o cardapio exibe um retangulo preto no
 * lugar do prato. Numa vitrine, isso e venda perdida.
 *
 * Entao alem do onError existe um prazo: se a foto do lojista nao aparecer em
 * `prazoMs`, entra o substituto — foto ilustrativa na loja de demonstração,
 * espaço reservado neutro na loja real.
 */
export function FotoProduto({
  src, nome, alt, className, prazoMs = 2500,
}: { src: string; nome: string; alt: string; className?: string; prazoMs?: number }) {
  const ilustrativaPermitida = useContext(FotoIlustrativaContext);
  const substituta = ilustrativaPermitida ? obterFotoFallback(nome) : '';
  const inicial = src || substituta;

  const [atual, setAtual] = useState(inicial);
  const carregou = useRef(false);

  useEffect(() => {
    setAtual(inicial);
    carregou.current = false;
    if (!inicial || inicial === substituta) return;
    const t = window.setTimeout(() => {
      if (!carregou.current) setAtual(substituta);
    }, prazoMs);
    return () => window.clearTimeout(t);
  }, [inicial, substituta, prazoMs]);

  if (!atual) return <SemFoto nome={nome} className={className} />;

  return (
    <img
      src={atual}
      alt={alt}
      className={className}
      onLoad={() => { carregou.current = true; }}
      onError={() => { carregou.current = true; setAtual(substituta); }}
    />
  );
}

/** Espaço reservado honesto: cor da loja, ícone e a inicial do produto. */
function SemFoto({ nome, className }: { nome: string; className?: string }) {
  const inicial = (nome || '').trim().charAt(0).toUpperCase();
  return (
    <div
      role="img"
      aria-label={nome}
      data-sem-foto="true"
      className={`${className ?? ''} relative flex items-center justify-center overflow-hidden`}
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--cor-primaria, #FC5B24) 22%, transparent), color-mix(in srgb, var(--cor-primaria, #FC5B24) 6%, transparent))',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute select-none font-black leading-none opacity-[0.12]"
        style={{ fontSize: '5rem', color: 'var(--cor-primaria, #FC5B24)' }}
      >
        {inicial}
      </span>
      <UtensilsCrossed aria-hidden="true" size={30} style={{ color: 'var(--cor-primaria, #FC5B24)', opacity: 0.55 }} />
    </div>
  );
}

export default FotoProduto;
