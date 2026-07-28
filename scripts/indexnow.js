// Notifica os buscadores que suportam IndexNow assim que o site é publicado,
// em vez de esperar o rastreamento passar sozinho (que pode levar semanas).
//
// Um POST no endpoint da api.indexnow.org propaga para todos os buscadores do
// consórcio: Bing, Yandex, Seznam e Naver. O Google não participa do IndexNow
// — ele descobre pelo sitemap.xml, gerado no mesmo build.
//
// AS URLS VÊM DE scripts/public-routes.mjs, a mesma fonte que gera o
// sitemap.xml e o HTML estático das rotas. A versão anterior tinha 5 URLs
// escritas à mão e estava desatualizada: faltavam as 9 landing pages de
// nicho, /videos, /cadastre-se, /lojas e /gestao-de-estoque-3d — justamente
// as páginas de aquisição. Ao criar rota nova, ela passa a ser notificada
// sozinha.
//
// Uso: `npm run indexnow` DEPOIS do deploy ter subido. Notificar antes faz o
// buscador rastrear a versão antiga que ainda está no ar.
import https from 'https';
import { PUBLIC_ROUTES } from './public-routes.mjs';

const host = 'miseon.app.br';
const key = '85ab415ae21f43bb8c74ac936ea56de5';
const keyLocation = `https://${host}/${key}.txt`;

// Só as rotas canônicas. As de DUPLICATE_ROUTES (/depoimentos, /demonstracao,
// /ajuda/estoque) declaram canonical apontando para outra URL — submetê-las
// seria pedir ao buscador para indexar conteúdo duplicado.
const urlList = PUBLIC_ROUTES.map((r) => `https://${host}${r.path}`);

const payload = JSON.stringify({ host, key, keyLocation, urlList });

/**
 * Confere que a chave está publicada ANTES de submeter.
 * O endpoint do IndexNow responde 200 na hora e só depois vai buscar
 * keyLocation para provar que somos donos do domínio — se der 404 ali, ele
 * descarta tudo em silêncio e o 200 vira falso positivo.
 * Isso já aconteceu: os dois arquivos de chave foram deletados de public/ no
 * commit 583a2bf e ficaram 404 em produção sem ninguém notar.
 */
function verificarChave() {
  return new Promise((resolve) => {
    https
      .get(keyLocation, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body: body.trim() }));
      })
      .on('error', () => resolve({ status: 0, body: '' }));
  });
}

const check = await verificarChave();
if (check.status !== 200 || check.body !== key) {
  console.error(`\n❌ A chave do IndexNow não está publicada corretamente.`);
  console.error(`   ${keyLocation} → HTTP ${check.status}`);
  console.error(`   esperado no corpo: "${key}" | recebido: "${check.body.slice(0, 40)}"`);
  console.error(`\n   O arquivo precisa existir em public/${key}.txt contendo exatamente a chave.`);
  console.error(`   Sem isso o Bing descarta a submissão, mesmo respondendo 200. Nada foi enviado.\n`);
  process.exit(1);
}
console.log(`Chave validada em ${keyLocation}`);

console.log(`Enviando ${urlList.length} URLs ao IndexNow (Bing, Yandex, Seznam, Naver)...`);

const req = https.request(
  'https://api.indexnow.org/indexnow',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (res) => {
    console.log(`IndexNow: ${res.statusCode} ${res.statusMessage}`);
    res.on('data', (d) => process.stdout.write(d));
    res.on('end', () => {
      if (res.statusCode === 200 || res.statusCode === 202) {
        console.log(`✅ ${urlList.length} URLs notificadas.`);
      } else {
        // Não derruba o processo: falhar em notificar um buscador não é
        // motivo para bloquear nada. As URLs seguem no sitemap.xml.
        console.warn('⚠️  IndexNow não confirmou o recebimento. O sitemap.xml continua valendo.');
      }
    });
  }
);

req.on('error', (e) => {
  console.error('⚠️  Erro ao contatar o IndexNow:', e.message);
});

req.write(payload);
req.end();
