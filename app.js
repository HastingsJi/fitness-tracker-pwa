const storageKey = "fitness-tracker-v2";
const passcodeStorageKey = "fitness-tracker-passcode";
const isDevServer = Boolean(window.__FITNESS_DEV__);

if (isDevServer && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

if (!isDevServer && "serviceWorker" in navigator) {
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
let pendingPhotos = [];
let pendingAnalysis = null;
let saveTimer = null;
let isHydratingState = false;
let passcodePromptPromise = null;

const els = {
  date: document.querySelector("#entry-date"),
  dateLabel: document.querySelector("#entry-date-label"),
  unlockDialog: document.querySelector("#unlock-dialog"),
  unlockForm: document.querySelector("#unlock-form"),
  passcodeInput: document.querySelector("#app-passcode-input"),
  unlockError: document.querySelector("#unlock-error"),
  weightForm: document.querySelector("#weight-form"),
  weight: document.querySelector("#weight-input"),
  weightStatus: document.querySelector("#weight-status"),
  mealText: document.querySelector("#meal-text"),
  photoInput: document.querySelector("#food-photo"),
  photoPreview: document.querySelector("#photo-preview"),
  calories: document.querySelector("#calories-input"),
  protein: document.querySelector("#protein-input"),
  carbs: document.querySelector("#carbs-input"),
  fat: document.querySelector("#fat-input"),
  macroEditor: document.querySelector("#macro-editor"),
  form: document.querySelector("#daily-form"),
  quickAddMeal: document.querySelector("#quick-add-meal-button"),
  estimate: document.querySelector("#estimate-button"),
  confirmMeal: document.querySelector("#confirm-meal-button"),
  analysisPanel: document.querySelector("#analysis-panel"),
  analysisSummary: document.querySelector("#analysis-summary"),
  analysisChat: document.querySelector("#analysis-chat"),
  correctionInput: document.querySelector("#correction-input"),
  sendCorrection: document.querySelector("#send-correction-button"),
  resetAnalysis: document.querySelector("#reset-analysis-button"),
  meals: document.querySelector("#meal-list"),
  history: document.querySelector("#history-table"),
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
  dashboardCarbs: document.querySelector("#dashboard-carbs"),
  dashboardFat: document.querySelector("#dashboard-fat"),
  dashboardWeight: document.querySelector("#dashboard-weight"),
  dashboardCalorieGoal: document.querySelector("#dashboard-calorie-goal"),
  dashboardProteinGoal: document.querySelector("#dashboard-protein-goal"),
  dashboardCarbsGoal: document.querySelector("#dashboard-carbs-goal"),
  dashboardFatGoal: document.querySelector("#dashboard-fat-goal"),
  dashboardWeightGoal: document.querySelector("#dashboard-weight-goal"),
  calorieGoalDisplay: document.querySelector("#calorie-goal-display"),
  proteinGoalDisplay: document.querySelector("#protein-goal-display"),
  carbsGoalDisplay: document.querySelector("#carbs-goal-display"),
  fatGoalDisplay: document.querySelector("#fat-goal-display"),
  weightGoalDisplay: document.querySelector("#weight-goal-display"),
  goalsDialog: document.querySelector("#goals-dialog"),
  goalsForm: document.querySelector("#goals-form"),
  goalCalories: document.querySelector("#goal-calories-input"),
  goalProtein: document.querySelector("#goal-protein-input"),
  goalCarbs: document.querySelector("#goal-carbs-input"),
  goalFat: document.querySelector("#goal-fat-input"),
  goalWeight: document.querySelector("#goal-weight-input"),
  microList: document.querySelector("#micro-list"),
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
      carbs: 260,
      fat: 70,
      micros: {
        fiber: 30,
        sodium: 2300,
        potassium: 3400,
        calcium: 1000,
        iron: 8
      },
      targetWeight: 70
    },
    days: {}
  };
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(storageKey)) || defaultState());
  } catch {
    return defaultState();
  }
}

