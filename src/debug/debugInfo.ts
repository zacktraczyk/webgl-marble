const debugInfoElem = document.getElementById("debug-info");

/**
 * Renders `value` as pretty-printed JSON into the `#debug-info` element.
 * @param value Any JSON-serializable value to display.
 * No-op when the element is absent from the page.
 */
export const updateDebugInfo = (value: unknown) => {
  if (debugInfoElem) {
    debugInfoElem.textContent = JSON.stringify(value, null, 2);
  }
};
