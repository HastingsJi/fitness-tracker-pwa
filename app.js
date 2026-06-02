const storageKey = "fitness-tracker-v2";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // The app still works without offline caching.
    });
  });
}

const foodDatabase = [
  { name: "鸡蛋", aliases: ["egg", "鸡蛋", "蛋"], unit: "个", calories: 70, protein: 6, carbs: 0.6, fat: 5 },
  { name: "鸡胸肉", aliases: ["chicken", "鸡胸", "鸡胸肉"], unit: "100g", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "牛肉", aliases: ["beef", "牛肉"], unit: "100g", calories: 250, protein: 26, carbs: 0, fat: 15 },
  { name: "三文鱼", aliases: ["salmon", "三文鱼"], unit: "100g", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: "米饭", aliases: ["rice", "米饭", "白饭"], unit: "100g", calories: 130, protein: 2.4, carbs: 28, fat: 0.3 },
  { name: "燕麦", aliases: ["oat", "oats", "燕麦"], unit: "50g", calories: 190, protein: 6.5, carbs: 32, fat: 3.5 },
  { name: "面包", aliases: ["bread", "吐司", "面包"], unit: "片", calories: 80, protein: 3, carbs: 14, fat: 1.2 },
  { name: "牛奶", aliases: ["milk", "牛奶"], unit: "250ml", calories: 150, protein: 8, carbs: 12, fat: 8 },
  { name: "酸奶", aliases: ["yogurt", "酸奶"], unit: "杯", calories: 120, protein: 9, carbs: 14, fat: 3 },
  { name: "香蕉", aliases: ["banana", "香蕉"], unit: "根", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: "苹果", aliases: ["apple", "苹果"], unit: "个", calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: "牛油果", aliases: ["avocado", "牛油果"], unit: "个", calories: 240, protein: 3, carbs: 13, fat: 22 },
  { name: "花生酱", aliases: ["peanut butter", "花生酱"], unit: "勺", calories: 95, protein: 3.5, carbs: 3.5, fat: 8 },
  { name: "蛋白粉", aliases: ["protein powder", "whey", "蛋白粉"], unit: "勺", calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { name: "沙拉", aliases: ["salad", "沙拉"], unit: "份", calories: 180, protein: 6, carbs: 16, fat: 10 },
  { name: "橄榄油", aliases: ["olive oil", "橄榄油", "油"], unit: "勺", calories: 119, protein: 0, carbs: 0, fat: 13.5 }
];

const state = loadState();
let activeDate = todayKey();
let pendingPhoto = "";

const els = {
  date: document.querySelector("#entry-date"),
  weight: document.querySelector("#weight-input"),
  mealText: document.querySelector("#meal-text"),
  photoInput: document.querySelector("#food-photo"),
  photoPreview: document.querySelector("#photo-preview"),
  calories: document.querySelector("#calories-input"),
  protein: document.querySelector("#protein-input"),
  carbs: document.querySelector("#carbs-input"),
  fat: document.querySelector("#fat-input"),
  form: document.querySelector("#daily-form"),
  estimate: document.querySelector("#estimate-button"),
  meals: document.querySelector("#meal-list"),
  history: document.querySelector("#history-table"),
  foodGrid: document.querySelector("#food-grid"),
  todayCalories: document.querySelector("#today-calories"),
  todayProtein: document.querySelector("#today-protein"),
  latestWeight: document.querySelector("#latest-weight"),
  calorieRing: document.querySelector("#calorie-ring"),
  caloriePercent: document.querySelector("#calorie-percent"),
  proteinBar: document.querySelector("#protein-bar"),
  carbsBar: document.querySelector("#carbs-bar"),
  fatBar: document.querySelector("#fat-bar"),
  proteinProgress: document.querySelector("#protein-progress-label"),
  carbsProgress: document.querySelector("#carbs-progress-label"),
  fatProgress: document.querySelector("#fat-progress-label"),
  dashboardCalories: document.querySelector("#dashboard-calories"),
  dashboardProtein: document.querySelector("#dashboard-protein"),
  dashboardWeight: document.querySelector("#dashboard-weight"),
  dashboardCalorieGoal: document.querySelector("#dashboard-calorie-goal"),
  dashboardProteinGoal: document.querySelector("#dashboard-protein-goal"),
  dashboardWeightGoal: document.querySelector("#dashboard-weight-goal"),
  calorieGoalDisplay: document.querySelector("#calorie-goal-display"),
  proteinGoalDisplay: document.querySelector("#protein-goal-display"),
  weightGoalDisplay: document.querySelector("#weight-goal-display"),
  goalsDialog: document.querySelector("#goals-dialog"),
  goalsForm: document.querySelector("#goals-form"),
  goalCalories: document.querySelector("#goal-calories-input"),
  goalProtein: document.querySelector("#goal-protein-input"),
  goalWeight: document.querySelector("#goal-weight-input"),
  goalSetupForm: document.querySelector("#goal-setup-form"),
  profileAge: document.querySelector("#profile-age"),
  profileSex: document.querySelector("#profile-sex"),
  profileHeight: document.querySelector("#profile-height"),
  profileWeight: document.querySelector("#profile-weight"),
  profileActivity: document.querySelector("#profile-activity"),
  profileGoalMode: document.querySelector("#profile-goal-mode"),
  profileTargetWeight: document.querySelector("#profile-target-weight"),
  profilePace: document.querySelector("#profile-pace"),
  suggestTarget: document.querySelector("#suggest-target-button"),
  goalSetupResult: document.querySelector("#goal-setup-result"),
  trendNote: document.querySelector("#weight-trend-note"),
  chart: document.querySelector("#weight-chart"),
  todayLabel: document.querySelector("#today-label"),
  viewTitle: document.querySelector("#view-title")
};

function defaultState() {
  return {
    profile: {
      age: "",
      sex: "male",
      height: "",
      weight: "",
      activity: "1.2",
      goalMode: "lose",
      targetWeight: "",
      pace: "0.5"
    },
    goals: {
      calories: 2200,
      protein: 140,
      targetWeight: 70
    },
    days: {}
  };
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDay(date = activeDate) {
  if (!state.days[date]) {
    state.days[date] = { weight: null, meals: [] };
  }
  return state.days[date];
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sumMeals(day) {
  return day.meals.reduce(
    (total, meal) => ({
      calories: total.calories + numberValue(meal.calories),
      protein: total.protein + numberValue(meal.protein),
      carbs: total.carbs + numberValue(meal.carbs),
      fat: total.fat + numberValue(meal.fat)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return "偏轻";
  if (bmi < 25) return "健康范围";
  if (bmi < 30) return "超重";
  return "肥胖范围";
}

function healthyWeightRange(heightCm) {
  const heightM = heightCm / 100;
  return {
    min: round(18.5 * heightM * heightM),
    max: round(24.9 * heightM * heightM),
    middle: round(22 * heightM * heightM)
  };
}

function calculateGoalPlan(profile) {
  const age = numberValue(profile.age);
  const height = numberValue(profile.height);
  const weight = numberValue(profile.weight);
  const targetWeight = numberValue(profile.targetWeight);
  const activity = numberValue(profile.activity);
  const pace = numberValue(profile.pace);

  if (!age || !height || !weight || !targetWeight || !activity) {
    return { error: "请先填写年龄、身高、当前体重、活动水平和目标体重。" };
  }

  const heightM = height / 100;
  const bmi = round(weight / (heightM * heightM), 1);
  const range = healthyWeightRange(height);
  const sexOffset = profile.sex === "female" ? -161 : 5;
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + sexOffset);
  const maintenance = Math.round(bmr * activity);
  const direction = Math.sign(targetWeight - weight);
  const mode = profile.goalMode;
  const weeklyChange = mode === "maintain" ? 0 : pace * (mode === "gain" ? 1 : -1);
  const kgToChange = Math.abs(targetWeight - weight);
  const weeks = weeklyChange ? Math.ceil(kgToChange / Math.abs(weeklyChange)) : 0;
  const dailyCalorieShift = weeklyChange ? Math.round((Math.abs(weeklyChange) * 7700) / 7) : 0;
  let targetCalories = maintenance;

  if (mode === "lose") targetCalories = maintenance - dailyCalorieShift;
  if (mode === "gain") targetCalories = maintenance + Math.min(400, dailyCalorieShift);

  const calorieFloor = profile.sex === "female" ? 1200 : 1500;
  const adjustedForFloor = mode === "lose" && targetCalories < calorieFloor;
  if (adjustedForFloor) targetCalories = calorieFloor;

  const proteinGoal = Math.round(Math.max(1.6 * targetWeight, 1.2 * weight));
  const reachDate = weeks ? addWeeks(new Date(), weeks) : null;
  const directionMismatch =
    (mode === "lose" && direction >= 0) ||
    (mode === "gain" && direction <= 0) ||
    (mode === "maintain" && kgToChange > 1);

  return {
    age,
    height,
    weight,
    targetWeight,
    bmi,
    category: bmiCategory(bmi),
    range,
    bmr,
    maintenance,
    targetCalories,
    proteinGoal,
    weeks,
    reachDate,
    adjustedForFloor,
    directionMismatch
  };
}

function addWeeks(date, weeks) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + weeks * 7);
  return copy.toISOString().slice(0, 10);
}

function readProfileForm() {
  return {
    age: els.profileAge.value,
    sex: els.profileSex.value,
    height: els.profileHeight.value,
    weight: els.profileWeight.value,
    activity: els.profileActivity.value,
    goalMode: els.profileGoalMode.value,
    targetWeight: els.profileTargetWeight.value,
    pace: els.profilePace.value
  };
}

function writeProfileForm() {
  const profile = state.profile;
  els.profileAge.value = profile.age;
  els.profileSex.value = profile.sex;
  els.profileHeight.value = profile.height;
  els.profileWeight.value = profile.weight || getDay().weight || "";
  els.profileActivity.value = profile.activity;
  els.profileGoalMode.value = profile.goalMode;
  els.profileTargetWeight.value = profile.targetWeight || state.goals.targetWeight || "";
  els.profilePace.value = profile.pace;
}

function suggestTargetWeight() {
  const profile = readProfileForm();
  const height = numberValue(profile.height);
  const weight = numberValue(profile.weight);
  if (!height || !weight) return;

  const range = healthyWeightRange(height);
  if (profile.goalMode === "lose") {
    els.profileTargetWeight.value = weight > range.max ? range.max : Math.max(range.min, round(weight * 0.95));
  } else if (profile.goalMode === "gain") {
    els.profileTargetWeight.value = weight < range.min ? range.min : round(weight * 1.05);
  } else {
    els.profileTargetWeight.value = weight;
  }
}

function renderGoalSetupResult(plan) {
  if (!plan || plan.error) {
    els.goalSetupResult.innerHTML = plan?.error ? `<div class="empty-state">${plan.error}</div>` : "";
    return;
  }

  const timeline = plan.weeks
    ? `${plan.weeks} 周左右，预计 ${plan.reachDate}`
    : "维持当前体重";
  const warnings = [
    plan.adjustedForFloor ? "目标速度会让热量过低，已自动提高到保守下限。" : "",
    plan.directionMismatch ? "目标方向和目标体重不一致，请确认是否填反。" : ""
  ].filter(Boolean);

  els.goalSetupResult.innerHTML = `
    <div class="result-grid">
      <article>
        <span>BMI</span>
        <strong>${plan.bmi}</strong>
        <small>${plan.category}</small>
      </article>
      <article>
        <span>健康体重范围</span>
        <strong>${plan.range.min}-${plan.range.max} kg</strong>
        <small>按成人 BMI 18.5-24.9 估算</small>
      </article>
      <article>
        <span>维持热量</span>
        <strong>${plan.maintenance} kcal</strong>
        <small>BMR ${plan.bmr} kcal × 活动水平</small>
      </article>
      <article>
        <span>建议每日热量</span>
        <strong>${plan.targetCalories} kcal</strong>
        <small>蛋白质 ${plan.proteinGoal} g / 天</small>
      </article>
      <article>
        <span>目标时间</span>
        <strong>${timeline}</strong>
        <small>实际会随体重变化调整</small>
      </article>
    </div>
    ${warnings.length ? `<div class="setup-warning">${warnings.join(" ")}</div>` : ""}
    <div class="action-row">
      <button class="primary-button" id="apply-plan-button" type="button">应用到每日目标</button>
    </div>
  `;

  document.querySelector("#apply-plan-button").addEventListener("click", () => {
    state.goals.calories = plan.targetCalories;
    state.goals.protein = plan.proteinGoal;
    state.goals.targetWeight = plan.targetWeight;
    state.profile = readProfileForm();
    saveState();
    render();
    renderGoalSetupResult(plan);
  });
}

function estimateFromText(text) {
  const normalized = text.toLowerCase();
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const matched = [];

  for (const food of foodDatabase) {
    const alias = food.aliases.find((item) => normalized.includes(item.toLowerCase()));
    if (!alias) continue;

    const quantity = readQuantityNearFood(normalized, alias, food);
    totals.calories += food.calories * quantity;
    totals.protein += food.protein * quantity;
    totals.carbs += food.carbs * quantity;
    totals.fat += food.fat * quantity;
    matched.push(`${food.name} x ${quantity}`);
  }

  return {
    ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value)])),
    matched
  };
}

