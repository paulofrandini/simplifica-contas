# Simplifica Contas

Aplicação de organização financeira pessoal construída com Next.js, Supabase e PostgreSQL. Esta versão foi preparada para ser mantida em um repositório próprio e publicada na Vercel ou na Railway.

## Recursos atuais

- cadastro e confirmação de rendas;
- contas mensais para 1, 6 ou 12 meses;
- gastos avulsos;
- cartões por valor total ou por compras detalhadas;
- compras parceladas e faturas mensais;
- empréstimos e uso de limite bancário;
- investimentos informativos por instituição;
- saldo previsto e saldo realizado;
- histórico mensal e comparação dos últimos seis meses;
- layout responsivo para desktop e celular;
- cadastro, login, confirmação de e-mail e recuperação de senha pelo Supabase Auth;
- isolamento dos registros por usuário.

## Estrutura

| Pasta | Função |
|---|---|
| `app/` | páginas, painel e API financeira |
| `components/` | componentes visuais |
| `db/` | esquema Drizzle e conexão PostgreSQL |
| `lib/` | cálculos, autenticação e clientes Supabase |
| `supabase/migrations/` | criação das tabelas, índices e políticas RLS |
| `tests/` | testes dos cálculos e contratos essenciais |

## 1. Configurar o Supabase

1. Abra o projeto `simplifica-contas` no Supabase.
2. Entre em **SQL Editor**.
3. Copie todo o conteúdo de `supabase/migrations/0001_initial_schema.sql`.
4. Execute o script uma única vez.
5. Em **Authentication > URL Configuration**, defina:
   - Site URL local: `http://localhost:3000`;
   - Redirect URL local: `http://localhost:3000/**`;
   - depois da publicação, adicione `https://SEU-DOMINIO.vercel.app/**` ou `https://SEU-DOMINIO.up.railway.app/**`.
6. Mantenha o login por e-mail e senha habilitado.

O script cria as tabelas e ativa Row Level Security. Cada registro possui um `user_id` ligado ao usuário autenticado.

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
DATABASE_URL=postgresql://postgres.SEU_PROJECT_REF:SUA_SENHA@SEU_POOLER:6543/postgres
```

- URL e chave pública: **Project Settings > API**.
- `DATABASE_URL`: botão **Connect > Transaction pooler**.
- Substitua a senha na URL e codifique caracteres especiais quando necessário.
- Nunca envie `DATABASE_URL`, senha do banco ou `service_role` para o GitHub.

## 3. Rodar localmente

Requer Node.js 20.9 ou superior.

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## 4. Validar

```bash
npm test
npm run lint
npm run build
```

## 5. Enviar ao GitHub

Crie um repositório vazio e execute na pasta do projeto:

```bash
git init
git add .
git commit -m "feat: versão independente do Simplifica Contas"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

## 6. Publicar na Vercel

1. Importe o repositório do GitHub na Vercel.
2. Use o preset **Next.js**.
3. Cadastre as três variáveis do `.env.example` em **Environment Variables**.
4. Publique.
5. Volte ao Supabase e adicione o endereço definitivo em **Authentication > URL Configuration**.

O site pode ser atualizado depois apenas enviando novos commits para a branch `main`.

## 7. Publicar na Railway

1. Crie um projeto na Railway a partir do mesmo repositório do GitHub.
2. Cadastre as três variáveis do `.env.example` na área **Variables**.
3. A Railway detectará o projeto Node.js. Use `npm run build` como comando de build e `npm start` como comando de inicialização caso seja solicitado.
4. Gere um domínio público para o serviço.
5. Adicione esse endereço em **Authentication > URL Configuration** no Supabase.

O servidor usa a porta fornecida automaticamente pela variável `PORT`, portanto não é necessário fixar uma porta no repositório.

## Segurança

- A sessão é armazenada em cookies pelo `@supabase/ssr`.
- A API valida o usuário antes de qualquer consulta ou alteração.
- Todas as consultas financeiras incluem o identificador do usuário.
- O banco também possui políticas RLS como segunda camada de proteção.
- Valores monetários são armazenados em centavos.
- Nenhum número, validade ou código de segurança de cartão é solicitado.

## Observações

- A integração com cobrança Premium/Asaas ainda não está ativa; o banco já possui o campo de plano no perfil.
- Os dados pessoais cadastrados no protótipo antigo não fazem parte deste repositório. Eles devem ser migrados separadamente para não expor informações financeiras no GitHub.
