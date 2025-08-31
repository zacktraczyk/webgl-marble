import "../src/style.css";
import levelBuilder from "./level-builder";

// Display errors on page
try {
  const toolSelectPan = document.getElementById("#tool-select-pan");
  const toolSelectSelect = document.getElementById("#tool-select-select");
  const toolSelectSquare = document.getElementById("#tool-select-square");
  const toolSelectCircle = document.getElementById("#tool-select-circle");
  const toolSelectFinishLine = document.getElementById(
    "#tool-select-finish-line"
  );

  levelBuilder({
    pan: toolSelectPan,
    select: toolSelectSelect,
    square: toolSelectSquare,
    circle: toolSelectCircle,
    finishLine: toolSelectFinishLine,
  });
} catch (error) {
  const errorElem = document.getElementById("#error");
  if (errorElem) {
    errorElem.textContent = `${error}`;
  }
}
