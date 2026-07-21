import type { LevelObjectData } from "../../game/level/document";
import {
  applyLevelObjectShape,
  setWallEndpoints,
} from "../../game/level/geometry";
import type { EditorEnv } from "./env";
import type { EditorGesture } from "./gestures";
import type { EditorSession } from "./session";

const findObject = (env: EditorEnv, id: string | null) => {
  if (!id) {
    return null;
  }
  return env.getObjects().find((object) => object.id === id) ?? null;
};

export function rollbackGesture(
  session: EditorSession,
  env: EditorEnv,
  gesture: EditorGesture
): void {
  if (gesture.kind === "move" && gesture.changed) {
    if (gesture.inserted) {
      const inserted = [...gesture.originals.keys()]
        .map((id) => findObject(env, id))
        .filter((object): object is LevelObjectData => Boolean(object));
      env.callbacks.onDiscard(inserted);
      session.selection.replaceAll(gesture.sourceSelection);
      return;
    }
    const restored: LevelObjectData[] = [];
    for (const [id, original] of gesture.originals) {
      const object = findObject(env, id);
      if (!object) {
        continue;
      }
      Object.assign(object, structuredClone(original));
      restored.push(object);
    }
    env.callbacks.onObjectsChange(restored);
    return;
  }

  if (gesture.kind === "move" && gesture.inserted) {
    const inserted = [...gesture.originals.keys()]
      .map((id) => findObject(env, id))
      .filter((object): object is LevelObjectData => Boolean(object));
    env.callbacks.onDiscard(inserted);
    session.selection.replaceAll(gesture.sourceSelection);
    return;
  }

  if (
    (gesture.kind === "resize" || gesture.kind === "rotate") &&
    gesture.changed
  ) {
    const object = findObject(env, gesture.objectId);
    if (object) {
      applyLevelObjectShape(object, gesture.startShape);
      env.callbacks.onObjectsChange([object]);
    }
    return;
  }

  if (gesture.kind === "wall-endpoint" && gesture.changed) {
    const object = findObject(env, gesture.objectId);
    if (object?.prefab === "wall") {
      setWallEndpoints(object, gesture.start, gesture.end);
      env.callbacks.onObjectsChange([object]);
    }
    return;
  }

  if (gesture.kind === "motion-range" && gesture.changed) {
    const object = findObject(env, gesture.objectId);
    if (object) {
      object.motion = structuredClone(gesture.startMotion);
      env.callbacks.onObjectsChange([object]);
    }
    return;
  }

  if (gesture.kind === "marquee") {
    session.selection.replaceAll(gesture.initialSelection);
  }
}

export function cancelGesture(session: EditorSession, env: EditorEnv): void {
  if (session.gesture) {
    const gesture = session.gesture;
    rollbackGesture(session, env, gesture);
    env.releasePointer(gesture.pointerId);
  }
  session.gesture = null;
  session.endpointFeedback = null;
  env.updateCursor();
}