function normalizeState(saved) {
  const defaults = defaultState();
  return {
    ...defaults,
    ...saved,
    profile: { ...defaults.profile, ...(saved.profile || {}) },
    goals: {
      ...defaults.goals,
      ...(saved.goals || {}),
      micros: { ...defaults.goals.micros, ...(saved.goals?.micros || {}) }
    },
    days: saved.days || {}
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (!isHydratingState) scheduleRemoteSave();
}

function hasLocalData() {
  return Object.keys(state.days || {}).length > 0 || Boolean(state.profile.weight || state.profile.age);
}

function scheduleRemoteSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    syncStateToServer().catch(() => {
      // Local storage remains the offline fallback when the server is unreachable.
    });
  }, 250);
}

async function hydrateStateFromServer() {
  const response = await apiFetch("/api/state");
  if (response.status === 401) {
    await requestPasscode(authPrompt());
    return hydrateStateFromServer();
  }
  if (!response.ok) throw new Error("state_load_failed");
  const payload = await response.json();

  if (payload.state) {
    isHydratingState = true;
    Object.assign(state, normalizeState(payload.state));
    localStorage.setItem(storageKey, JSON.stringify(state));
    isHydratingState = false;
    render();
    return;
  }

  if (hasLocalData()) {
    await syncStateToServer();
  }
}

async function syncStateToServer() {
  const response = await apiFetch("/api/state", {
    method: "PUT",
    body: JSON.stringify({ state })
  });
  if (response.status === 401) {
    await requestPasscode(authPrompt());
    return syncStateToServer();
  }
  if (!response.ok) throw new Error("state_save_failed");
}

function apiHeaders(extra = {}) {
  const passcode = localStorage.getItem(passcodeStorageKey) || "";
  return {
    "Content-Type": "application/json",
    ...(passcode ? { "X-App-Passcode": passcode } : {}),
    ...extra
  };
}

function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: apiHeaders(options.headers || {})
  });
}

function authPrompt() {
  const hadPasscode = Boolean(localStorage.getItem(passcodeStorageKey));
  if (hadPasscode) localStorage.removeItem(passcodeStorageKey);
  return {
    message: hadPasscode ? "Passcode 不正确，请重新输入" : "请输入 passcode",
    showError: hadPasscode
  };
}

function requestPasscode(prompt = {}) {
  if (passcodePromptPromise) return passcodePromptPromise;

  const normalizedPrompt = typeof prompt === "string" ? { message: prompt, showError: false } : prompt;
  const message = normalizedPrompt.message || "请输入 passcode";

  passcodePromptPromise = new Promise((resolve) => {
    els.unlockError.textContent = message;
    els.unlockError.hidden = !normalizedPrompt.showError;
    els.passcodeInput.value = localStorage.getItem(passcodeStorageKey) || "";
    if (!els.unlockDialog.open) els.unlockDialog.showModal();

    const handleSubmit = (event) => {
      event.preventDefault();
      const passcode = els.passcodeInput.value.trim();
      if (!passcode) {
        els.unlockError.textContent = "请输入 passcode";
        els.unlockError.hidden = false;
        return;
      }
      localStorage.setItem(passcodeStorageKey, passcode);
      els.unlockForm.removeEventListener("submit", handleSubmit);
      els.unlockDialog.close();
      passcodePromptPromise = null;
      resolve();
    };

    els.unlockForm.addEventListener("submit", handleSubmit);
  });

  return passcodePromptPromise;
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

function decimalValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
      fat: total.fat + numberValue(meal.fat),
      fiber: total.fiber + numberValue(meal.fiber),
      sodium: total.sodium + numberValue(meal.sodium),
      potassium: total.potassium + numberValue(meal.potassium),
      calcium: total.calcium + numberValue(meal.calcium),
      iron: total.iron + numberValue(meal.iron)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, potassium: 0, calcium: 0, iron: 0 }
  );
}

