Social es multiplayer specifikacio - vazlat

Cel
- A jatekosok tudjanak egymassal kapcsolatot tartani, baratokat kezelni, uzeneteket kuldeni, es egymas jatekaba meghivassal vagy csatlakozassal belepni.
- A multiplayer alapelve: egy kozos kuldetesben eleg, ha legalabb egy resztvevo figyeli a kepernyot, de a jatek kozben latszodjon, hogy ki figyel es ki nem.

Funkciok
- Baratok menu a fomenuben.
- Baratlista online statusszal.
- Barathoz meghivas kuldese.
- Barat futobb jatekahoz csatlakozas.
- Privat uzenetek baratok kozott.
- Jatek kozbeni resztvevo lista a jobb felso sarokban.
- Resztvevonkent figyel / nem figyel allapot kijelzese.

Multiplayer alapmukodes
- Egy jatekos elindit egy kuldetest, o lesz a host.
- A host meghivhat baratokat a kuldetesbe.
- A meghivott jatekos elfogadas utan resztvevokent belep a kuldetesbe.
- A kuldetes figyelmi feltetele csapatszintu: ha legalabb egy aktiv resztvevo figyel, a kuldetes nem bukik el figyelmetlenseg miatt.
- Ha senki nem figyel, a jatek ugyanugy veszelybe kerul, mint single player modban.
- A jobb felso sarokban megjelenik a resztvevok neve es aktualis figyelmi allapota.

Eventek multiplayerben
- Multiplayer kuldetesben egy adott event mindig csak egy kijelolt jatekost erint kozvetlenul.
- Az event interaktiv UI-ja, dontesi helyzete vagy teendoje csak az erintett jatekosnal jelenik meg.
- A tobbi resztvevonek ugyanazt az eventet nem kell interaktiv modon megjeleniteni.
- Ha az event globalis kovetkezmennyel jar, a hatas az osszes resztvevore ervenyesul.
- Pelda: ha az erintett jatekosnak mentohajora kell atszallnia, akkor a multiplayer session kozos hajostate-je is valtozik, es a tobbi jatekosnal is lecserelodik az urhajo / muszerfal.
- Az eventtel kozvetlenul nem erintett resztvevok kapjanak rovid tajekoztatast toasttal, statusz uzenettel vagy mas nem blokkoló UI-jelzessel.
- Pelda tajekoztatas: "Anna mentohajora szallt at", "Bela kikerulesi manovere miatt az utido megnott", "Csaba hibas utasitast kapott hard modban".
- A tajekoztato uzenet ne igenyeljen dontest az eventtel nem erintett jatekosoktol, csak tegye erthetove, mi tortent es miert valtozott a kozos allapot.

Nyitott kerdesek
1. Baratkozas
- Dontes: a user kereshessen nickname es email alapjan is.
- Dontes: user ID alapjan egyertelmuen meg lehessen talalni valakit friend request kuldesehez.
- Dontes: lehessen emailes meghivot kuldeni olyan usernek is, akit a jatekos meg akar hivni.
- Emailes meghivo tisztazando: csak regisztralt usernek kuldjon meghivot, vagy nem regisztralt email cimre is menjen invite link?
- Dontes: a baratkozas mindig baratkeressel tortenik, amit a masik fel elfogadhat vagy elutasithat.

2. Uzenetek
- Dontes: a privat chat kell az MVP-ben.
- Dontes: az elso verzio privat chatet tartalmaz ket barat kozott.
- Kell olvasatlan uzenet jelzes?
- A chat csak a Baratok menuben legyen, vagy jatek kozben is elerheto legyen?

3. Online statusz
- Milyen statuszok legyenek: offline, online, jatekban, figyel, nem figyel?
- A "figyel / nem figyel" csak jatek kozben jelenjen meg, vagy a baratlistaban is?

4. Meghivas es csatlakozas
- Meghivast csak aktiv kuldetesbe lehessen kuldeni, vagy mar kuldetesvalasztas elott is?
- A meghivott jatekos popupot kapjon, vagy a Baratok menuben lassa a meghivast?
- Dontes: csatlakozashoz mindig host jovahagyas kell.
- A csatlakozni probalo barat join requestet kuld a hostnak.
- A host elfogadhatja vagy elutasithatja a join requestet.
- Dontes: mar elindult, futo kuldeteshez is lehet csatlakozni.
- Futo kuldeteshez csatlakozasnal is host jovahagyas kell.

5. Host es session szabalyok
- Mi tortenjen, ha a host kilep?
- A kuldetes folytatodjon, ha marad legalabb egy resztvevo?
- Legyen maximum letszam egy multiplayer kuldetesben?

6. Figyelesi szabaly
- Dontes: easy es medium fokozaton eleg, ha legalabb egy aktiv resztvevo figyel.
- Dontes: hard fokozaton mindenkinek figyelnie kell.
- Mennyi ido utan bukjon a csapat, ha senki nem figyel?

6/B. Multiplayer event szabalyok
- Dontes: egy event kozvetlenul mindig csak egy jatekost erint.
- Dontes: az event UI-ja csak az erintett jatekosnal jelenik meg.
- Dontes: globalis kovetkezmeny eseten minden resztvevo allapota frissul.
- Dontes: a nem erintett jatekosok toast vagy statusz uzenet formaban tajekoztatast kapnak.
- Dontes: az eventtel erintett jatekost azok kozul valassza a rendszer, akik eppen figyelnek.
- Ha tobb figyelo jatekos van, kozuluk random vagy sulyozott random valasztas tortenjen.
- Ha senki nem figyel, ne induljon uj interaktiv event; ilyenkor a figyelmetlensegi veszteseg szabalyai ervenyesek.
- Tisztazando: ha az erintett jatekos nem reagal idoben, a teljes csapat bukjon, vagy csak globalis buntetest kapjon?

7. Jutalom es bukas
- Dontes: sikeres kuldetesnel a resztvevok osztoznak a rewardon.
- A kuldetes teljes jutalma a resztvevok kozott kerul felosztasra.
- Csak azok kapjanak jutalmat, akik a kuldetes vegen online vannak?
- Kapjon extra jutalmat az, aki aktivan figyelt?
- Ha a csapat elbukik, minden resztvevo veszitsen?

8. Elso verzio hatara
- Dontes: az MVP tartalmazza a privat chatet is.
- Dontes: MVP scope = baratlista + invite/join + jatek kozbeni figyelmi lista + privat chat.
- MVP-ben a friend request is szukseges, mert a baratlista alapfeltetele.
- Kell-e vendeg / linkes csatlakozas, vagy csak bejelentkezett userek kozott mukodjon?
