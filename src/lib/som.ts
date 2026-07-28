// Campainha sintetizada via Web Audio — sem depender de arquivo externo.
let ctx: AudioContext | null = null;
let desbloqueioArmado = false;

// O navegador cria o AudioContext em estado "suspended" enquanto a aba não
// recebeu nenhuma interação do usuário (política de autoplay). Sem resume(),
// todo som sai mudo — a notificação aparecia na tela e nada tocava.
function contexto(): AudioContext | null {
  try {
    const AudioCtor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioCtor) return null;
    ctx ??= new AudioCtor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Destrava o áudio no primeiro gesto do usuário (clique ou tecla). Chamado uma
// vez pelo AdminLayout: a partir daí a campainha toca mesmo com a aba em segundo
// plano, que é o caso real — o lojista não fica olhando o painel.
export function armarDesbloqueioDeSom() {
  if (desbloqueioArmado || typeof window === 'undefined') return;
  desbloqueioArmado = true;

  const destravar = () => {
    const audio = contexto();
    if (audio?.state === 'running') {
      window.removeEventListener('pointerdown', destravar);
      window.removeEventListener('keydown', destravar);
    }
  };

  window.addEventListener('pointerdown', destravar);
  window.addEventListener('keydown', destravar);
}

export function tocarSom() {
  const audio = contexto();
  if (!audio) return;

  const emitir = () => {
    try {
      [0, 0.2].forEach((t) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.frequency.value = 880;
        o.connect(g);
        g.connect(audio.destination);
        g.gain.setValueAtTime(0.4, audio.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.5);
        o.start(audio.currentTime + t);
        o.stop(audio.currentTime + t + 0.5);
      });
    } catch (e) {
      console.warn('Falha ao tocar a campainha:', e);
    }
  };

  // Ainda suspenso: espera o resume() resolver antes de agendar os osciladores,
  // senão eles tocam no vazio e o alerta se perde.
  if (audio.state === 'suspended') {
    audio.resume().then(emitir).catch((e) => console.warn('AudioContext bloqueado pelo navegador:', e));
    return;
  }
  emitir();
}
