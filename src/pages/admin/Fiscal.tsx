import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  FileText, ShieldCheck, Lock, Upload, CheckCircle2, AlertTriangle, 
  ExternalLink, RefreshCw, Eye, EyeOff, Search, FileCode,
  Box, DollarSign, Layers, Trash2, Building2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { CtxLoja } from './AdminLayout';

import { useI18n } from '../../contexts/I18nContext';
interface ConfigFiscal {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  cnae_principal: string;
  regime_tributario: string;
  crt: number;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  codigo_ibge: string;
  telefone: string;
  email: string;
  nfe_ambiente: 'homologacao' | 'producao';
  id_csc: string;
  csc: string;
  certificado_nome?: string;
  certificado_validade?: string;
  certificado_status?: string;
}

interface NotaFiscal {
  id: string;
  pedido_id?: string;
  tipo: 'NFE' | 'NFCE' | 'ENTRADA_FORNECEDOR';
  ambiente: string;
  ref: string;
  status: 'RASCUNHO' | 'PROCESSANDO' | 'AUTORIZADA' | 'REJEITADA' | 'CANCELADA' | 'ERRO' | 'IMPORTADA';
  chave_nfe?: string;
  numero?: string;
  serie?: string;
  xml_url?: string;
  danfe_url?: string;
  qrcode_url?: string;
  mensagem_sefaz?: string;
  valor_total: number;
  emitente_nome?: string;
  created_at: string;
}

interface ItemXmlParsed {
  codigo: string;
  descricao: string;
  ncm: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  categoriaDestino: 'insumo' | 'venda_direta' | 'embalagem' | 'limpeza' | 'outros';
}

