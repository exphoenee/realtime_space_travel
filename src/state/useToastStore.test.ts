import { describe, it, expect, beforeEach } from "vitest";
import useToastStore, {
  DEFAULT_TOAST_DURATION,
  MAX_TOASTS,
} from "./useToastStore";

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe("useToastStore", () => {
  it("addToast appends a toast with the given type and message", () => {
    useToastStore.getState().addToast("success", "Mission complete");

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe("success");
    expect(toasts[0].message).toBe("Mission complete");
    expect(toasts[0].id).toBeTruthy();
    expect(toasts[0].createdAt).toBeGreaterThan(0);
  });

  it("addToast uses the default duration when none is given", () => {
    useToastStore.getState().addToast("info", "No duration");

    expect(useToastStore.getState().toasts[0].duration).toBe(DEFAULT_TOAST_DURATION);
  });

  it("addToast honours an explicit duration", () => {
    useToastStore.getState().addToast("warning", "Custom", 1234);

    expect(useToastStore.getState().toasts[0].duration).toBe(1234);
  });

  it("gives every toast a unique id", () => {
    const { addToast } = useToastStore.getState();
    addToast("info", "a");
    addToast("info", "b");
    addToast("info", "c");

    const ids = useToastStore.getState().toasts.map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("dismissToast removes only the matching toast", () => {
    const { addToast } = useToastStore.getState();
    addToast("info", "first");
    addToast("error", "second");

    const targetId = useToastStore.getState().toasts[0].id;
    useToastStore.getState().dismissToast(targetId);

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("second");
  });

  it("dismissToast with an unknown id is a no-op", () => {
    useToastStore.getState().addToast("info", "kept");
    useToastStore.getState().dismissToast("does-not-exist");

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("keeps at most MAX_TOASTS, dropping the oldest (FIFO)", () => {
    const { addToast } = useToastStore.getState();
    for (let i = 1; i <= MAX_TOASTS + 3; i++) {
      addToast("info", `msg-${i}`);
    }

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(MAX_TOASTS);
    // The three oldest fell out; the newest is last.
    expect(toasts[0].message).toBe("msg-4");
    expect(toasts[MAX_TOASTS - 1].message).toBe(`msg-${MAX_TOASTS + 3}`);
  });
});
