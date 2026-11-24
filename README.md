# MV Upload

Site simples de envio e compartilhamento de arquivos.

## Funcionalidades

- Um único botão **ADM** com senha `360`
- Seleção ou arraste de arquivo
- Upload para o Supabase Storage
- Registro do nome, tamanho, tipo, caminho, URL e data no banco
- Lista dos arquivos enviados no modo ADM
- Geração automática de link público permanente
- Sem conta de usuário e sem expiração

## Configuração do banco

1. Abra o Supabase.
2. Execute todo o conteúdo de `banco.sql` no SQL Editor.
3. A tabela `public.upload_files` será criada.
4. O bucket público `uploads` será criado.
5. Publique `index.html`, `style.css` e `app.js` no GitHub Pages ou Netlify.
