// logWorkout.js
// Detta script körs när du trycker på widgeten på hemskärmen.
// Kräver: gymData.js sparad i samma Scriptable-mapp.

const GymData = importModule("gymData")

async function main() {
  const data = GymData.loadData()
  const exerciseName = await pickExercise(data)
  if (!exerciseName) return // Avbröt

  await logExerciseFlow(data, exerciseName)
}

// ---------- STEG 1: Välj övning ----------

async function pickExercise(data) {
  const table = new UITable()
  table.showSeparators = true
  let chosen = null
  let done = false

  function buildTable() {
    table.removeAllRows()

    for (const [group, names] of Object.entries(data.exercises)) {
      const header = new UITableRow()
      header.isHeader = true
      header.addText(group)
      table.addRow(header)

      for (const name of names) {
        table.addRow(makeExerciseRow(name))
      }
    }

    if (data.customExercises && data.customExercises.length > 0) {
      const header = new UITableRow()
      header.isHeader = true
      header.addText("Övriga")
      table.addRow(header)
      for (const name of data.customExercises) {
        table.addRow(makeExerciseRow(name))
      }
    }

    const addRow = new UITableRow()
    addRow.dismissOnSelect = false
    const addCell = addRow.addText("＋ Lägg till ny övning")
    addCell.titleColor = Color.blue()
    addRow.onSelect = async () => {
      const alert = new Alert()
      alert.title = "Ny övning"
      alert.addTextField("t.ex. Shoulder Press")
      alert.addAction("Lägg till")
      alert.addCancelAction("Avbryt")
      const result = await alert.presentAlert()
      if (result === 0) {
        const name = alert.textFieldValue(0).trim()
        if (name.length > 0) {
          GymData.addCustomExercise(data, name)
          GymData.saveData(data)
          chosen = name
          done = true
        }
      }
    }
    table.addRow(addRow)
  }

  function makeExerciseRow(name) {
    const row = new UITableRow()
    row.dismissOnSelect = false
    const last = GymData.getLastEntry(data, name)
    const cell = row.addText(name, last ? `Senast: ${last.weight}kg × ${last.reps} reps × ${last.sets} set` : "Inget pass loggat än")
    cell.titleFont = Font.mediumSystemFont(16)
    cell.subtitleColor = Color.gray()
    row.onSelect = () => {
      chosen = name
      done = true
    }
    return row
  }

  buildTable()
  table.present(false) // non-blocking-ish: vi pollar nedan

  // Vänta tills en övning valts (present() själv blockerar tills stängd,
  // men onSelect triggas innan dess - vi använder ett litet poll-race istället).
  while (!done) {
    await new Promise(r => Timer.schedule(100, false, r))
  }

  return chosen
}

// ---------- STEG 2: Logga vikt / reps / set ----------

async function logExerciseFlow(data, exerciseName) {
  const last = GymData.getLastEntry(data, exerciseName)
  let weight = last ? last.weight : 20
  let reps = last ? last.reps : 8
  let sets = last ? last.sets : 3
  let saved = false
  let cancelled = false

  const table = new UITable()
  table.showSeparators = true

  function render() {
    table.removeAllRows()

    const titleRow = new UITableRow()
    titleRow.isHeader = true
    titleRow.addText(exerciseName)
    table.addRow(titleRow)

    if (last) {
      const infoRow = new UITableRow()
      const cell = infoRow.addText(GymData.getSuggestion(last))
      cell.titleColor = Color.gray()
      cell.titleFont = Font.footnote()
      table.addRow(infoRow)
    }

    addAdjustableField("Vikt", `${weight} kg`, [
      ["－ 5 kg", () => { weight = Math.max(0, weight - 5); render() }],
      ["－ 1 kg", () => { weight = Math.max(0, weight - 1); render() }],
      ["＋ 1 kg", () => { weight = weight + 1; render() }],
      ["＋ 5 kg", () => { weight = weight + 5; render() }],
    ])

    addAdjustableField("Reps", `${reps}`, [
      ["－ 1 rep", () => { reps = Math.max(0, reps - 1); render() }],
      ["＋ 1 rep", () => { reps = reps + 1; render() }],
    ])

    addAdjustableField("Set", `${sets}`, [
      ["－ 1 set", () => { sets = Math.max(1, sets - 1); render() }],
      ["＋ 1 set", () => { sets = sets + 1; render() }],
    ])

    const saveRow = new UITableRow()
    saveRow.dismissOnSelect = false
    const saveCell = saveRow.addText("✅ Spara pass")
    saveCell.titleColor = Color.green()
    saveCell.titleFont = Font.boldSystemFont(17)
    saveRow.onSelect = () => {
      saved = true
    }
    table.addRow(saveRow)

    const cancelRow = new UITableRow()
    cancelRow.dismissOnSelect = false
    const cancelCell = cancelRow.addText("Avbryt")
    cancelCell.titleColor = Color.red()
    cancelRow.onSelect = () => {
      cancelled = true
    }
    table.addRow(cancelRow)

    table.reload()
  }

  // Lägger till en informationsrad (t.ex. "Vikt: 72 kg") följt av EN RAD PER KNAPP.
  // Varje knapp är en egen UITableRow med sin egen row.onSelect - det är den enda
  // metoden som är helt pålitlig i Scriptable (cell-index inom en rad är opålitligt).
  function addAdjustableField(label, valueText, buttons) {
    const infoRow = new UITableRow()
    infoRow.height = 36
    const infoCell = infoRow.addText(`${label}: ${valueText}`)
    infoCell.titleFont = Font.boldSystemFont(15)
    table.addRow(infoRow)

    for (const [text, action] of buttons) {
      const btnRow = new UITableRow()
      btnRow.dismissOnSelect = false
      btnRow.height = 44
      const btnCell = btnRow.addText(text)
      btnCell.titleColor = Color.blue()
      btnCell.titleFont = Font.mediumSystemFont(16)
      btnRow.onSelect = action
      table.addRow(btnRow)
    }
  }

  render()
  table.present(false)

  while (!saved && !cancelled) {
    await new Promise(r => Timer.schedule(100, false, r))
  }

  if (saved) {
    GymData.logEntry(data, exerciseName, weight, reps, sets)
    const alert = new Alert()
    alert.title = "Pass loggat! 💪"
    alert.message = `${exerciseName}: ${weight}kg × ${reps} reps × ${sets} set`
    alert.addAction("Klart")
    await alert.presentAlert()
  }
}

await main()
Script.complete()
