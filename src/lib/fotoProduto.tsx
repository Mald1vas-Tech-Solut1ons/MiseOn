import { useEffect, useRef, useState } from 'react';

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
 * `prazoMs`, entra a foto curada. Vale para qualquer URL externa, nao so para o
 * placeholder de hoje — foto propria hospedada em servidor lento cai na mesma
 * armadilha.
 */
export function FotoProduto({
  src, fallback, alt, className, prazoMs = 2500,
}: { src: string; fallback: string; alt: string; className?: string; prazoMs?: number }) {
  const [atual, setAtual] = useState(src);
  const carregou = useRef(false);

  useEffect(() => {
    setAtual(src);
    carregou.current = false;
    if (!src || src === fallback) return;
    const t = window.setTimeout(() => {
      if (!carregou.current) setAtual(fallback);
    }, prazoMs);
    return () => window.clearTimeout(t);
  }, [src, fallback, prazoMs]);

  return (
    <img
      src={atual}
      alt={alt}
      className={className}
      onLoad={() => { carregou.current = true; }}
      onError={() => { carregou.current = true; setAtual(fallback); }}
    />
  );
}

export default FotoProduto;
