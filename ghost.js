
/* ===== GHOST MODE ===== */

// Elements
const difficulty = document.getElementById("difficulty");
const playerPassage = document.getElementById("player-passage");
const ghostPassage = document.getElementById("ghost-passage");

const playerInput = document.getElementById("player-input");

const playerWpm = document.getElementById("player-wpm");
const playerAccuracy = document.getElementById("player-accuracy");
const ghostWpm = document.getElementById("ghost-wpm");
const ghostAccuracy = document.getElementById("ghost-accuracy");

const playerProgress = document.getElementById("player-progress");
const ghostProgress = document.getElementById("ghost-progress");

const startBtn = document.getElementById("start-ghost-btn");
const resetBtn = document.getElementById("reset-ghost-btn");
const message = document.getElementById("ghost-message");
const themeBtn = document.getElementById("theme-btn");

// Typing passages
const passages = [
    "Practice makes progress. Keep typing and improve your speed every day.",
    "Technology makes our lives easier and connects people around the world.",
    "Success comes from patience, practice and the determination to keep learning.",
    "A journey of a thousand miles begins with a single step."
];

let passage = "";
let startTime = 0;

let playerAttempts = 0;
let playerMistakes = 0;
let previousInput = "";

let ghostAttempts = 0;
let ghostMistakes = 0;

let running = false;
let ghostFinished = false;
let simulationId = 0;

// Difficulty settings

const levels = {
    beginner: { wpm: 25, accuracy: 98 },
    intermediate: { wpm: 45, accuracy: 94 },
    advanced: { wpm: 70, accuracy: 88 },

    "personal-best": {
        wpm: Math.min(
            (Number(localStorage.getItem("keyrush-best-wpm")) || 25) * 0.85,
            60
        ),
        accuracy:
            Number(localStorage.getItem("keyrush-best-accuracy")) || 98
    }
};


// Display passage as characters
function renderPassage(element, text) {
    element.innerHTML = "";

    for (const character of text) {
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = character;
        element.appendChild(span);
    }
}

// Calculate WPM
function calculateWPM(attempts, elapsed) {
    const minutes = elapsed / 60000;

    if (minutes <= 0) return 0;

    return Math.round((attempts / 5) / minutes);
}

// Calculate accuracy
function calculateAccuracy(attempts, mistakes) {
    if (attempts === 0) return 100;

    return Math.max(
        0,
        Math.round(((attempts - mistakes) / attempts) * 100)
    );
}

// Update player display
function updatePlayer() {
    const typed = playerInput.value;
    const characters = playerPassage.querySelectorAll(".char");

    characters.forEach((span, index) => {
    span.classList.remove("correct", "wrong", "current");

    if (index < typed.length) {
        if (typed[index] === passage[index]) {
            span.classList.add("correct");
        } else {
            span.classList.add("wrong");
        }
    }
});

// Show cursor at the next character
if (typed.length < passage.length) {
    characters[typed.length].classList.add("current");
}
    const elapsed = Date.now() - startTime;

    playerWpm.textContent = calculateWPM(playerAttempts, elapsed);
    playerAccuracy.textContent =
        calculateAccuracy(playerAttempts, playerMistakes) + "%";

    playerProgress.textContent =
        Math.round((typed.length / passage.length) * 100) + "%";

    if (typed === passage) {
        playerInput.disabled = true;
        message.textContent = "You completed the passage!";
        message.classList.remove("hidden");
    }
}

// Player typing event
playerInput.addEventListener("input", () => {
    if (!running) return;

    const currentInput = playerInput.value;

    // Count newly entered characters
    if (currentInput.length > previousInput.length) {
        const added = currentInput.length - previousInput.length;
        const startIndex = previousInput.length;

        playerAttempts += added;

        for (let i = 0; i < added; i++) {
            const index = startIndex + i;

            if (currentInput[index] !== passage[index]) {
                playerMistakes++;
            }
        }
    }

    previousInput = currentInput;
    updatePlayer();
});

// Wait for a specified time
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Ghost typing simulation
async function startGhost(id) {
    const settings = levels[difficulty.value];

    const characters = ghostPassage.querySelectorAll(".char");

    for (let i = 0; i < passage.length; i++) {

        if (id !== simulationId) return;

        // Calculate typing delay from target WPM
        const baseDelay = 60000 / (settings.wpm * 5);
        const delay = baseDelay * (0.85 + Math.random() * 0.3);

        await wait(delay);

        if (id !== simulationId) return;

        ghostAttempts++;

        // Simulate an occasional typing mistake
        const makesMistake = Math.random() * 100 > settings.accuracy;

        if (makesMistake) {
            ghostMistakes++;

            characters[i].classList.add("wrong");
            characters[i].textContent = "✕";

            await wait(250);

            if (id !== simulationId) return;
        }

        // Correct character appears
        characters[i].textContent = passage[i];
        characters[i].classList.remove("wrong");
        characters[i].classList.add("correct");
        // Move ghost cursor forward
        characters.forEach(char => char.classList.remove("current"));

        if (i + 1 < passage.length) {
    characters[i + 1].classList.add("current");
        }

        const elapsed = Date.now() - startTime;

        ghostWpm.textContent = calculateWPM(ghostAttempts, elapsed);
        ghostAccuracy.textContent =
            calculateAccuracy(ghostAttempts, ghostMistakes) + "%";

        ghostProgress.textContent =
            Math.round(((i + 1) / passage.length) * 100) + "%";
    }

    if (id === simulationId) {
    ghostFinished = true;

    message.classList.remove("hidden");
    message.textContent = "Ghost completed the passage!";
}
}

// Start Ghost Mode
startBtn.addEventListener("click", () => {
    resetGame();

    passage = passages[Math.floor(Math.random() * passages.length)];

    renderPassage(playerPassage, passage);
    renderPassage(ghostPassage, passage);
    // Show starting cursor in both panels
    playerPassage.querySelector(".char").classList.add("current");
    ghostPassage.querySelector(".char").classList.add("current");

    running = true;
    startTime = Date.now();

    playerInput.disabled = false;
    difficulty.disabled = true;
    playerInput.focus();

    startBtn.disabled = true;
    message.classList.add("hidden");

    const currentId = simulationId;
    startGhost(currentId);
});

// Reset game
function resetGame() {
    simulationId++;

    running = false;
    ghostFinished = false;

    playerAttempts = 0;
    playerMistakes = 0;
    previousInput = "";

    ghostAttempts = 0;
    ghostMistakes = 0;

    playerInput.value = "";
    playerInput.disabled = true;

    playerWpm.textContent = "0";
    playerAccuracy.textContent = "100%";

    ghostWpm.textContent = "0";
    ghostAccuracy.textContent = "100%";

    playerProgress.textContent = "0%";
    ghostProgress.textContent = "0%";

    playerPassage.innerHTML = "";
    ghostPassage.innerHTML = "";

    difficulty.disabled = false;
    startBtn.disabled = false;

    message.textContent = "";
    message.classList.add("hidden");
}

// Reset button
resetBtn.addEventListener("click", resetGame);

// Theme toggle
themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");

    themeBtn.textContent =
        document.body.classList.contains("light-mode")
            ? "☾ Dark mode"
            : "☼ Light mode";
});
