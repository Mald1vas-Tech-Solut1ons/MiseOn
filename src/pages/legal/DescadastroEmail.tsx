import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MailX, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

import { useI18n } from '../../contexts/I18nContext';
/**
 * Descadastro de e-mails promocionais, sem login.
 *
 * O link do rodapé carrega só um token opaco — nunca o e-mail em si —
 * para que a URL não vaze o endereço de ninguém em logs, histórico de
 * navegador ou referer. O token é resolvido no banco por
 * fn_email_descadastrar, que é SECURITY DEFINER.
 *
 * Vale só para marketing: avisos do próprio pedido continuam saindo,
 * porque o cliente precisa saber que o pagamento foi aprovado.
 */
type Estado = 'processando' | 'ok' | 'invalido' | 'erro';

export default function DescadastroEmail() {
  const { tDynamic } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('t');
  const [estado, setEstado] = useState<Estado>('processando');

  useEffect(() => {
    (async () => {
      if (!token) return setEstado('invalido');
      const { data, error } = await supabase.rpc('fn_email_descadastrar', { p_token: token });
      if (error) return setEstado('erro');
      setEstado(data === true ? 'ok' : 'invalido');
    })();
  }, [token]);

  const conteudo = {
    processando: {
      icone: <Loader2 size={44} className="mx-auto mb-4 animate-spin opacity-90" />,
      titulo: 'Processando…',
      texto: 'Só um instante enquanto atualizamos sua preferência.',
    },
    ok: {
      icone: <CheckCircle2 size={44} className="mx-auto mb-4 opacity-90" />,
      titulo: 'Pronto, descadastrado',
      texto: 'Você não vai mais receber ofertas e promoções desta loja. Avisos sobre pedidos que você fizer continuam chegando — são eles que confirmam pagamento e entrega.',
    },
    invalido: {
      icone: <AlertTriangle size={44} className="mx-auto mb-4 opacity-90" />,
      titulo: 'Link inválido ou já utilizado',
      texto: 'Este link de descadastro não é mais válido. Se você continuar recebendo ofertas, use o link do rodapé do e-mail mais recente.',
    },
    erro: {
      icone: <AlertTriangle size={44} className="mx-auto mb-4 opacity-90" />,
      titulo: 'Não conseguimos concluir agora',
      texto: 'Houve uma falha de comunicação. Tente novamente em alguns minutos pelo link do rodapé do e-mail.',
    },
  }[estado];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070C18] dark:text-[#EAF1FB] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-[var(--cor-secundaria)] px-8 py-10 text-white text-center">
          <MailX size={48} className="mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl font-extrabold font-sora">{tDynamic('Preferências de e-mail')}</h1>
        </div>

        <div className="p-8 sm:p-12 text-center text-gray-600 dark:text-gray-300">
          <div className="text-[var(--cor-secundaria)] dark:text-[#6B9EFF]">{conteudo.icone}</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sora mb-3">{conteudo.titulo}</h2>
          <p className="leading-relaxed">{conteudo.texto}</p>

          <a href="/" className="mt-8 inline-block rounded-xl bg-[var(--cor-primaria)] px-6 py-3 text-sm font-bold text-white">
            {tDynamic('Voltar ao início')}
          </a>
        </div>
      </div>
    </div>
  );
}
