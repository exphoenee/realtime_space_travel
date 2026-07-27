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


## 011 — Eseményrendszer: időzített események és a timer callback guard-ok

**Tünet:** A `useEventSystem` hook `isAttentionLost` állapotban is triggerelt eseményeket, mert a timer callback guard condition-je nem ellenőrizte ezt a flaget.

**Kiváltó ok:** A `scheduleNext()` függvény már ellenőrizte az `isAttentionLost`-ot (és 1 másodperces retry timer-t állított be), de a **timer callback**, ami a tényleges `triggerEvent`-et hívja, csak `isPaused`-ot ellenőrzött. Amikor a játékos figyelme elveszett a timer beállítása és lefutása között, a callback nem vette észre, és az esemény mégis triggerelődött.

**Tanulság:**
1. **Dupla guard réteg:** Mind a `scheduleNext()` függvényben, mind a timer callback-ben ellenőrizni kell az összes blokkoló állapotot (`isPaused`, `isAttentionLost`, `activeEvent`, `gamePhase`). A `scheduleNext()` guard megakadályozza az új timer beállítását, de a már beállított timer callback guard nélkül átcsúszhat.
2. **Egyetlen setTimeout lánc (nem setInterval):** Az esemény ütemező egyetlen `setTimeout` láncot használ — minden esemény után a callback meghívja a `scheduleNext()`-et. Ez megakadályozza a párhuzamos timer-ek versenyhelyzetét.
3. **Determinisztikus tesztelés fake timer-ekkel:** A `vi.useFakeTimers()` + `vi.advanceTimersByTime()` lehetővé teszi az időzítés-alapú logika tesztelését anélkül, hogy valós időt kellene várni. A random jitter miatt érdemes alul-/felülről közelíteni (pl. 1 perc = nincs esemény, 6 perc = van esemény), és a `triggerManualEvent` segítségével tesztelni a pool-okat.
4. **A `triggerManualEvent` debug függvény értékes teszteszköz:** Lehetővé teszi, hogy a store event-logikáját (triggerEvent → resolveEvent/dismissEvent → cockpitVariant, asteroidWarning, eventPenaltyYears) időzítés nélkül, izoláltan teszteljük.
5. **useCallback([]) + getState() minta:** A hook `useCallback`-et használ üres függőségi listával, és a store-ból `getState()`-val olvas — ez a minta stabil referenciát ad, miközben mindig friss adatokat használ. A `useEffect` függőségek így nem okoznak felesleges újrafutást.

## 011 — Dashboard esemény-integráció: cockpitVariant és asteroidWarning

**Tünet:** A mentőhajó átszállás (`rescue-transfer`) esemény után a Dashboard ugyanazt a cockpit képet mutatta, nem jelzett vizuális változást.

**Megoldás:** A `useGameStore`-ba bevezetett `cockpitVariant` (`"default"` | `"rescue"`) és `asteroidWarning` mezők, amelyeket a `resolveEvent` szükség szerint állít. A Dashboard ezek alapján:
- Mentőhajó módban: zöld keret, hue-rotate CSS filter, „🚑 Rescue Ship" banner
- Aszteroida esetén: piros pulzáló figyelmeztető banner, ami automatikusan eltűnik az esemény után

**Tanulság:**
1. **Az esemény hatásának nem csak a modalban kell megjelennie.** A Dashboard vizuális visszajelzése (bannerek, keret színváltás) erősíti a narratív feszültséget.
2. **A CSS filter (`hue-rotate`) olcsó és hatékony módja a cockpit változás jelzésének** — nem kell hozzá külön kép.
3. **Az `asteroidWarning`-ot minden ágon tisztítani kell:** `resolveEvent(true)`, `resolveEvent(false)`, `dismissEvent()`, `resetToMenu()`. A kódban ezt egységesen kell kezelni, különben a banner ragadós marad.
