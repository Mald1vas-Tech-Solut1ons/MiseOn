import { useState } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';

import { maskCEP } from '../lib/mascaras';

export interface EnderecoFormData {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ponto_referencia: string;
  sem_numero: boolean;
}

interface Props {
  valorInicial?: Partial<EnderecoFormData>;
  onMudanca: (dados: EnderecoFormData) => void;
  className?: string;
}

export default function EnderecoMixin({ valorInicial, onMudanca, className = '' }: Props) {
  const [dados, setDados] = useState<EnderecoFormData>({
    cep: valorInicial?.cep ?? '',
    logradouro: valorInicial?.logradouro ?? '',
    numero: valorInicial?.numero ?? '',
    complemento: valorInicial?.complemento ?? '',
    bairro: valorInicial?.bairro ?? '',
    cidade: valorInicial?.cidade ?? '',
    uf: valorInicial?.uf ?? '',
    ponto_referencia: valorInicial?.ponto_referencia ?? '',
    sem_numero: valorInicial?.sem_numero ?? false,
  });
  const [buscando, setBuscando] = useState(false);
  const [erroCep, setErroCep] = useState('');

  const atualizar = (campo: keyof EnderecoFormData, valor: any) => {
    const novosDados = { ...dados, [campo]: valor };
    setDados(novosDados);
    onMudanca(novosDados);
  };

  const buscarCep = async (cepBruto: string) => {
    const cepFormatado = maskCEP(cepBruto);
    atualizar('cep', cepFormatado);
    
    const cepLimpo = cepFormatado.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    
    setBuscando(true);
    setErroCep('');
    
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      
      if (data.erro) {
        setErroCep('CEP não encontrado.');
      } else {
        const novosDados = {
          ...dados,
          cep: cepLimpo,
          logradouro: data.logradouro || dados.logradouro,
          bairro: data.bairro || dados.bairro,
          cidade: data.localidade || dados.cidade,
          uf: data.uf || dados.uf,
        };
        setDados(novosDados);
        onMudanca(novosDados);
      }
    } catch {
      setErroCep('Erro ao buscar o CEP.');
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-3.5 text-gray-400" size={16} />
        <input
          type="text"
          maxLength={9}
          value={dados.cep}
          onChange={(e) => buscarCep(e.target.value)}
          placeholder="CEP (Somente números)"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-10 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-950 dark:text-white"
        />
        <div className="absolute right-3 top-3.5 text-gray-400">
          {buscando ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
        </div>
      </div>
      {erroCep && <p className="text-xs text-red-500">{erroCep}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={dados.logradouro}
          onChange={(e) => atualizar('logradouro', e.target.value)}
          placeholder="Endereço (Rua/Avenida)"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-950 dark:text-white"
        />
        <input
          type="text"
          value={dados.bairro}
          onChange={(e) => atualizar('bairro', e.target.value)}
          placeholder="Bairro"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-950 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input
          type="text"
          value={dados.cidade}
          onChange={(e) => atualizar('cidade', e.target.value)}
          placeholder="Cidade"
          className="col-span-1 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-950 dark:text-white sm:col-span-2"
        />
        <input
          type="text"
          value={dados.uf}
          onChange={(e) => atualizar('uf', e.target.value)}
          placeholder="UF"
          maxLength={2}
          className="col-span-1 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm uppercase outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-950 dark:text-white sm:col-span-1"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 flex flex-col gap-1">
          <input
            type="text"
            value={dados.numero}
            disabled={dados.sem_numero}
            onChange={(e) => atualizar('numero', e.target.value)}
            placeholder="Número"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[var(--cor-primaria)] disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-xs opacity-90 text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={dados.sem_numero}
              onChange={(e) => {
                const s = e.target.checked;
                setDados(d => {
                  const novos = { ...d, sem_numero: s, numero: s ? 'SN' : '' };
                  onMudanca(novos);
                  return novos;
                });
              }}
              className="rounded text-[var(--cor-primaria)] focus:ring-0"
            />
            Sem número
          </label>
        </div>
        <div className="col-span-2">
          <input
            type="text"
            value={dados.complemento}
            onChange={(e) => atualizar('complemento', e.target.value)}
            placeholder="Complemento (Apto, Bloco...)"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-950 dark:text-white"
          />
        </div>
      </div>

      <input
        type="text"
        value={dados.ponto_referencia}
        onChange={(e) => atualizar('ponto_referencia', e.target.value)}
        placeholder="Ponto de Referência"
        className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-950 dark:text-white"
      />
    </div>
  );
}
