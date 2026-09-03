import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, User, MapPin, Phone, History, LogOut, Loader2, Save, Heart, Plus, Trash2, CheckCircle2, Mail } from 'lucide-react';
import type { EnderecoCliente, Pedido, FavoritoCliente } from '../types';
import EnderecoMixin, { EnderecoFormData } from './EnderecoMixin';
import { fmt } from '../types';
import { PreferenceCenter } from './PreferenceCenter';
import { getOptimizedImageUrl } from '../lib/cdn';
import { useI18n } from '../contexts/I18nContext';

type Aba = 'DADOS' | 'ENDERECOS' | 'PEDIDOS' | 'FAVORITOS' | 'COMUNICACAO';

const mensagemErroSupabase = (fallback: string, error?: { message?: string } | null) =>
  error?.message ? `${fallback} ${error.message}` : fallback;

export default function ModalMinhaConta({
  isOpen,
  onClose,
  lojaId,
  userId,
  userEmail
}: {
  isOpen: boolean;
  onClose: () => void;
  lojaId: string;
  userId: string;
  userEmail?: string;
}) {
  const { tDynamic } = useI18n();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('DADOS');
  const [clienteId, setClienteId] = useState<string | null>(null);

  // Aba: Meus Dados
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  // Aba: Endereços
  const [enderecos, setEnderecos] = useState<EnderecoCliente[]>([]);
  const [criandoEndereco, setCriandoEndereco] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState<Partial<EnderecoFormData>>({});

  // Aba: Pedidos
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  // Aba: Favoritos
  const [favoritos, setFavoritos] = useState<FavoritoCliente[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const garantirCliente = async () => {
    const nomeFallback = nome.trim() || userEmail?.split('@')[0] || 'Cliente';
    const { data, error } = await supabase
      .from('clientes')
      .upsert({
        loja_id: lojaId,
        user_id: userId,
        nome: nomeFallback,
        telefone: telefone || null,
        email: userEmail ?? null,
      }, { onConflict: 'loja_id,user_id' })
      .select('id')
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || tDynamic('Não foi possível identificar o cliente para salvar os dados.'));
    }

    setClienteId(data.id);
    return data.id;
  };

  const carregarDados = async () => {
    setCarregando(true);

    const { data: cliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('loja_id', lojaId)
      .eq('user_id', userId)
      .maybeSingle();

    if (cliente) {
      setClienteId(cliente.id);
      setNome(cliente.nome ?? '');
      setTelefone(cliente.telefone ?? '');

      const { data: ends } = await supabase
        .from('enderecos_cliente')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('padrao', { ascending: false });
      if (ends) setEnderecos(ends as EnderecoCliente[]);

      const { data: peds } = await supabase
        .from('pedidos')
        .select('*, itens_pedido(nome_produto, quantidade)')
        .eq('cliente_id', cliente.id)
        .order('criado_em', { ascending: false })
        .limit(10);
      if (peds) setPedidos(peds as Pedido[]);

      const { data: favs } = await supabase
        .from('favoritos_cliente')
        .select('*, produto:produtos(*)')
        .eq('cliente_id', cliente.id);
      if (favs) setFavoritos(favs as FavoritoCliente[]);
    }

    setCarregando(false);
  };

  useEffect(() => {
    if (isOpen) setTimeout(carregarDados, 0);
  }, [isOpen, lojaId, userId]);

  if (!isOpen) return null;

  const salvarDadosPerfil = async () => {
    setSalvando(true);
    setMensagem('');
    try {
      await garantirCliente();
      setMensagem(tDynamic('Dados atualizados com sucesso!'));
      setTimeout(() => setMensagem(''), 3000);
    } catch (error) {
      setMensagem(mensagemErroSupabase(tDynamic('Erro ao salvar os dados.'), error as { message?: string }));
    }
    setSalvando(false);
  };

  const salvarNovoEndereco = async () => {
    if (!novoEndereco.cep || !novoEndereco.logradouro || !novoEndereco.bairro || !novoEndereco.cidade || !novoEndereco.uf) {
      setMensagem(tDynamic('Preencha os campos obrigatórios do endereço.'));
      setTimeout(() => setMensagem(''), 3000);
      return;
    }

    let clienteIdAtual = clienteId;
    if (!clienteIdAtual) {
      try {
        clienteIdAtual = await garantirCliente();
      } catch (error) {
        setMensagem(mensagemErroSupabase(tDynamic('Erro ao preparar o cliente para salvar o endereco.'), error as { message?: string }));
        setTimeout(() => setMensagem(''), 4000);
        return;
      }
    }

    const payload = {
      cliente_id: clienteIdAtual,
      cep: novoEndereco.cep,
      logradouro: novoEndereco.logradouro,
      numero: novoEndereco.sem_numero ? 'SN' : (novoEndereco.numero || null),
      complemento: novoEndereco.complemento || null,
      bairro: novoEndereco.bairro,
      cidade: novoEndereco.cidade,
      uf: (novoEndereco.uf || '').toUpperCase(),
      ponto_referencia: novoEndereco.ponto_referencia || null,
      padrao: enderecos.length === 0,
    };

    setSalvando(true);
    const { error } = await supabase.from('enderecos_cliente').insert(payload);

    if (error) {
      setMensagem(mensagemErroSupabase(tDynamic('Erro ao salvar endereço.'), error));
    } else {
      setCriandoEndereco(false);
      setNovoEndereco({});
      await carregarDados();
      setMensagem(tDynamic('Endereço salvo com sucesso!'));
      setTimeout(() => setMensagem(''), 3000);
    }
    setSalvando(false);
  };

  const tornarPadrao = async (id: string) => {
    if (!clienteId) return;
    setSalvando(true);
    const { error: limparError } = await supabase.from('enderecos_cliente').update({ padrao: false }).eq('cliente_id', clienteId);
    if (limparError) {
      setMensagem(mensagemErroSupabase(tDynamic('Erro ao atualizar endereço padrão.'), limparError));
      setSalvando(false);
      return;
    }
    const { error: padraoError } = await supabase.from('enderecos_cliente').update({ padrao: true }).eq('id', id);
    if (padraoError) {
      setMensagem(mensagemErroSupabase(tDynamic('Erro ao atualizar endereço padrão.'), padraoError));
      setSalvando(false);
      return;
    }
    await carregarDados();
    setMensagem(tDynamic('Endereço padrão atualizado!'));
    setTimeout(() => setMensagem(''), 3000);
    setSalvando(false);
  };

  const deletarEndereco = async (id: string) => {
    setSalvando(true);
    const { error } = await supabase.from('enderecos_cliente').delete().eq('id', id);
    if (error) {
      setMensagem(mensagemErroSupabase(tDynamic('Erro ao excluir endereço.'), error));
      setSalvando(false);
      return;
    }
    await carregarDados();
    setMensagem(tDynamic('Endereço excluído com sucesso!'));
    setTimeout(() => setMensagem(''), 3000);
    setSalvando(false);
  };

  const deletarFavorito = async (id: string) => {
    setSalvando(true);
    await supabase.from('favoritos_cliente').delete().eq('id', id);
    await carregarDados();
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-900 shadow-2xl transition-transform sm:w-[480px]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tDynamic('Minha Conta')}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex w-full overflow-x-auto border-b px-2 dark:border-gray-800 hide-scrollbar">
          {(['DADOS', 'ENDERECOS', 'PEDIDOS', 'FAVORITOS', 'COMUNICACAO'] as Aba[]).map((aba) => (
            <button
              key={aba}
              onClick={() => setAbaAtiva(aba)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                abaAtiva === aba 
                  ? 'border-[var(--cor-primaria)] text-[var(--cor-primaria-texto)]' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {aba === 'DADOS' && <User size={16} />}
              {aba === 'ENDERECOS' && <MapPin size={16} />}
              {aba === 'PEDIDOS' && <History size={16} />}
              {aba === 'FAVORITOS' && <Heart size={16} />}
              {aba === 'COMUNICACAO' && <Mail size={16} />}
              {aba === 'DADOS' ? tDynamic('Meus Dados') : aba === 'ENDERECOS' ? tDynamic('Endereços') : aba === 'PEDIDOS' ? tDynamic('Pedidos') : aba === 'FAVORITOS' ? tDynamic('Favoritos') : tDynamic('Comunicação')}
            </button>
          ))}
        </div>

        {/* Corpo scrollável */}
        <div className="flex-1 overflow-y-auto p-6">
          {carregando ? (
            <div className="mt-20 flex justify-center text-[var(--cor-primaria-texto)]">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : (
            <>
              {mensagem && (
                <div className={`mb-4 rounded-lg p-3 text-sm ${mensagem.includes('Erro') || mensagem.includes('Preencha') ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'}`}>
                  {mensagem}
                </div>
              )}
              
              {abaAtiva === 'DADOS' && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <p>{tDynamic('Email logado:')} <strong className="text-gray-800 dark:text-gray-200">{userEmail}</strong></p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="text-xs font-semibold text-gray-500">{tDynamic('NOME COMPLETO')}</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder={tDynamic('Nome completo')}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      />
                    </div>

                    <label className="text-xs font-semibold text-gray-500 mt-2 block">{tDynamic('TELEFONE (WHATSAPP)')}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3.5 text-gray-400" size={16} />
                      <input
                        type="tel"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={salvarDadosPerfil}
                    disabled={salvando}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {salvando ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {salvando ? tDynamic('Salvando...') : tDynamic('Salvar Alterações')}
                  </button>

                  <div className="border-t pt-6 mt-6 dark:border-gray-800">
                    <button
                      onClick={async () => {
                        await supabase.auth.signOut();
                        onClose();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                    >
                      <LogOut size={16} /> {tDynamic('Sair da conta')}
                    </button>
                  </div>
                </div>
              )}

              {abaAtiva === 'ENDERECOS' && (
                <div className="space-y-4">
                  {!criandoEndereco ? (
                    <>
                      {enderecos.length === 0 ? (
                        <p className="py-6 text-center text-sm text-gray-500">{tDynamic('Nenhum endereço cadastrado.')}</p>
                      ) : (
                        <div className="space-y-3">
                          {enderecos.map(end => (
                            <div key={end.id} className="relative rounded-xl border p-4 dark:border-gray-800 dark:bg-gray-950">
                              <div className="flex items-start gap-3">
                                <MapPin className={`mt-0.5 shrink-0 ${end.padrao ? 'text-[var(--cor-primaria-texto)]' : 'text-gray-400'}`} size={18} />
                                <div>
                                  <p className="text-sm font-semibold dark:text-white">
                                    {end.logradouro}, {end.numero} {end.complemento && `(${end.complemento})`}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{end.bairro} - {end.cidade}/{end.uf}</p>
                                  {end.padrao && (
                                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--cor-primaria)]/10 px-2 py-0.5 text-xs opacity-90 font-bold text-[var(--cor-primaria-texto)]">
                                      <CheckCircle2 size={10} /> {tDynamic('Endereço Padrão')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 flex gap-2">
                                {!end.padrao && (
                                  <button onClick={() => tornarPadrao(end.id)} disabled={salvando} className="text-xs font-semibold text-gray-500 hover:text-[var(--cor-primaria-texto)] dark:text-gray-400">
                                    {tDynamic('Tornar padrão')}
                                  </button>
                                )}
                                <button onClick={() => deletarEndereco(end.id)} disabled={salvando} className="text-xs font-semibold text-red-500 hover:text-red-600">
                                  {tDynamic('Excluir')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <button
                        onClick={() => setCriandoEndereco(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-4 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Plus size={18} /> {tDynamic('Adicionar Novo Endereço')}
                      </button>
                    </>
                  ) : (
                    <div className="rounded-xl border p-4 dark:border-gray-800">
                      <h3 className="mb-4 font-bold dark:text-white">{tDynamic('Novo Endereço')}</h3>
                      <EnderecoMixin 
                        onMudanca={(dados) => setNovoEndereco(dados)} 
                      />
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => setCriandoEndereco(false)}
                          className="w-1/3 rounded-xl border py-3 text-sm font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"
                        >
                          {tDynamic('Cancelar')}
                        </button>
                        <button
                          onClick={salvarNovoEndereco}
                          disabled={salvando}
                          className="flex-1 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                        >
                          {salvando ? tDynamic('Salvando...') : tDynamic('Salvar Endereço')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {abaAtiva === 'PEDIDOS' && (
                <div className="space-y-3">
                  {pedidos.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">{tDynamic('Nenhum pedido encontrado.')}</p>
                  ) : (
                    pedidos.map(p => (
                      <div key={p.id} className="rounded-xl border p-4 dark:border-gray-800 dark:bg-gray-950">
                        <div className="flex items-center justify-between border-b pb-2 dark:border-gray-800">
                          <span className="font-bold text-gray-900 dark:text-white">{tDynamic('Pedido')} #{p.numero}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs opacity-90 font-bold ${
                            p.status === 'FINALIZADO' ? 'bg-green-100 text-green-700' :
                            p.status === 'CANCELADO' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {tDynamic(p.status)}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {p.itens_pedido?.map((item: any, i) => (
                            <div key={i} className="text-xs text-gray-600 dark:text-gray-400">
                              {item.quantidade}x {item.nome_produto}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between pt-2">
                          <span className="text-xs text-gray-500">{new Date(p.criado_em).toLocaleDateString()}</span>
                          <span className="font-bold text-[var(--cor-primaria-texto)]">{fmt(Number(p.valor_total))}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {abaAtiva === 'FAVORITOS' && (
                <div className="space-y-3">
                  {favoritos.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">{tDynamic('Nenhum produto salvo como favorito.')}</p>
                  ) : (
                    favoritos.map(f => (
                      <div key={f.id} className="flex items-center justify-between rounded-xl border p-3 dark:border-gray-800 dark:bg-gray-950">
                        <div className="flex items-center gap-3">
                          {f.produto?.imagem_url ? (
                            <img src={getOptimizedImageUrl(f.produto.imagem_url)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-800" />
                          )}
                          <div>
                            <p className="text-sm font-bold dark:text-white">{f.produto?.nome}</p>
                            <p className="text-xs font-semibold text-[var(--cor-primaria-texto)]">{fmt(Number(f.produto?.preco))}</p>
                          </div>
                        </div>
                        <button onClick={() => deletarFavorito(f.id)} disabled={salvando} className="p-2 text-gray-400 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {abaAtiva === 'COMUNICACAO' && (
                <div className="pt-2">
                  <PreferenceCenter />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
