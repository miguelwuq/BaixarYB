# BaixarYB

Aplicacao em Next.js para buscar um video do YouTube, mostrar thumbnail, titulo, nome do canal e disponibilizar links de download por qualidade.

## Rodar localmente

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

## Subir para GitHub

```bash
git init
git add .
git commit -m "feat: cria baixaryb"
git branch -M main
git remote add origin SEU_REPOSITORIO_GITHUB
git push -u origin main
```

## Publicar no Vercel

1. Crie um novo projeto na Vercel.
2. Importe o repositorio do GitHub.
3. Mantenha as configuracoes padrao de Next.js.
4. Clique em deploy.

Depois disso, cada `git push` na branch conectada gera um deploy novo automaticamente. Na pratica, o site fica atualizado em tempo real a cada envio novo para o GitHub.

## Seguranca aplicada

- Links de download assinados com expiracao curta.
- Rate limit nas rotas da API para reduzir abuso automatizado.
- Validacao estrita de URL, tamanho de payload e origem da requisicao.
- Headers de seguranca como CSP, HSTS, `X-Frame-Options` e `nosniff`.
- Respostas da API com `no-store` para evitar cache indevido.
- Validacao do destino do redirect para impedir redirecionamento aberto.

## Configuracao recomendada no Vercel

Defina a variavel `DOWNLOAD_TOKEN_SECRET` com um valor longo e aleatorio no projeto da Vercel antes de publicar em producao.

## Observacoes

- O endpoint de download redireciona o navegador para a URL temporaria da midia.
- Isso reduz carga no servidor e tende a funcionar melhor em ambientes serverless como Vercel.
- Use apenas para conteudos que voce possui permissao para baixar.
- Nenhum site fica protegido de todos os ataques possiveis, mas esta base ficou bem mais endurecida contra abuso comum e exposicao desnecessaria de dados.
