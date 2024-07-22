let donationsDisplay = document.getElementById("counter");
let thanks = document.getElementById("thanks");
let donateButton = document.getElementById("donate");
let donations = 9995;

donationsDisplay.innerHTML = donations;

donateButton.addEventListener("click", () => {
    donations += 1;
    if (donations > 30000) {
        donations = 0;
    } else if (donations > 25000) {
        thanks.innerHTML = "Stop";
    } else if (donations > 20000) {
        thanks.innerHTML = "Why??";
    } else {
        thanks.innerHTML = "Thank you for your donation! <br>We will use it to fund the wars!";
    }
    donationsDisplay.innerHTML = donations;
});
