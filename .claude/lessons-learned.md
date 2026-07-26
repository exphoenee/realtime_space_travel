# Tanulságok (Lessons Learned)

Ebbe a fájlba gyűjtjük azokat a mintákat, hibákat és döntéseket, amiket érdemes megjegyezni a későbbi fázisokhoz.


## 009 — Firebase identitás-szétválás: a "non-fatal" fallback anti-pattern

**Tünet:** A Google user `rtdbKey`-ja `deviceId`-re esett vissza egy `catch`-ben, ami két különböző RTDB node-ot hozott létre ugyanahhoz a fiókhoz.

**Kiváltó ok:** `migrateGuestData:176` `guestData.wallet.credits = ...` bal oldali `?.` nélkül → `TypeError` guest node-ban nincs `wallet` → `catch { setRtdbKey(deviceId) }` → identitáscsere.

**Tanulság:**
1. **A non-fatal fallback, ami identitást cserél, nem non-fatal.** Ha egy fallback másik RTDB kulcsra vált, az adatvesztéshez vezet. A `catch` ág ne írjon felül strukturális identitás-információt.
2. **Az `rtdbKey` ne legyen külön írható state mező.** Legyen derivált érték (`selectRtdbKey` / `getRtdbKey`) — a `setRtdbKey` eltávolítása típusszinten garantálja, hogy a hiba többé nem fordul elő.
3. **Snapshot objektumokat ne mutáljunk.** `guestData.wallet.credits = ...` — ha a guest node-ban nincs `wallet`, a bal oldal `undefined`. Használj `DeepPartial`-t és építs fel egy külön updates objektumot.
4. **Multi-path `update(ref(db), {...})` atomikus:** egyetlen tranzakcióban ír target adatot + takarít + jelöl. A lépésenkénti alternatíva csak rollback-barát fallback.
5. **Idempotencia kapu:** `profile/migratedFrom/{deviceId}` jelölés biztosítja, hogy a migráció csak egyszer fusson le.
6. **Wallet politika:** ha a target node-nak van `wallet` ága, a target győz. Az elesett kredit audit-mezőbe kerül (`profile/orphanDiscardedCredits/{deviceId}`).
