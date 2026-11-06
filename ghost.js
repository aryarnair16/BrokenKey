
/* ===== GHOST MODE ===== */

// ===== DOM ELEMENTS =====

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
const raceTimer = document.getElementById("race-timer");

const raceResults = document.getElementById("race-results");
const winnerHeading = document.getElementById("winner-heading");

const playerFinalWpm = document.getElementById("player-final-wpm");
const playerFinalAccuracy = document.getElementById("player-final-accuracy");
const playerFinalScore = document.getElementById("player-final-score");

const ghostFinalWpm = document.getElementById("ghost-final-wpm");
const ghostFinalAccuracy = document.getElementById("ghost-final-accuracy");
const ghostFinalScore = document.getElementById("ghost-final-score");

const completionStatus = document.getElementById("completion-status");
const timeDifference = document.getElementById("time-difference");

// Analytics elements
const analyticsBestWpm = document.getElementById("analytics-best-wpm");
const analyticsAverageWpm = document.getElementById("analytics-average-wpm");
const analyticsRacesPlayed = document.getElementById("analytics-races-played");
const performanceChart = document.getElementById("performance-chart");

// Rules popup elements
const rulesBtn = document.getElementById("rules-btn");
const rulesModal = document.getElementById("rules-modal");
const closeRulesBtn = document.getElementById("close-rules-btn");

// Paste warning
const pasteWarning = document.createElement("p");

pasteWarning.id = "paste-warning";
pasteWarning.className = "paste-warning";
pasteWarning.textContent =
    "Pasting doesn't qualify you for a win. Type the full passage manually to complete the race.";
pasteWarning.hidden = true;

playerInput.insertAdjacentElement("afterend", pasteWarning);


// ===== GAME DATA =====

const passages = [
    "Practice makes progress. Keep typing and improve your speed every day.",
    "Technology makes our lives easier and connects people around the world.",
    "Success comes from patience, practice and the determination to keep learning.",
    "A journey of a thousand miles begins with a single step."
];

const levels = {
    beginner: { wpm: 25, accuracy: 98 },
    intermediate: { wpm: 45, accuracy: 94 },
    advanced: { wpm: 70, accuracy: 88 }
};

const GHOST_HISTORY_KEY = "keyrush-ghost-history";

let previousInputValue = "";
let pendingInput = null;
let pendingPaste = null;

let passage = "";
let startTime = 0;

let playerAttempts = 0;
let playerWpmAttempts = 0;
let playerMistakes = 0;
let playerManualCharacters = [];

let ghostAttempts = 0;
let ghostMistakes = 0;

let running = false;
let timeLeft = 30;
let timerInterval = null;

let playerFinished = false;
let ghostFinished = false;
let raceEnded = false;

let playerFinishTime = null;
let ghostFinishTime = null;

let targetWpm = 0;
let simulationId = 0;


// ===== DIFFICULTY SETTINGS =====

function getDifficultySettings() {
    if (difficulty.value === "personal-best") {
        const bestWPM = Number(
            localStorage.getItem("keyrush-best-wpm")
        );

        const bestAccuracy = Number(
            localStorage.getItem("keyrush-best-accuracy")
        );

        if (!bestWPM) return null;

        return {
            wpm: Math.min(bestWPM * 0.85, 60),
            accuracy: bestAccuracy || 98
        };
    }

    return levels[difficulty.value] || null;
}

function updateDifficultySelection() {
    const settings = getDifficultySettings();

    if (!settings) {
        message.textContent =
            "No Personal Best record found. Complete a typing test first!";
        message.classList.remove("hidden");
        startBtn.disabled = true;
    } else {
        message.classList.add("hidden");

        if (!running) {
            startBtn.disabled = false;
        }
    }
}

difficulty.addEventListener("change", updateDifficultySelection);


// ===== PASSAGE DISPLAY =====

function renderPassage(element, text) {
    element.innerHTML = "";

    for (const character of text) {
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = character;
        element.appendChild(span);
    }
}


// ===== CALCULATIONS =====

function calculateWPM(attempts, elapsed) {
    const minutes = elapsed / 60000;

    if (minutes <= 0) return 0;

    return Math.round((attempts / 5) / minutes);
}

function calculateAccuracy(attempts, mistakes) {
    if (attempts === 0) return 0;

    return ((attempts - mistakes) / attempts) * 100;
}

