# Brick Breaker: Vault

Klasicka HTML5 brick breaker hra bez zavislosti, ale v "insane crazy" podani:
kostky se skryvaji za ocelovou zdi, do ktere vede jen mala centralni skulina.
Hrac musi kulicku do skuliny presne trefit a projit zkroucenou chodbou
z neznicitelnych ocelovych bloku - teprve na jejim konci se dostane ke
znicitelnym kostkam. Staci otevrit `index.html` v prohlizeci.

## Funkce

- Husta jednobarevna mrizka drobnych kostek (72 x 48 bunek) za ocelovou zdi.
- **Mala centralni skulina (1 bunka)** - mireni musi byt co nejpresnejsi.
- **Zkroucena chodba z neznicitelnych ocelovych bloku** - kulicka musi projit dlouhou cestu, nez se dostane ke kostkam.
- Kulicka se odrazi od kazde kostky, takze kazdy vstup do kostkoveho pole je poradna vyzva.
- V kostkovem poli nejsou neznicitelne kostky, takze level jde vzdy dokoncit.
- Kdyz zbyva poslednich par kostek, ocelove steny povoli a otevre se cesta ke zbytku.
- Kdyz se kulicka zasekne v koute mezi ocelovymi bloky, po 5 s se vrati na palku (text OSVOBOZENO).
- Mala kulicka (polomer 4) a drobne kostky - poradne husty a chaosem nabity feeling.
- 6 tematickych levelu s jinym barevnym ladenim a jinym tvarem bludiste, 5 zivotu.
- Hudba na pozadi a zvukove efekty, tlacitko pro ztlumeni (volba se pamatuje).
- Skalovani hraci plochy podle displeje (ostre i na 4K a retina obrazovkach).
- **Combo system** - kazda znicena kostka zvysuje combo, nasobek skore az x25.
- **Zlate kostky** - velky bonus a zaruceny power-up.
- **Neznicitelne ocelove kostky** - odrazeji kulicku, nelze je rozbit.
- Screen shake, castice, plovouci texty a zvuky generovane pres WebAudio (lze vypnout).

## Bonusy

| Bonus | Vyznam |
|-------|--------|
| M (zelena) | Multi - pribudou 3 kulicky |
| X (ruzova) | Crazy - pribudne 8 kulicek |
| W (modra) | Sirsi palka na 16 s |
| S (tyrkysova) | Pomale kulicky na 9 s |
| C (fialova) | Lepiva palka - kulicku chyti, vystrelis znovu |
| + (cervena) | Extra zivot |

Ocelove zdi a bloky jsou neznicitelne vzdy. Hra je bez bomb, fireballu a laseru - o to vic zalezi na presnem mireni a cisteni pole.

## Hudba

Playlist se sam posouva po skonceni tracku, novy track se nahodi i pri novem startu hry.

- `assets/neon-gaming.mp3` - "Neon Gaming" od dopestuff, stazeno z Pixabay (https://pixabay.com/music/synthwave-neon-gaming-128925/), licence Pixabay Content License.
- `assets/shades-of-city.mp3` - "Shades of City (Neon Vibe)" od AlexGrohl, stazeno z Pixabay (https://pixabay.com/music/synthwave-shades-of-city-neon-vibe-195917/), licence Pixabay Content License.
- `assets/synthwave.mp3` - "Synthwave" od penguinmusic, stazeno z Pixabay (https://pixabay.com/music/synthwave-synthwave-181569/), licence Pixabay Content License.

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

## Deploy na LXC server

Repozitar je verejny, takze na LXC neni potreba token.

### Prvni nasazeni

```bash
ssh root@<IP_LXC>
git clone https://github.com/Finito3/OpenCode_brick-breaker.git /home/Scripts_systemctl/brick-breaker
cp /home/Scripts_systemctl/brick-breaker/deploy/brick-breaker.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now brick-breaker.service
```

Hra pak bezi na `http://<IP_LXC>:5901`.

### Dalsi aktualizace

```bash
cd /home/Scripts_systemctl/brick-breaker
./git_deploy.sh
```

`git_deploy.sh` stahne zmeny (`git pull --ff-only`) a restartuje `brick-breaker.service`.

### Varianta s nginx

Pokud uz na LXC bezi nginx, staci repo naklonovat do web rootu a v konfiguraci nastavit root na adresar projektu:

```bash
git clone https://github.com/Finito3/OpenCode_brick-breaker.git /var/www/brick-breaker
```

Aktualizace je pak jen `cd /var/www/brick-breaker && git pull --ff-only`.
