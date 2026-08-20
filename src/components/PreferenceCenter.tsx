import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useI18n } from '../contexts/I18nContext';
interface Preferences {
  marketing_allowed: boolean;
  transactional_allowed: boolean;
}

export const PreferenceCenter: React.FC = () => {
  const { tDynamic } = useI18n();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('email_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching preferences:', error);
          toast.error('Erro ao carregar preferências de e-mail.');
          return;
        }

        if (data) {
          setPreferences({
            marketing_allowed: data.marketing_allowed,
            transactional_allowed: data.transactional_allowed
          });
        } else {
          // Defaults
          setPreferences({ marketing_allowed: false, transactional_allowed: true });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const handleToggle = async (key: keyof Preferences) => {
    if (!preferences) return;
    const newValue = !preferences[key];
    setPreferences(prev => prev ? { ...prev, [key]: newValue } : null);
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('email_preferences')
        .upsert({
          user_id: user.id,
          marketing_allowed: key === 'marketing_allowed' ? newValue : preferences.marketing_allowed,
          transactional_allowed: key === 'transactional_allowed' ? newValue : preferences.transactional_allowed,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Preferências de e-mail atualizadas.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar preferências.');
      // Revert optimism
      setPreferences(prev => prev ? { ...prev, [key]: !newValue } : null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="animate-spin text-[var(--cor-secundaria)]" size={24} />
      </div>
    );
  }

  if (!preferences) return null;

  return (
    <div className="bg-[var(--cor-surface)] border border-[var(--cor-borda)] rounded-xl p-6 shadow-sm max-w-lg w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-[var(--cor-fundo)] rounded-lg text-[var(--cor-secundaria)]">
          <Settings size={22} />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-[var(--cor-texto)]">{tDynamic('Centro de Preferências')}</h3>
          <p className="text-sm text-[var(--cor-texto-suave)]">{tDynamic('Gerencie suas comunicações por e-mail.')}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Emails Transacionais */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--cor-fundo)] border border-[var(--cor-borda)] transition-colors hover:bg-[var(--cor-surface)]">
          <div className="flex items-center gap-3">
            <Mail className="text-[var(--cor-texto-suave)]" size={20} />
            <div>
              <p className="font-medium text-[var(--cor-texto)]">Emails Transacionais</p>
              <p className="text-xs text-[var(--cor-texto-fraco)] max-w-[240px]">{tDynamic('Recibos, atualizações de pedidos e alertas essenciais da conta.')}</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={preferences.transactional_allowed}
              onChange={() => handleToggle('transactional_allowed')}
              disabled={saving}
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--cor-secundaria)]"></div>
          </label>
        </div>

        {/* Emails de Marketing */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--cor-fundo)] border border-[var(--cor-borda)] transition-colors hover:bg-[var(--cor-surface)]">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-[var(--cor-texto-suave)]" size={20} />
            <div>
              <p className="font-medium text-[var(--cor-texto)]">Ofertas e Marketing</p>
              <p className="text-xs text-[var(--cor-texto-fraco)] max-w-[240px]">{tDynamic('Novidades do sistema, dicas operacionais e promoções exclusivas.')}</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={preferences.marketing_allowed}
              onChange={() => handleToggle('marketing_allowed')}
              disabled={saving}
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--cor-primaria)]"></div>
          </label>
        </div>
      </div>
    </div>
  );
};