function calculateFinalScore(
    wpmAttempts,
    accuracyAttempts,
    mistakes,
    elapsed
) {
    const wpm = calculateWPM(wpmAttempts, elapsed);
    const accuracy = calculateAccuracy(accuracyAttempts, mistakes);

    const normalizedWpm = targetWpm > 0
        ? Math.min((wpm / targetWpm) * 100, 100)
        : 0;

    const score = (0.70 * normalizedWpm) + (0.30 * accuracy);

    return { wpm, accuracy, score };
}


// ===== PERFORMANCE ANALYTICS =====

function getRaceHistory() {
    try {
        const history = JSON.parse(
            localStorage.getItem(GHOST_HISTORY_KEY) || "[]"
        );

        if (!Array.isArray(history)) return [];

        return history.filter(race =>
            race &&
            Number.isFinite(race.wpm) &&
            Number.isFinite(race.accuracy) &&
            Number.isFinite(race.score)
        );
    } catch {
        return [];
    }
}

function saveRaceResult(result) {
    const history = getRaceHistory();

    const raceRecord = {
        wpm: result.wpm,
        accuracy: result.accuracy,
        score: result.score,
        date: new Date().toISOString()
    };

    history.push(raceRecord);

    try {
        localStorage.setItem(
            GHOST_HISTORY_KEY,
            JSON.stringify(history.slice(-20))
        );

        const currentBestWpm =
            Number(localStorage.getItem("keyrush-best-wpm")) || 0;

        if (result.wpm > currentBestWpm) {
            localStorage.setItem("keyrush-best-wpm", result.wpm);
            localStorage.setItem(
                "keyrush-best-accuracy",
                result.accuracy
            );
        }
    } catch (error) {
        console.error("Could not save Ghost Mode history:", error);
    }

    updateAnalytics();
}

function updateAnalytics() {
    const history = getRaceHistory();

    const totalWpm = history.reduce(
        (sum, race) => sum + race.wpm,
        0
    );

    const averageWpm = history.length
        ? Math.round(totalWpm / history.length)
        : 0;

    const bestWpm =
        Number(localStorage.getItem("keyrush-best-wpm")) || 0;

    analyticsBestWpm.textContent = bestWpm;
    analyticsAverageWpm.textContent = averageWpm;
    analyticsRacesPlayed.textContent = history.length;

    drawPerformanceChart(history);
}


