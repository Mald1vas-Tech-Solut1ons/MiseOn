import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scale, RefreshCw, Check, AlertTriangle, ShieldCheck, Zap, Usb, Cpu, Hash, ShoppingBag, ArrowRight } from 'lucide-react';
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

  // Configuração da Balança
  const [config, setConfig] = useState<BalancaConfiguracao>({
    id: '',
    loja_id: '',
    protocolo: 'TOLEDO_PRIX3',
    modo_conexao: 'EMULADOR',
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

      const { data: membro } = await supabase
        .from('membros_equipe')
        .select('loja_id')
        .eq('user_id', userRes.user.id)
        .maybeSingle();

      const lId = membro?.loja_id;
      if (!lId) return;
      setLojaId(lId);

      // 1. Carregar produtos tipo POR_PESO
      const { data: prods } = await supabase
        .from('produtos')
        .select('*')
        .eq('loja_id', lId)
        .eq('tipo_venda', 'POR_PESO')
        .eq('disponivel', true);

      setProdutosPeso(prods as Produto[] || []);

      // 2. Carregar comandas abertas
      const { data: coms } = await supabase
        .from('comandas')
        .select('*')
        .eq('loja_id', lId)
        .eq('status', 'ABERTA');

      setComandasAbertas(coms as Comanda[] || []);

      // 3. Carregar configuração de Balança
      const { data: confBalanca } = await supabase
        .from('balanca_configuracoes')
        .select('*')
        .eq('loja_id', lId)
        .maybeSingle();

      if (confBalanca) {
        setConfig(confBalanca as BalancaConfiguracao);
        inicializarEngine(confBalanca as BalancaConfiguracao);
      } else {
        // Padrão inicial
        const defaultConfig: BalancaConfiguracao = {
          id: '',
          loja_id: lId,
          protocolo: 'TOLEDO_PRIX3',
          modo_conexao: 'EMULADOR',
          baud_rate: 9600,
          data_bits: 8,
          stop_bits: 1,
          parity: 'none',
          tara_padrao_g: 200,
          produto_buffet_id: prods?.[0]?.id || null,
          ip_dispositivo: '192.168.1.150',
          porta_dispositivo: 9100,
          ativo: true,
        };
        setConfig(defaultConfig);
        inicializarEngine(defaultConfig);
      }
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
        produto_buffet_id: config.produto_buffet_id || null,
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

    const prodBuffet = produtosPeso.find((p) => p.id === config.produto_buffet_id) || produtosPeso[0];
    if (!prodBuffet) {
      return setMensagem({ tipo: 'erro', texto: 'Cadastre ao menos um produto tipo POR_PESO (Buffet por Quilo) no Cardápio.' });
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
        return setMensagem({ tipo: 'erro', texto: 'Selecione uma comanda ou digite o número do cartão/comanda do cliente.' });
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
            identificador_cliente: numeroCartaoInput.trim() ? `Comanda #${numeroCartaoInput.trim()}` : 'Cliente Buffet',
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
      const valorItem = Number((leituraAtual.pesoLiquidoKg * (prodBuffet.preco_por_quilo || 0)).toFixed(2));

      const { error: errItem } = await supabase.from('itens_pedido').insert({
        pedido_id: pedExistente.id,
        produto_id: prodBuffet.id,
        nome_produto: prodBuffet.nome,
        preco_unitario: prodBuffet.preco_por_quilo || 0,
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
        texto: `✅ Registrado! ${leituraAtual.pesoLiquidoKg.toFixed(3)} kg de ${prodBuffet.nome} (${fmt(valorItem)}) gravados na comanda com sucesso!`,
      });

      setNumeroCartaoInput('');
      carregarDados();
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

  const prodBuffetAtivo = produtosPeso.find((p) => p.id === config.produto_buffet_id) || produtosPeso[0];
  const valorEstimadoPrato = prodBuffetAtivo
    ? (leituraAtual.pesoLiquidoKg * (prodBuffetAtivo.preco_por_quilo || 0))
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
                PROT: {config.protocolo} | TARA: {config.tara_padrao_g}g
              </div>

              <div className="text-5xl font-black font-mono tracking-tight text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)] sm:text-6xl">
                {leituraAtual.pesoLiquidoKg.toFixed(3)}{' '}
                <span className="text-2xl font-bold text-emerald-600">kg</span>
              </div>

              <div className="mt-3 flex items-center justify-center gap-6 text-xs text-slate-400 font-mono">
                <span>Bruto: {leituraAtual.pesoBrutoKg.toFixed(3)} kg</span>
                <span>•</span>
                <span>Tara (Prato): {(config.tara_padrao_g / 1000).toFixed(3)} kg</span>
              </div>
            </div>

            {/* Produto Buffet & Valor Estimado */}
            <div className="mb-6 rounded-xl bg-slate-800/40 p-4 border border-slate-700/50 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Produto de Pesagem</div>
                <div className="font-semibold text-slate-100 flex items-center gap-2 mt-0.5">
                  <ShoppingBag size={16} className="text-orange-400" />
                  {prodBuffetAtivo ? prodBuffetAtivo.nome : 'Nenhum cadastrado'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Valor do Prato ({fmt(prodBuffetAtivo?.preco_por_quilo || 0)}/kg)</div>
                <div className="text-xl font-bold text-orange-400">{fmt(valorEstimadoPrato)}</div>
              </div>
            </div>

            {/* Simulação em modo Emulador */}
            {config.modo_conexao === 'EMULADOR' && (
              <div className="mb-6 rounded-xl bg-amber-500/10 p-4 border border-amber-500/20 text-xs space-y-2">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Cpu size={14} /> Modo Emulador Ativo para Testes
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">Simular peso no prato:</span>
                  <button
                    onClick={() => engineRef.current?.simularPeso(0.350)}
                    className="rounded bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700 font-mono"
                  >
                    350g (Leve)
                  </button>
                  <button
                    onClick={() => engineRef.current?.simularPeso(0.580)}
                    className="rounded bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700 font-mono"
                  >
                    580g (Médio)
                  </button>
                  <button
                    onClick={() => engineRef.current?.simularPeso(0.850)}
                    className="rounded bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700 font-mono"
                  >
                    850g (Grande)
                  </button>
                </div>
              </div>
            )}

            {/* Formulário de Lançamento Direto na Comanda */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Vincular Pesagem à Comanda do Cliente
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Número do Cartão / Comanda Individual
                  </label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Ex: 04"
                      value={numeroCartaoInput}
                      onChange={(e) => setNumeroCartaoInput(e.target.value)}
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
                <option value="EMULADOR">Emulador Interno (Testes e Demonstração)</option>
              </select>
            </div>

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

            <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Produto Vinculado (Buffet por Quilo)
              </label>
              <select
                value={config.produto_buffet_id || ''}
                onChange={(e) => setConfig({ ...config, produto_buffet_id: e.target.value })}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
              >
                {produtosPeso.length === 0 && <option value="">Nenhum produto POR_PESO cadastrado</option>}
                {produtosPeso.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {fmt(p.preco_por_quilo || 0)}/kg
                  </option>
                ))}
              </select>
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
