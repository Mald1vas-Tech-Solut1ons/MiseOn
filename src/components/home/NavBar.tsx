import MiseOnLogo from '../MiseOnLogo';

export function NavBar() {
  return (
    <nav
      style={{ background: 'rgba(7,12,24,0.85)', borderBottom: '1px solid rgba(10,92,196,0.2)', backdropFilter: 'blur(16px)' }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="drop-shadow-[0_0_12px_rgba(255,255,255,0.3)] filter">
          <MiseOnLogo size={140} />
        </div>
        <div className="hidden items-center gap-6 md:flex">
          <a href="/autoatendimento" className="text-sm font-bold text-[#FC5B24] transition hover:brightness-110 flex items-center gap-1">
            Totem Kiosk <span className="rounded-full bg-[#FC5B24]/20 px-1.5 py-0.5 text-[10px] uppercase font-black text-[#FC5B24]">NOVO</span>
          </a>
          <a href="#recursos" className="text-sm font-semibold text-gray-400 transition hover:text-white">Recursos</a>
          <a href="#ia" className="text-sm font-semibold text-gray-400 transition hover:text-white">IA Atendente</a>
          <a href="#taxas" className="text-sm font-semibold text-gray-400 transition hover:text-white">Taxas</a>
          <a href="#planos" className="text-sm font-semibold text-gray-400 transition hover:text-white">Planos</a>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/acesso"
            className="hidden text-sm font-semibold text-[#EAF1FB] opacity-70 transition hover:opacity-100 sm:inline"
          >
            Acessos
          </a>
          <a
            href="/cadastre-se"
            style={{ background: '#FC5B24', color: '#fff', fontFamily: "'Sora', sans-serif" }}
            className="rounded-full px-5 py-2.5 text-sm font-bold shadow-lg transition hover:scale-105 hover:brightness-110"
          >
            Criar minha loja
          </a>
        </div>
      </div>
    </nav>
  );
}
