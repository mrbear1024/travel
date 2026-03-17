const { createApp, ref, computed, nextTick, watch } = Vue;

createApp({
  setup() {
    const step = ref('input');
    const planTab = ref('plan');
    const userInput = ref('');
    const isLoading = ref(false);
    const errorMsg = ref('');
    const questions = ref([]);
    const answers = ref({});
    const planMarkdown = ref('');

    // Map & Locations
    const locations = ref([]);
    const isExtractingLocations = ref(false);
    let map = null;
    let markers = [];
    let routeLine = null;

    // Check-in
    const checkIns = ref(loadCheckIns());
    const checkInToast = ref('');
    const showAchievements = ref(false);

    const exampleIdeas = [
      '我想带5岁的孩子去三亚玩5天',
      '和朋友去云南大理丽江，7天自由行',
      '一个人去日本东京大阪，预算8000元',
      '带父母去厦门养生度假一周',
      '情侣蜜月旅行，想去海岛',
      '国庆长假全家自驾去西北大环线',
    ];

    // Configure marked
    marked.setOptions({ breaks: true, gfm: true });

    const renderedPlan = computed(() => {
      if (!planMarkdown.value) return '';
      try { return marked.parse(planMarkdown.value); }
      catch { return planMarkdown.value; }
    });

    // ===== Check-in Functions =====
    function loadCheckIns() {
      try {
        return JSON.parse(localStorage.getItem('travelCheckIns') || '{}');
      } catch { return {}; }
    }

    function saveCheckIns() {
      localStorage.setItem('travelCheckIns', JSON.stringify(checkIns.value));
    }

    function isCheckedIn(name) {
      return !!checkIns.value[name];
    }

    function toggleCheckIn(loc) {
      if (isCheckedIn(loc.name)) {
        delete checkIns.value[loc.name];
        checkIns.value = { ...checkIns.value };
      } else {
        checkIns.value = {
          ...checkIns.value,
          [loc.name]: {
            time: new Date().toISOString(),
            lat: loc.lat,
            lng: loc.lng,
            type: loc.type,
            icon: loc.icon,
            description: loc.description,
          }
        };
        checkInToast.value = `恭喜打卡「${loc.name}」！`;
        setTimeout(() => { checkInToast.value = ''; }, 2500);
      }
      saveCheckIns();
      updateMapMarkers();
    }

    function getCheckInTime(name) {
      const ci = checkIns.value[name];
      if (!ci) return '';
      const d = new Date(ci.time);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    const checkedInCount = computed(() => {
      const locationNames = new Set(locations.value.map(l => l.name));
      return Object.keys(checkIns.value).filter(n => locationNames.has(n)).length;
    });

    const allCheckedInCount = computed(() => Object.keys(checkIns.value).length);

    const checkedInList = computed(() => {
      return locations.value.filter(l => isCheckedIn(l.name));
    });

    const checkedInCities = computed(() =>
      Object.entries(checkIns.value).filter(([, v]) => v.type === 'city').map(([k]) => k)
    );
    const checkedInScenics = computed(() =>
      Object.entries(checkIns.value).filter(([, v]) => v.type === 'scenic').map(([k]) => k)
    );
    const checkedInFoods = computed(() =>
      Object.entries(checkIns.value).filter(([, v]) => v.type === 'food').map(([k]) => k)
    );

    const progressPercent = computed(() => {
      if (locations.value.length === 0) return 0;
      return Math.round((checkedInCount.value / locations.value.length) * 100);
    });

    const progressColor = computed(() => {
      const p = progressPercent.value;
      if (p >= 100) return 'text-green-600';
      if (p >= 50) return 'text-blue-600';
      return 'text-gray-600';
    });

    const progressBarColor = computed(() => {
      const p = progressPercent.value;
      if (p >= 100) return 'bg-gradient-to-r from-green-400 to-emerald-500';
      if (p >= 50) return 'bg-gradient-to-r from-blue-400 to-blue-500';
      return 'bg-gradient-to-r from-gray-300 to-blue-400';
    });

    // ===== Achievement Badges =====
    const achievementBadges = computed(() => {
      const count = checkedInCount.value;
      const total = locations.value.length;
      return [
        { id: 'first', icon: '🎯', name: '初次打卡', desc: '打卡第1个地点', unlocked: count >= 1 },
        { id: 'half', icon: '⭐', name: '半程达人', desc: `打卡${Math.ceil(total / 2)}个地点`, unlocked: count >= Math.ceil(total / 2) && total > 0 },
        { id: 'all', icon: '👑', name: '全程王者', desc: '打卡全部地点', unlocked: count >= total && total > 0 },
        { id: 'foodie', icon: '🍜', name: '美食猎人', desc: '打卡3个美食地点', unlocked: locations.value.filter(l => l.type === 'food' && isCheckedIn(l.name)).length >= 3 },
      ];
    });

    const allAchievementBadges = computed(() => {
      const totalAll = allCheckedInCount.value;
      return [
        { id: 'first', icon: '🎯', name: '初次打卡', desc: '打卡第1个地点', unlocked: totalAll >= 1 },
        { id: 'explorer5', icon: '🧭', name: '小小探险家', desc: '累计打卡5个地点', unlocked: totalAll >= 5 },
        { id: 'explorer10', icon: '🌟', name: '旅行达人', desc: '累计打卡10个地点', unlocked: totalAll >= 10 },
        { id: 'explorer20', icon: '🏅', name: '行者无疆', desc: '累计打卡20个地点', unlocked: totalAll >= 20 },
        { id: 'city3', icon: '🏙️', name: '城市漫步', desc: '打卡3个城市', unlocked: checkedInCities.value.length >= 3 },
        { id: 'scenic5', icon: '🏞️', name: '风景收藏家', desc: '打卡5个景点', unlocked: checkedInScenics.value.length >= 5 },
        { id: 'foodie3', icon: '🍜', name: '美食猎人', desc: '打卡3个美食地点', unlocked: checkedInFoods.value.length >= 3 },
        { id: 'explorer50', icon: '👑', name: '旅行大师', desc: '累计打卡50个地点', unlocked: totalAll >= 50 },
      ];
    });

    // ===== Map Functions =====
    function getTypeIcon(type) {
      const icons = { city: '🏙️', scenic: '🏞️', food: '🍜', hotel: '🏨', transport: '🚉' };
      return icons[type] || '📍';
    }

    function getTypeLabel(type) {
      const labels = { city: '城市', scenic: '景点', food: '美食', hotel: '住宿', transport: '交通' };
      return labels[type] || '地点';
    }

    function createCustomIcon(loc) {
      const checked = isCheckedIn(loc.name);
      const size = loc.type === 'city' ? 36 : 28;
      return L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-icon ${checked ? 'checked' : ''} type-${loc.type}" style="font-size:${size}px">
          ${loc.icon || getTypeIcon(loc.type)}
          ${checked ? '<span class="marker-check">✓</span>' : ''}
        </div>`,
        iconSize: [size + 8, size + 8],
        iconAnchor: [(size + 8) / 2, (size + 8) / 2],
      });
    }

    async function initMap() {
      await nextTick();

      if (!map) {
        const mapEl = document.getElementById('travel-map');
        if (!mapEl) return;

        map = L.map('travel-map', {
          center: [35.86, 104.19],
          zoom: 5,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(map);
      }

      setTimeout(() => { map.invalidateSize(); }, 100);

      if (locations.value.length > 0) {
        updateMapMarkers();
      } else if (!isExtractingLocations.value && planMarkdown.value) {
        extractLocations();
      }
    }

    function updateMapMarkers() {
      if (!map) return;

      // Clear existing
      markers.forEach(m => map.removeLayer(m));
      markers = [];
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }

      if (locations.value.length === 0) return;

      const bounds = [];
      const routePoints = [];

      locations.value.forEach((loc, idx) => {
        const latlng = [loc.lat, loc.lng];
        bounds.push(latlng);

        if (loc.type === 'city' || loc.type === 'scenic') {
          routePoints.push(latlng);
        }

        const marker = L.marker(latlng, { icon: createCustomIcon(loc) }).addTo(map);

        const checked = isCheckedIn(loc.name);
        marker.bindPopup(`
          <div class="map-popup">
            <div class="popup-header">
              <span class="popup-icon">${loc.icon || getTypeIcon(loc.type)}</span>
              <strong>${loc.name}</strong>
              ${checked ? '<span class="popup-checked">已打卡 ✅</span>' : ''}
            </div>
            <p class="popup-desc">${loc.description || ''}</p>
            ${loc.day > 0 ? `<p class="popup-day">📅 第 ${loc.day} 天</p>` : ''}
            <p class="popup-type">${getTypeLabel(loc.type)}</p>
          </div>
        `);

        markers.push(marker);
      });

      // Draw route line through cities/scenics
      if (routePoints.length >= 2) {
        routeLine = L.polyline(routePoints, {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.6,
          dashArray: '10, 8',
        }).addTo(map);
      }

      // Fit bounds
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    }

    function flyToLocation(loc) {
      if (planTab.value !== 'map') {
        planTab.value = 'map';
        nextTick(() => {
          initMap();
          setTimeout(() => {
            if (map) map.flyTo([loc.lat, loc.lng], 14, { duration: 1 });
          }, 300);
        });
      } else if (map) {
        map.flyTo([loc.lat, loc.lng], 14, { duration: 1 });
      }
    }

    async function extractLocations() {
      if (isExtractingLocations.value || !planMarkdown.value) return;

      isExtractingLocations.value = true;
      try {
        const res = await fetch('/api/extract-locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planMarkdown: planMarkdown.value }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '提取失败');
        }

        const data = await res.json();
        locations.value = data.locations || [];
        updateMapMarkers();
      } catch (e) {
        showError(e.message || '地点提取失败');
      } finally {
        isExtractingLocations.value = false;
      }
    }

    // ===== Core Functions =====
    function showError(msg) {
      errorMsg.value = msg;
      setTimeout(() => { errorMsg.value = ''; }, 4000);
    }

    function formatNumber(num) {
      if (num === undefined || num === null) return '';
      return num.toLocaleString('zh-CN');
    }

    function resetAll() {
      step.value = 'input';
      planTab.value = 'plan';
      userInput.value = '';
      questions.value = [];
      answers.value = {};
      planMarkdown.value = '';
      isLoading.value = false;
      locations.value = [];
      isExtractingLocations.value = false;
      if (map) { map.remove(); map = null; }
      markers = [];
      routeLine = null;
    }

    async function submitIdea() {
      if (!userInput.value.trim() || isLoading.value) return;

      isLoading.value = true;
      try {
        const res = await fetch('/api/questionnaire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userInput: userInput.value.trim() }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '请求失败');
        }

        const data = await res.json();
        questions.value = data.questions;

        answers.value = {};
        data.questions.forEach((q) => {
          if (q.type === 'checkbox') {
            answers.value[q.id] = [];
          } else if (q.type === 'slider') {
            answers.value[q.id] = Math.round((q.min + q.max) / 2);
          } else if (q.type === 'daterange') {
            answers.value[q.id + '_start'] = '';
            answers.value[q.id + '_end'] = '';
          } else {
            answers.value[q.id] = '';
          }
        });

        step.value = 'questionnaire';
      } catch (e) {
        showError(e.message || '问卷生成失败，请重试');
      } finally {
        isLoading.value = false;
      }
    }

    async function generatePlan() {
      if (isLoading.value) return;

      isLoading.value = true;
      planMarkdown.value = '';
      planTab.value = 'plan';
      locations.value = [];
      step.value = 'plan';

      const formattedAnswers = {};
      questions.value.forEach((q) => {
        if (q.type === 'daterange') {
          const start = answers.value[q.id + '_start'];
          const end = answers.value[q.id + '_end'];
          if (start || end) {
            formattedAnswers[q.label] = `${start || '未定'} 至 ${end || '未定'}`;
          }
        } else if (q.type === 'checkbox') {
          const val = answers.value[q.id];
          if (val && val.length > 0) {
            formattedAnswers[q.label] = val;
          }
        } else if (q.type === 'slider') {
          formattedAnswers[q.label] = `${answers.value[q.id]}`;
        } else {
          const val = answers.value[q.id];
          if (val) {
            formattedAnswers[q.label] = val;
          }
        }
      });

      try {
        const res = await fetch('/api/travel-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userInput: userInput.value.trim(),
            answers: formattedAnswers,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '请求失败');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                planMarkdown.value += data.content;
              } else if (data.type === 'error') {
                showError(data.content);
              } else if (data.type === 'done') {
                // Stream finished - extract locations
                extractLocations();
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          showError(e.message || '旅行计划生成失败，请重试');
        }
      } finally {
        isLoading.value = false;
      }
    }

    function printPlan() {
      window.print();
    }

    return {
      step,
      planTab,
      userInput,
      isLoading,
      errorMsg,
      questions,
      answers,
      planMarkdown,
      renderedPlan,
      exampleIdeas,
      locations,
      isExtractingLocations,
      checkIns,
      checkInToast,
      showAchievements,
      checkedInCount,
      allCheckedInCount,
      checkedInList,
      checkedInCities,
      checkedInScenics,
      checkedInFoods,
      progressPercent,
      progressColor,
      progressBarColor,
      achievementBadges,
      allAchievementBadges,
      submitIdea,
      generatePlan,
      resetAll,
      showError,
      formatNumber,
      printPlan,
      initMap,
      flyToLocation,
      isCheckedIn,
      toggleCheckIn,
      getCheckInTime,
      getTypeIcon,
      getTypeLabel,
    };
  },
}).mount('#app');
