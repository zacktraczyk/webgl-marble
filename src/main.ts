import firstRace from "./scenes/first-race";
import "./style.css";

// Display errors on page
try {
  firstRace();
} catch (error) {
  const errorElem = document.getElementById("#error");
  if (errorElem) {
    errorElem.textContent = `${error}`;
  }
}