function drawPerformanceChart(history, liveWpm = null) {
    const canvas = performanceChart;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width <= 0 || height <= 0) return;

    const isLightMode = document.body.classList.contains("light-mode");

    // Theme colors
    const axisColor = isLightMode ? "#475569" : "#94a3b8";
    const textColor = isLightMode ? "#334155" : "#cbd5e1";
    const gridColor = isLightMode
        ? "rgba(15, 23, 42, 0.12)"
        : "rgba(255, 255, 255, 0.12)";
    const lineColor = isLightMode ? "#16a34a" : "#4ade80";

    // Canvas resolution
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Keep the last 9 completed races if a live race is being displayed
    const completedRaces = liveWpm !== null && liveWpm > 0
        ? history.slice(-9)
        : history.slice(-10);

    const points = completedRaces.map((race, index) => ({
        raceNumber: history.length - completedRaces.length + index + 1,
        wpm: race.wpm
    }));

    // Add temporary live race point
    if (liveWpm !== null && liveWpm > 0) {
        points.push({
            raceNumber: history.length + 1,
            wpm: liveWpm
        });
    }

    if (points.length === 0) {
        ctx.fillStyle = textColor;
        ctx.font = "14px Arial";
        ctx.textAlign = "center";

        ctx.fillText(
            "Complete a race to see your WPM history",
            width / 2,
            height / 2
        );

        return;
    }

    // Chart dimensions
    const paddingLeft = 48;
    const paddingRight = 18;
    const paddingTop = 20;
    const paddingBottom = 42;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxWpm = Math.max(
        10,
        Math.ceil(Math.max(...points.map(point => point.wpm)) / 10) * 10
    );

    // Draw horizontal gridlines and Y-axis labels
    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
        const value = (maxWpm / 4) * i;
        const y = paddingTop + chartHeight - (i / 4) * chartHeight;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.fillText(Math.round(value), paddingLeft - 9, y);
    }

    // Draw chart axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    // Draw Y-axis title
    ctx.save();
    ctx.translate(12, paddingTop + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.font = "12px Arial";
    ctx.fillText("WPM", 0, 0);
    ctx.restore();

    // Draw X-axis title
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.font = "12px Arial";
    ctx.fillText(
        "Race number",
        paddingLeft + chartWidth / 2,
        height - 5
    );

    // Calculate point positions
    const getX = index => {
        return paddingLeft + (
            points.length === 1
                ? chartWidth / 2
                : (index / (points.length - 1)) * chartWidth
        );
    };

    const getY = wpm => {
        return paddingTop + chartHeight -
            (wpm / maxWpm) * chartHeight;
    };

    // Draw WPM line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();

    points.forEach((point, index) => {
        const x = getX(index);
        const y = getY(point.wpm);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    // Draw data points and race numbers
    points.forEach((point, index) => {
        const x = getX(index);
        const y = getY(point.wpm);

        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        ctx.fillText(
            point.raceNumber,
            x,
            height - paddingBottom + 8
        );
    });
}



// ===== PLAYER DISPLAY =====

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

    playerWpm.textContent = calculateWPM(
        playerWpmAttempts,
        elapsed
    );

    // Update graph with temporary live race performance
    if (running && playerAttempts > 0) {
        drawPerformanceChart(
            getRaceHistory(),
            calculateWPM(playerWpmAttempts, elapsed)
        );
    }

    playerAccuracy.textContent =
        calculateAccuracy(playerAttempts, playerMistakes) + "%";

    playerProgress.textContent =
        Math.round((typed.length / passage.length) * 100) + "%";

    const entirePassageTypedManually =
        playerManualCharacters.length === passage.length &&
        playerManualCharacters.every(Boolean);

    if (
        typed === passage &&
        entirePassageTypedManually
    ) {
        playerFinished = true;
        playerFinishTime = Date.now() - startTime;

        playerInput.disabled = true;

        message.textContent = ghostFinished
            ? "Both you and the ghost completed the passage!"
            : "You completed the passage! Ghost is still typing.";

        message.classList.remove("hidden");

        if (ghostFinished) {
            endRace();
        }
    }
}


// ===== PLAYER ACCURACY TRACKING =====

function getTextChange(oldValue, newValue) {
    let start = 0;

    while (
        start < oldValue.length &&
        start < newValue.length &&
        oldValue[start] === newValue[start]
    ) {
        start++;
    }

    let oldEnd = oldValue.length;
    let newEnd = newValue.length;

    while (
        oldEnd > start &&
        newEnd > start &&
        oldValue[oldEnd - 1] === newValue[newEnd - 1]
    ) {
        oldEnd--;
        newEnd--;
    }

    return {
        index: start,
        removedLength: oldEnd - start,
        text: newValue.slice(start, newEnd)
    };
}

// Record selection and input type before editing
playerInput.addEventListener("beforeinput", (event) => {
    pendingInput = {
        start: playerInput.selectionStart,
        end: playerInput.selectionEnd,
        inputType: event.inputType,
        data: event.data
    };

    if (event.inputType !== "insertFromPaste") {
        pendingPaste = null;
    }
});

// Capture pasted text
playerInput.addEventListener("paste", (event) => {
    pendingPaste = {
        text: event.clipboardData.getData("text"),
        start: playerInput.selectionStart,
        end: playerInput.selectionEnd
    };
});

// Process actual input
playerInput.addEventListener("input", () => {
    const oldValue = previousInputValue;
    const newValue = playerInput.value;

    if (!running) {
        previousInputValue = newValue;
        pendingInput = null;
        pendingPaste = null;
        return;
    }

    const edit = pendingInput;

    let change;

    if (
        edit &&
        typeof edit.inputType === "string" &&
        edit.inputType.startsWith("insert")
    ) {
        const removedLength = edit.end - edit.start;

        const insertedLength = Math.max(
            0,
            newValue.length -
            (oldValue.length - removedLength)
        );

        change = {
            index: edit.start,
            removedLength,
            text: newValue.slice(
                edit.start,
                edit.start + insertedLength
            )
        };
    } else {
        change = getTextChange(oldValue, newValue);
    }

    const insertedText = change.text;
    const insertionIndex = change.index;

    const isPaste =
        (edit && edit.inputType === "insertFromPaste") ||
        pendingPaste !== null;

    if (isPaste) {
        pasteWarning.hidden = false;
    }

    const isManualInsertion =
        !isPaste &&
        (
            !edit ||
            edit.inputType === "insertText" ||
            edit.inputType === "insertCompositionText"
        );

    // Track whether each character was typed manually
    playerManualCharacters.splice(
        change.index,
        change.removedLength,
        ...Array(insertedText.length).fill(isManualInsertion)
    );

    // Count inserted characters
    for (let i = 0; i < insertedText.length; i++) {
        playerAttempts++;

        if (isManualInsertion) {
            playerWpmAttempts++;
        }

        if (
            insertedText[i] !== passage[insertionIndex + i]
        ) {
            playerMistakes++;
        }
    }

    previousInputValue = newValue;
    pendingInput = null;
    pendingPaste = null;

    updatePlayer();
});


// ===== GHOST TYPING SIMULATION =====

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startGhost(id) {
    const settings = getDifficultySettings();

    if (!settings) return;

    const characters = ghostPassage.querySelectorAll(".char");

    for (let i = 0; i < passage.length; i++) {
        if (id !== simulationId || !running) return;

        const baseDelay = 60000 / (settings.wpm * 5);
        const delay = baseDelay * (0.85 + Math.random() * 0.3);

        await wait(delay);

        if (id !== simulationId || !running) return;

        ghostAttempts++;

        // Simulate an occasional typing mistake
        const makesMistake =
            Math.random() * 100 > settings.accuracy;

        if (makesMistake) {
            ghostMistakes++;

            characters[i].classList.add("wrong");
            characters[i].textContent = "✕";

            await wait(250);

            if (id !== simulationId || !running) return;

            ghostAttempts++;
        }

        // Correct character appears
        characters[i].textContent = passage[i];
        characters[i].classList.remove("wrong");
        characters[i].classList.add("correct");

        // Move ghost cursor forward
        characters.forEach(char =>
            char.classList.remove("current")
        );

        if (i + 1 < passage.length) {
            characters[i + 1].classList.add("current");
        }

        const elapsed = Date.now() - startTime;

        ghostWpm.textContent = calculateWPM(
            ghostAttempts,
            elapsed
        );

        ghostAccuracy.textContent =
            calculateAccuracy(ghostAttempts, ghostMistakes) + "%";

        ghostProgress.textContent =
            Math.round(((i + 1) / passage.length) * 100) + "%";
    }

    if (id === simulationId && running) {
        ghostFinished = true;
        ghostFinishTime = Date.now() - startTime;

        message.classList.remove("hidden");

        message.textContent = playerFinished
            ? "Both you and the ghost completed the passage!"
            : "Ghost completed the passage! You can continue typing.";

        if (playerFinished) {
            endRace();
        }
    }
}


// ===== START RACE =====

startBtn.addEventListener("click", () => {
    const settings = getDifficultySettings();

    if (!settings) {
        updateDifficultySelection();
        return;
    }

    resetGame();

    passage = passages[
        Math.floor(Math.random() * passages.length)
    ];

    playerInput.maxLength = passage.length;

    renderPassage(playerPassage, passage);
    renderPassage(ghostPassage, passage);

    playerPassage.querySelector(".char").classList.add("current");
    ghostPassage.querySelector(".char").classList.add("current");

    targetWpm = settings.wpm;

    running = true;
    startTime = Date.now();

    playerInput.disabled = false;
    difficulty.disabled = true;
    playerInput.focus();

    startBtn.disabled = true;
    message.classList.add("hidden");

    startRaceTimer();

    const currentId = simulationId;
    startGhost(currentId);
});


// ===== RACE TIMER =====

function startRaceTimer() {
    timeLeft = 30;
    raceTimer.textContent = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        raceTimer.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            endRace();
        }
    }, 1000);
}


