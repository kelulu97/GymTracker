// progressWidget.js
// Detta är widgeten du lägger på hemskärmen.
// OBS: GymData tillhandahålls av loader-scriptet, deklareras INTE här.

const data = GymData.loadData()
const widget = new ListWidget()
widget.backgroundColor = new Color("#1c1c1e")
widget.url = URLScheme.forRunningScript()

const family = config.widgetFamily || "medium"

const allExercises = GymData.getAllExerciseNames(data)
const exercisesWithHistory = allExercises.filter(name => data.history[name] && data.history[name].length > 0)
const exercisesToShow = family === "small" ? exercisesWithHistory.slice(0, 1)
  : family === "medium" ? exercisesWithHistory.slice(0, 3)
  : exercisesWithHistory.slice(0, 6)

buildWidget(widget, exercisesToShow, family)

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  if (family === "small") await widget.presentSmall()
  else if (family === "large") await widget.presentLarge()
  else await widget.presentMedium()
}
Script.complete()

function buildWidget(widget, exercises, family) {
  widget.setPadding(14, 14, 14, 14)

  if (exercises.length === 0) {
    const title = widget.addText("Gym Tracker")
    title.font = Font.boldSystemFont(16)
    title.textColor = Color.white()
    widget.addSpacer(8)
    const empty = widget.addText("Inga pass loggade än. Tryck här för att börja!")
    empty.font = Font.systemFont(13)
    empty.textColor = Color.gray()
    return
  }

  const header = widget.addText("💪 Gym Tracker")
  header.font = Font.boldSystemFont(14)
  header.textColor = Color.white()
  widget.addSpacer(10)

  exercises.forEach((name, i) => {
    if (i > 0) widget.addSpacer(10)
    addExerciseRow(widget, name, family)
  })
}

function addExerciseRow(widget, name, family) {
  const last = GymData.getLastEntry(data, name)
  const trend = GymData.getTrend(data, name)

  const row = widget.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()

  const leftCol = row.addStack()
  leftCol.layoutVertically()

  const nameText = leftCol.addText(name)
  nameText.font = Font.semiboldSystemFont(13)
  nameText.textColor = Color.white()

  const detailText = leftCol.addText(`${last.weight}kg × ${last.reps} × ${last.sets} set`)
  detailText.font = Font.systemFont(11)
  detailText.textColor = Color.gray()

  row.addSpacer()

  const trendSymbols = { up: "↑", down: "↓", neutral: "→" }
  const trendColors = { up: Color.green(), down: Color.red(), neutral: Color.gray() }
  const trendText = row.addText(trendSymbols[trend])
  trendText.font = Font.boldSystemFont(18)
  trendText.textColor = trendColors[trend]
}
