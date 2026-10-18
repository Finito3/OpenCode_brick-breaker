# Brick Breaker

Klasicka HTML5 brick breaker hra bez zavislosti. Staci otevrit `index.html` v prohlizeci.

## Funkce

- Klasicka mrizka kostek s odrazem kulicky od palky podle mista zasahu.
- **Neznicitelne ocelove kostky** - kulicka se od nich odrazi, nelze je rozbit (ani fireballem).
- **Nasobeni kulicek (multiball)** a dalsi bonusy.
- 6 levelu s rostouci obtiznosti, skore, zivoty a bonusy za dokonceni levelu.
- Zvuky generovane pres WebAudio (lze vypnout), castice, trail kulicky.

## Bonusy

| Bonus | Vyznam |
|-------|--------|
| M (zelena) | Multiball - pribudou 2 kulicky |
| W (modra) | Sirsi palka na 16 s |
| S (tyrkysova) | Pomale kulicky na 9 s |
| + (cervena) | Extra zivot |
| L (oranzova) | Laser - palka automaticky strili na 13 s |
| C (fialova) | Lepiva palka - kulicku chyti, vystrelis znovu |
| F (zluta) | Fireball - kulicka prochazi pres barevne kostky na 10 s |

Ocelove kostky jsou neznicitelne vzdy - ani fireball je nerozbije.

## Ovladani

- Mys / prst: pohyb palky, klik / tap = start a vystreleni.
- Klavesnice: sipky nebo A/D = pohyb, mezernik = start / vystrelit, P nebo Esc = pauza.
- Tlacitka pod plochou: doleva, start, doprava.

## Spusteni

Otevri `index.html` primo v prohlizeci, nebo spust lokalni server:

```bash
python3 -m http.server 8080
```

a navstiv `http://localhost:8080`.

## Deploy

```bash
./git_deploy.sh
```