export default function Fiscal() {
  const { tDynamic } = useI18n();
  const ctx = useOutletContext<CtxLoja>();
  const toast = useToast();

  const [abaAtiva, setAbaAtiva] = useState<'config' | 'notas' | 'importar'>('config');
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  // Form de Configuração Fiscal
  const [formConfig, setFormConfig] = useState<ConfigFiscal>({
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    cnae_principal: '5611-2/01',
    regime_tributario: 'Simples Nacional',
    crt: 1,
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: 'SP',
    cep: '',
    codigo_ibge: '',
    telefone: '',
    email: '',
    nfe_ambiente: 'homologacao',
    id_csc: '',
    csc: '',
  });

  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [senhaCertificado, setSenhaCertificado] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Notas Fiscais
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [buscaNota, setBuscaNota] = useState('');

  // Modal Cancelamento
  const [notaParaCancelar, setNotaParaCancelar] = useState<NotaFiscal | null>(null);
  const [justificativaCancelamento, setJustificativaCancelamento] = useState('');
  const [cancelando, setCancelando] = useState(false);

  // Importador de XML
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlDataParsed, setXmlDataParsed] = useState<{
    fornecedorNome: string;
    fornecedorCnpj: string;
    numeroNota: string;
    dataEmissao: string;
    valorTotal: number;
    itens: ItemXmlParsed[];
  } | null>(null);
  const [importandoXml, setImportandoXml] = useState(false);

  const carregarConfiguracoes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_fiscais')
        .select('*')
        .eq('loja_id', ctx.lojaId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setFormConfig({
          cnpj: data.cnpj || '',
          razao_social: data.razao_social || '',
          nome_fantasia: data.nome_fantasia || '',
          inscricao_estadual: data.inscricao_estadual || '',
          inscricao_municipal: data.inscricao_municipal || '',
          cnae_principal: data.cnae_principal || '5611-2/01',
          regime_tributario: data.regime_tributario || 'Simples Nacional',
          crt: data.crt || 1,
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          uf: data.uf || 'SP',
          cep: data.cep || '',
          codigo_ibge: data.codigo_ibge || '',
          telefone: data.telefone || '',
          email: data.email || '',
          nfe_ambiente: data.nfe_ambiente || 'homologacao',
          id_csc: data.id_csc || '',
          csc: data.csc || '',
          certificado_nome: data.certificado_nome,
          certificado_validade: data.certificado_validade,
          certificado_status: data.certificado_status,
        });
      }
    } catch (err: any) {
      console.error(err);
      toast('Erro ao carregar configurações fiscais', 'erro');
    }
  }, [ctx?.lojaId, toast]);

  const carregarNotas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('*')
        .eq('loja_id', ctx.lojaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotas(data || []);
    } catch (err: any) {
      console.error(err);
    }
  }, [ctx?.lojaId]);

  useEffect(() => {
    if (ctx?.lojaId) {
      carregarConfiguracoes();
      carregarNotas();
    }
  }, [ctx?.lojaId, carregarConfiguracoes, carregarNotas]);

  const buscarCepAuto = async (cepBruto: string) => {
    const cepLimpo = cepBruto.replace(/\D/g, '');
    setFormConfig(prev => ({ ...prev, cep: cepLimpo }));
    if (cepLimpo.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormConfig(prev => ({
            ...prev,
            logradouro: data.logradouro || prev.logradouro,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            uf: data.uf || prev.uf,
            codigo_ibge: data.ibge || prev.codigo_ibge
          }));
          toast('Endereço preenchido via CEP!', 'sucesso');
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const salvarConfiguracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoConfig(true);

    try {
      let certBase64 = '';
      if (certificadoFile) {
        const reader = new FileReader();
        certBase64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(certificadoFile);
        });
      }

      const cleanCnpj = (formConfig.cnpj || '').replace(/\D/g, '');
      const cleanIe = (formConfig.inscricao_estadual || '').replace(/\D/g, '');
      const cleanCep = (formConfig.cep || '').replace(/\D/g, '');

      // 1. Salvar os dados cadastrais da empresa no banco de dados do MiseOn (garantia de gravação)
      const fiscalDataDb = {
        loja_id: ctx.lojaId,
        cnpj: cleanCnpj,
        razao_social: formConfig.razao_social,
        nome_fantasia: formConfig.nome_fantasia || formConfig.razao_social,
        inscricao_estadual: cleanIe || 'ISENTO',
        inscricao_municipal: formConfig.inscricao_municipal,
        cnae_principal: formConfig.cnae_principal,
        regime_tributario: formConfig.regime_tributario,
        crt: Number(formConfig.crt) || 1,
        logradouro: formConfig.logradouro,
        numero: formConfig.numero,
        complemento: formConfig.complemento,
        bairro: formConfig.bairro,
        cidade: formConfig.cidade,
        uf: (formConfig.uf || 'SP').toUpperCase(),
        cep: cleanCep,
        codigo_ibge: formConfig.codigo_ibge,
        telefone: formConfig.telefone,
        email: formConfig.email,
        nfe_ambiente: formConfig.nfe_ambiente,
        id_csc: formConfig.id_csc,
        csc: formConfig.csc,
        updated_at: new Date().toISOString()
      };

      const { error: dbError } = await supabase
        .from('configuracoes_fiscais')
        .upsert(fiscalDataDb, { onConflict: 'loja_id' });

      if (dbError) throw dbError;

      // 2. Tentar habilitar / transmitir à Focus NFe / SEFAZ via Edge Function
      let transmitiuFocus = false;
      try {
        const payload = {
          ...formConfig,
          cnpj: cleanCnpj,
          inscricao_estadual: cleanIe || 'ISENTO',
          certificado_base64: certBase64 || undefined,
          senha_certificado: senhaCertificado || undefined,
          ambiente: formConfig.nfe_ambiente
        };

        const { data, error } = await supabase.functions.invoke('fiscal-onboarding-empresa', {
          body: payload
        });

        if (!error && !data?.error) {
          transmitiuFocus = true;
        }
      } catch (fErr) {
        console.warn('Onboarding Focus NFe em background pendente:', fErr);
      }

      if (transmitiuFocus) {
        toast('Dados cadastrais e habilitação SEFAZ salvos com sucesso!', 'sucesso');
      } else {
        toast('Dados da empresa salvos no MiseOn! Quando você anexar seu Certificado A1, a habilitação na SEFAZ será ativada.', 'sucesso');
      }

      await carregarConfiguracoes();
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Erro ao salvar configurações fiscais', 'erro');
    } finally {
      setSalvandoConfig(false);
    }
  };

  const solicitarCancelamento = async () => {
    if (!notaParaCancelar) return;
    if (justificativaCancelamento.length < 15) {
      toast('A justificativa deve possuir no mínimo 15 caracteres.', 'erro');
      return;
    }

    setCancelando(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-cancelar-nota', {
        body: {
          nota_id: notaParaCancelar.id,
          justificativa: justificativaCancelamento
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Falha no cancelamento');
      }

      toast('Nota fiscal cancelada com sucesso!', 'sucesso');
      setNotaParaCancelar(null);
      setJustificativaCancelamento('');
      await carregarNotas();
    } catch (err: any) {
      toast(err.message || 'Erro ao cancelar nota', 'erro');
    } finally {
      setCancelando(false);
    }
  };

  // Parser XML de Fornecedor
  const handleXmlUpload = (file: File) => {
    setXmlFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        const emitenteNome = xmlDoc.querySelector('emit > xNome')?.textContent || 'Fornecedor Desconhecido';
        const emitenteCnpj = xmlDoc.querySelector('emit > CNPJ')?.textContent || '';
        const nNF = xmlDoc.querySelector('ide > nNF')?.textContent || '0';
        const dhEmi = xmlDoc.querySelector('ide > dhEmi')?.textContent || new Date().toISOString();
        const vNF = parseFloat(xmlDoc.querySelector('total > ICMSTot > vNF')?.textContent || '0');

        const detList = xmlDoc.querySelectorAll('det');
        const items: ItemXmlParsed[] = [];

        detList.forEach((det) => {
          const prod = det.querySelector('prod');
          if (prod) {
            const codigo = prod.querySelector('cProd')?.textContent || '';
            const descricao = prod.querySelector('xProd')?.textContent || '';
            const ncm = prod.querySelector('NCM')?.textContent || '';
            const quantidade = parseFloat(prod.querySelector('qCom')?.textContent || '1');
            const unidade = prod.querySelector('uCom')?.textContent || 'UN';
            const valorUnitario = parseFloat(prod.querySelector('vUnCom')?.textContent || '0');
            const valorTotal = parseFloat(prod.querySelector('vProd')?.textContent || '0');

            items.push({
              codigo,
              descricao,
              ncm,
              quantidade,
              unidade,
              valorUnitario,
              valorTotal,
              categoriaDestino: 'insumo'
            });
          }
        });

        setXmlDataParsed({
          fornecedorNome: emitenteNome,
          fornecedorCnpj: emitenteCnpj,
          numeroNota: nNF,
          dataEmissao: dhEmi,
          valorTotal: vNF,
          itens: items
        });

        toast('XML lido com sucesso! Verifique os itens abaixo.', 'sucesso');
      } catch (err) {
        console.error(err);
        toast('Erro ao ler o arquivo XML da NFe', 'erro');
      }
    };
    reader.readAsText(file);
  };

  const processarEntradaEstoqueXml = async () => {
    if (!xmlDataParsed) return;
    setImportandoXml(true);
    try {
      // Grava no histórico de notas fiscais
      const { error: errNota } = await supabase
        .from('notas_fiscais')
        .insert({
          loja_id: ctx.lojaId,
          tipo: 'ENTRADA_FORNECEDOR',
          status: 'IMPORTADA',
          numero: xmlDataParsed.numeroNota,
          valor_total: xmlDataParsed.valorTotal,
          emitente_nome: xmlDataParsed.fornecedorNome,
          emitente_cnpj: xmlDataParsed.fornecedorCnpj,
          ambiente: 'producao'
        })
        .select()
        .single();

      if (errNota) throw errNota;

      // Atualiza / Dá entrada no Estoque
      for (const item of xmlDataParsed.itens) {
        // Verifica se o insumo já existe ou cria entrada
        const { data: insumosExistentes } = await supabase
          .from('insumos')
          .select('*')
          .eq('loja_id', ctx.lojaId)
          .ilike('nome', `%${item.descricao.split(' ')[0]}%`)
          .limit(1);

        if (insumosExistentes && insumosExistentes.length > 0) {
          const insumo = insumosExistentes[0];
          const novaQtd = Number(insumo.quantidade || 0) + item.quantidade;
          await supabase
            .from('insumos')
            .update({ 
              quantidade: novaQtd, 
              custo_unitario: item.valorUnitario 
            })
            .eq('id', insumo.id);
        } else {
          // Cria novo insumo no estoque automaticamente
          await supabase
            .from('insumos')
            .insert({
              loja_id: ctx.lojaId,
              nome: item.descricao,
              unidade_medida: item.unidade,
              quantidade: item.quantidade,
              custo_unitario: item.valorUnitario,
              estoque_minimo: 5
            });
        }
      }

      toast('Estoque atualizado e Nota Fiscal de Fornecedor importada com sucesso!', 'sucesso');
      setXmlFile(null);
      setXmlDataParsed(null);
      await carregarNotas();
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Erro ao importar XML para o estoque', 'erro');
    } finally {
      setImportandoXml(false);
    }
  };

  const notasFiltradas = notas.filter(n => {
    if (filtroStatus !== 'todos' && n.status.toLowerCase() !== filtroStatus.toLowerCase()) return false;
    if (buscaNota) {
      const q = buscaNota.toLowerCase();
      return (
        n.numero?.toLowerCase().includes(q) ||
        n.chave_nfe?.toLowerCase().includes(q) ||
        n.emitente_nome?.toLowerCase().includes(q) ||
        n.ref?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalEmitidoMes = notas.reduce((acc, n) => acc + (n.status === 'AUTORIZADA' ? Number(n.valor_total || 0) : 0), 0);
  const totalAutorizadas = notas.filter(n => n.status === 'AUTORIZADA').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header com Selos de Criptografia & LGPD */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-xl p-6 rounded-3xl border border-gray-200/50 dark:border-white/10 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#004198]/10 dark:bg-[#004198]/20 text-[#004198] dark:text-[#6B9EFF]">
              <FileText size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{tDynamic('Módulo Fiscal SaaS')}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tDynamic('Emissão automatizada de NF-e, NFC-e (Focus NFe API v2) e entrada de compras via XML')}</p>
            </div>
          </div>
        </div>

        {/* Selos de Proteção de Dados e LGPD */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <Lock size={14} /> Criptografia AES-256
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold">
            <ShieldCheck size={14} /> LGPD Compliance (Lei 13.709)
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-4">
        <button
          onClick={() => setAbaAtiva('config')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            abaAtiva === 'config'
              ? 'border-[#004198] text-[#004198] dark:border-[#6B9EFF] dark:text-[#6B9EFF]'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Building2 size={18} /> {tDynamic('Configurações Fiscais do Tenant')}
        </button>

        <button
          onClick={() => setAbaAtiva('notas')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            abaAtiva === 'notas'
              ? 'border-[#004198] text-[#004198] dark:border-[#6B9EFF] dark:text-[#6B9EFF]'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Layers size={18} /> Gestão de Notas Fiscais ({notas.length})
        </button>

        <button
          onClick={() => setAbaAtiva('importar')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            abaAtiva === 'importar'
              ? 'border-[#004198] text-[#004198] dark:border-[#6B9EFF] dark:text-[#6B9EFF]'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Box size={18} /> {tDynamic('Importar XML (Estoque de Fornecedores)')}
        </button>
      </div>

      {/* ABA 1: CONFIGURAÇÕES FISCAIS */}
      {abaAtiva === 'config' && (
        <form onSubmit={salvarConfiguracoes} className="space-y-6">
          {/* Card Status do Certificado A1 */}
          <div className="bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-purple-900/10 p-6 rounded-3xl border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 text-white rounded-2xl">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">{tDynamic('Status da Habilitação SEFAZ / Focus NFe')}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formConfig.certificado_validade 
                    ? `Certificado A1 Ativo (Validade: ${new Date(formConfig.certificado_validade).toLocaleDateString('pt-BR')})` 
                    : 'Nenhum certificado A1 configurado ainda'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                formConfig.nfe_ambiente === 'producao' 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                Ambiente: {formConfig.nfe_ambiente === 'producao' ? 'Produção (SEFAZ)' : 'Homologação (Testes)'}
              </span>
            </div>
          </div>

          {/* Dados Fiscais da Empresa */}
          <div className="bg-white dark:bg-[#0B1120] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 size={20} className="text-[#004198]" /> {tDynamic('Dados Cadastrais Fiscais da Empresa')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">CNPJ *</label>
                <input
                  type="text"
                  required
                  value={formConfig.cnpj}
                  onChange={(e) => setFormConfig({ ...formConfig, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Razão Social *</label>
                <input
                  type="text"
                  required
                  value={formConfig.razao_social}
                  onChange={(e) => setFormConfig({ ...formConfig, razao_social: e.target.value })}
                  placeholder="Razão Social completa"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Nome Fantasia</label>
                <input
                  type="text"
                  value={formConfig.nome_fantasia}
                  onChange={(e) => setFormConfig({ ...formConfig, nome_fantasia: e.target.value })}
                  placeholder="Nome Fantasia da Loja"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">{tDynamic('Inscrição Estadual (IE) *')}</label>
                <input
                  type="text"
                  required
                  value={formConfig.inscricao_estadual}
                  onChange={(e) => setFormConfig({ ...formConfig, inscricao_estadual: e.target.value })}
                  placeholder="Apenas números ou ISENTO"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">{tDynamic('Inscrição Municipal (IM)')}</label>
                <input
                  type="text"
                  value={formConfig.inscricao_municipal}
                  onChange={(e) => setFormConfig({ ...formConfig, inscricao_municipal: e.target.value })}
                  placeholder="Inscrição Municipal"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">{tDynamic('Regime Tributário (CRT) *')}</label>
                <select
                  value={formConfig.crt}
                  onChange={(e) => {
                    const crtVal = Number(e.target.value);
                    const regNome = crtVal === 1 ? 'Simples Nacional' : crtVal === 2 ? 'Simples Nacional - Excesso' : 'Regime Normal';
                    setFormConfig({ ...formConfig, crt: crtVal, regime_tributario: regNome });
                  }}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                >
                  <option value={1}>1 - Simples Nacional (MEI / EPP)</option>
                  <option value={2}>2 - Simples Nacional (Excesso Sublimite)</option>
                  <option value={3}>3 - Regime Normal (Lucro Presumido / Real)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Endereço Fiscal */}
          <div className="bg-white dark:bg-[#0B1120] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{tDynamic('Endereço Fiscal Emitente (SEFAZ)')}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">CEP *</label>
                <input
                  type="text"
                  required
                  value={formConfig.cep}
                  onChange={(e) => buscarCepAuto(e.target.value)}
                  placeholder="00000-000"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Logradouro *</label>
                <input
                  type="text"
                  required
                  value={formConfig.logradouro}
                  onChange={(e) => setFormConfig({ ...formConfig, logradouro: e.target.value })}
                  placeholder="Rua, Avenida, Alameda..."
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Número *</label>
                <input
                  type="text"
                  required
                  value={formConfig.numero}
                  onChange={(e) => setFormConfig({ ...formConfig, numero: e.target.value })}
                  placeholder="Ex: 123 ou S/N"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Bairro *</label>
                <input
                  type="text"
                  required
                  value={formConfig.bairro}
                  onChange={(e) => setFormConfig({ ...formConfig, bairro: e.target.value })}
                  placeholder="Bairro"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">Cidade *</label>
                <input
                  type="text"
                  required
                  value={formConfig.cidade}
                  onChange={(e) => setFormConfig({ ...formConfig, cidade: e.target.value })}
                  placeholder="Cidade"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">UF *</label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={formConfig.uf}
                  onChange={(e) => setFormConfig({ ...formConfig, uf: e.target.value.toUpperCase() })}
                  placeholder="SP"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold uppercase outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">{tDynamic('Código IBGE Cidade')}</label>
                <input
                  type="text"
                  value={formConfig.codigo_ibge}
                  onChange={(e) => setFormConfig({ ...formConfig, codigo_ibge: e.target.value })}
                  placeholder="Ex: 3550308"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>
            </div>
          </div>

          {/* Upload do Certificado A1 + Senha (AES-256 e LGPD) */}
          <div className="bg-white dark:bg-[#0B1120] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock size={20} className="text-emerald-500" /> {tDynamic('Certificado Digital A1 (.pfx ou .p12)')}
              </h2>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                🔒 Criptografia Servidor AES-256
              </span>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              O certificado digital A1 é utilizado para assinar as notas fiscais no padrão SEFAZ. Seu arquivo e senha são encriptados imediatamente em memória e salvos com chave segura no banco de dados.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-[#004198] rounded-2xl p-4 text-center cursor-pointer transition-colors relative flex flex-col items-center justify-center min-h-[120px]">
                <input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => setCertificadoFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload size={24} className="text-gray-400 mb-2" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {certificadoFile ? certificadoFile.name : (formConfig.certificado_nome ? `Substituir ${formConfig.certificado_nome}` : 'Clique para selecionar arquivo .pfx/.p12')}
                </span>
                <span className="text-[10px] text-gray-400 mt-1">{tDynamic('Tamanho máximo: 5MB')}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">{tDynamic('Senha do Certificado A1')}</label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senhaCertificado}
                    onChange={(e) => setSenhaCertificado(e.target.value)}
                    placeholder="Digite a senha do arquivo .pfx"
                    className="w-full p-3 pr-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  {tDynamic('Conforme a LGPD, esta senha é encriptada e nunca armazenada em texto puro.')}
                </p>
              </div>
            </div>
          </div>

          {/* Token CSC para NFC-e */}
          <div className="bg-white dark:bg-[#0B1120] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{tDynamic('Token CSC da SEFAZ (Obrigatório para NFC-e)')}</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">{tDynamic('ID do Token CSC')}</label>
                <input
                  type="text"
                  value={formConfig.id_csc}
                  onChange={(e) => setFormConfig({ ...formConfig, id_csc: e.target.value })}
                  placeholder="Ex: 000001"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">{tDynamic('Código Token CSC (SEFAZ)')}</label>
                <input
                  type="text"
                  value={formConfig.csc}
                  onChange={(e) => setFormConfig({ ...formConfig, csc: e.target.value })}
                  placeholder="Ex: 1A2B3C4D5E6F7G8H"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-[#004198]"
                />
              </div>
            </div>

            {/* Alternar Ambiente */}
            <div className="pt-2">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 block">Ambiente SEFAZ</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nfe_ambiente"
                    checked={formConfig.nfe_ambiente === 'homologacao'}
                    onChange={() => setFormConfig({ ...formConfig, nfe_ambiente: 'homologacao' })}
                    className="text-[#004198]"
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{tDynamic('Homologação (Ambiente de Testes)')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nfe_ambiente"
                    checked={formConfig.nfe_ambiente === 'producao'}
                    onChange={() => setFormConfig({ ...formConfig, nfe_ambiente: 'producao' })}
                    className="text-[#004198]"
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{tDynamic('Produção (Emissão com Validade Jurídica)')}</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={salvandoConfig}
              className="px-8 py-3.5 rounded-2xl bg-[#004198] hover:bg-[#00337A] text-white font-bold text-sm shadow-lg shadow-[#004198]/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {salvandoConfig ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              Salvar e Transmitir para Focus NFe
            </button>
          </div>
        </form>
      )}

      {/* ABA 2: GESTÃO DE NOTAS FISCAIS */}
      {abaAtiva === 'notas' && (
        <div className="space-y-6">
          {/* KPIs da aba */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#0B1120] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">{tDynamic('Total Faturado no Mês')}</p>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">R$ {totalEmitidoMes.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <DollarSign size={24} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#0B1120] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Notas Autorizadas</p>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{totalAutorizadas}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#0B1120] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">{tDynamic('Total de Histórico')}</p>
                <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{notas.length}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                <FileText size={24} />
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                value={buscaNota}
                onChange={(e) => setBuscaNota(e.target.value)}
                placeholder="Buscar por Chave, Número ou Emitente..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B1120] text-sm outline-none focus:border-[#004198]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B1120] text-xs font-bold outline-none"
              >
                <option value="todos">{tDynamic('Todos os Status')}</option>
                <option value="autorizada">Autorizada</option>
                <option value="processando">Processando</option>
                <option value="rejeitada">Rejeitada</option>
                <option value="cancelada">Cancelada</option>
                <option value="importada">Importada</option>
              </select>

              <button
                onClick={carregarNotas}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Tabela de Notas */}
          <div className="bg-white dark:bg-[#0B1120] rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-[11px] font-bold text-gray-400 uppercase">
                    <th className="p-4">Data</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Número / Ref</th>
                    <th className="p-4">Valor Total</th>
                    <th className="p-4">Status SEFAZ</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-semibold text-gray-700 dark:text-gray-300">
                  {notasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-sm text-gray-400">
                        {tDynamic('Nenhuma nota fiscal encontrada no período.')}
                      </td>
                    </tr>
                  ) : (
                    notasFiltradas.map((nota) => (
                      <tr key={nota.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors">
                        <td className="p-4 text-xs whitespace-nowrap">
                          {new Date(nota.created_at).toLocaleString('pt-BR')}
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            nota.tipo === 'NFCE' 
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' 
                              : nota.tipo === 'NFE'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {nota.tipo}
                          </span>
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 dark:text-white">#{nota.numero || nota.ref?.substring(0, 12)}</span>
                            {nota.chave_nfe && (
                              <span className="text-[10px] font-mono text-gray-400 truncate max-w-[160px]">{nota.chave_nfe}</span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          R$ {Number(nota.valor_total || 0).toFixed(2)}
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            nota.status === 'AUTORIZADA' || nota.status === 'IMPORTADA'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : nota.status === 'REJEITADA' || nota.status === 'ERRO'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : nota.status === 'CANCELADA'
                              ? 'bg-gray-500/10 text-gray-500'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {nota.status}
                          </span>
                        </td>

                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {nota.danfe_url && (
                              <a
                                href={nota.danfe_url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-[#004198]/10 text-[#004198] dark:text-[#6B9EFF] hover:bg-[#004198]/20 text-xs font-bold flex items-center gap-1 transition-all"
                              >
                                <ExternalLink size={14} /> DANFE (PDF)
                              </a>
                            )}

                            {nota.xml_url && (
                              <a
                                href={nota.xml_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-all"
                                title="Baixar XML"
                              >
                                <FileCode size={16} />
                              </a>
                            )}

                            {nota.status === 'AUTORIZADA' && (
                              <button
                                onClick={() => setNotaParaCancelar(nota)}
                                className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all"
                                title="Cancelar Nota Fiscal"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: IMPORTAR XML DE FORNECEDORES (ESTOQUE) */}
      {abaAtiva === 'importar' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0B1120] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Box size={20} className="text-[#004198]" /> {tDynamic('Entrada de Mercadorias via XML de NFe (Fornecedores)')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Faça o upload do arquivo `.xml` fornecido pela sua distribuidora/fornecedor para ler automaticamente os itens, atualizar o custo unitário e incrementar o saldo no estoque do MiseOn.
            </p>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-[#004198] rounded-3xl p-8 text-center cursor-pointer transition-colors relative flex flex-col items-center justify-center">
              <input
                type="file"
                accept=".xml"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleXmlUpload(f);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileCode size={36} className="text-[#004198] dark:text-[#6B9EFF] mb-3 animate-bounce" />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                {xmlFile ? xmlFile.name : 'Arraste ou selecione o arquivo .xml da NFe'}
              </span>
              <span className="text-xs text-gray-400 mt-1">{tDynamic('Formato suportado: XML NFe Modelo 55 da SEFAZ')}</span>
            </div>
          </div>

          {/* Dados Lidos do XML */}
          {xmlDataParsed && (
            <div className="bg-white dark:bg-[#0B1120] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">{xmlDataParsed.fornecedorNome}</h3>
                  <p className="text-xs text-gray-500">CNPJ: {xmlDataParsed.fornecedorCnpj} | NFe Nº: {xmlDataParsed.numeroNota}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 uppercase font-bold block">{tDynamic('Valor Total da Nota')}</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">R$ {xmlDataParsed.valorTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Tabela de Itens */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 font-bold text-gray-400 uppercase">
                      <th className="p-3">Código</th>
                      <th className="p-3">{tDynamic('Descrição do Produto (NFe)')}</th>
                      <th className="p-3">Qtd</th>
                      <th className="p-3">Unid</th>
                      <th className="p-3">Custo Unit.</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">{tDynamic('Destino no Estoque')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-semibold">
                    {xmlDataParsed.itens.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-mono text-gray-400">{item.codigo}</td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{item.descricao}</td>
                        <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{item.quantidade}</td>
                        <td className="p-3">{item.unidade}</td>
                        <td className="p-3">R$ {item.valorUnitario.toFixed(2)}</td>
                        <td className="p-3 font-bold">R$ {item.valorTotal.toFixed(2)}</td>
                        <td className="p-3">
                          <select
                            value={item.categoriaDestino}
                            onChange={(e) => {
                              const cat = e.target.value as any;
                              const novosItens = [...xmlDataParsed.itens];
                              novosItens[idx].categoriaDestino = cat;
                              setXmlDataParsed({ ...xmlDataParsed, itens: novosItens });
                            }}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs font-bold outline-none"
                          >
                            <option value="insumo">{tDynamic('Insumo de Preparo')}</option>
                            <option value="venda_direta">Venda Direta / Revenda</option>
                            <option value="embalagem">Embalagem</option>
                            <option value="limpeza">{tDynamic('Material de Limpeza')}</option>
                            <option value="outros">Outros</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={processarEntradaEstoqueXml}
                  disabled={importandoXml}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {importandoXml ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Confirmar Entrada no Estoque
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Cancelamento de Nota */}
      {notaParaCancelar && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B1120] rounded-3xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Cancelar Nota Fiscal SEFAZ</h3>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Informe a justificativa legal para o cancelamento da nota #{notaParaCancelar.numero || notaParaCancelar.ref}. O cancelamento é irreversível perante a SEFAZ.
            </p>

            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">{tDynamic('Justificativa (Mínimo 15 caracteres) *')}</label>
              <textarea
                rows={3}
                value={justificativaCancelamento}
                onChange={(e) => setJustificativaCancelamento(e.target.value)}
                placeholder="Motivo legal do cancelamento..."
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-sm font-semibold outline-none focus:border-red-500"
              />
              <span className="text-[10px] text-gray-400">{justificativaCancelamento.length}/15 caracteres mínimos</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNotaParaCancelar(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={solicitarCancelamento}
                disabled={cancelando || justificativaCancelamento.length < 15}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {cancelando ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
