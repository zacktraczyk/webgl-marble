const debugInfoElem = document.getElementById("debug-info");

export const updateDebugInfo = (value: unknown) => {
  if (debugInfoElem) {
    debugInfoElem.textContent = JSON.stringify(value, null, 2);
  }
};
