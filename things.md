# Outpost

## Deno Deploy
```
accept:  */*
accept-encoding:  gzip, br
accept-language:  *
cdn-loop:  deno;s=deno;d=ah40t9m8n54g
host:  bad-goat-66.deno.dev
user-agent:  Deno/1.34.1
```

## Deno
```
accept:  */*
accept-encoding:  gzip, br
accept-language:  *
host:  bad-goat-66.deno.dev
user-agent:  Deno/1.34.3
```

## Edge
```
accept:  text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7
accept-encoding:  gzip, deflate, br
accept-language:  en-US,en;q=0.9
host:  bad-goat-66.deno.dev
referer:  https://dash.deno.com/
sec-ch-ua:  "Microsoft Edge";v="117", "Not;A=Brand";v="8", "Chromium";v="117"
sec-ch-ua-mobile:  ?0
sec-ch-ua-platform:  "Windows"
sec-fetch-dest:  iframe
sec-fetch-mode:  navigate
sec-fetch-site:  cross-site
upgrade-insecure-requests:  1
user-agent:  Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Edg/117.0.0.0
```

## Firefox
```
accept:  text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8
accept-encoding:  gzip, deflate, br
accept-language:  en-US,en;q=0.5
host:  bad-goat-66.deno.dev
sec-fetch-dest:  document
sec-fetch-mode:  navigate
sec-fetch-site:  cross-site
te:  trailers
upgrade-insecure-requests:  1
user-agent:  Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0
```

When a requet comes in:
- if its for a transpile-able document:
  - if its a request from deno:
    - 