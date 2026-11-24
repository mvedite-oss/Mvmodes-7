# MV Upload

## Correção do upload

O upload agora usa `XMLHttpRequest` com eventos reais de progresso.

A barra começa em `0%` e avança conforme os bytes são enviados.
Ela chega a `100%` somente após o Supabase confirmar o upload.

## Configuração necessária

1. Execute o `banco.sql` no Supabase.
2. Aguarde a implantação do GitHub Pages.
3. Clique em **ADM** e digite **360**.
4. Selecione e envie o arquivo.
