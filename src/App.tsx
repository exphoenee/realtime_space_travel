import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import ScreenRouter from "./components/routing/ScreenRouter";
import Starfield from "./components/ui/Starfield";
import Dashboard from "./components/features/Dashboard";
import PauseMenu from "./components/features/PauseMenu";
import DebugOverlay from "./components/features/DebugOverlay";
import DebugEventBar from "./components/features/DebugEventBar";
import ToastContainer from "./components/features/ToastContainer";

import useGameStore from "./state/useGameStore";
import useUIStore from "./state/useUIStore";
import useAuthStore, { getRtdbKey } from "./state/useAuthStore";
import useShopStore from "./state/useShopStore";
import useToastStore from "./state/useToastStore";
import { clearUserScopedData } from "./state/clearUserScopedData";
import {
  getCameraPermissionState,
  needsCameraConsent,
} from "./services/cameraPermission";
import { useAudio } from "./hooks/useAudio";
import { useWeather } from "./hooks/useWeather";
import { useCamera } from "./hooks/useCamera";
import { useFaceDetection } from "./hooks/useFaceDetection";
import { useAttentionMonitor } from "./hooks/useAttentionMonitor";
import { usePageLeave } from "./hooks/usePageLeave";
import { useEventSystem } from "./hooks/useEventSystem";
import { useNotificationListener } from "./hooks/useNotificationListener";
import { useFriendPresenceToasts } from "./hooks/useFriendPresenceToasts";
import i18n from "./i18n/index";
import { initFirebase } from "./firebase/config";
import { startAuthBootstrap } from "./firebase/authBootstrap";
import { updateUserSettings, updateOnlineStatus, migrateWallData, updateUserPublicProfile } from "./firebase/userData";
import type { UserNode } from "./firebase/userData";
import { BASE_EXOPLANET_IDS, getShipImageById } from "./constants/shopCatalog";

import { Destination } from "./types";
import { saveFailureRecord, saveSuccessRecord, mapPurchases } from "./firebase/userData";
import {
  ATTENTION_INTERVAL_MS,
  INACTIVITY_LIMIT_SECONDS,
  INTRO_AUTO_SKIP_TIMEOUT_MS,
  SERVICE_UPDATE_INTERVAL_MS,
  SHIP_SPEED_KM_PER_SECOND,
  TRAVEL_YEARS_PER_SECOND,
} from "./constants/constants";
import styles from "./App.module.css";

