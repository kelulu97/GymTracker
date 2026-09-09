// gymData.js
// Delad modul för datalagring och progressive-overload-logik.
// Importeras av både logWorkout.js och progressWidget.js med:
//   const GymData = importModule("gymData")

const FILE_NAME = "gym-tracker-data.json"

// Tillgängliga kategorier. Ändra/lägg till här om du vill ha fler grupper.
const CATEGORIES = ["Underkropp", "Överkropp", "Övrigt"]

// Dina förvalda favoritövningar. Format: { "Övningsnamn": "Kategori" }
const DEFAULT_EXERCISES = {
  "Hip Thrust": "Underkropp",
  "Single Leg Deadlift": "Underkropp",
  "Adductor Machine": "Underkropp",
  "Lats Pulldown": "Överkropp",
  "Chest Press": "Överkropp",
  "Bicep Curl": "Överkropp",
  "Tricep Curl": "Överkropp"
}

function getFileManager() {
  return FileManager.iCloud()
}

function getFilePath() {
  const fm = getFileManager()
  return fm.joinPath(fm.documentsDirectory(), FILE_NAME)
}

// Migrerar gammalt dataformat till nya platta formatet { namn: kategori }.
function migrateIfNeeded(data) {
  const values = Object.values(data.exercises || {})
  const isOldFormat = values.length > 0 && Array.isArray(values[0])

  if (isOldFormat) {
    const flat = {}
    for (const [cat, names] of Object.entries(data.exercises)) {
      for (const name of names) flat[name] = cat
    }
    if (data.customExercises) {
      for (const name of data.customExercises) {
        if (!(name in flat)) flat[name] = "Övrigt"
      }
    }
    data.exercises = flat
    delete data.customExercises
    saveData(data)
  }

  return data
}

function loadData() {
  const fm = getFileManager()
  const path = getFilePath()

  if (!fm.fileExists(path)) {
    const initial = {
      exercises: { ...DEFAULT_EXERCISES },
      history: {}
    }
    saveData(initial)
    return initial
  }

  if (fm.isFileDownloaded && !fm.isFileDownloaded(path)) {
    fm.downloadFileFromiCloud(path)
  }

  try {
    const raw = fm.readString(path)
    const data = JSON.parse(raw)
    return migrateIfNeeded(data)
  } catch (e) {
    const fallback = { exercises: { ...DEFAULT_EXERCISES }, history: {} }
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
  return Object.keys(data.exercises)
}

function getExercisesByCategory(data) {
  const grouped = {}
  for (const cat of CATEGORIES) grouped[cat] = []
  for (const [name, cat] of Object.entries(data.exercises)) {
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(name)
  }
  return grouped
}

function addExercise(data, name, category) {
  data.exercises[name] = category
  saveData(data)
  return data
}

function setExerciseCategory(data, name, category) {
  if (name in data.exercises) {
    data.exercises[name] = category
    saveData(data)
  }
  return data
}

function deleteExercise(data, name) {
  delete data.exercises[name]
  saveData(data)
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

function getSuggestion(entry) {
  if (!entry) return "Inget tidigare pass loggat än - sätt ett startvärde!"
  return `Förra gången: ${entry.weight}kg × ${entry.reps} reps × ${entry.sets} set. Försök öka vikten eller reps denna gång.`
}

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
  CATEGORIES,
  loadData,
  saveData,
  getAllExerciseNames,
  getExercisesByCategory,
  addExercise,
  setExerciseCategory,
  deleteExercise,
  getLastEntry,
  logEntry,
  getSuggestion,
  getTrend,
  DEFAULT_EXERCISES
}
