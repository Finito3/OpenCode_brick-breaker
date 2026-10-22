# AGENTS.md - Brick Breaker

## Projekt
- Staticka HTML5 hra brick breaker s ocelovou zdi, jednobunkovym vstupem a zkroucenou ocelovou chodbou k poli drobnych kostek (canvas, ciste HTML/CSS/JS, bez zavislosti).
- Vstupni bod: `index.html`, herni logika: `game.js`, styly: `style.css`.

## Git repozitar projektu (POVINNE)
- Projekt ma vlastni samostatny Git repozitar v tomto adresari.
- Vzdaleny repozitar (remote `origin`) je VZDY `github.com/Finito3/OpenCode_brick-breaker`.
- Upload postup: `git init` -> `git remote add origin https://github.com/Finito3/OpenCode_brick-breaker.git` -> `git add .` -> `git commit -m "Initial commit"` -> `git push -u origin main`.
- Nikdy necommituj provozni data ani secrets (viz `.gitignore`).
- Heslo/token pro push nikdy neuvadej do konfigurace ani do commitu.

## Vyvoj
- Hra je ciste staticka, po zmene staci obnovit stranku v prohlizeci.
- Kontrola syntaxe: `node --check game.js`.
- Vsechny `*.md` soubory pis bez diakritiky.
- Deploy: `./git_deploy.sh`.