const App: React.FC = () => {
  const { t } = useTranslation();
  const {
    gamePhase,
    destination,
    remainingYears,
    shipSpeedKmPerSecond,
    isPaused,
    isAttentionLost,
    inactivitySeconds,
    crewLost,
    crewLostReason,
    missionComplete,
    serviceSeconds,
    bestServiceSeconds,
    showIntro,
    setRemainingYears,
    setIsPaused,
    setIsAttentionLost,
    setInactivitySeconds,
    setCrewLost,
    setCrewLostReason,
    setMissionComplete,
    setServiceSeconds,
    setBestServiceSeconds,
    setShowIntro,
    debugIgnoreAttention,
    setDebugIgnoreAttention,
    startMission,
    resetToMenu,
  } = useGameStore();

  const {
    cameraError,
    showExitConfirm,
    isMusicMuted,
    musicVolume,
    setCameraError,
    setShowExitConfirm,
    debugMode,
  } = useUIStore();

  const [canvasBounds, setCanvasBounds] = useState<DOMRectReadOnly | null>(null);

  const activeMusicId = useUIStore((s) => s.activeMusicId);
  const activeShipId = useUIStore((s) => s.activeShipId);
  const { playMusic } = useAudio(activeMusicId);
  const localWeather = useWeather(destination);
  const { videoRef, isStreamReady } = useCamera(destination);
  const { debugCanvasRef, faceStatus, debugMetrics } = useFaceDetection(
    videoRef,
    destination,
    isStreamReady,
    debugMode,
  );
  useAttentionMonitor(faceStatus, destination);
  usePageLeave();
  const { triggerManualEvent } = useEventSystem();
  // Single global subscription to `notifications/{authUid}` → toasts + badge.
  useNotificationListener();
  useFriendPresenceToasts();

  // Auto-record failure when crewLost is triggered (all paths)
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prevState) => {
      if (state.gamePhase === "crewLost" && prevState.gamePhase !== "crewLost") {
        // Record failure in local store first
        const gs = useGameStore.getState();
        gs.recordFailure();

        // Then persist to RTDB if signed in
        const rtdbKey = getRtdbKey();
        if (rtdbKey) {
          // Read the just-recorded failure from the updated store
          const updated = useGameStore.getState();
          const latest = updated.failureRecords[updated.failureRecords.length - 1];
          if (latest) {
            saveFailureRecord(rtdbKey, latest).catch(console.error);
          }
        }
      }
    });
    return () => unsub();
  }, []);

  // Watch isMusicMuted changes → persist to RTDB.
  // Guard against the initial mount: the auth bootstrap (ensureDeviceMap +
  // ensureUserNode) may not have completed yet, and writing to RTDB before
  // the device_map entry exists triggers a PERMISSION_DENIED.
  useEffect(() => {
    const { _initialized } = useAuthStore.getState();
    const rtdbKey = getRtdbKey();
    if (_initialized && rtdbKey) {
      updateUserSettings(rtdbKey, { musicMuted: isMusicMuted }).catch(console.error);
    }
  }, [isMusicMuted]);

  // Initialize Firebase on mount + boot the auth lifecycle singleton
  useEffect(() => {
    initFirebase();

    /** Sync RTDB user data into local stores. */
    const handleUserData = (data: UserNode | null) => {
      if (!data) return;

      const ui = useUIStore.getState();
      const shop = useShopStore.getState();

      // Settings → useUIStore
      if (data.settings) {
        const s = data.settings;
        if (s.musicMuted !== undefined && s.musicMuted !== ui.isMusicMuted) {
          ui.setIsMusicMuted(s.musicMuted);
        }
        if (s.activeMusicId !== undefined && s.activeMusicId !== ui.activeMusicId) {
          ui.setActiveMusicId(s.activeMusicId);
        }
        if (s.activeShipId !== undefined && s.activeShipId !== ui.activeShipId) {
          // Validate against RTDB snapshot inventory (not store, which may not be synced yet)
          const ownedShipsFromSnapshot = data.inventory?.ships
            ? Object.keys(data.inventory.ships).filter((k) => data.inventory.ships![k])
            : shop.owned.ships;
          if (s.activeShipId === null || ownedShipsFromSnapshot.includes(s.activeShipId)) {
            ui.setActiveShipId(s.activeShipId);
          } else {
            // Not owned anymore — reset to null and write back to RTDB
            ui.setActiveShipId(null);
            const rtdbKey = getRtdbKey();
            if (rtdbKey) {
              updateUserSettings(rtdbKey, { activeShipId: null }).catch(console.error);
            }
          }
        }
        if (s.musicVolume !== undefined && s.musicVolume !== ui.musicVolume) {
          ui.setMusicVolume(s.musicVolume);
        }
        if (s.difficulty !== undefined && s.difficulty !== ui.difficulty) {
          ui.setDifficulty(s.difficulty as any);
        }
        if (s.cameraConsent !== undefined && s.cameraConsent !== ui.cameraConsent) {
          ui.setCameraConsent(s.cameraConsent);
        }
        if (s.language && s.language !== i18n.language) {
          i18n.changeLanguage(s.language);
        }
      }

      // Stats → useGameStore
      if (data.stats?.bestServiceSeconds !== undefined) {
        const gs = useGameStore.getState();
        const rtdb = data.stats.bestServiceSeconds;
        const local = gs.bestServiceSeconds;
        if (rtdb > local) {
          gs.setBestServiceSeconds(rtdb);
        }
      }

      // Profile → useAuthStore (nickname + displayName)
      if (data.profile) {
        const storeNickname = data.profile.nickname;
        const storeDisplayName = data.profile.displayName;

        if (storeNickname !== undefined) {
          useAuthStore.getState().setNickname(storeNickname);
        }
        // Sync RTDB displayName as fallback (some linked accounts lack
        // Firebase Auth user.displayName, but RTDB persists the correct value).
        if (storeDisplayName) {
          useAuthStore.getState().setDisplayName(storeDisplayName);
        }

        // Sync nickname to usersPublic so friends searching can find the user
        // by their nickname, and the friend wall title shows the nickname.
        // authBootstrap.ts also calls updateUserPublicProfile, but at that point
        // the auth store's nickname may still be empty (synced async via RTDB).
        // This ensures usersPublic has the correct nickname once RTDB data loads.
        if (storeNickname !== undefined) {
          const rtdbKey = getRtdbKey();
          if (rtdbKey) {
            updateUserPublicProfile(
              rtdbKey,
              storeNickname,
              storeDisplayName ?? null,
            ).catch(console.error);
          }
        }
      }

      // Wallet + Inventory → useShopStore. RTDB is the single source of truth:
      // a missing branch means the value is 0 / empty, NOT "keep the local
      // value". setCredits also flips creditsLoaded → true.
      shop.setCredits(data.wallet?.credits ?? 0);

      const inv = data.inventory;
      // Missing RTDB branch → fallback (empty, except exoplanets → base set).
      const mergeInventory = (
        rtdbItems: Record<string, boolean> | undefined,
        fallback: string[],
      ): string[] => {
        if (!rtdbItems) return fallback;
        return Object.keys(rtdbItems).filter((k) => rtdbItems[k]);
      };
      const newShips = mergeInventory(inv?.ships, []);
      const newMusic = mergeInventory(inv?.music, []);
      const newExos = mergeInventory(inv?.exoplanets, [...BASE_EXOPLANET_IDS]);
      // Purchase history → useShopStore. Arrives with the rest of the user
      // node (subscribeUser reads `users/{uid}` wholesale), so no separate
      // subscription is needed. RTDB replaces the optimistic local array.
      shop.setPurchaseHistory(mapPurchases(data.purchases));

      if (
        JSON.stringify(newShips) !== JSON.stringify(shop.owned.ships) ||
        JSON.stringify(newMusic) !== JSON.stringify(shop.owned.music) ||
        JSON.stringify(newExos) !== JSON.stringify(shop.owned.exoplanets)
      ) {
        shop.setOwned({ ships: newShips, music: newMusic, exoplanets: newExos });
      }
    };

    startAuthBootstrap(handleUserData);

    // Detect returning from Stripe Payment Link (/shop/success).
    // The SPA always loads index.html regardless of path, so the path is
    // preserved. Auto-navigate to shop so ShopScreen's useEffect can
    // process the pending purchase from sessionStorage/localStorage.
    if (window.location.pathname.includes("/shop/success")) {
      // Use a micro-task so the current render cycle settles first,
      // then bypass the intro and go straight to the shop.
      queueMicrotask(() => {
        useGameStore.getState().transitionTo("shop");
      });
    }

    // Listen for language changes → persist to RTDB
    const handleLanguageChange = (lng: string) => {
      const rtdbKey = getRtdbKey();
      if (rtdbKey) {
        updateUserSettings(rtdbKey, { language: lng }).catch(console.error);
      }
    };
    i18n.on("languageChanged", handleLanguageChange);

    return () => {
      // Note: startAuthBootstrap is a module-level singleton and is intentionally
      // NOT torn down here — keeping it alive across a StrictMode remount is what
      // prevents a second anonymous login.
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, []);

  // One-time wall data migration: when uid becomes available, copy old
  // failure/success data from users/{uid}/ to walls/{uid}/ so friends can
  // read them (users/$key/.read blocks friends at the parent level).
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state, prev) => {
      if (state.uid && state.uid !== prev.uid) {
        migrateWallData(state.uid).catch(console.error);
      }
    });
    return () => unsub();
  }, []);

  // Identity change → drop the previous account's locally cached data.
  //
  // Only a REGISTERED (non-anonymous) identity is tracked. Going guest→Google
  // is the same human upgrading their session — `migrateGuestData` moves that
  // data to the new uid, so it must NOT be wiped. Going Google→signed-out or
  // Google→another Google account is a different person on this browser.
  useEffect(() => {
    const currentUser = useAuthStore.getState().user;
    let lastAuthedUid =
      currentUser && !currentUser.isAnonymous ? currentUser.uid : null;

    const unsub = useAuthStore.subscribe((state) => {
      const authedUid =
        state.user && !state.user.isAnonymous ? state.user.uid : null;
      if (lastAuthedUid && lastAuthedUid !== authedUid) {
        clearUserScopedData();
      }
      lastAuthedUid = authedUid;
    });
    return () => unsub();
  }, []);

  // After Zustand persist rehydrates the saved game state on page refresh,
  // re-apply the boolean flags (showIntro, isPaused, isAttentionLost, etc.)
  // so they are consistent with the restored gamePhase.
  //
  // NOTE: Camera permission is NOT requested here — the browser prompt must
  // only appear AFTER the user has seen and accepted our camera consent UI
  // (CameraConsentScreen). The getUserMedia call lives exclusively in the
  // CameraConsentScreen "Allow" handler.
  useEffect(() => {
    // Use a macrotask so it runs after persist has finished rehydrating
    // (which happens in a microtask after create()).
    const timer = setTimeout(() => {
      const gs = useGameStore.getState();

      // Re-apply phase flags only — never call getUserMedia here
      if (gs.gamePhase !== "intro") {
        gs.transitionTo(gs.gamePhase);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const checkCamera = useCallback(async (): Promise<boolean> => {
    // The cameraError overlay only renders during gameplay, but this check
    // runs in the pre-game ship select — without a toast a failure would
    // leave the Launch button doing nothing at all.
    const failWith = (message: string) => {
      setCameraError(message);
      useToastStore.getState().addToast("error", message, 7000);
      return false;
    };

    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      return failWith(t("app.camera.noSupport"));
    }

    if (!window.FaceDetection) {
      return failWith(t("app.camera.noModel"));
    }

    // Deliberately NO getUserMedia here. `useCamera` opens the live stream a
    // moment later, and opening + closing the device right before that is how
    // the mission launch used to die on a NotReadableError — Windows does not
    // release a webcam instantly. Asking the Permissions API costs nothing and
    // catches the only case worth blocking on: an outright denied permission.
    if ((await getCameraPermissionState()) === "denied") {
      return failWith(t("app.camera.denied"));
    }

    setCameraError(null);
    return true;
  }, [setCameraError, t]);

  const handleSelectDestination = async (selectedDestination: Destination) => {
    setShowExitConfirm(false);
    // Go to ship selection directly (camera check happens after ship select)
    useGameStore.getState().selectDestinationForShip(selectedDestination);
  };

  const handleRequestExit = () => {
    setShowExitConfirm(true);
    setIsPaused(true);
  };

  const updateBestServiceTime = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      setBestServiceSeconds((prev) => (seconds <= prev ? prev : seconds));
    },
    [setBestServiceSeconds],
  );

  const handleConfirmExit = () => {
    updateBestServiceTime(serviceSeconds);
    setShowExitConfirm(false);
    setCameraError(null);

    const gs = useGameStore.getState();
    if (gs.destination) {
      // Record the exit as a failure and reset to menu
      gs.exitMission();

      // Persist to RTDB if signed in
      const rtdbKey = getRtdbKey();
      if (rtdbKey) {
        const updated = useGameStore.getState();
        const latest = updated.failureRecords[updated.failureRecords.length - 1];
        if (latest) {
          saveFailureRecord(rtdbKey, latest).catch(console.error);
        }
      }
    } else {
      resetToMenu();
    }
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
    if (!crewLost && !missionComplete) {
      if (gamePhase === "paused" || gamePhase === "countdown") {
        useGameStore.getState().transitionTo("playing");
      } else {
        setIsPaused(false);
      }
    }
  };

  const isPreGame =
    gamePhase === "intro" ||
    gamePhase === "cameraConsent" ||
    gamePhase === "mainMenu" ||
    gamePhase === "missionSelect" ||
    gamePhase === "shipSelect" ||
    gamePhase === "settings" ||
    gamePhase === "shop" ||
    gamePhase === "loading" ||
    gamePhase === "wallOfShame" ||
    gamePhase === "friends" ||
    gamePhase === "friendWall" ||
    gamePhase === "chat";

  const attentionCountdown =
    gamePhase === "countdown"
      ? Math.max(0, INACTIVITY_LIMIT_SECONDS - inactivitySeconds)
      : null;

  const handleCanvasBoundsChange = useCallback(
    (bounds: DOMRectReadOnly) => {
      setCanvasBounds(bounds);
    },
    [setCanvasBounds],
  );

  const handleSkipIntro = useCallback(() => {
    const ui = useUIStore.getState();

    // Replaying the intro from the menu is not a game start — back to the
    // menu, no camera question, even when permission is missing.
    if (ui.introReplay) {
      ui.setIntroReplay(false);
      useGameStore.getState().transitionTo("mainMenu");
      return;
    }

    // The intro on first load: ask for the camera here, so the permission is
    // already settled by the time the player hits Start. Consent granted from
    // here still lands in the menu — only the Start button starts a mission.
    needsCameraConsent(ui.cameraConsent).then((needed) => {
      if (needed) {
        ui.setCameraConsentOrigin("boot");
        useGameStore.getState().transitionTo("cameraConsent");
      } else {
        useGameStore.getState().transitionTo("mainMenu");
      }
    });
  }, []);

  const handleLoadingComplete = useCallback(() => {
    useGameStore.getState().transitionTo("playing");
  }, []);

  const serviceMinutes = serviceSeconds / 60;
  const bestServiceMinutes = bestServiceSeconds / 60;
  const crewLostMessage =
    crewLostReason === "buttons"
      ? t("app.crewLostButtons")
      : crewLostReason === "exit"
        ? t("app.crewLostExit")
        : t("app.crewLostAttention");

  // Pause overlay visible when in paused/countdown phase and no blocking overlays
  const isPauseOverlayVisible =
    (gamePhase === "paused" || gamePhase === "countdown") &&
    !cameraError &&
    !showExitConfirm;

  useEffect(() => {
    if (!showIntro) return;

    const timer = window.setTimeout(
      handleSkipIntro,
      INTRO_AUTO_SKIP_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [showIntro, handleSkipIntro]);

  useEffect(() => {
    if (!showIntro) return;

    const handleSkip = () => {
      handleSkipIntro();
    };

    window.addEventListener("keydown", handleSkip);
    window.addEventListener("mousedown", handleSkip);
    window.addEventListener("touchstart", handleSkip);

    return () => {
      window.removeEventListener("keydown", handleSkip);
      window.removeEventListener("mousedown", handleSkip);
      window.removeEventListener("touchstart", handleSkip);
    };
  }, [showIntro, handleSkipIntro]);

  useEffect(() => {
    if (!destination) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Escape" || e.key === "Tab" || e.key.startsWith("F")) return;

      const gameState = useGameStore.getState();
      const uiState = useUIStore.getState();
      if (
        gameState.crewLost ||
        gameState.missionComplete ||
        uiState.showExitConfirm
      ) {
        return;
      }      updateBestServiceTime(gameState.serviceSeconds);
          gameState.transitionTo("crewLost");
          gameState.setCrewLostReason("buttons");
          uiState.setShowExitConfirm(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [destination, updateBestServiceTime]);

  const shouldPlayMusic =
    gamePhase !== "shop" &&
    (!destination ||
      (!showExitConfirm &&
        !cameraError &&
        !crewLost &&
        !missionComplete &&
        isPaused));

  useEffect(() => {
    playMusic(shouldPlayMusic, isMusicMuted, musicVolume);
  }, [shouldPlayMusic, isMusicMuted, musicVolume, playMusic]);

  useEffect(() => {
    if (!destination || isPaused || crewLost || missionComplete) {
      return;
    }

    const deltaSeconds = SERVICE_UPDATE_INTERVAL_MS / 1000;
    const interval = window.setInterval(() => {
      setServiceSeconds((prev) => prev + deltaSeconds);
      // Read the current ship speed from the store each tick so that
      // speed changes (e.g. rescue ship) affect the travel rate.
      const currentSpeed = useGameStore.getState().shipSpeedKmPerSecond;
      const speedRatio = currentSpeed / SHIP_SPEED_KM_PER_SECOND;
      setRemainingYears((prev) => {
        if (prev <= 0) {
          return 0;
        }

        const next = prev - deltaSeconds * TRAVEL_YEARS_PER_SECOND * speedRatio;
        return next <= 0 ? 0 : next;
      });
    }, SERVICE_UPDATE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [
    destination,
    isPaused,
    crewLost,
    missionComplete,
  ]);

  useEffect(() => {
    if (!isAttentionLost) {
      setInactivitySeconds(0);
    }
  }, [isAttentionLost]);

  useEffect(() => {
    if (!destination || !isAttentionLost || crewLost || missionComplete) {
      return;
    }

    const interval = window.setInterval(() => {
      const state = useGameStore.getState();

      // First tick: transition from paused → countdown
      if (state.inactivitySeconds === 0 && state.gamePhase === "paused") {
        state.transitionTo("countdown");
      }

      setInactivitySeconds((prev) => {
        const next = prev + 1;
        if (next >= INACTIVITY_LIMIT_SECONDS) {
          updateBestServiceTime(state.serviceSeconds);
          state.transitionTo("crewLost");
          state.setCrewLostReason("attention");
          useUIStore.getState().setShowExitConfirm(false);
          return INACTIVITY_LIMIT_SECONDS;
        }
        return next;
      });
    }, ATTENTION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [
    destination,
    isAttentionLost,
    crewLost,
    missionComplete,
    updateBestServiceTime,
  ]);

  // Watch gamePhase changes → update online status
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prevState) => {
      if (state.gamePhase === prevState.gamePhase) return;

      const rtdbKey = getRtdbKey();
      if (!rtdbKey) return;

      // Set status based on current phase
      if (state.gamePhase === "playing" || state.gamePhase === "loading") {
        updateOnlineStatus(rtdbKey, "in-game").catch(console.error);
      } else if (
        state.gamePhase === "mainMenu" ||
        state.gamePhase === "intro" ||
        state.gamePhase === "settings" ||
        state.gamePhase === "shop" ||
        state.gamePhase === "wallOfShame" ||
        state.gamePhase === "friends" ||
        state.gamePhase === "friendWall" ||
        state.gamePhase === "chat"
      ) {
        updateOnlineStatus(rtdbKey, "online").catch(console.error);
      } else if (
        state.gamePhase === "crewLost" ||
        state.gamePhase === "missionComplete"
      ) {
        // Brief moment of online before transitioning back to menu
        updateOnlineStatus(rtdbKey, "online").catch(console.error);
      }
    });

    return () => unsub();
  }, []);

  // Check for pending destruction (rescue-transfer ignored)
  useEffect(() => {
    if (!destination || crewLost || missionComplete) return;

    const interval = window.setInterval(() => {
      const state = useGameStore.getState();
      if (
        state.pendingDestructionAt &&
        Date.now() >= state.pendingDestructionAt &&
        state.gamePhase === "playing"
      ) {
        state.transitionTo("crewLost");
        state.setCrewLostReason("event");
        state.cancelDestruction();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [destination, crewLost, missionComplete]);

  useEffect(() => {
    if (!destination || missionComplete || crewLost) {
      return;
    }

    if (remainingYears <= 0) {
      const gs = useGameStore.getState();
      updateBestServiceTime(gs.serviceSeconds);
      gs.recordMissionComplete();
      // Persist success record to RTDB so friends can see it
      const rtdbKey = getRtdbKey();
      if (rtdbKey) {
        const updated = useGameStore.getState();
        const latest = updated.successRecords[updated.successRecords.length - 1];
        if (latest) {
          saveSuccessRecord(rtdbKey, latest).catch(console.error);
        }
      }
      gs.transitionTo("missionComplete");
      setShowExitConfirm(false);
    }
  }, [
    destination,
    remainingYears,
    missionComplete,
    crewLost,
    updateBestServiceTime,
  ]);

  return (
    <>
      {/* Outside both branches so system toasts show in menus AND in-game. */}
      <ToastContainer />

      {isPreGame ? (
        <main className={styles.app}>
          <Starfield key="pregame" onCanvasBoundsChange={handleCanvasBoundsChange} />
          <ScreenRouter
            phase={gamePhase}
            onSkipIntro={handleSkipIntro}
            onSelectDestination={handleSelectDestination}
            onLoadingComplete={handleLoadingComplete}
            onCheckCamera={checkCamera}
          />

          {/* A camera failure during `loading` used to be invisible — the error
              overlay below only exists in the gameplay branch — leaving the
              player staring at a spinner that never finishes. The other
              pre-game screens report their camera problems as a toast and stay
              usable, so only the loading screen gets this blocking card. */}
          {gamePhase === "loading" && cameraError && (
            <div className={`${styles.overlay} ${styles.cameraError}`}>
              <div className={`${styles.overlayCard} ${styles.cameraErrorCard}`}>
                <h2 className={styles.cameraErrorTitle}>{t("app.errorTitle")}</h2>
                <p className={styles.cameraErrorText}>{cameraError}</p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={() => {
                      setCameraError(null);
                      resetToMenu();
                    }}
                    className={`${styles.button} ${styles.neutralButton}`}
                  >
                    {t("app.backToMenu")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      ) : !destination ? null : (
        <main className={styles.app}>
          <Starfield
            key="gameplay"
            onCanvasBoundsChange={handleCanvasBoundsChange}
            isPaused={isPauseOverlayVisible}
            cockpitImageUrl={`${import.meta.env.BASE_URL}spaceships/${getShipImageById(activeShipId)}`}
          />
          {canvasBounds && (
            <div
              className={styles.canvasControls}
              style={{
                top: canvasBounds.top,
                left: canvasBounds.left,
                width: canvasBounds.width,
                height: canvasBounds.height,
              }}
            >
              <button onClick={handleRequestExit} className={styles.exitButton} aria-label={t("app.exitAria")}>
                {t("app.exit")}
              </button>
              <div className={styles.statsPanel}>
                <p>{t("app.serviceTime", { minutes: serviceMinutes.toFixed(2) })}</p>
                <p className={styles.statsRecord}>
                  {t("app.record", { minutes: bestServiceMinutes.toFixed(2) })}
                </p>
              </div>
            </div>
          )}
          <div className={styles.dashboardWrapper}>
            <Dashboard
              remainingYears={remainingYears}
              destinationName={destination.name}
              localWeather={localWeather}
              currentSpeedKmPerSecond={shipSpeedKmPerSecond}
            />
          </div>

          {missionComplete && (
            <div className={styles.overlay}>
              <div className={`${styles.overlayCard} ${styles.successCard}`}>
                <h2 className={styles.overlayTitle}>{t("app.missionCompleteTitle")}</h2>
                <p className={styles.overlayText}>
                  {t("app.missionCompleteText")}
                </p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={handleConfirmExit}
                    className={`${styles.button} ${styles.successButton}`}
                  >
                    {t("app.backToMenu")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {crewLost && (
            <div className={styles.overlay}>
              <div className={`${styles.overlayCard} ${styles.dangerCard}`}>
                <h2 className={styles.overlayTitle}>{t("app.gameOverTitle")}</h2>
                <p className={styles.overlayText}>{crewLostMessage}</p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={handleConfirmExit}
                    className={`${styles.button} ${styles.dangerButton}`}
                  >
                    {t("app.backToMenu")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showExitConfirm ? (
            <div className={styles.overlay}>
              <div className={`${styles.overlayCard} ${styles.neutralCard}`}>
                <h2 className={styles.overlayTitle}>{t("app.exitConfirmTitle")}</h2>
                <p className={styles.overlayText}>
                  {t("app.exitConfirmText")}
                </p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={handleConfirmExit}
                    className={`${styles.button} ${styles.dangerButton}`}
                  >
                    {t("app.yes")}
                  </button>
                  <button
                    onClick={handleCancelExit}
                    className={`${styles.button} ${styles.neutralButton}`}
                  >
                    {t("app.no")}
                  </button>
                </div>
              </div>
            </div>
          ) : cameraError ? (
            <div className={`${styles.overlay} ${styles.cameraError}`}>
              <div className={`${styles.overlayCard} ${styles.cameraErrorCard}`}>
                <h2 className={styles.cameraErrorTitle}>{t("app.errorTitle")}</h2>
                <p className={styles.cameraErrorText}>{cameraError}</p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={() => {
                      useUIStore.getState().setCameraError(null);
                      useGameStore.getState().setIsPaused(false);
                    }}
                    className={`${styles.button} ${styles.neutralButton}`}
                  >
                    {t("app.retry")}
                  </button>
                </div>
              </div>
            </div>
          ) : isPauseOverlayVisible ? (
            <PauseMenu countdownSeconds={attentionCountdown} />
          ) : null}

          {debugMode && (
            <DebugOverlay
              debugCanvasRef={debugCanvasRef}
              faceStatus={faceStatus}
              debugMetrics={debugMetrics}
              debugIgnoreAttention={debugIgnoreAttention}
              setDebugIgnoreAttention={setDebugIgnoreAttention}
              canvasBounds={canvasBounds}
              videoRef={videoRef}
              destination={destination}
            />
          )}

          {debugMode && !isPreGame && (
            <DebugEventBar onTrigger={triggerManualEvent} />
          )}
        </main>
      )}

      {/* Video element rendered unconditionally so the camera stream persists across phase changes */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: "none", position: "absolute" }}
      />
    </>
  );
};

export default App;
