import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle2, Store, Percent, AlertCircle, Save } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

import { useI18n } from '../../contexts/I18nContext';
/** Resposta da checagem de prontidão da integração. */
interface DiagnosticoIfood {
  credenciaisConfiguradas: boolean;
  autenticacao?: 'ok' | 'falhou';
  lojasVisiveis?: number;
  lojas?: { id: string; nome: string }[];
  pronto?: boolean;
  detalhe?: string;
  error?: string;
}

/** Loja do iFood visível para o aplicativo, como a Edge Function devolve. */
interface MerchantDisponivel {
  id: string;
  nome: string;
  /** Nome da loja do MiseOn que já usa este merchant, quando houver. */
  jaVinculadaEm: string | null;
}

interface IfoodOnboardingProps {
  lojaId: string;
  form: any;
  setValor: (campo: any, valor: any) => void;
  onSuccess: () => void;
  /**
   * Salva as taxas. Opcional: em Configurações da Loja o componente vive dentro
   * de um formulário que ja tem botao global, e ali a dica de texto e o certo.
   * Na tela de Integração iFood nao havia botao perto do campo — passar o
   * handler faz o botao nascer colado nele.
   */
  onSalvarTaxas?: () => void;
  salvandoTaxas?: boolean;
}

export function IfoodOnboarding({ lojaId, form, setValor, onSuccess, onSalvarTaxas, salvandoTaxas }: IfoodOnboardingProps) {
  const { tDynamic } = useI18n();
  /**
   * Aplicativo centralizado não tem código para o lojista digitar.
   *
   * O MiseOn se autentica com a própria credencial e enxerga as lojas que o
   * iFood associou ao aplicativo; a vinculação é escolher qual delas é esta.
   * A tela anterior pedia um "User Code" que só existe em aplicativo
   * distribuído — o lojista procurava no portal um campo que não está lá.
   */
  const [lojas, setLojas] = useState<MerchantDisponivel[] | null>(null);
  const [escolhida, setEscolhida] = useState('');
  const [processando, setProcessando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const toast = useToast();

  /**
   * Checagem de prontidão da integração.
   *
   * Existe para ser rodada ANTES de ir ao cliente. Ela separa as três causas
   * que se parecem na tela e têm soluções completamente diferentes: credencial
   * não configurada no servidor (problema nosso, resolve em minutos),
   * credencial recusada pelo iFood (aplicativo desativado ou secret trocado) e
   * aplicativo sem nenhuma loja associada (resolve com o gerente de conta do
   * iFood, e pode levar dias). Descobrir qual delas é na frente do lojista é o
   * pior momento possível.
   */
  const [diagnostico, setDiagnostico] = useState<DiagnosticoIfood | null>(null);
  const [diagnosticando, setDiagnosticando] = useState(false);

  const rodarDiagnostico = async () => {
    setDiagnosticando(true);
    setDiagnostico(null);
    try {
      const { data, error } = await supabase.functions.invoke('ifood-auth', {
        body: { lojaId, acao: 'diagnostico' },
      });
      if (error) throw new Error(error.message);
      setDiagnostico(data as DiagnosticoIfood);
    } catch (e: any) {
      setDiagnostico({ credenciaisConfiguradas: false, pronto: false, detalhe: e.message });
    } finally {
      setDiagnosticando(false);
    }
  };

  const buscarLojas = async () => {
    setBuscando(true);
    setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('ifood-auth', {
        body: { lojaId, acao: 'listar' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const encontradas: MerchantDisponivel[] = data?.merchants ?? [];
      setLojas(encontradas);
      // Uma loja só: já deixa escolhida. É o caso comum, e poupar um clique
      // aqui é poupar um passo na frente do cliente.
      const livres = encontradas.filter((m) => !m.jaVinculadaEm);
      if (livres.length === 1) setEscolhida(livres[0].id);
    } catch (e: any) {
      setErro(e.message || 'Não consegui falar com o iFood agora.');
      setLojas([]);
    } finally {
      setBuscando(false);
    }
  };

  const ifoodMerchantId = form.ifood_merchant_id;
  
  const vincular = async () => {
    if (!escolhida) {
      setErro('Escolha a loja do iFood que corresponde a este cadastro.');
      return;
    }
    setProcessando(true);
    setErro('');

    try {
      const { data, error } = await supabase.functions.invoke('ifood-auth', {
        body: { lojaId, acao: 'vincular', merchantId: escolhida },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast('iFood vinculado com sucesso!', 'sucesso');
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setErro(e.message || 'Falha ao vincular com o iFood. Verifique o código.');
    } finally {
      setProcessando(false);
    }
  };

  const desvincular = async () => {
    if (!confirm('Tem certeza que deseja desvincular o iFood? Você deixará de receber pedidos novos.')) return;
    setProcessando(true);
    try {
      const { error } = await supabase.from('lojas').update({
        ifood_merchant_id: null,
        ifood_authorization_code: null,
        ifood_refresh_token: null
      }).eq('id', lojaId);
      if (error) throw error;
      toast('iFood desvinculado.', 'info');
      onSuccess();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-gray-100">{tDynamic('Integração iFood')}</h2>
          <p className="mt-1 text-sm text-gray-500">{tDynamic('Receba pedidos do iFood direto no PDV.')}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-900/20">
          <Store size={24} />
        </div>
      </div>

      {/*
        Checagem de prontidão. Fica fora do fluxo de vinculação de propósito:
        serve tanto para preparar a visita quanto para diagnosticar depois, com
        a loja já conectada.
      */}
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
            {tDynamic('Conferir se a integração está pronta')}
          </p>
          <button
            onClick={rodarDiagnostico}
            disabled={diagnosticando}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {diagnosticando ? <Loader2 size={13} className="animate-spin" /> : <AlertCircle size={13} />}
            {diagnosticando ? tDynamic('Verificando...') : tDynamic('Testar conexão')}
          </button>
        </div>

        {diagnostico && (
          <div className="mt-3 space-y-1.5 text-[11px]">
            <p className={diagnostico.credenciaisConfiguradas ? 'text-emerald-600 dark:text-emerald-400' : 'font-bold text-red-600 dark:text-red-400'}>
              {diagnostico.credenciaisConfiguradas ? '✓' : '✕'} {tDynamic('Credenciais do aplicativo no servidor')}
            </p>
            {diagnostico.credenciaisConfiguradas && (
              <p className={diagnostico.autenticacao === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'font-bold text-red-600 dark:text-red-400'}>
                {diagnostico.autenticacao === 'ok' ? '✓' : '✕'} {tDynamic('Autenticação no iFood')}
              </p>
            )}
            {diagnostico.autenticacao === 'ok' && (
              <p className={diagnostico.lojasVisiveis ? 'text-emerald-600 dark:text-emerald-400' : 'font-bold text-amber-600 dark:text-amber-400'}>
                {diagnostico.lojasVisiveis ? '✓' : '!'} {diagnostico.lojasVisiveis ?? 0}{' '}
                {tDynamic('loja(s) visível(is) para o aplicativo')}
              </p>
            )}
            {diagnostico.detalhe && (
              <p className="rounded-lg bg-red-50 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {diagnostico.detalhe}
              </p>
            )}
          </div>
        )}
      </div>

      {ifoodMerchantId ? (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-emerald-500/20 bg-emerald-50 p-6 text-center dark:bg-emerald-900/10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="mt-3 text-lg font-black text-emerald-800 dark:text-emerald-400">Conta Vinculada!</h3>
            <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-500">
              ID: <span className="font-mono text-emerald-900 dark:text-emerald-300">{ifoodMerchantId}</span>
            </p>
            
            <button onClick={desvincular} disabled={processando} className="mt-4 rounded-xl border-2 border-red-200 px-4 py-2 text-xs font-bold text-red-500 transition hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20">
              Desvincular Conta
            </button>
          </div>
          
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h4 className="mb-4 flex items-center gap-2 font-bold text-gray-800 dark:text-gray-100">
              <Percent size={18} className="text-red-500" />
              {tDynamic('Gestão de Margem e Taxas')}
            </h4>
            <div className="mb-4 rounded-xl bg-amber-50 p-4 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30">
              <p className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-500 mb-1">
                <AlertCircle size={14} /> {tDynamic('Importante: Markup de Cardápio')}
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Ao configurar a sua taxa de contrato abaixo, o MiseOn aplicará automaticamente este Markup aos itens do cardápio vinculados ao iFood. Assim, garantimos sua margem real, evitando prejuízos por divergência de preços no app.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Taxa Percentual (%)</span>
                <input
                  type="number"
                  step="0.1"
                  value={form.ifood_taxa_pct || ''}
                  onChange={(e) => setValor('ifood_taxa_pct', Number(e.target.value))}
                  placeholder="Ex: 27.0"
                  className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
              </label>
              
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Taxa Fixa (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.ifood_taxa_fixa || ''}
                  onChange={(e) => setValor('ifood_taxa_fixa', Number(e.target.value))}
                  placeholder="Ex: 0.99"
                  className="mt-1 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
              </label>
            </div>
            
            {/* O botão de salvar mora AQUI, colado no campo que ele salva.
                Antes esta linha mandava clicar em "Salvar Alterações" — botão
                que não existe na tela de Integração iFood, onde ele se chama
                "Salvar Taxas" e fica no fim do cartão SEGUINTE, depois de sete
                interruptores que salvam sozinhos ao toque. Três modelos de
                salvamento e uma instrução apontando para um botão inexistente:
                o lojista preenche a taxa, não acha o botão e vai embora achando
                que salvou.

                Em Configurações da Loja o componente continua sem handler e a
                dica antiga vale, porque lá o botão global existe de verdade. */}
            {onSalvarTaxas ? (
              <button
                onClick={onSalvarTaxas}
                disabled={salvandoTaxas}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-3 text-sm font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50"
              >
                {salvandoTaxas ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                {salvandoTaxas ? tDynamic('Salvando…') : tDynamic('Salvar taxas')}
              </button>
            ) : (
              <p className="mt-4 text-center text-[10px] text-gray-400">
                {tDynamic('Lembre-se de clicar em')} <b>"Salvar alterações"</b> no final da tela para aplicar estas taxas.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-6 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <h4 className="font-bold text-gray-700 dark:text-gray-200">{tDynamic('Como conectar')}</h4>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {tDynamic('O MiseOn é um aplicativo homologado pelo iFood. Você não precisa de código nenhum: clique no botão abaixo e escolha o seu restaurante na lista.')}
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              {tDynamic('Se o seu restaurante não aparecer, é porque o iFood ainda não associou a loja ao aplicativo — fale com o seu gerente de conta iFood.')}
            </p>
          </div>

          <div className="space-y-4">
            {lojas === null ? (
              <button
                onClick={buscarLojas}
                disabled={buscando}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-3.5 text-base font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50"
              >
                {buscando ? <Loader2 size={20} className="animate-spin" /> : <Store size={20} />}
                {buscando ? tDynamic('Consultando o iFood...') : tDynamic('Buscar meu restaurante no iFood')}
              </button>
            ) : lojas.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/15">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                  <AlertCircle size={16} /> {tDynamic('Nenhum restaurante disponível')}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                  {tDynamic('O aplicativo autenticou no iFood, mas ainda não enxerga nenhuma loja. Isso é feito do lado do iFood: peça ao seu gerente de conta para associar o seu restaurante ao aplicativo MiseOn.')}
                </p>
                <button
                  onClick={buscarLojas}
                  disabled={buscando}
                  className="mt-3 rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
                >
                  {tDynamic('Procurar de novo')}
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {tDynamic('Qual destes é o seu restaurante?')}
                </p>
                <div className="space-y-2">
                  {lojas.map((m) => {
                    const ocupada = !!m.jaVinculadaEm;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={ocupada}
                        onClick={() => setEscolhida(m.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                          ocupada
                            ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-800/40'
                            : escolhida === m.id
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/15'
                              : 'border-gray-200 hover:border-red-300 dark:border-gray-700'
                        }`}
                      >
                        <Store size={18} className={`mt-0.5 shrink-0 ${escolhida === m.id ? 'text-red-600' : 'text-gray-400'}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-gray-900 dark:text-gray-100">{m.nome}</span>
                          <span className="block truncate font-mono text-[10px] text-gray-400">{m.id}</span>
                          {ocupada && (
                            <span className="mt-1 block text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              {tDynamic('Já conectada em')} “{m.jaVinculadaEm}”
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={buscarLojas}
                  disabled={buscando}
                  className="text-xs font-bold text-gray-500 hover:underline dark:text-gray-400"
                >
                  {tDynamic('Atualizar lista')}
                </button>
              </>
            )}

            {erro && <p className="text-sm font-medium text-red-500">{erro}</p>}

            {lojas && lojas.length > 0 && (
              <button
                onClick={vincular}
                disabled={processando || !escolhida}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-3.5 text-base font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50"
              >
                {processando ? <Loader2 size={20} className="animate-spin" /> : <Store size={20} />}
                {processando ? tDynamic('Conectando...') : tDynamic('Conectar este restaurante')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
