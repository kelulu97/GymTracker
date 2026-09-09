// gymData.js
// Delad modul för datalagring och progressive-overload-logik.
// Importeras av både logWorkout.js och progressWidget.js med:
//   const GymData = importModule("gymData")

const FILE_NAME = "gym-tracker-data.json"

// Dina förvalda favoritövningar, grupperade per pass.
// Lägg till/ta bort valfritt - nya övningar som loggas via "Lägg till ny"
// sparas automatiskt och dyker upp i listan "Övriga" nästa gång.
const DEFAULT_EXERCISES = {
  "Underkropp": ["Hip Thrust", "Single Leg Deadlift", "Adductor Machine"],
  "Överkropp": ["Lats Pulldown", "Chest Press", "Bicep Curl", "Tricep Curl"]
}

function getFileManager() {
  // Använder iCloud om tillgängligt så datan finns kvar och synkas mellan enheter.
  const iCloudFM = FileManager.iCloud()
  return iCloudFM
}

function getFilePath() {
  const fm = getFileManager()
  return fm.joinPath(fm.documentsDirectory(), FILE_NAME)
}

function loadData() {
  const fm = getFileManager()
  const path = getFilePath()

  if (!fm.fileExists(path)) {
    const initial = {
      exercises: DEFAULT_EXERCISES,
      customExercises: [],
      history: {} // { "Hip Thrust": [ {date, weight, reps, sets}, ... ] }
    }
    saveData(initial)
    return initial
  }

  if (fm.isFileDownloaded && !fm.isFileDownloaded(path)) {
    fm.downloadFileFromiCloud(path)
  }

  try {
    const raw = fm.readString(path)
    return JSON.parse(raw)
  } catch (e) {
    // Om filen är korrupt, backa till tomt state istället för att krascha.
    const fallback = { exercises: DEFAULT_EXERCISES, customExercises: [], history: {} }
    saveData(fallback)
    return fallback
  }
}

function saveData(data) {
  const fm = getFileManager()
  const path = getFilePath()
  fm.writeString(path, JSON.stringify(data, null, 2))
}

function getAllExerciseNames(data) {
  const favorites = Object.values(data.exercises).flat()
  const custom = data.customExercises || []
  // Unika namn, favoriter först
  return [...new Set([...favorites, ...custom])]
}

function addCustomExercise(data, name) {
  if (!data.customExercises) data.customExercises = []
  const allNames = getAllExerciseNames(data)
  if (!allNames.includes(name)) {
    data.customExercises.push(name)
  }
  return data
}

function getLastEntry(data, exerciseName) {
  const hist = data.history[exerciseName]
  if (!hist || hist.length === 0) return null
  return hist[hist.length - 1]
}

function logEntry(data, exerciseName, weight, reps, sets) {
  if (!data.history[exerciseName]) data.history[exerciseName] = []
  data.history[exerciseName].push({
    date: new Date().toISOString(),
    weight: weight,
    reps: reps,
    sets: sets
  })
  saveData(data)
  return data
}

// Enkel förslagstext baserat på förra passet.
function getSuggestion(entry) {
  if (!entry) return "Inget tidigare pass loggat än - sätt ett startvärde!"
  return `Förra gången: ${entry.weight}kg × ${entry.reps} reps × ${entry.sets} set. Försök öka vikten eller reps denna gång.`
}

// Jämför senaste passets VIKT med näst senaste passets vikt.
// Det här är det enda som styr trendpilen i widgeten - enkelt och tydligt.
function getTrend(data, exerciseName) {
  const hist = data.history[exerciseName]
  if (!hist || hist.length < 2) return "neutral"

  const last = hist[hist.length - 1]
  const prev = hist[hist.length - 2]

  if (last.weight > prev.weight) return "up"
  if (last.weight < prev.weight) return "down"
  return "neutral"
}

module.exports = {
  loadData,
  saveData,
  getAllExerciseNames,
  addCustomExercise,
  getLastEntry,
  logEntry,
  getSuggestion,
  getTrend,
  DEFAULT_EXERCISES
}
