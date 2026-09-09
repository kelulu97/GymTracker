// logWorkout.js
// Detta script körs när du trycker på widgeten på hemskärmen.
// OBS: GymData tillhandahålls av loader-scriptet, deklareras INTE här.

async function main() {
  const data = GymData.loadData()
  let keepGoing = true

  while (keepGoing) {
    const exerciseName = await pickExercise(data)
    if (!exerciseName) break

    keepGoing = await logExerciseFlow(data, exerciseName)
  }
}

async function presentAndWait(table, checkDone) {
  let dismissed = false
  table.present(false).then(() => { dismissed = true })

  while (!checkDone() && !dismissed) {
    await new Promise(r => Timer.schedule(100, false, r))
  }
  return checkDone()
}

// ---------- STEG 1: Välj övning ----------

async function pickExercise(data) {
  const table = new UITable()
  table.showSeparators = true
  let chosen = null
  let done = false
  let manageRequested = false

  function buildTable() {
    table.removeAllRows()
    const grouped = GymData.getExercisesByCategory(data)

    for (const category of GymData.CATEGORIES) {
      const names = grouped[category] || []
      if (names.length === 0) continue

      const header = new UITableRow()
      header.isHeader = true
      header.addText(category)
      table.addRow(header)

      for (const name of names) {
        table.addRow(makeExerciseRow(name))
      }
    }

    const addRow = new UITableRow()
    addRow.dismissOnSelect = false
    const addCell = addRow.addText("＋ Lägg till ny övning")
    addCell.titleColor = Color.blue()
    addRow.onSelect = async () => {
      await addNewExerciseFlow(data)
      buildTable()
    }
    table.addRow(addRow)

    const manageRow = new UITableRow()
    manageRow.dismissOnSelect = false
    const manageCell = manageRow.addText("⚙️ Hantera övningar")
    manageCell.titleColor = Color.gray()
    manageRow.onSelect = () => {
      manageRequested = true
    }
    table.addRow(manageRow)

    table.reload()
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
  await presentAndWait(table, () => done || manageRequested)

  if (manageRequested) {
    await manageExercisesFlow(data)
    return await pickExercise(data)
  }

  return chosen
}

// ---------- Lägg till ny övning (med kategori) ----------

async function addNewExerciseFlow(data) {
  const nameAlert = new Alert()
  nameAlert.title = "Ny övning"
  nameAlert.addTextField("t.ex. Shoulder Press")
  nameAlert.addAction("Nästa")
  nameAlert.addCancelAction("Avbryt")
  const nameResult = await nameAlert.presentAlert()
  if (nameResult !== 0) return

  const name = nameAlert.textFieldValue(0).trim()
  if (name.length === 0) return

  const catAlert = new Alert()
  catAlert.title = "Välj kategori"
  catAlert.message = name
  for (const cat of GymData.CATEGORIES) {
    catAlert.addAction(cat)
  }
  catAlert.addCancelAction("Avbryt")
  const catResult = await catAlert.presentSheet()
  if (catResult < 0 || catResult >= GymData.CATEGORIES.length) return

  const category = GymData.CATEGORIES[catResult]
  GymData.addExercise(data, name, category)
}

// ---------- Hantera övningar (byt kategori / ta bort) ----------

async function manageExercisesFlow(data) {
  const table = new UITable()
  table.showSeparators = true
  let finished = false

  function render() {
    table.removeAllRows()

    const header = new UITableRow()
    header.isHeader = true
    header.addText("Hantera övningar")
    table.addRow(header)

    const infoRow = new UITableRow()
    const infoCell = infoRow.addText("Tryck på en övning för att byta kategori eller ta bort den.")
    infoCell.titleColor = Color.gray()
    infoCell.titleFont = Font.footnote()
    table.addRow(infoRow)

    const names = GymData.getAllExerciseNames(data)
    if (names.length === 0) {
      const emptyRow = new UITableRow()
      emptyRow.addText("Inga övningar ännu")
      table.addRow(emptyRow)
    }

    for (const name of names) {
      const category = data.exercises[name]
      const row = new UITableRow()
      row.dismissOnSelect = false
      row.height = 46
      const cell = row.addText(name, category)
      cell.subtitleColor = Color.gray()
      row.onSelect = async () => {
        await showExerciseOptions(data, name)
        render()
      }
      table.addRow(row)
    }

    const doneRow = new UITableRow()
    doneRow.dismissOnSelect = false
    const doneCell = doneRow.addText("✅ Klar")
    doneCell.titleColor = Color.green()
    doneCell.titleFont = Font.boldSystemFont(16)
    doneRow.onSelect = () => { finished = true }
    table.addRow(doneRow)

    table.reload()
  }

  render()
  await presentAndWait(table, () => finished)
}

async function showExerciseOptions(data, name) {
  const currentCategory = data.exercises[name]
  const otherCategories = GymData.CATEGORIES.filter(c => c !== currentCategory)

  const alert = new Alert()
  alert.title = name
  alert.message = `Nuvarande kategori: ${currentCategory}`
  for (const cat of otherCategories) {
    alert.addAction(`Flytta till "${cat}"`)
  }
  alert.addDestructiveAction("🗑 Ta bort övning")
  alert.addCancelAction("Stäng")

  const result = await alert.presentSheet()
  if (result < 0) return

  if (result < otherCategories.length) {
    GymData.setExerciseCategory(data, name, otherCategories[result])
    return
  }

  const confirm = new Alert()
  confirm.title = "Ta bort övning?"
  confirm.message = `"${name}" försvinner från listan. Redan loggade pass sparas fortfarande.`
  confirm.addDestructiveAction("Ta bort")
  confirm.addCancelAction("Avbryt")
  const confirmResult = await confirm.presentAlert()
  if (confirmResult === 0) {
    GymData.deleteExercise(data, name)
  }
}

// ---------- STEG 2: Logga vikt / reps / set ----------

async function logExerciseFlow(data, exerciseName) {
  const last = GymData.getLastEntry(data, exerciseName)
  let weight = last ? last.weight : 20
  let reps = last ? last.reps : 8
  let sets = last ? last.sets : 3
  let saved = false

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

    table.reload()
  }

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
  await presentAndWait(table, () => saved)

  if (!saved) return false

  GymData.logEntry(data, exerciseName, weight, reps, sets)

  const alert = new Alert()
  alert.title = "Pass loggat! 💪"
  alert.message = `${exerciseName}: ${weight}kg × ${reps} reps × ${sets} set`
  alert.addAction("Logga en till övning")
  alert.addAction("Klar - stäng")
  const resultIndex = await alert.presentAlert()

  return resultIndex === 0
}

await main()
Script.complete()