function microTargets() {
  return [
    { key: "fiber", label: "膳食纤维", unit: "g" },
    { key: "sodium", label: "钠", unit: "mg", limit: true },
    { key: "potassium", label: "钾", unit: "mg" },
    { key: "calcium", label: "钙", unit: "mg" },
    { key: "iron", label: "铁", unit: "mg" }
  ];
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
  const macroGoals = calculateMacroGoals(targetCalories, proteinGoal);
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
    carbsGoal: macroGoals.carbs,
    fatGoal: macroGoals.fat,
    weeks,
    reachDate,
    adjustedForFloor,
    directionMismatch
  };
}

function calculateMacroGoals(calories, protein) {
  const proteinCalories = protein * 4;
  const fatCalories = Math.max(calories * 0.25, 45 * 9);
  const carbsCalories = Math.max(0, calories - proteinCalories - fatCalories);
  return {
    carbs: Math.max(1, Math.round(carbsCalories / 4)),
    fat: Math.max(1, Math.round(fatCalories / 9))
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
        <small>P ${plan.proteinGoal}g · C ${plan.carbsGoal}g · F ${plan.fatGoal}g</small>
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
    state.goals.carbs = plan.carbsGoal;
    state.goals.fat = plan.fatGoal;
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

async function createAnalysisDraft(text, photos, correction = "") {
  const normalizedPhotos = normalizePhotos(photos);
  const serverDraft = await requestMealAnalysis(text, normalizedPhotos, correction).catch(() => null);
  if (serverDraft) {
    return {
      text: serverDraft.text,
      photo: primaryPhoto(normalizedPhotos),
      photos: normalizedPhotos,
      foods: serverDraft.foods || [],
      calories: serverDraft.calories,
      protein: serverDraft.protein,
      carbs: serverDraft.carbs,
      fat: serverDraft.fat,
      fiber: serverDraft.fiber || 0,
      sodium: serverDraft.sodium || 0,
      potassium: serverDraft.potassium || 0,
      calcium: serverDraft.calcium || 0,
      iron: serverDraft.iron || 0,
      source: serverDraft.source || "ai",
      warning: serverDraft.warning || "",
      messages: [{ role: "assistant", text: serverDraft.message }]
    };
  }

  return createLocalAnalysisDraft(text, normalizedPhotos, correction);
}

async function requestMealAnalysis(text, photos, correction = "") {
  const normalizedPhotos = normalizePhotos(photos);
  const response = await apiFetch(normalizedPhotos.length ? "/api/analyze-meal-photo" : "/api/analyze-meal-text", {
    method: "POST",
    body: JSON.stringify({ text, correction, photo: primaryPhoto(normalizedPhotos) || null, photos: normalizedPhotos })
  });

  if (response.status === 401) {
    await requestPasscode(authPrompt());
    return requestMealAnalysis(text, normalizedPhotos, correction);
  }
  if (!response.ok) throw new Error("analysis_failed");
  return response.json();
}

function createLocalAnalysisDraft(text, photos, correction = "") {
  const normalizedPhotos = normalizePhotos(photos);
  const combinedText = [text, correction].filter(Boolean).join(" ");
  const estimate = estimateFromText(combinedText);
  const hasFoodMatch = estimate.matched.length > 0;
  const hasPhoto = normalizedPhotos.length > 0;
  const fallback = hasPhoto && !hasFoodMatch
    ? { calories: 550, protein: 25, carbs: 60, fat: 22, matched: ["照片餐食 x 1"] }
    : estimate;

  return {
    text: combinedText.trim() || (hasPhoto ? "照片餐食" : ""),
    photo: primaryPhoto(normalizedPhotos),
    photos: normalizedPhotos,
    foods: fallback.matched,
    calories: Math.round(fallback.calories),
    protein: round(fallback.protein),
    carbs: round(fallback.carbs),
    fat: round(fallback.fat),
    fiber: 0,
    sodium: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
    source: "fallback",
    warning: "当前是本地粗略估算，没有调用 AI。",
    messages: [
      {
        role: "assistant",
        text: hasFoodMatch
          ? "我先按这些食物估算。你可以继续更正份量或食材。"
          : hasPhoto
            ? "我先按照片生成一个粗略草稿。你可以补充食材和份量。"
            : "我需要更多食物信息才能估算。"
      }
    ]
  };
}

function createLoadingAnalysis() {
  return {
    text: "",
    photo: primaryPhoto(pendingPhotos),
    photos: pendingPhotos,
    foods: [],
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
    isLoading: true,
    messages: [{ role: "assistant", text: "分析中..." }]
  };
}

function normalizePhotos(photos) {
  if (!photos) return [];
  return Array.isArray(photos) ? photos.filter(Boolean).map(String) : [String(photos)].filter(Boolean);
}

function primaryPhoto(photos) {
  return normalizePhotos(photos)[0] || "";
}

function renderAnalysis() {
  if (!pendingAnalysis) {
    els.analysisPanel.hidden = true;
    els.confirmMeal.disabled = true;
    els.macroEditor.hidden = true;
    return;
  }

  els.analysisPanel.hidden = false;
  els.confirmMeal.disabled = pendingAnalysis.isLoading || (!pendingAnalysis.text && !pendingAnalysis.photo && !normalizePhotos(pendingAnalysis.photos).length);
  els.macroEditor.hidden = Boolean(pendingAnalysis.isLoading);
  els.analysisSummary.hidden = Boolean(pendingAnalysis.isLoading);
  els.calories.value = pendingAnalysis.calories || "";
  els.protein.value = pendingAnalysis.protein || "";
  els.carbs.value = pendingAnalysis.carbs || "";
  els.fat.value = pendingAnalysis.fat || "";

  els.analysisSummary.innerHTML = `
    ${
      pendingAnalysis.warning
        ? `<div class="analysis-warning">${escapeHtml(pendingAnalysis.warning)}</div>`
        : pendingAnalysis.source === "ai"
          ? `<div class="analysis-source">AI 分析结果，请确认后保存</div>`
          : ""
    }
    <div class="analysis-macros">
      <article><span>热量</span><strong>${pendingAnalysis.calories || 0}</strong><small>kcal</small></article>
      <article><span>蛋白质</span><strong>${pendingAnalysis.protein || 0}</strong><small>g</small></article>
      <article><span>碳水</span><strong>${pendingAnalysis.carbs || 0}</strong><small>g</small></article>
      <article><span>脂肪</span><strong>${pendingAnalysis.fat || 0}</strong><small>g</small></article>
    </div>
    <div class="analysis-micros">
      ${microTargets().map((micro) => `<span>${micro.label} ${round(pendingAnalysis[micro.key] || 0)}${micro.unit}</span>`).join("")}
    </div>
    <div class="food-chips">
      ${(pendingAnalysis.foods.length ? pendingAnalysis.foods : ["待确认"]).map((food) => `<span>${escapeHtml(food)}</span>`).join("")}
    </div>
  `;

  els.analysisChat.innerHTML = pendingAnalysis.messages
    .map((message) => `<div class="chat-message ${message.role}">${escapeHtml(message.text)}</div>`)
    .join("");
}

function resetAnalysis() {
  pendingAnalysis = null;
  els.correctionInput.value = "";
  renderAnalysis();
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
  els.dateLabel.textContent = dateControlLabel(activeDate);
  renderGoals();
  renderDayForm();
  writeProfileForm();
  renderProgress();
  renderMeals();
  renderHistory();
  drawWeightChart();
}

function dateControlLabel(dateValue) {
  const date = parseLocalDate(dateValue);
  const today = parseLocalDate(todayKey());
  const yesterday = addDays(today, -1);

  if (sameDate(date, today)) return "今天";
  if (sameDate(date, yesterday)) return "昨天";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function parseLocalDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function renderGoals() {
  els.calorieGoalDisplay.textContent = state.goals.calories;
  els.proteinGoalDisplay.textContent = state.goals.protein;
  els.carbsGoalDisplay.textContent = state.goals.carbs;
  els.fatGoalDisplay.textContent = state.goals.fat;
  els.weightGoalDisplay.textContent = state.goals.targetWeight;
  els.dashboardCalorieGoal.textContent = state.goals.calories;
  els.dashboardProteinGoal.textContent = state.goals.protein;
  els.dashboardCarbsGoal.textContent = state.goals.carbs;
  els.dashboardFatGoal.textContent = state.goals.fat;
  els.dashboardWeightGoal.textContent = state.goals.targetWeight;
  els.goalCalories.value = state.goals.calories;
  els.goalProtein.value = state.goals.protein;
  els.goalCarbs.value = state.goals.carbs;
  els.goalFat.value = state.goals.fat;
  els.goalWeight.value = state.goals.targetWeight;
}

function renderDayForm() {
  const day = getDay();
  els.weight.value = day.weight ?? "";
  els.weightStatus.textContent = day.weight ? `已保存 ${day.weight}kg` : "未保存";
}

function renderProgress() {
  const day = getDay();
  const totals = sumMeals(day);
  const caloriePercent = Math.min(160, Math.round((totals.calories / state.goals.calories) * 100) || 0);
  const proteinPercent = Math.min(100, (totals.protein / state.goals.protein) * 100 || 0);
  const carbsPercent = Math.min(100, (totals.carbs / state.goals.carbs) * 100 || 0);
  const fatPercent = Math.min(100, (totals.fat / state.goals.fat) * 100 || 0);

  els.dashboardCalories.textContent = Math.round(totals.calories);
  els.dashboardProtein.textContent = `${round(totals.protein)}g`;
  els.dashboardCarbs.textContent = `${round(totals.carbs)}g`;
  els.dashboardFat.textContent = `${round(totals.fat)}g`;
  els.dashboardWeight.textContent = latestWeightLabel();
  els.calorieRing.style.setProperty("--percent", `${Math.min(100, caloriePercent)}%`);
  els.caloriePercent.textContent = `${caloriePercent}%`;
  els.proteinBar.style.width = `${proteinPercent}%`;
  els.carbsBar.style.width = `${carbsPercent}%`;
  els.fatBar.style.width = `${fatPercent}%`;
  els.proteinProgress.textContent = `${round(totals.protein)} / ${state.goals.protein}g`;
  els.carbsProgress.textContent = `${round(totals.carbs)} / ${state.goals.carbs}g`;
  els.fatProgress.textContent = `${round(totals.fat)} / ${state.goals.fat}g`;
  renderMicros(totals);
}

function renderMicros(totals) {
  els.microList.innerHTML = microTargets().map((micro) => {
    const goal = numberValue(state.goals.micros[micro.key]);
    const consumed = numberValue(totals[micro.key]);
    const percent = goal ? Math.min(140, Math.round((consumed / goal) * 100)) : 0;
    const label = micro.limit ? "上限" : "目标";
    return `
      <article class="micro-item">
        <div>
          <strong>${micro.label}</strong>
          <span>${round(consumed)} / ${goal}${micro.unit} ${label}</span>
        </div>
        <div class="micro-bar"><span style="width: ${Math.min(100, percent)}%"></span></div>
      </article>
    `;
  }).join("");
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
    els.meals.innerHTML = `<div class="empty-state">还没有记录</div>`;
    return;
  }

  els.meals.innerHTML = day.meals
    .map(
      (meal) => `
        <article class="meal-item">
          ${
            primaryPhoto(meal.photos || meal.photo)
              ? `<img class="meal-thumb" src="${primaryPhoto(meal.photos || meal.photo)}" alt="食物照片" />`
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

function drawWeightChart() {
  const ctx = els.chart.getContext("2d");
  const points = Object.entries(state.days)
    .filter(([, day]) => day.weight)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30);

  const ratio = window.devicePixelRatio || 1;
  const displayWidth = Math.max(280, Math.floor(els.chart.parentElement?.clientWidth || els.chart.clientWidth || 900));
  const displayHeight = displayWidth < 520 ? 260 : 320;
  els.chart.width = Math.floor(displayWidth * ratio);
  els.chart.height = Math.floor(displayHeight * ratio);
  els.chart.style.width = `${displayWidth}px`;
  els.chart.style.height = `${displayHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = displayWidth;
  const height = displayHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcfa";
  ctx.fillRect(0, 0, width, height);

  if (points.length < 2) {
    els.trendNote.textContent = points.length ? "再记录一天即可生成趋势" : "暂无数据";
    ctx.fillStyle = "#6e7771";
    ctx.font = "18px system-ui";
    ctx.fillText("记录两天后显示趋势", 32, height / 2);
    return;
  }

  const weights = points.map(([, day]) => Number(day.weight));
  const min = Math.min(...weights, state.goals.targetWeight) - 1;
  const max = Math.max(...weights, state.goals.targetWeight) + 1;
  const leftPad = width < 520 ? 28 : 44;
  const rightPad = width < 520 ? 28 : 44;
  const topPad = width < 520 ? 34 : 42;
  const bottomPad = width < 520 ? 42 : 48;
  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;

  const xFor = (index) => {
    if (points.length === 2) return leftPad + (index === 0 ? chartWidth * 0.08 : chartWidth * 0.92);
    return leftPad + (index / (points.length - 1)) * chartWidth;
  };
  const yFor = (weight) => topPad + chartHeight - ((weight - min) / (max - min)) * chartHeight;

  ctx.strokeStyle = "#dde3dc";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = topPad + i * (chartHeight / 4);
    ctx.beginPath();
    ctx.moveTo(leftPad, y);
    ctx.lineTo(width - rightPad, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#e56f3f";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(leftPad, yFor(state.goals.targetWeight));
  ctx.lineTo(width - rightPad, yFor(state.goals.targetWeight));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#167a68";
  ctx.lineWidth = width < 520 ? 3 : 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
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
    ctx.arc(x, y, width < 520 ? 4 : 5, 0, Math.PI * 2);
    ctx.fill();
    if (index === 0 || index === points.length - 1) {
      ctx.fillStyle = "#18201d";
      ctx.font = "700 12px system-ui";
      ctx.textAlign = index === 0 ? "left" : "right";
      ctx.fillText(`${day.weight}kg`, x + (index === 0 ? 6 : -6), y - 10);
      ctx.fillStyle = "#6e7771";
      ctx.font = "12px system-ui";
      ctx.fillText(date.slice(5), x, height - 14);
    }
  });

  const diff = round(weights.at(-1) - weights[0]);
  const direction = diff < 0 ? "下降" : diff > 0 ? "上升" : "持平";
  els.trendNote.textContent = `${points[0][0].slice(5)} - ${points.at(-1)[0].slice(5)} · ${direction} ${Math.abs(diff)} kg`;
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
  els.photoPreview.innerHTML = "";
  els.photoPreview.classList.remove("has-photo");
  els.macroEditor.hidden = true;
  pendingPhotos = [];
  resetAnalysis();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview() {
  els.photoPreview.innerHTML = pendingPhotos
    .map((photo, index) => `<img src="${photo}" alt="食物照片 ${index + 1}" />`)
    .join("");
  els.photoPreview.classList.toggle("has-photo", pendingPhotos.length > 0);
}

function showView(viewId) {
  const view = document.querySelector(`#${viewId}`);
  if (!view) return;

  document.querySelectorAll(".view").forEach((node) => node.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach((node) => node.classList.toggle("active", node.dataset.view === viewId));
  view.classList.add("active");
  els.viewTitle.textContent = view.dataset.title || "Fitness";

  if (viewId === "trend-view") {
    drawWeightChart();
  }
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

els.quickAddMeal.addEventListener("click", () => {
  showView("log-view");
  requestAnimationFrame(() => els.mealText.focus());
});

els.date.addEventListener("change", () => {
  activeDate = els.date.value || todayKey();
  resetMealInputs();
  render();
});

els.weightForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = decimalValue(els.weight.value);
  if (!value) return;

  getDay().weight = value;
  state.profile.weight = String(value);
  saveState();
  els.weightStatus.textContent = `已保存 ${value}kg`;
  renderProgress();
  renderHistory();
  drawWeightChart();
  writeProfileForm();
});

els.estimate.addEventListener("click", () => {
  const hasInput = els.mealText.value.trim() || pendingPhotos.length;
  if (!hasInput) return;

  pendingAnalysis = createLoadingAnalysis();
  renderAnalysis();
  createAnalysisDraft(els.mealText.value, pendingPhotos).then((draft) => {
    pendingAnalysis = draft;
    renderAnalysis();
  });
});

els.mealText.addEventListener("input", () => {
  if (pendingAnalysis) resetAnalysis();
});

els.sendCorrection.addEventListener("click", () => {
  const correction = els.correctionInput.value.trim();
  if (!correction || !pendingAnalysis) return;

  const previousMessages = pendingAnalysis.messages;
  pendingAnalysis.messages = [
    ...previousMessages,
    { role: "user", text: correction },
    { role: "assistant", text: "更新中..." }
  ];
  els.correctionInput.value = "";
  renderAnalysis();

  createAnalysisDraft(els.mealText.value, pendingPhotos, correction).then((draft) => {
    pendingAnalysis = {
      ...draft,
      messages: [
        ...previousMessages,
        { role: "user", text: correction },
        { role: "assistant", text: "已按你的更正更新草稿。确认无误后再保存。" }
      ]
    };
    renderAnalysis();
  });
});

els.correctionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    els.sendCorrection.click();
  }
});

els.resetAnalysis.addEventListener("click", resetAnalysis);

els.photoInput.addEventListener("change", () => {
  const files = Array.from(els.photoInput.files || []);
  if (!files.length) return;

  Promise.all(files.map(readFileAsDataUrl)).then((photos) => {
    pendingPhotos = photos;
    renderPhotoPreview();
    if (pendingAnalysis) resetAnalysis();
  });
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const day = getDay();

  if (!pendingAnalysis) {
    const hasInput = els.mealText.value.trim() || pendingPhotos.length;
    if (!hasInput) return;

    pendingAnalysis = createLoadingAnalysis();
    renderAnalysis();
    createAnalysisDraft(els.mealText.value, pendingPhotos).then((draft) => {
      pendingAnalysis = draft;
      renderAnalysis();
      saveState();
    });
    return;
  }

  const source = pendingAnalysis || {
    text: els.mealText.value.trim(),
    calories: numberValue(els.calories.value),
    protein: numberValue(els.protein.value),
    carbs: numberValue(els.carbs.value),
    fat: numberValue(els.fat.value),
    fiber: 0,
    sodium: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
    photo: primaryPhoto(pendingPhotos),
    photos: pendingPhotos
  };

  const meal = {
    id: crypto.randomUUID(),
    text: source.text || els.mealText.value.trim(),
    calories: numberValue(els.calories.value || source.calories),
    protein: numberValue(els.protein.value || source.protein),
    carbs: numberValue(els.carbs.value || source.carbs),
    fat: numberValue(els.fat.value || source.fat),
    fiber: numberValue(source.fiber),
    sodium: numberValue(source.sodium),
    potassium: numberValue(source.potassium),
    calcium: numberValue(source.calcium),
    iron: numberValue(source.iron),
    photo: source.photo || primaryPhoto(source.photos || pendingPhotos),
    photos: normalizePhotos(source.photos || source.photo || pendingPhotos),
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
  state.goals.carbs = Math.max(1, Math.round(numberValue(els.goalCarbs.value)));
  state.goals.fat = Math.max(1, Math.round(numberValue(els.goalFat.value)));
  state.goals.targetWeight = Math.max(1, decimalValue(els.goalWeight.value) || 1);
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

render();
hydrateStateFromServer().catch(() => {
  // Keep the current local state if persistence is unavailable during development.
});
