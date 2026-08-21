import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle2, Store, Percent, AlertCircle, Save } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

import { useI18n } from '../../contexts/I18nContext';
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
  const [userCode, setUserCode] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const toast = useToast();

  const ifoodMerchantId = form.ifood_merchant_id;
  
  const vincular = async () => {
    if (!userCode.trim() || userCode.length < 6) {
      setErro('Digite um código de autorização válido.');
      return;
    }
    setProcessando(true);
    setErro('');

    try {
      const { data, error } = await supabase.functions.invoke('ifood-auth', {
        body: { lojaId, authorizationCode: userCode.trim() }
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
            <h4 className="font-bold text-gray-700 dark:text-gray-200">Como vincular:</h4>
            <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
              <li>Acesse o <strong>{tDynamic('Portal do Parceiro iFood')}</strong>.</li>
              <li>Vá em <strong>Aplicativos {'>'} Meus Aplicativos</strong>.</li>
              <li>Procure por <strong>MiseOn</strong> e clique em Autorizar.</li>
              <li>Copie o <strong>{tDynamic('Código de Autorização')}</strong> (User Code) gerado e cole abaixo.</li>
            </ol>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">
                {tDynamic('Código de Autorização (User Code)')}
              </label>
              <input
                value={userCode}
                onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                placeholder="Ex: ABCD-1234"
                className="w-full rounded-xl border border-gray-300 p-3.5 font-mono text-lg font-black uppercase tracking-widest outline-none transition focus:border-red-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            {erro && <p className="text-sm font-medium text-red-500">{erro}</p>}
            <button
              onClick={vincular}
              disabled={processando || !userCode.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-3.5 text-base font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50"
            >
              {processando ? <Loader2 size={20} className="animate-spin" /> : <Store size={20} />}
              {processando ? 'Validando código...' : 'Vincular Restaurante'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
