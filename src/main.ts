import randomBalls from "./scenes/random-balls";
import "./style.css";

// Display errors on page
try {
  // firstRace();
  randomBalls();
} catch (error) {
  const errorElem = document.getElementById("#error");
  if (errorElem) {
    errorElem.textContent = `${error}`;
  }
}