function readQuantityNearFood(text, alias, food) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const afterPattern = new RegExp(`${escaped}[\\u4e00-\\u9fa5a-zA-Z\\s]{0,2}(\\d+(?:\\.\\d+)?)(?:\\s*(g|克|ml|毫升|个|份|杯|片|勺))?`, "i");
  const beforePattern = new RegExp(`(\\d+(?:\\.\\d+)?)(?:\\s*(g|克|ml|毫升|个|份|杯|片|勺))?\\s*${escaped}`, "i");
  const after = text.match(afterPattern);
  const before = text.match(beforePattern);
  const match = after || before;
  const value = numberValue(match?.[1] || 1);
  const unit = match?.[2] || "";

  if (/^(g|克|ml|毫升)$/i.test(unit)) {
    const baseAmount = Number(food.unit.match(/\d+/)?.[0]) || 100;
    return Math.max(0.1, value / baseAmount);
  }

  return Math.max(0.1, value);
}

function render() {
  els.todayLabel.textContent = activeDate === todayKey() ? "今天" : activeDate;
  els.date.value = activeDate;
  renderGoals();
  renderDayForm();
  writeProfileForm();
  renderProgress();
  renderMeals();
  renderHistory();
  renderFoods();
  drawWeightChart();
}

function renderGoals() {
  els.calorieGoalDisplay.textContent = state.goals.calories;
  els.proteinGoalDisplay.textContent = state.goals.protein;
  els.weightGoalDisplay.textContent = Number(state.goals.targetWeight).toFixed(1);
  els.dashboardCalorieGoal.textContent = state.goals.calories;
  els.dashboardProteinGoal.textContent = state.goals.protein;
  els.dashboardWeightGoal.textContent = Number(state.goals.targetWeight).toFixed(1);
  els.goalCalories.value = state.goals.calories;
  els.goalProtein.value = state.goals.protein;
  els.goalWeight.value = state.goals.targetWeight;
}

