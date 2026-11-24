# MV Upload

## Configuração completa

1. Abra o projeto Supabase que está configurado no arquivo `app.js`.
2. Abra **SQL Editor**.
3. Cole todo o conteúdo de `banco.sql`.
4. Clique em **Run**.
5. Abra o site no GitHub Pages ou Netlify.
6. Clique em **ADM**, digite `360` e envie o arquivo.

## O que o banco configura

- Cria o bucket público `uploads`.
- Permite leitura e envio público de arquivos.
- Cria a tabela `public.upload_files`.
- Permite inserir e listar metadados dos arquivos.

## Observações

- Links públicos não expiram por configuração do site.
- O limite real vem do plano e do armazenamento do Supabase.
- A senha `360` protegida somente no JavaScript é uma senha de interface, não autenticação segura no servidor.
- Para evitar abusos, o uso público das políticas deve ser limitado por regras reais de autorização ou por uma aplicação servidor segura.