// ===== END RACE =====

function endRace() {
    if (raceEnded || !running) return;

    raceEnded = true;
    running = false;

    clearInterval(timerInterval);
    timerInterval = null;

    // Stop remaining ghost typing
    simulationId++;

    playerInput.disabled = true;
    difficulty.disabled = false;
    startBtn.disabled = false;

    const elapsed = Date.now() - startTime;

    const playerTime = playerFinishTime ?? elapsed;
    const ghostTime = ghostFinishTime ?? elapsed;

    const playerResult = calculateFinalScore(
        playerWpmAttempts,
        playerAttempts,
        playerMistakes,
        playerTime
    );

    const ghostResult = calculateFinalScore(
        ghostAttempts,
        ghostAttempts,
        ghostMistakes,
        ghostTime
    );

    // Save player's completed race
    saveRaceResult(playerResult);

    // Display player results
    playerFinalWpm.textContent = playerResult.wpm;
    playerFinalAccuracy.textContent =
        playerResult.accuracy.toFixed(1) + "%";
    playerFinalScore.textContent =
        playerResult.score.toFixed(2);

    // Display ghost results
    ghostFinalWpm.textContent = ghostResult.wpm;
    ghostFinalAccuracy.textContent =
        ghostResult.accuracy.toFixed(1) + "%";
    ghostFinalScore.textContent =
        ghostResult.score.toFixed(2);

    // Determine winner
    if (playerFinished && !ghostFinished) {
        winnerHeading.textContent = "YOU WIN!";
    } else if (ghostFinished && !playerFinished) {
        winnerHeading.textContent = "GHOST WINS!";
    } else if (playerResult.score > ghostResult.score) {
        winnerHeading.textContent = "YOU WIN!";
    } else if (ghostResult.score > playerResult.score) {
        winnerHeading.textContent = "GHOST WINS!";
    } else {
        winnerHeading.textContent = "IT'S A DRAW!";
    }

    // Completion time difference
    if (playerFinished && ghostFinished) {
        completionStatus.textContent =
            "Completion time difference: " +
            (
                Math.abs(playerFinishTime - ghostFinishTime) / 1000
            ).toFixed(2) +
            " seconds";
    } else {
        completionStatus.textContent = "";
    }

    timeDifference.textContent = "";

    raceResults.classList.remove("hidden");
}