function renderDayForm() {
  const day = getDay();
  els.weight.value = day.weight ?? "";
}

function renderProgress() {
  const day = getDay();
  const totals = sumMeals(day);
  const caloriePercent = Math.min(160, Math.round((totals.calories / state.goals.calories) * 100) || 0);
  const proteinPercent = Math.min(100, (totals.protein / state.goals.protein) * 100 || 0);
  const carbsPercent = Math.min(100, (totals.carbs / 300) * 100 || 0);
  const fatPercent = Math.min(100, (totals.fat / 90) * 100 || 0);

  els.todayCalories.textContent = Math.round(totals.calories);
  els.todayProtein.textContent = `${round(totals.protein)}g`;
  els.latestWeight.textContent = latestWeightLabel();
  els.dashboardCalories.textContent = Math.round(totals.calories);
  els.dashboardProtein.textContent = `${round(totals.protein)}g`;
  els.dashboardWeight.textContent = latestWeightLabel();
  els.calorieRing.style.setProperty("--percent", `${Math.min(100, caloriePercent)}%`);
  els.caloriePercent.textContent = `${caloriePercent}%`;
  els.proteinBar.style.width = `${proteinPercent}%`;
  els.carbsBar.style.width = `${carbsPercent}%`;
  els.fatBar.style.width = `${fatPercent}%`;
  els.proteinProgress.textContent = `${round(totals.protein)} / ${state.goals.protein}g`;
  els.carbsProgress.textContent = `${round(totals.carbs)}g`;
  els.fatProgress.textContent = `${round(totals.fat)}g`;
}

