import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scale, RefreshCw, Check, AlertTriangle, ShieldCheck, Zap, Usb, Hash, ArrowRight, Utensils, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, type BalancaConfiguracao, type ProtocoloBalanca, type ModoConexaoBalanca, type Produto, type Comanda } from '../../types';
import { BalancaEngine, type LeituraBalanca } from '../../lib/balanca/balancaEngine';
import { useI18n } from '../../contexts/I18nContext';

type ModoBuffet = 'QUILO' | 'LIVRE';

export function PainelBalanca() {
  const { tDynamic } = useI18n();
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Modo Buffet: Por Quilo (R$/kg) vs Buffet Livre (Preço Fixo)
  const [modoBuffet, setModoBuffet] = useState<ModoBuffet>('QUILO');
  const [precoBuffetLivre, setPrecoBuffetLivre] = useState<number>(45.00);

  // Produtos por quilo
  const [produtosPeso, setProdutosPeso] = useState<Produto[]>([]);
  const [comandasAbertas, setComandasAbertas] = useState<Comanda[]>([]);
  
  // Operação em Tempo Real
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
    tara_padrao_g: 450, // Tara padrão de prato de restaurante self-service (450g)
    produto_buffet_id: null,
    ip_dispositivo: '192.168.1.150',
    porta_dispositivo: 9100,
    ativo: true,
  });

  // Estado da Leitura em Tempo Real
  const [conectado, setConectado] = useState(false);
  const [leituraAtual, setLeituraAtual] = useState<LeituraBalanca>({
    pesoBrutoKg: 0,
    taraKg: 0.450,
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

      const { data: membro } = await supabase
        .from('usuarios_loja')
        .select('loja_id')
        .eq('user_id', userRes.user.id)
        .maybeSingle();

      const lId = membro?.loja_id;
      if (!lId) return;
      setLojaId(lId);

      // Botões Rápidos de Preço por Quilo
      const botoesSalvos = localStorage.getItem('@miseon/balanca_botoes');
      let botoesIniciais = [];
      if (botoesSalvos) {
        try {
          botoesIniciais = JSON.parse(botoesSalvos);
        } catch {
          // Fallback se JSON estiver quebrado
        }
      }
      
      if (botoesIniciais.length === 0) {
        botoesIniciais = [
          { id: '1', nome: 'Buffet Tradicional', preco_por_quilo: 69.90 },
          { id: '2', nome: 'Buffet com Churrasco', preco_por_quilo: 89.90 },
          { id: '3', nome: 'Sobremesa', preco_por_quilo: 99.90 }
        ];
        localStorage.setItem('@miseon/balanca_botoes', JSON.stringify(botoesIniciais));
      }
      
      setProdutosPeso(botoesIniciais as any);

      if (botoesIniciais.length > 0) {
        setProdutoAtivo(botoesIniciais[0]);
        setPrecoPraticado(botoesIniciais[0].preco_por_quilo || 0);
      }

      // Configuração de Hardware da Balança
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
        const defaultConfig: BalancaConfiguracao = {
          id: '',
          loja_id: lId,
          protocolo: 'TOLEDO_PRIX3',
          modo_conexao: 'MANUAL',
          baud_rate: 9600,
          data_bits: 8,
          stop_bits: 1,
          parity: 'none',
          tara_padrao_g: 450,
          produto_buffet_id: null,
          ip_dispositivo: '192.168.1.150',
          porta_dispositivo: 9100,
          ativo: true,
        };
        setConfig(defaultConfig);
        configParaUsar = defaultConfig;
      }
      
      inicializarEngine(configParaUsar as BalancaConfiguracao);

      // Comandas Abertas
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

  useEffect(() => {
    if (produtosPeso.length > 0) {
      if (!produtoAtivo || !produtosPeso.find(p => p.id === produtoAtivo.id)) {
        setProdutoAtivo(produtosPeso[0]);
        setPrecoPraticado(produtosPeso[0].preco_por_quilo || 0);
      }
    }
  }, [produtosPeso, produtoAtivo]);

  const aplicarTaraRapida = (taraGramas: number) => {
    const novaConfig = { ...config, tara_padrao_g: taraGramas };
    setConfig(novaConfig);
    const taraKg = taraGramas / 1000;
    setLeituraAtual((prev) => ({
      ...prev,
      taraKg,
      pesoLiquidoKg: Math.max(0, prev.pesoBrutoKg - taraKg),
    }));
  };

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
        produto_buffet_id: null,
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

  /* ── Lançamento Inteligente de Buffet em Comanda ── */
  const lancarPesoNaComanda = async () => {
    if (modoBuffet === 'QUILO' && leituraAtual.pesoLiquidoKg <= 0) {
      return setMensagem({ tipo: 'erro', texto: 'Coloque um prato na balança com peso maior que zero.' });
    }

    if (modoBuffet === 'QUILO' && !produtoAtivo) {
      return setMensagem({ tipo: 'erro', texto: 'Selecione ou cadastre um produto por quilo para registrar a pesagem.' });
    }

    setProcessandoLancamento(true);
    setMensagem(null);

    try {
      let comandaAlvoId = comandaSelecionadaId;

      // Se informou número de cartão de comanda (bipagem ou digitação)
      if (numeroCartaoInput.trim() && lojaId) {
        let { data: comExistente } = await supabase
          .from('comandas')
          .select('*')
          .eq('loja_id', lojaId)
          .eq('numero_cartao', numeroCartaoInput.trim())
          .eq('status', 'ABERTA')
          .maybeSingle();

        if (!comExistente) {
          // Criar comanda aberta para este cartão de consumo
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
        return setMensagem({ tipo: 'erro', texto: 'Bipe o cartão ou selecione a comanda do cliente.' });
      }

      // Buscar ou criar pedido vinculado em status ACEITO (em aberto na comanda, consumido no salão)
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
            status: 'ACEITO', // Status ACEITO: item lançado na comanda aberta, aguarda pagamento no caixa
            requer_cozinha: false,
            estacao_atual: 'BALCAO',
            identificador_cliente: numeroCartaoInput.trim() ? `Cartão #${numeroCartaoInput.trim()}` : 'Cliente Buffet',
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

      // Dados do item (Buffet por Quilo vs Buffet Livre)
      const isQuilo = modoBuffet === 'QUILO';
      const valorItem = isQuilo
        ? Number((leituraAtual.pesoLiquidoKg * precoPraticado).toFixed(2))
        : precoBuffetLivre;

      const nomeItem = isQuilo
        ? (produtoAtivo ? `${produtoAtivo.nome} (${leituraAtual.pesoLiquidoKg.toFixed(3)}kg)` : `Buffet por Quilo (${leituraAtual.pesoLiquidoKg.toFixed(3)}kg)`)
        : 'Buffet Livre (Por Pessoa)';

      const precoUnitario = isQuilo ? precoPraticado : precoBuffetLivre;
      const quantidade = isQuilo ? leituraAtual.pesoLiquidoKg : 1;

      // Inserir item no pedido
      const { error: errItem } = await supabase.from('itens_pedido').insert({
        pedido_id: pedExistente.id,
        produto_id: isQuilo && produtoAtivo?.id?.length === 36 ? produtoAtivo.id : null,
        nome_produto: nomeItem,
        preco_unitario: precoUnitario,
        quantidade: quantidade,
        origem_balanca: isQuilo,
        tara_g: isQuilo ? config.tara_padrao_g : 0,
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
        texto: isQuilo
          ? `✅ Gravação OK! ${leituraAtual.pesoLiquidoKg.toFixed(3)} kg (${fmt(valorItem)}) lançados no Cartão #${numeroCartaoInput.trim() || 'Comanda'}!`
          : `✅ Buffet Livre (${fmt(precoBuffetLivre)}) lançado no Cartão #${numeroCartaoInput.trim() || 'Comanda'}!`,
      });

      // Limpar campo de bipagem para o próximo cliente da fila do buffet
      setNumeroCartaoInput('');
      carregarDados();
      setTimeout(() => inputComandaRef.current?.focus(), 100);
    } catch (err: any) {
      console.error('Erro ao lançar peso:', err);
      setMensagem({ tipo: 'erro', texto: `Falha ao gravar item na comanda: ${err?.message || 'Erro de conexão ou validação.'}` });
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

  const valorEstimadoPrato = modoBuffet === 'QUILO'
    ? (leituraAtual.pesoLiquidoKg * precoPraticado)
    : precoBuffetLivre;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header com Seletor de Modo Self-Service */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            <Scale size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{tDynamic('Balança & Estação Buffet Self-Service')}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Pesagem por quilo, buffet livre por pessoa e gravação instantânea em comanda por bipagem.
            </p>
          </div>
        </div>

        {/* Seletor de Modo: Quilo vs Livre */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setModoBuffet('QUILO')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                modoBuffet === 'QUILO'
                  ? 'bg-orange-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Scale size={14} /> Por Quilo (R$/kg)
            </button>
            <button
              onClick={() => setModoBuffet('LIVRE')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                modoBuffet === 'LIVRE'
                  ? 'bg-orange-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Utensils size={14} /> Buffet Livre (Fixo)
            </button>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
              conectado
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {conectado ? `${config.modo_conexao}` : 'Off'}
          </span>
        </div>
      </div>

      {mensagem && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium border ${
            mensagem.tipo === 'sucesso'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
          }`}
        >
          {mensagem.tipo === 'sucesso' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
          <span>{mensagem.texto}</span>
        </div>
      )}

      {/* Grid Operacional */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Lado Esquerdo: Display Digital & Bipagem Contínua */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Zap size={14} className="text-amber-500" />
                {modoBuffet === 'QUILO' ? 'Visor Digital de Pesagem' : 'Valor Fixo por Pessoa'}
              </span>

              {modoBuffet === 'QUILO' && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-bold mr-1">Tara:</span>
                  {[
                    { label: 'Prato 450g', g: 450 },
                    { label: 'Sobremesa 200g', g: 200 },
                    { label: 'Marmita 30g', g: 30 },
                    { label: 'Zero', g: 0 },
                  ].map((t) => (
                    <button
                      key={t.g}
                      onClick={() => aplicarTaraRapida(t.g)}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                        config.tara_padrao_g === t.g
                          ? 'bg-orange-500 text-slate-950 border-orange-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Display HUD */}
            <div className="my-5 rounded-2xl bg-slate-950 border border-slate-800 p-6 text-center shadow-inner relative overflow-hidden">
              {modoBuffet === 'QUILO' ? (
                <>
                  <div className="absolute top-3 left-4 text-xs font-mono text-emerald-500/70">
                    TARA APLICADA: {config.tara_padrao_g}g | BRUTO: {leituraAtual.pesoBrutoKg.toFixed(3)}kg
                  </div>

                  {config.modo_conexao === 'MANUAL' ? (
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={leituraAtual.pesoLiquidoKg || ''}
                        onChange={(e) => {
                          const pesoLiq = Number(e.target.value);
                          const taraKg = config.tara_padrao_g / 1000;
                          setLeituraAtual({
                            ...leituraAtual,
                            pesoLiquidoKg: pesoLiq,
                            pesoBrutoKg: pesoLiq + taraKg,
                            estavel: true,
                          });
                        }}
                        className="w-48 bg-transparent text-5xl font-black font-mono tracking-tight text-emerald-400 sm:text-6xl text-center focus:outline-none border-b-2 border-emerald-500/40 focus:border-emerald-500"
                        placeholder="0.000"
                      />
                      <span className="text-2xl font-bold text-emerald-500">kg</span>
                    </div>
                  ) : (
                    <div className="text-5xl font-black font-mono tracking-tight text-emerald-400 sm:text-6xl">
                      {leituraAtual.pesoLiquidoKg.toFixed(3)}{' '}
                      <span className="text-2xl font-bold text-emerald-500">kg</span>
                    </div>
                  )}

                  <div className="mt-2 text-xs text-slate-400 font-mono">
                    Peso Líquido Calculado (Bruto - {config.tara_padrao_g}g de prato)
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Consumo Livre por Pessoa
                  </div>
                  <div className="flex justify-center items-center gap-2">
                    <span className="text-2xl font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.50"
                      value={precoBuffetLivre}
                      onChange={(e) => setPrecoBuffetLivre(Number(e.target.value))}
                      className="w-40 bg-transparent text-5xl font-black font-mono text-emerald-400 text-center border-b-2 border-emerald-500/40 focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-slate-400">O cliente paga um valor fixo e consome à vontade no buffet.</p>
                </div>
              )}
            </div>

            {/* Seleção de Tabela de Preço por Quilo */}
            {modoBuffet === 'QUILO' && (
              <div className="mb-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200 dark:border-slate-700/50 space-y-3">
                <div className="text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                  Selecione a Tabela / Tipo de Buffet:
                </div>
                <div className="flex flex-wrap gap-2">
                  {produtosPeso.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProdutoAtivo(p);
                        setPrecoPraticado(p.preco_por_quilo || 0);
                      }}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition ${
                        produtoAtivo?.id === p.id
                          ? 'bg-orange-500 text-slate-950 border-orange-500 shadow-md scale-105'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {p.nome} ({fmt(p.preco_por_quilo || 0)}/kg)
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700/50 pt-3">
                  <span className="text-xs text-slate-400">Preço do Quilo Aplicado:</span>
                  <span className="text-base font-extrabold text-emerald-400 font-mono">
                    {fmt(precoPraticado)}/kg
                  </span>
                </div>
              </div>
            )}

            {/* Área de Bipagem Contínua de Cartão/Comanda */}
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Bipar Cartão de Comanda do Cliente
                </h3>
                <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                  <Award size={13} /> Pronto para bipagem rápida
                </span>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Hash size={18} className="absolute left-3.5 top-3.5 text-orange-500" />
                  <input
                    ref={inputComandaRef}
                    autoFocus
                    type="text"
                    placeholder="Bipe o código de barras ou digite o nº do cartão..."
                    value={numeroCartaoInput}
                    onChange={(e) => setNumeroCartaoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        lancarPesoNaComanda();
                      }
                    }}
                    className="w-full rounded-2xl bg-white dark:bg-slate-950 border-2 border-orange-500/60 pl-10 pr-4 py-3 text-base font-bold text-slate-900 dark:text-slate-100 focus:border-orange-500 focus:outline-none shadow-md"
                  />
                </div>

                {comandasAbertas.length > 0 && (
                  <div className="pt-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Ou selecione uma comanda aberta:
                    </label>
                    <select
                      value={comandaSelecionadaId}
                      onChange={(e) => {
                        setComandaSelecionadaId(e.target.value);
                        const selected = comandasAbertas.find((c) => c.id === e.target.value);
                        if (selected?.numero_cartao) {
                          setNumeroCartaoInput(selected.numero_cartao);
                        }
                      }}
                      className="w-full rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="">-- Selecionar Comanda Aberta --</option>
                      {comandasAbertas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.numero_cartao ? `Cartão #${c.numero_cartao}` : `Comanda ${c.id.substring(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={lancarPesoNaComanda}
                  disabled={processandoLancamento || (modoBuffet === 'QUILO' && leituraAtual.pesoLiquidoKg <= 0)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 px-4 font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition text-sm"
                >
                  {processandoLancamento ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>Gravar na Comanda ({fmt(valorEstimadoPrato)})</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Parâmetros & Configuração */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-xl backdrop-blur-md space-y-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
              <Usb size={16} className="text-orange-500" /> Parâmetros da Balança Física
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-400 mb-1">Modo de Conexão Hardware</label>
                <select
                  value={config.modo_conexao}
                  onChange={(e) => setConfig({ ...config, modo_conexao: e.target.value as ModoConexaoBalanca })}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                >
                  <option value="WEB_SERIAL">Web Serial API (Cabo USB / RS-232 Direct)</option>
                  <option value="NETWORK_WEBHOOK">Rede Local TCP/IP (Ethernet/Wi-Fi)</option>
                  <option value="MANUAL">Digitação Manual no Teclado</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-400 mb-1">Protocolo / Fabricante</label>
                <select
                  value={config.protocolo}
                  onChange={(e) => setConfig({ ...config, protocolo: e.target.value as ProtocoloBalanca })}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                >
                  <option value="TOLEDO_PRIX3">Toledo Prix 3 / Prix 4 / Prix 5</option>
                  <option value="FILIZOLA_CS15">Filizola CS 15 / Platina</option>
                  <option value="URANO">Urano Pop / Integra</option>
                  <option value="CUSTOM_SERIAL">Serial Genérica (ASCII Float)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-400 mb-1">Tara Padrão do Prato (g)</label>
                <input
                  type="number"
                  value={config.tara_padrao_g}
                  onChange={(e) => setConfig({ ...config, tara_padrao_g: Number(e.target.value) })}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Tabela de Preços Rápidos por Quilo */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-orange-400 uppercase tracking-wider">
                Tabelas de Preço Rápido (R$/kg)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {produtosPeso.map((p, index) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={p.nome}
                      onChange={(e) => {
                        const newProds = [...produtosPeso];
                        newProds[index].nome = e.target.value;
                        setProdutosPeso(newProds);
                        localStorage.setItem('@miseon/balanca_botoes', JSON.stringify(newProds));
                      }}
                      className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200"
                    />
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
                      className="w-24 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs font-bold text-emerald-400 font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={salvarConfiguracoes}
              disabled={salvando}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-xs font-bold text-white hover:bg-slate-700 transition"
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
