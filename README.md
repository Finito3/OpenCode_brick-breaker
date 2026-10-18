# Brick Breaker: Vault

Klasicka HTML5 brick breaker hra bez zavislosti, ale v "insane crazy" podani:
kostky se skryvaji v ocelove komnate, do ktere vede jen mala skulina a uzka
ulicka. Hrac musi kulicku do skuliny trefit - teprve pak se dostane ke
znicitelnym kostkam. Staci otevrit `index.html` v prohlizeci.

## Funkce

- Husta mozaika malych kostek (36 x 28 bunek) ukryta za ocelovou zdi.
- **Mala skulina + uzka ulicka** - kulicka musi proskakat ulickou, aby se dostala dovnitr.
- Kulicka se odrazi od kazde kostky, takze kazdy vstup do komnaty je poradna vyzva.
- Vice skulin a ulicek vyssich levelech (az 3 vstupy).
- Obrazce z prazdnych bunek: logo N se srdcem, hvezda, srdce, lebka, smajlik, diamant.
- 6 tematickych levelu s rostouci obtiznosti, 5 zivotu.
- Hudba na pozadi a zvukove efekty, tlacitko pro ztlumeni (volba se pamatuje).
- **Combo system** - kazda znicena kostka zvysuje combo, nasobek skore az x25.
- **Vybusne kostky** - tmave bomby po zniceni exploduji a spousti retezove reakce.
- **Zlate kostky** - velky bonus a zaruceny power-up.
- **Neznicitelne ocelove kostky** - odrazeji kulicku, nelze je rozbit ani fireballem.
- Screen shake, castice, plovouci texty a zvuky generovane pres WebAudio (lze vypnout).

## Bonusy

| Bonus | Vyznam |
|-------|--------|
| M (zelena) | Multi - pribudou 3 kulicky |
| X (ruzova) | Crazy - pribudne 8 kulicek a fireball |
| W (modra) | Sirsi palka na 16 s |
| S (tyrkysova) | Pomale kulicky na 9 s |
| L (oranzova) | Laser - palka automaticky strili na 13 s |
| C (fialova) | Lepiva palka - kulicku chyti, vystrelis znovu |
| F (zluta) | Fireball - kulicka prochazi pres barevne kostky na 10 s |
| B (cervena) | Bomb ball - kazdy zasah kostky vybuchne na 9 s |
| + (cervena) | Extra zivot |

Ocelove kostky jsou neznicitelne vzdy - ani bomb ball nebo fireball je nerozbije.

## Hudba

- `assets/neon-gaming.mp3` - "Neon Gaming" od dopestuff, stazeno z Pixabay (https://pixabay.com/music/synthwave-neon-gaming-128925/), licence Pixabay Content License (zdarma i komercne, bez atribuce).

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
