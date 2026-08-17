import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scale, RefreshCw, Check, AlertTriangle, ShieldCheck, Zap, Usb, Hash, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, type BalancaConfiguracao, type ProtocoloBalanca, type ModoConexaoBalanca, type Produto, type Comanda } from '../../types';
import { BalancaEngine, type LeituraBalanca } from '../../lib/balanca/balancaEngine';

export function PainelBalanca() {
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Produtos por quilo
  const [produtosPeso, setProdutosPeso] = useState<Produto[]>([]);
  const [comandasAbertas, setComandasAbertas] = useState<Comanda[]>([]);
  
  // Operação em Tempo Real (Caixa)
  const [produtoAtivo, setProdutoAtivo] = useState<Produto | null>(null);
  const [precoPraticado, setPrecoPraticado] = useState<number>(0);
  const inputComandaRef = useRef<HTMLInputElement>(null);

  // Configuração da Balança
  const [config, setConfig] = useState<BalancaConfiguracao>({
    id: '',
    loja_id: '',
    protocolo: 'TOLEDO_PRIX3',
    modo_conexao: 'MANUAL',
    baud_rate: 9600,
    data_bits: 8,
    stop_bits: 1,
    parity: 'none',
    tara_padrao_g: 200,
    produto_buffet_id: null,
    ip_dispositivo: '192.168.1.150',
    porta_dispositivo: 9100,
    ativo: true,
  });

  // Estado da Leitura em Tempo Real
  const [conectado, setConectado] = useState(false);
  const [leituraAtual, setLeituraAtual] = useState<LeituraBalanca>({
    pesoBrutoKg: 0,
    taraKg: 0.200,
    pesoLiquidoKg: 0,
    estavel: true,
    timestamp: new Date(),
  });

  // Lançamento em Comanda
  const [comandaSelecionadaId, setComandaSelecionadaId] = useState<string>('');
  const [numeroCartaoInput, setNumeroCartaoInput] = useState<string>('');
  const [processandoLancamento, setProcessandoLancamento] = useState(false);

  const engineRef = useRef<BalancaEngine | null>(null);

  const inicializarEngine = useCallback((conf: BalancaConfiguracao) => {
    if (engineRef.current) {
      engineRef.current.desconectar();
    }

    const engine = new BalancaEngine(conf);
    engineRef.current = engine;

    engine.onLeitura((leitura) => {
      setLeituraAtual(leitura);
    });

    engine.conectar().then((ok) => setConectado(ok));
  }, []);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;

      // A tabela é `usuarios_loja`; `membros_equipe` nunca existiu no banco, o
      // que deixava o painel da balança sem loja e travado no loading.
      const { data: membro } = await supabase
        .from('usuarios_loja')
        .select('loja_id')
        .eq('user_id', userRes.user.id)
        .maybeSingle();

      const lId = membro?.loja_id;
      if (!lId) return;
      setLojaId(lId);


      // 1. Inteligência de Food Service: Botões Rápidos locais (sem depender de Cardápio)
      const botoesSalvos = localStorage.getItem('@miseon/balanca_botoes');
      let botoesIniciais = [];
      if (botoesSalvos) {
        try {
          botoesIniciais = JSON.parse(botoesSalvos);
        } catch {
          // Se o JSON estiver quebrado, ignora silenciosamente e usa o padrão
        }
      }
      
      if (botoesIniciais.length === 0) {
        botoesIniciais = [
          { id: '1', nome: 'Buffet Tradicional', preco_por_quilo: 69.90 },
          { id: '2', nome: 'Buffet com Churrasco', preco_por_quilo: 89.90 }
        ];
        localStorage.setItem('@miseon/balanca_botoes', JSON.stringify(botoesIniciais));
      }
      
      setProdutosPeso(botoesIniciais as any);

      // Auto-selecionar o primeiro se houver
      if (botoesIniciais.length > 0) {
        setProdutoAtivo(botoesIniciais[0]);
        setPrecoPraticado(botoesIniciais[0].preco_por_quilo || 0);
      }

      // 2. Carregar configuração de Balança (ANTES DAS COMANDAS PARA GARANTIR FUNCIONAMENTO)
      let configParaUsar = null;
      const { data: confBalanca } = await supabase
        .from('balanca_configuracoes')
        .select('*')
        .eq('loja_id', lId)
        .maybeSingle();

      if (confBalanca) {
        setConfig(confBalanca as BalancaConfiguracao);
        configParaUsar = confBalanca;
      } else {
        // Padrão inicial
        const defaultConfig: BalancaConfiguracao = {
          id: '',
          loja_id: lId,
          protocolo: 'TOLEDO_PRIX3',
          modo_conexao: 'MANUAL',
          baud_rate: 9600,
          data_bits: 8,
          stop_bits: 1,
          parity: 'none',
          tara_padrao_g: 200,
          produto_buffet_id: null,
          ip_dispositivo: '192.168.1.150',
          porta_dispositivo: 9100,
          ativo: true,
        };
        setConfig(defaultConfig);
        configParaUsar = defaultConfig;
      }
      
      // Inicializa o hardware IMEDIATAMENTE para garantir que o emulador funcione
      inicializarEngine(configParaUsar as BalancaConfiguracao);

      // 3. Carregar comandas abertas
      const { data: coms } = await supabase
        .from('comandas')
        .select('*')
        .eq('loja_id', lId)
        .eq('status', 'ABERTA');

      setComandasAbertas(coms as Comanda[] || []);

    } catch (err: any) {
      console.error('Erro ao carregar configurações de balança:', err);
    } finally {
      setLoading(false);
    }
  }, [inicializarEngine]);

  useEffect(() => {
    carregarDados();
    return () => {
      if (engineRef.current) engineRef.current.desconectar();
    };
  }, [carregarDados]);

  // Inteligência de Food Service: Sempre mantém um botão ativo para nunca exibir preço em branco
  useEffect(() => {
    if (produtosPeso.length > 0) {
      if (!produtoAtivo || !produtosPeso.find(p => p.id === produtoAtivo.id)) {
        setProdutoAtivo(produtosPeso[0]);
        setPrecoPraticado(produtosPeso[0].preco_por_quilo || 0);
      }
    } else {
      setProdutoAtivo(null);
      setPrecoPraticado(0);
    }
  }, [produtosPeso, produtoAtivo]);




  const salvarConfiguracoes = async () => {
    if (!lojaId) return;
    setSalvando(true);
    setMensagem(null);

    try {
      const payload = {
        loja_id: lojaId,
        protocolo: config.protocolo,
        modo_conexao: config.modo_conexao,
        baud_rate: Number(config.baud_rate),
        data_bits: Number(config.data_bits),
        stop_bits: Number(config.stop_bits),
        parity: config.parity,
        tara_padrao_g: Number(config.tara_padrao_g),
        produto_buffet_id: null, // Descontinuado do hardware, agora é live na tela
        ip_dispositivo: config.ip_dispositivo || null,
        porta_dispositivo: config.porta_dispositivo ? Number(config.porta_dispositivo) : null,
        ativo: config.ativo,
        atualizado_em: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('balanca_configuracoes')
        .upsert(payload, { onConflict: 'loja_id' })
        .select()
        .single();

      if (error) throw error;

      setConfig(data as BalancaConfiguracao);
      inicializarEngine(data as BalancaConfiguracao);
      setMensagem({ tipo: 'sucesso', texto: 'Configurações da balança salvas com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao salvar balança:', err);
      setMensagem({ tipo: 'erro', texto: 'Falha ao salvar configurações da balança.' });
    } finally {
      setSalvando(false);
    }
  };

  const lancarPesoNaComanda = async () => {
    if (leituraAtual.pesoLiquidoKg <= 0) {
      return setMensagem({ tipo: 'erro', texto: 'Coloque um prato na balança com peso maior que zero.' });
    }

    if (!produtoAtivo) {
      return setMensagem({ tipo: 'erro', texto: 'Selecione ou cadastre um produto por quilo para registrar a pesagem.' });
    }

    setProcessandoLancamento(true);
    setMensagem(null);

    try {
      let comandaAlvoId = comandaSelecionadaId;

      // Se informou número de cartão de comanda individual
      if (numeroCartaoInput.trim() && lojaId) {
        let { data: comExistente } = await supabase
          .from('comandas')
          .select('*')
          .eq('loja_id', lojaId)
          .eq('numero_cartao', numeroCartaoInput.trim())
          .eq('status', 'ABERTA')
          .maybeSingle();

        if (!comExistente) {
          // Criar nova comanda individual automática para este cartão
          const { data: novaCom, error: errCom } = await supabase
            .from('comandas')
            .insert({
              loja_id: lojaId,
              status: 'ABERTA',
              tipo_comanda: 'INDIVIDUAL',
              numero_cartao: numeroCartaoInput.trim(),
              taxa_servico_pct: 10,
              valor_servico: 0,
            })
            .select()
            .single();

          if (errCom) throw errCom;
          comExistente = novaCom;
        }

        comandaAlvoId = comExistente.id;
      }

      if (!comandaAlvoId) {
        setProcessandoLancamento(false);
        return setMensagem({ tipo: 'erro', texto: 'Comanda não selecionada ou não encontrada.' });
      }

      // Buscar ou criar pedido vinculado à comanda
      let { data: pedExistente } = await supabase
        .from('pedidos')
        .select('*')
        .eq('comanda_id', comandaAlvoId)
        .neq('status', 'CANCELADO')
        .maybeSingle();

      if (!pedExistente) {
        const { data: novoPed, error: errPed } = await supabase
          .from('pedidos')
          .insert({
            loja_id: lojaId,
            comanda_id: comandaAlvoId,
            tipo_pedido: 'SALAO',
            status: 'FINALIZADO', // item de buffet pesado é consumido de imediato
            identificador_cliente: numeroCartaoInput.trim() ? `Comanda ${numeroCartaoInput.trim()}` : 'Cliente Buffet',
            subtotal: 0,
            taxa_entrega: 0,
            desconto: 0,
            valor_total: 0,
            origem: 'balanca',
          })
          .select()
          .single();

        if (errPed) throw errPed;
        pedExistente = novoPed;
      }

      // Inserir o item pesado
      const valorItem = Number((leituraAtual.pesoLiquidoKg * precoPraticado).toFixed(2));

      // Registra o item do peso no banco usando produto_id null ou mockado
      const { error: errItem } = await supabase.from('itens_pedido').insert({
        pedido_id: pedExistente.id,
        produto_id: produtoAtivo?.id?.length === 36 ? produtoAtivo.id : null, // Evita enviar ID fake do localStorage se a tabela exigir uuid, ou manda nulo.
        nome_produto: produtoAtivo ? produtoAtivo.nome : 'Buffet Avulso',
        preco_unitario: precoPraticado,
        quantidade: leituraAtual.pesoLiquidoKg,
        origem_balanca: true,
        tara_g: config.tara_padrao_g,
      });

      if (errItem) throw errItem;

      // Recalcular subtotal do pedido
      const { data: todosItens } = await supabase
        .from('itens_pedido')
        .select('preco_unitario, quantidade')
        .eq('pedido_id', pedExistente.id);

      const novoSubtotal = (todosItens || []).reduce(
        (acc, item) => acc + Number(item.preco_unitario) * Number(item.quantidade),
        0
      );

      await supabase
        .from('pedidos')
        .update({
          subtotal: novoSubtotal,
          valor_total: novoSubtotal,
        })
        .eq('id', pedExistente.id);

      setMensagem({
        tipo: 'sucesso',
        texto: `✅ Registrado! ${leituraAtual.pesoLiquidoKg.toFixed(3)} kg (${fmt(valorItem)}) gravados com sucesso!`,
      });

      setNumeroCartaoInput('');
      carregarDados();
      setTimeout(() => inputComandaRef.current?.focus(), 100);
    } catch (err: any) {
      console.error('Erro ao lançar peso:', err);
      setMensagem({ tipo: 'erro', texto: 'Falha ao gravar item na comanda.' });
    } finally {
      setProcessandoLancamento(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const valorEstimadoPrato = produtoAtivo
    ? (leituraAtual.pesoLiquidoKg * precoPraticado)
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-400 border border-orange-500/20">
              <Scale size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Balança do Buffet por Quilo</h1>
              <p className="text-sm text-slate-400">
                Integração inteligente de pesagem em tempo real com Toledo, Filizola, Urano e Web Serial.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold border ${
              conectado
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {conectado ? `Balança Conectada (${config.modo_conexao})` : 'Balança Desconectada'}
          </span>

          <button
            onClick={() => engineRef.current && engineRef.current.conectar().then((ok) => setConectado(ok))}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            <RefreshCw size={14} /> Reconectar
          </button>
        </div>
      </div>

      {mensagem && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium border ${
            mensagem.tipo === 'sucesso'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          }`}
        >
          {mensagem.tipo === 'sucesso' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
          <span>{mensagem.texto}</span>
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Painel Esquerdo: Mostrador Digital & Lançamento Rápido */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Zap size={14} className="text-amber-400" /> Leitura Digital em Tempo Real
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {leituraAtual.estavel ? 'ESTÁVEL' : 'OSCILANDO...'}
              </span>
            </div>

            {/* Display de Peso em LED / HUD */}
            <div className="my-6 rounded-2xl bg-black/80 border border-slate-800 p-6 text-center shadow-inner relative overflow-hidden">
              <div className="absolute top-3 left-4 text-xs font-mono text-emerald-500/70">
                PROT: {config.modo_conexao === 'MANUAL' ? 'DIGITAÇÃO MANUAL' : config.protocolo} | TARA: {config.tara_padrao_g}g
              </div>

              {config.modo_conexao === 'MANUAL' ? (
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    autoFocus
                    value={leituraAtual.pesoLiquidoKg || ''}
                    onChange={(e) => {
                      const pesoLiq = Number(e.target.value);
                      const taraKg = config.tara_padrao_g / 1000;
                      setLeituraAtual({
                        ...leituraAtual,
                        pesoLiquidoKg: pesoLiq,
                        pesoBrutoKg: pesoLiq + taraKg,
                        estavel: true
                      });
                    }}
                    className="w-48 bg-transparent text-5xl font-black font-mono tracking-tight text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)] sm:text-6xl text-center focus:outline-none border-b-2 border-emerald-500/30 focus:border-emerald-500"
                    placeholder="0.000"
                  />
                  <span className="text-2xl font-bold text-emerald-600">kg</span>
                </div>
              ) : (
                <div className="text-5xl font-black font-mono tracking-tight text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)] sm:text-6xl">
                  {leituraAtual.pesoLiquidoKg.toFixed(3)}{' '}
                  <span className="text-2xl font-bold text-emerald-600">kg</span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-center gap-6 text-xs text-slate-400 font-mono">
                <span>Bruto: {leituraAtual.pesoBrutoKg.toFixed(3)} kg</span>
                <span>•</span>
                <span>Tara (Prato): {(config.tara_padrao_g / 1000).toFixed(3)} kg</span>
              </div>
            </div>

            {/* Produto Buffet & Valor Estimado (Override de Preço) */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-slate-800/40 p-4 border border-slate-700/50">
              <div className="flex-1 space-y-3">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">O que estamos pesando?</div>
                <div className="flex flex-wrap gap-2">
                  {produtosPeso.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProdutoAtivo(p);
                        setPrecoPraticado(p.preco_por_quilo || 0);
                      }}
                      className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition ${
                        produtoAtivo?.id === p.id 
                          ? 'bg-orange-500 text-slate-900 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-105' 
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {p.nome}
                    </button>
                  ))}
                  {produtosPeso.length === 0 && (
                    <span className="text-sm font-bold text-orange-400">Buffet Avulso</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6 border-t border-slate-700/50 pt-4 sm:border-0 sm:pt-0 sm:pl-4 sm:border-l">
                <div className="flex flex-col">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Preço Praticado/kg</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={precoPraticado || 0}
                      onChange={e => setPrecoPraticado(Number(e.target.value))}
                      className="w-28 rounded-lg bg-slate-900 border border-slate-700 pl-8 pr-2 py-2 text-base font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total do Prato</div>
                  <div className="text-2xl font-black text-orange-400 leading-none">{fmt(valorEstimadoPrato)}</div>
                </div>
              </div>
            </div>

            {/* Formulário de Lançamento Direto na Comanda */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Vincular Pesagem à Comanda do Cliente
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Comanda ou Ficha (Aceita Código de Barras)
                  </label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-3 text-slate-500" />
                    <input
                      ref={inputComandaRef}
                      autoFocus
                      type="text"
                      placeholder="Ex: JOAO, VIP-123 ou Bipar Cartão"
                      value={numeroCartaoInput}
                      onChange={(e) => setNumeroCartaoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          lancarPesoNaComanda();
                        }
                      }}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Ou Escolha uma Comanda de Mesa
                  </label>
                  <select
                    value={comandaSelecionadaId}
                    onChange={(e) => setComandaSelecionadaId(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Selecione a comanda...</option>
                    {comandasAbertas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.numero_cartao ? `Cartão #${c.numero_cartao}` : `Comanda da Mesa`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={lancarPesoNaComanda}
                disabled={processandoLancamento || leituraAtual.pesoLiquidoKg <= 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 px-4 font-semibold text-slate-950 shadow-lg hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition"
              >
                {processandoLancamento ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Gravar Peso na Comanda ({fmt(valorEstimadoPrato)})</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Painel Direito: Configuração Avançada da Balança */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-md space-y-5">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Usb size={18} className="text-orange-400" /> Configuração do Hardware
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Modo de Conexão com a Balança
              </label>
              <select
                value={config.modo_conexao}
                onChange={(e) => setConfig({ ...config, modo_conexao: e.target.value as ModoConexaoBalanca })}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
              >
                <option value="WEB_SERIAL">Web Serial API (Cabo USB / RS-232 Direct)</option>
                <option value="NETWORK_WEBHOOK">Rede Local / IP TCP/IP</option>
                <option value="MANUAL">Digitação Manual (Sem Comunicação Integrada)</option>
              </select>
            </div>

            {/* Smart UI: Render fields based on connection mode */}
            {config.modo_conexao === 'MANUAL' && (
              <div className="rounded-xl bg-orange-500/10 p-3 border border-orange-500/20 text-xs text-orange-300 flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0" />
                <span>Modo de Digitação Manual: O operador deverá olhar o visor da balança não-integrada e digitar o peso do prato diretamente no sistema.</span>
              </div>
            )}

            {config.modo_conexao === 'NETWORK_WEBHOOK' && (
              <div className="rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0" />
                <span>Modo Rede ativado. O sistema escutará as transmissões da balança diretamente via TCP/IP na porta configurada.</span>
              </div>
            )}

            {(config.modo_conexao === 'WEB_SERIAL' || config.modo_conexao === 'NETWORK_WEBHOOK') && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Protocolo / Fabricante da Balança
                </label>
                <select
                  value={config.protocolo}
                  onChange={(e) => setConfig({ ...config, protocolo: e.target.value as ProtocoloBalanca })}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
                >
                  <option value="TOLEDO_PRIX3">Toledo Prix 3 / Prix 4</option>
                  <option value="FILIZOLA_CS15">Filizola CS 15 / Platina</option>
                  <option value="URANO">Urano Pop / Integra</option>
                  <option value="CUSTOM_SERIAL">Serial Genérica (ASCII Float)</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {config.modo_conexao === 'WEB_SERIAL' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Baud Rate (bps)
                    </label>
                    <input
                      type="number"
                      value={config.baud_rate}
                      onChange={(e) => setConfig({ ...config, baud_rate: Number(e.target.value) })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Data Bits
                    </label>
                    <select
                      value={config.data_bits}
                      onChange={(e) => setConfig({ ...config, data_bits: Number(e.target.value) })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
                    >
                      <option value="7">7</option>
                      <option value="8">8</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Stop Bits
                    </label>
                    <select
                      value={config.stop_bits}
                      onChange={(e) => setConfig({ ...config, stop_bits: Number(e.target.value) })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Paridade (Parity)
                    </label>
                    <select
                      value={config.parity}
                      onChange={(e) => setConfig({ ...config, parity: e.target.value as any })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
                    >
                      <option value="none">None (Nenhuma)</option>
                      <option value="even">Even (Par)</option>
                      <option value="odd">Odd (Ímpar)</option>
                    </select>
                  </div>
                </>
              )}

              {config.modo_conexao === 'NETWORK_WEBHOOK' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Porta de Escuta (TCP)
                  </label>
                  <input
                    type="number"
                    value={config.porta_dispositivo || 9100}
                    onChange={(e) => setConfig({ ...config, porta_dispositivo: Number(e.target.value) })}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              )}

              <div className={config.modo_conexao === 'MANUAL' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Tara Padrão do Prato (gramas)
                </label>
                <input
                  type="number"
                  value={config.tara_padrao_g}
                  onChange={(e) => setConfig({ ...config, tara_padrao_g: Number(e.target.value) })}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Gerenciamento Rápido de Botões (Substitui Cardápio) */}
            <div className="pt-4 border-t border-slate-800/50">
              <label className="block text-xs font-bold text-orange-400 mb-3 uppercase tracking-wider">
                Botões de Preço Rápido (Exclusivo desta balança)
              </label>
              <div className="space-y-3">
                {produtosPeso.map((p, index) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={p.nome}
                      onChange={(e) => {
                        const newProds = [...produtosPeso];
                        newProds[index].nome = e.target.value;
                        setProdutosPeso(newProds);
                        localStorage.setItem('@miseon/balanca_botoes', JSON.stringify(newProds));
                      }}
                      placeholder="Ex: Tradicional"
                      className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
                    />
                    <div className="relative w-32">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-500">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={p.preco_por_quilo || 0}
                        onChange={(e) => {
                          const newProds = [...produtosPeso];
                          newProds[index].preco_por_quilo = Number(e.target.value);
                          setProdutosPeso(newProds);
                          localStorage.setItem('@miseon/balanca_botoes', JSON.stringify(newProds));
                          if (produtoAtivo?.id === p.id) setPrecoPraticado(Number(e.target.value));
                        }}
                        className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-8 pr-2 py-2 text-sm font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const newProds = produtosPeso.filter((_, i) => i !== index);
                        setProdutosPeso(newProds);
                        localStorage.setItem('@miseon/balanca_botoes', JSON.stringify(newProds));
                      }}
                      className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"
                    >
                      X
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={() => {
                    const newProds = [...produtosPeso, { id: Date.now().toString(), nome: 'Novo Botão', preco_por_quilo: 0 }];
                    setProdutosPeso(newProds as any);
                    localStorage.setItem('@miseon/balanca_botoes', JSON.stringify(newProds));
                  }}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                >
                  + Adicionar novo botão
                </button>
              </div>
            </div>



            <button
              onClick={salvarConfiguracoes}
              disabled={salvando}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-100 border border-slate-700 hover:bg-slate-700 transition"
            >
              {salvando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check size={16} />}
              <span>Salvar Parâmetros da Balança</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
