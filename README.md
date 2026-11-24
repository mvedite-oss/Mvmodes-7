# MV Upload

Uploader público com painel administrativo por senha.

## Erro de envio

Se aparecer `Bucket uploads não encontrado` ou `Permissão negada`:

1. Abra o Supabase usado pelo site.
2. Vá em **SQL Editor**.
3. Cole todo o conteúdo de [`banco.sql`](banco.sql).
4. Clique em **Run**.
5. Recarregue o site e tente novamente.

## Funcionamento

- Clique em `ADM` e digite `360`.
- Selecione o arquivo.
- Clique em `Enviar arquivo`.
- O arquivo é enviado ao bucket `uploads`.
- Um link público é gerado.
- Os metadados são registrados na tabela `upload_files`.

A senha atual está no JavaScript do site e não protege o Supabase por si só. Qualquer pessoa com acesso ao código ou às credenciais públicas pode abrir o painel ou enviar arquivos enquanto as políticas SQL forem públicas.