function latestWeightLabel() {
  const latest = Object.entries(state.days)
    .filter(([, day]) => day.weight)
    .sort(([a], [b]) => b.localeCompare(a))[0];
  return latest ? `${latest[1].weight}kg` : "--";
}

function renderMeals() {
  const day = getDay();
  if (!day.meals.length) {
    els.meals.innerHTML = `<div class="empty-state">还没有餐食记录。可以输入文字估算，或添加照片后手动保存营养。</div>`;
    return;
  }

  els.meals.innerHTML = day.meals
    .map(
      (meal) => `
        <article class="meal-item">
          ${
            meal.photo
              ? `<img class="meal-thumb" src="${meal.photo}" alt="食物照片" />`
              : `<div class="meal-thumb empty" aria-hidden="true">餐</div>`
          }
          <div>
            <div class="meal-title">${escapeHtml(meal.text || "未命名餐食")}</div>
            <div class="meal-meta">${Math.round(meal.calories)} kcal · P ${round(meal.protein)}g · C ${round(meal.carbs)}g · F ${round(meal.fat)}g</div>
          </div>
          <button class="delete-meal" type="button" data-id="${meal.id}" aria-label="删除记录">删除</button>
        </article>
      `
    )
    .join("");
}

function renderHistory() {
  const rows = Object.entries(state.days)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, day]) => {
      const totals = sumMeals(day);
      const mealText = day.meals.map((meal) => meal.text).filter(Boolean).join("；");
      return `
        <tr>
          <td>${date}</td>
          <td>${day.weight ? `${day.weight} kg` : "--"}</td>
          <td>${Math.round(totals.calories)}</td>
          <td>${round(totals.protein)}g</td>
          <td>${escapeHtml(mealText || "--")}</td>
        </tr>
      `;
    });
  els.history.innerHTML = rows.join("") || `<tr><td colspan="5">暂无历史记录</td></tr>`;
}