// ===== RESET GAME =====

function resetGame() {
    simulationId++;

    clearInterval(timerInterval);
    timerInterval = null;

    running = false;
    raceEnded = false;

    playerFinished = false;
    ghostFinished = false;

    playerFinishTime = null;
    ghostFinishTime = null;

    timeLeft = 30;
    raceTimer.textContent = "30";

    playerAttempts = 0;
    playerMistakes = 0;
    playerWpmAttempts = 0;
    playerManualCharacters = [];

    pasteWarning.hidden = true;

    previousInputValue = "";
    pendingInput = null;
    pendingPaste = null;

    ghostAttempts = 0;
    ghostMistakes = 0;

    playerInput.value = "";
    playerInput.disabled = true;

    playerWpm.textContent = "0";
    playerAccuracy.textContent = "0%";

    ghostWpm.textContent = "0";
    ghostAccuracy.textContent = "0%";

    playerProgress.textContent = "0%";
    ghostProgress.textContent = "0%";

    playerPassage.innerHTML = "";
    ghostPassage.innerHTML = "";

    difficulty.disabled = false;
    startBtn.disabled = false;

    message.textContent = "";
    message.classList.add("hidden");

    raceResults.classList.add("hidden");

    updateDifficultySelection();
}

// Reset button
resetBtn.addEventListener("click", resetGame);


// ===== THEME TOGGLE =====

themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");

    themeBtn.textContent =
        document.body.classList.contains("light-mode")
            ? "☾ Dark mode"
            : "☼ Light mode";

    // Redraw graph using the current theme colors
    updateAnalytics();
});


// ===== RULES POPUP =====

rulesBtn.addEventListener("click", () => {
    rulesModal.hidden = false;
    closeRulesBtn.focus();
});

closeRulesBtn.addEventListener("click", () => {
    rulesModal.hidden = true;
    rulesBtn.focus();
});

// Close when clicking outside the popup
rulesModal.addEventListener("click", (event) => {
    if (event.target === rulesModal) {
        rulesModal.hidden = true;
        rulesBtn.focus();
    }
});

// Close using Escape
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !rulesModal.hidden) {
        rulesModal.hidden = true;
        rulesBtn.focus();
    }
});


// ===== INITIALIZATION =====

updateDifficultySelection();
updateAnalytics();
