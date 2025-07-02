import "../src/style.css";
import firstRace from "./first-race";

// Display errors on page
try {
  firstRace();
} catch (error) {
  const errorElem = document.getElementById("#error");
  if (errorElem) {
    errorElem.textContent = `${error}`;
  }
}