function renderFoods() {
  els.foodGrid.innerHTML = foodDatabase
    .map(
      (food) => `
        <article class="food-card">
          <strong>${food.name}</strong>
          <span>每 ${food.unit}</span>
          <span>${food.calories} kcal · P ${food.protein}g · C ${food.carbs}g · F ${food.fat}g</span>
        </article>
      `
    )
    .join("");
}

function drawWeightChart() {
  const ctx = els.chart.getContext("2d");
  const points = Object.entries(state.days)
    .filter(([, day]) => day.weight)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30);

  const { width, height } = els.chart;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcfa";
  ctx.fillRect(0, 0, width, height);

  if (points.length < 2) {
    els.trendNote.textContent = points.length ? "再记录一天即可生成趋势" : "暂无数据";
    ctx.fillStyle = "#6e7771";
    ctx.font = "18px system-ui";
    ctx.fillText("记录至少两天体重后显示趋势", 32, height / 2);
    return;
  }

  const weights = points.map(([, day]) => Number(day.weight));
  const min = Math.min(...weights, state.goals.targetWeight) - 1;
  const max = Math.max(...weights, state.goals.targetWeight) + 1;
  const pad = 42;

  const xFor = (index) => pad + (index / (points.length - 1)) * (width - pad * 2);
  const yFor = (weight) => height - pad - ((weight - min) / (max - min)) * (height - pad * 2);

  ctx.strokeStyle = "#dde3dc";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = pad + i * ((height - pad * 2) / 4);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#e56f3f";
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(pad, yFor(state.goals.targetWeight));
  ctx.lineTo(width - pad, yFor(state.goals.targetWeight));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#167a68";
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach(([, day], index) => {
    const x = xFor(index);
    const y = yFor(day.weight);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  points.forEach(([date, day], index) => {
    const x = xFor(index);
    const y = yFor(day.weight);
    ctx.fillStyle = "#167a68";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (index === 0 || index === points.length - 1) {
      ctx.fillStyle = "#18201d";
      ctx.font = "14px system-ui";
      ctx.fillText(`${day.weight}kg`, x - 18, y - 12);
      ctx.fillStyle = "#6e7771";
      ctx.fillText(date.slice(5), x - 18, height - 14);
    }
  });

  const diff = round(weights.at(-1) - weights[0]);
  els.trendNote.textContent = `${points[0][0]} 到 ${points.at(-1)[0]}：${diff > 0 ? "+" : ""}${diff} kg`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetMealInputs() {
  els.mealText.value = "";
  els.calories.value = "";
  els.protein.value = "";
  els.carbs.value = "";
  els.fat.value = "";
  els.photoInput.value = "";
  els.photoPreview.removeAttribute("src");
  els.photoPreview.classList.remove("has-photo");
  pendingPhoto = "";
}

function exportCsv() {
  const headers = ["date", "weight_kg", "calories", "protein_g", "carbs_g", "fat_g", "meals"];
  const rows = Object.entries(state.days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      const totals = sumMeals(day);
      return [
        date,
        day.weight ?? "",
        Math.round(totals.calories),
        round(totals.protein),
        round(totals.carbs),
        round(totals.fat),
        day.meals.map((meal) => meal.text).join("; ")
      ];
    });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fitness-${todayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function showView(viewId) {
  const view = document.querySelector(`#${viewId}`);
  if (!view) return;

  document.querySelectorAll(".view").forEach((node) => node.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach((node) => node.classList.toggle("active", node.dataset.view === viewId));
  view.classList.add("active");
  els.viewTitle.textContent = view.dataset.title || "Fitness";

  if (viewId === "weight-view") {
    drawWeightChart();
  }
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

els.date.addEventListener("change", () => {
  activeDate = els.date.value || todayKey();
  resetMealInputs();
  render();
});

els.weight.addEventListener("change", () => {
  getDay().weight = els.weight.value ? round(numberValue(els.weight.value)) : null;
  if (els.weight.value) {
    state.profile.weight = els.weight.value;
  }
  saveState();
  renderProgress();
  renderHistory();
  drawWeightChart();
  writeProfileForm();
});

els.estimate.addEventListener("click", () => {
  const estimate = estimateFromText(els.mealText.value);
  els.calories.value = Math.round(estimate.calories);
  els.protein.value = estimate.protein;
  els.carbs.value = estimate.carbs;
  els.fat.value = estimate.fat;
  if (!estimate.matched.length) {
    els.mealText.placeholder = "没匹配到食物。可以试试：鸡胸肉150g 米饭200g 鸡蛋2个";
  }
});

els.photoInput.addEventListener("change", () => {
  const file = els.photoInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    pendingPhoto = String(reader.result);
    els.photoPreview.src = pendingPhoto;
    els.photoPreview.classList.add("has-photo");
  });
  reader.readAsDataURL(file);
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const day = getDay();
  if (els.weight.value) day.weight = round(numberValue(els.weight.value));

  const meal = {
    id: crypto.randomUUID(),
    text: els.mealText.value.trim(),
    calories: numberValue(els.calories.value),
    protein: numberValue(els.protein.value),
    carbs: numberValue(els.carbs.value),
    fat: numberValue(els.fat.value),
    photo: pendingPhoto,
    createdAt: new Date().toISOString()
  };

  if (meal.text || meal.calories || meal.photo) {
    day.meals.push(meal);
  }

  saveState();
  resetMealInputs();
  render();
  showView("dashboard-view");
});

els.meals.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-meal");
  if (!button) return;
  const day = getDay();
  day.meals = day.meals.filter((meal) => meal.id !== button.dataset.id);
  saveState();
  render();
});

document.querySelector("#edit-goals-button").addEventListener("click", () => {
  els.goalsDialog.showModal();
});

els.goalsForm.addEventListener("submit", () => {
  state.goals.calories = Math.max(1, Math.round(numberValue(els.goalCalories.value)));
  state.goals.protein = Math.max(1, Math.round(numberValue(els.goalProtein.value)));
  state.goals.targetWeight = Math.max(1, round(numberValue(els.goalWeight.value)));
  saveState();
  render();
});

els.suggestTarget.addEventListener("click", () => {
  suggestTargetWeight();
});

els.goalSetupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.profile = readProfileForm();
  const plan = calculateGoalPlan(state.profile);
  saveState();
  renderGoalSetupResult(plan);
});

document.querySelector("#clear-day-button").addEventListener("click", () => {
  if (!confirm(`清空 ${activeDate} 的记录？`)) return;
  delete state.days[activeDate];
  saveState();
  render();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  if (!confirm("清空所有本地记录？")) return;
  state.days = {};
  saveState();
  render();
});

document.querySelector("#export-button").addEventListener("click", exportCsv);

render();
