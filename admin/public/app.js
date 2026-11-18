// ========================================================
// TU TIÊN VẤN ĐẠO - ADMIN PANEL CLIENT CONTROLLER
// ========================================================

const state = {
  currentTab: 'tab-dashboard',
  players: [],
  sects: [],
  itemPresets: [],
  petPresets: [],
  weaponPresets: [],
  helperPresets: [],
  skillPresets: [],
  bossPresets: [],
  petSettings: null,
  constants: null,
  realmsChart: null
};

let currentTabRefreshInProgress = false;
let statsRequestVersion = 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function safeImageUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function updateBannerImagePreview() {
  const preview = document.getElementById('pf-banner-preview');
  if (!preview) return;
  const imageUrl = safeImageUrl(document.getElementById('pf-banner-image').value.trim());
  preview.src = imageUrl;
  preview.classList.toggle('hidden', !imageUrl);
}

// ==========================================
// 1. INITIALIZATION & ROUTING
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupEventListeners();

  await loadConstantsAndPresets();
  await refreshAllData();

  // Keep the open admin tab synchronized with changes made by the game.
  setInterval(() => {
    if (document.visibilityState === 'visible' && !currentTabRefreshInProgress) {
      currentTabRefreshInProgress = true;
      loadTabData(state.currentTab).finally(() => {
        currentTabRefreshInProgress = false;
      });
    }
  }, 30000);
});

function setupNavigation() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);

      // Close mobile sidebar if open
      const sidebar = document.getElementById('sidebar');
      if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
        sidebar.classList.add('-translate-x-full');
      }
    });
  });

  const mobileToggle = document.getElementById('mobile-menu-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('-translate-x-full');
    });
  }

  const refreshBtn = document.getElementById('btn-quick-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.querySelector('i').classList.add('fa-spin');
      refreshAllData().finally(() => {
        setTimeout(() => refreshBtn.querySelector('i').classList.remove('fa-spin'), 600);
      });
    });
  }

  const airdropBtn = document.getElementById('btn-open-airdrop');
  if (airdropBtn) {
    airdropBtn.addEventListener('click', () => openModal('modal-airdrop'));
  }
}

function switchTab(tabId) {
  state.currentTab = tabId;

  // Toggle active class on nav buttons
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle views
  document.querySelectorAll('.tab-view').forEach(view => {
    if (view.id === tabId) {
      view.classList.remove('hidden');
    } else {
      view.classList.add('hidden');
    }
  });

  loadTabData(tabId);
}

async function loadTabData(tabId) {
  switch (tabId) {
    case 'tab-dashboard':
      return loadStats();
    case 'tab-players':
      return loadPlayers();
    case 'tab-inventory':
      return loadInventory();
    case 'tab-gift-codes':
      return loadGiftCodes();
    case 'tab-pets':
      return loadPets();
    case 'tab-weapons':
      return loadWeapons();
    case 'tab-helpers':
      return loadHelpers();
    case 'tab-skills':
      return loadSkills();
    case 'tab-dongphu':
      return loadDongPhu();
    case 'tab-sects':
      return Promise.all([loadSects(), loadMines()]);
    case 'tab-boss':
      return loadBoss();
    case 'tab-market':
      return loadMarket();
    case 'tab-tools':
      return loadSystemInfo();
    case 'tab-gacha':
      return Promise.all([loadGachaStats(), loadGachaItems()]);
  }
}

function setupEventListeners() {
  // Search inputs with debounce
  const debounce = (func, delay = 300) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func(...args), delay);
    };
  };

  document.getElementById('player-search')?.addEventListener('input', debounce(loadPlayers));
  document.getElementById('player-filter-race')?.addEventListener('change', loadPlayers);
  document.getElementById('player-filter-realm')?.addEventListener('change', loadPlayers);

  document.getElementById('inv-search')?.addEventListener('input', debounce(loadInventory));
  document.getElementById('inv-filter-type')?.addEventListener('change', loadInventory);
  document.getElementById('inv-filter-user')?.addEventListener('change', loadInventory);

  document.getElementById('pet-search')?.addEventListener('input', debounce(loadPets));
  document.getElementById('pet-filter-element')?.addEventListener('change', loadPets);
  document.getElementById('pet-filter-mythic')?.addEventListener('change', loadPets);
  document.getElementById('pet-filter-user')?.addEventListener('change', loadPets);
  document.getElementById('form-pet-element')?.addEventListener('submit', handlePetElementSubmit);
  document.getElementById('form-pet-resonance')?.addEventListener('submit', handlePetResonanceSubmit);

  document.getElementById('weapon-search')?.addEventListener('input', debounce(loadWeapons));
  document.getElementById('weapon-filter-tier')?.addEventListener('change', loadWeapons);
  document.getElementById('weapon-filter-user')?.addEventListener('change', loadWeapons);

  document.getElementById('helper-filter-type')?.addEventListener('change', loadHelpers);
  document.getElementById('helper-filter-user')?.addEventListener('change', loadHelpers);

  document.getElementById('skill-filter-user')?.addEventListener('change', loadSkills);
  document.getElementById('market-filter-status')?.addEventListener('change', loadMarket);

  document.getElementById('gacha-search')?.addEventListener('input', debounce(loadGachaItems));
  document.getElementById('gacha-filter-type')?.addEventListener('change', loadGachaItems);
  document.getElementById('gacha-filter-rarity')?.addEventListener('change', loadGachaItems);
  document.getElementById('gacha-filter-banner')?.addEventListener('change', loadGachaItems);
  document.getElementById('gacha-filter-active')?.addEventListener('change', loadGachaItems);
  document.getElementById('item-image-url')?.addEventListener('input', updateItemImagePreview);
  document.getElementById('pf-banner-image')?.addEventListener('input', updateBannerImagePreview);
}

async function refreshAllData() {
  await Promise.all([
    loadStats(),
    loadPlayers(),
    loadSects()
  ]);
  showToast('Đã làm mới dữ liệu hệ thống!', 'info');
}

// ==========================================
// 2. CONSTANTS & PRESETS LOADER
// ==========================================
async function loadConstantsAndPresets() {
  try {
    const [constRes, invPresetRes, petPresetRes, weapPresetRes, helpPresetRes, skillPresetRes, bossPresetRes, petSettingsRes] = await Promise.all([
      fetch('/api/constants').then(r => r.json()),
      fetch('/api/inventory/presets').then(r => r.json()),
      fetch('/api/pets/presets').then(r => r.json()),
      fetch('/api/weapons/presets').then(r => r.json()),
      fetch('/api/helpers/presets').then(r => r.json()),
      fetch('/api/skills/presets').then(r => r.json()),
      fetch('/api/boss/presets').then(r => r.json()).catch(() => ({ success: true, data: [] })),
      fetch('/api/pet-config').then(r => r.json())
    ]);

    if (constRes.success) state.constants = constRes.data;
    if (invPresetRes.success) state.itemPresets = invPresetRes.data;
    if (petPresetRes.success) state.petPresets = petPresetRes.data;
    if (weapPresetRes.success) state.weaponPresets = weapPresetRes.data;
    if (helpPresetRes.success) state.helperPresets = helpPresetRes.data;
    if (skillPresetRes.success) state.skillPresets = skillPresetRes.data;
    if (bossPresetRes.success) state.bossPresets = bossPresetRes.data;
    if (petSettingsRes.success) {
      state.petSettings = petSettingsRes.data;
      renderPetSettings();
    }

    populatePresetDropdowns();
  } catch (err) {
    console.error('Lỗi nạp presets:', err);
  }
}

function populatePresetDropdowns() {
  // 1. Item Presets
  const itemSelect = document.getElementById('give-item-preset');
  const airdropSelect = document.getElementById('airdrop-preset-select');
  const giftCodeSelect = document.getElementById('gift-code-preset');
  if (giftCodeSelect) {
    giftCodeSelect.innerHTML = '<option value="">-- Chọn mẫu hoặc tự điền bên dưới --</option>' +
      state.itemPresets.map((p, idx) =>
        `<option value="${idx}">[${escapeHtml(p.category)}] ${escapeHtml(p.item_name)}</option>`
      ).join('');
  }
  if (itemSelect) {
    itemSelect.innerHTML = '<option value="">-- Tự điền thông số hoặc chọn mẫu --</option>' +
      state.itemPresets.map((p, idx) => `<option value="${idx}">[${p.category}] ${p.item_name} (${p.desc})</option>`).join('');
  }
  if (airdropSelect) {
    airdropSelect.innerHTML = '<option value="">-- Chọn vật phẩm airdrop --</option>' +
      state.itemPresets.map((p, idx) => `<option value="${idx}">[${p.category}] ${p.item_name}</option>`).join('');
  }

  // 2. Pet Presets
  const petSelect = document.getElementById('pet-preset-select');
  if (petSelect) {
    petSelect.innerHTML = '<option value="">-- Chọn Thần Thú mẫu hoặc tự điền --</option>' +
      state.petPresets.map((p, idx) => `<option value="${idx}">[${p.element}] ${p.name} (${p.star}⭐)</option>`).join('');
  }

  // 3. Weapon Presets
  const weapSelect = document.getElementById('weapon-preset-select');
  if (weapSelect) {
    weapSelect.innerHTML = '<option value="">-- Chọn Thần Khí mẫu hoặc tự điền --</option>' +
      state.weaponPresets.map((w, idx) => `<option value="${idx}">[Bậc ${w.tier}] ${w.name} (+${w.atk} Công)</option>`).join('');
  }

  // 4. Helper Presets
  const helpSelect = document.getElementById('helper-preset-select');
  if (helpSelect) {
    helpSelect.innerHTML = '<option value="">-- Chọn Trợ Thủ mẫu hoặc tự điền --</option>' +
      state.helperPresets.map((h, idx) => `<option value="${idx}">[${h.type === 'combat' ? 'Chiến Đấu' : 'Sinh Hoạt'}] ${h.name} (Tier ${h.tier})</option>`).join('');
  }

  // 5. Skill Presets
  const skillSelect = document.getElementById('skill-preset-select');
  if (skillSelect) {
    skillSelect.innerHTML = '<option value="">-- Chọn Công Pháp mẫu hoặc tự điền --</option>' +
      state.skillPresets.map((s, idx) => `<option value="${idx}">[${s.element}] ${s.name} (x${s.damage_mult} ST)</option>`).join('');
  }

  // 6. Boss Presets
  const bossSelect = document.getElementById('boss-preset-select');
  if (bossSelect) {
    bossSelect.innerHTML = '<option value="">-- Chọn Hung Thú mẫu --</option>' +
      state.bossPresets.map((b, idx) => `<option value="${idx}">${b.name} (${Number(b.baseHp).toLocaleString()} HP)</option>`).join('');
  }
}

function renderPetSettings() {
  if (!state.petSettings) return;
  const { elements, resonance } = state.petSettings;
  const elementOptions = elements.map(element =>
    `<option value="${escapeHtml(element.name)}">${escapeHtml(element.icon)} ${escapeHtml(element.name)}</option>`
  ).join('');

  const petElement = document.getElementById('pet-element');
  const petFilter = document.getElementById('pet-filter-element');
  const gachaElement = document.getElementById('gacha-element');
  const selectedPetElement = petElement?.value;
  const selectedFilterElement = petFilter?.value;
  const selectedGachaElement = gachaElement?.value;
  if (petElement) petElement.innerHTML = elementOptions;
  if (petFilter) petFilter.innerHTML = '<option value="">Tất Cả Hệ</option>' + elementOptions;
  if (gachaElement) gachaElement.innerHTML = elementOptions;
  if (selectedPetElement && elements.some(element => element.name === selectedPetElement)) {
    petElement.value = selectedPetElement;
  }
  if (selectedFilterElement && elements.some(element => element.name === selectedFilterElement)) {
    petFilter.value = selectedFilterElement;
  }
  if (selectedGachaElement && elements.some(element => element.name === selectedGachaElement)) {
    gachaElement.value = selectedGachaElement;
  }
  if (!selectedPetElement && elements.some(element => element.name === 'Hỏa')) {
    petElement.value = 'Hỏa';
  }
  if (!selectedGachaElement && elements.some(element => element.name === 'Hỏa')) {
    gachaElement.value = 'Hỏa';
  }

  const list = document.getElementById('pet-elements-list');
  if (list) {
    list.innerHTML = elements.map(element => `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-700">
        <span>${escapeHtml(element.icon)} ${escapeHtml(element.name)}</span>
        <button type="button" onclick="handleDeletePetElement('${encodeURIComponent(element.name)}')" title="Xóa hệ" class="text-red-400 hover:text-red-300">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </span>
    `).join('');
  }

  const resonanceFields = {
    'pet-resonance-name': resonance.name,
    'pet-resonance-description': resonance.desc,
    'pet-resonance-atk': resonance.atk_bonus,
    'pet-resonance-hp': resonance.hp_bonus,
    'pet-resonance-def': resonance.def_bonus,
    'pet-resonance-speed': resonance.speed_bonus,
    'pet-resonance-crit': resonance.crit_bonus,
    'pet-resonance-resist': resonance.phys_resist_bonus,
    'pet-resonance-regen': resonance.hp_regen_turn
  };
  for (const [id, value] of Object.entries(resonanceFields)) {
    const input = document.getElementById(id);
    if (input) input.value = value;
  }
}

async function reloadPetSettings() {
  const response = await fetch('/api/pet-config').then(r => r.json());
  if (!response.success) throw new Error(response.error || 'Không thể tải cấu hình linh thú.');
  state.petSettings = response.data;
  renderPetSettings();
}

async function handlePetElementSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('pet-element-name-new').value.trim();
  const icon = document.getElementById('pet-element-icon-new').value.trim();
  try {
    const response = await fetch('/api/pet-elements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon })
    }).then(r => r.json());
    if (!response.success) {
      showToast(response.error, 'error');
      return;
    }
    document.getElementById('form-pet-element').reset();
    await reloadPetSettings();
    showToast(response.message, 'success');
  } catch (error) {
    showToast('Lỗi thêm hệ linh thú: ' + error.message, 'error');
  }
}

async function handleDeletePetElement(encodedName) {
  const name = decodeURIComponent(encodedName);
  if (!confirm(`Xóa hệ ${name}? Hệ đang được sử dụng sẽ không thể xóa.`)) return;
  try {
    const response = await fetch(`/api/pet-elements/${encodeURIComponent(name)}`, { method: 'DELETE' }).then(r => r.json());
    if (!response.success) {
      showToast(response.error, 'error');
      return;
    }
    await reloadPetSettings();
    showToast(response.message, 'success');
  } catch (error) {
    showToast('Lỗi xóa hệ linh thú: ' + error.message, 'error');
  }
}

async function handlePetResonanceSubmit(event) {
  event.preventDefault();
  const data = {
    name: document.getElementById('pet-resonance-name').value.trim(),
    description: document.getElementById('pet-resonance-description').value.trim(),
    atk_bonus: Number(document.getElementById('pet-resonance-atk').value),
    hp_bonus: Number(document.getElementById('pet-resonance-hp').value),
    def_bonus: Number(document.getElementById('pet-resonance-def').value),
    speed_bonus: Number(document.getElementById('pet-resonance-speed').value),
    crit_bonus: Number(document.getElementById('pet-resonance-crit').value),
    phys_resist_bonus: Number(document.getElementById('pet-resonance-resist').value),
    hp_regen_turn: Number(document.getElementById('pet-resonance-regen').value)
  };
  try {
    const response = await fetch('/api/pet-resonance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
    if (!response.success) {
      showToast(response.error, 'error');
      return;
    }
    await reloadPetSettings();
    showToast(response.message, 'success');
  } catch (error) {
    showToast('Lỗi cập nhật cộng hưởng: ' + error.message, 'error');
  }
}

function populateUserSelects() {
  const userSelects = [
    'give-item-user', 'pet-user-id', 'weapon-user-id', 'helper-user-id',
    'skill-user-id', 'sect-leader-id', 'inv-filter-user', 'pet-filter-user',
    'weapon-filter-user', 'helper-filter-user', 'skill-filter-user'
  ];

  userSelects.forEach(selId => {
    const el = document.getElementById(selId);
    if (!el) return;

    const isFilter = selId.includes('filter');
    const isGiveItem = selId === 'give-item-user';

    let html = '';
    if (isGiveItem) {
      html += '<option value="all">🌟 TẤT CẢ NGƯỜI CHƠI TRÊN SERVER (Airdrop Toàn Bộ)</option>';
    } else if (isFilter) {
      html += '<option value="">Tất Cả Người Chơi</option>';
    }

    state.players.forEach(p => {
      const realmName = state.constants?.realms[p.realm_id]?.name || `Cảnh giới ${p.realm_id}`;
      html += `<option value="${p.user_id}">${p.dao_hieu || p.username} (${realmName} - ${p.user_id})</option>`;
    });

    el.innerHTML = html;
  });
}

// Preset application handlers
function applyItemPreset(index) {
  if (index === '') return;
  const p = state.itemPresets[Number(index)];
  if (!p) return;
  document.getElementById('give-item-type').value = p.item_type;
  document.getElementById('give-item-key').value = p.item_key;
  document.getElementById('give-item-name').value = p.item_name;
  document.getElementById('give-item-amount').value = p.defaultAmount || 10;
}

function applyAirdropPreset(index) {
  if (index === '') return;
  const p = state.itemPresets[Number(index)];
  if (!p) return;
  document.getElementById('airdrop-item-amount').value = p.defaultAmount || 10;
}

function applyPetPreset(index) {
  if (index === '') return;
  const p = state.petPresets[Number(index)];
  if (!p) return;
  document.getElementById('pet-name').value = p.name;
  document.getElementById('pet-element').value = p.element;
  document.getElementById('pet-star').value = p.star;
  document.getElementById('pet-is-mythic').value = p.is_mythic;
  document.getElementById('pet-hp').value = p.hp;
  document.getElementById('pet-atk').value = p.atk;
  document.getElementById('pet-def').value = p.def;
  document.getElementById('pet-speed').value = p.speed;
  document.getElementById('pet-effect').value = p.effect_desc;
  document.getElementById('pet-image-url').value = p.image_url || '';
}

function applyWeaponPreset(index) {
  if (index === '') return;
  const w = state.weaponPresets[Number(index)];
  if (!w) return;
  document.getElementById('weapon-name').value = w.name;
  document.getElementById('weapon-tier').value = w.tier;
  document.getElementById('weapon-atk').value = w.atk;
  document.getElementById('weapon-def').value = w.def;
  document.getElementById('weapon-effect-name').value = w.effect_name;
  document.getElementById('weapon-effect-desc').value = w.effect_desc;
  document.getElementById('weapon-image-url').value = w.image_url || '';
  document.getElementById('weapon-is-natal').checked = Number(w.is_natal) === 1;
}

function applyHelperPreset(index) {
  if (index === '') return;
  const h = state.helperPresets[Number(index)];
  if (!h) return;
  document.getElementById('helper-name').value = h.name;
  document.getElementById('helper-type').value = h.type;
  document.getElementById('helper-tier').value = h.tier;
  document.getElementById('helper-effect-desc').value = h.effect_desc;
  document.getElementById('helper-image-url').value = h.image_url || '';
}

function applySkillPreset(index) {
  if (index === '') return;
  const s = state.skillPresets[Number(index)];
  if (!s) return;
  document.getElementById('skill-name').value = s.name;
  document.getElementById('skill-element').value = s.element;
  document.getElementById('skill-type').value = s.type;
  document.getElementById('skill-dmg-mult').value = s.damage_mult;
  document.getElementById('skill-desc').value = s.desc;
}

function applyBossPreset(index) {
  if (index === '') return;
  const b = state.bossPresets[Number(index)];
  if (!b) return;
  document.getElementById('boss-spawn-name').value = b.name;
  document.getElementById('boss-spawn-hp').value = b.baseHp;
}

// ==========================================
// 3. DASHBOARD & CHARTS
// ==========================================
async function loadStats() {
  const requestVersion = ++statsRequestVersion;
  try {
    const res = await fetch('/api/stats', { cache: 'no-store' }).then(r => r.json());
    if (requestVersion !== statsRequestVersion) return;
    if (!res.success) return;

    const d = res.data;
    document.getElementById('metric-players').textContent = d.totalPlayers.toLocaleString();
    document.getElementById('metric-silver').textContent = d.totalSilver.toLocaleString();
    document.getElementById('metric-sects').textContent = d.totalSects;
    document.getElementById('metric-mines').textContent = `${d.mines.occupied}/${d.mines.total}`;
    document.getElementById('metric-market').textContent = d.totalMarketActive;

    if (d.activeBoss) {
      document.getElementById('metric-boss').textContent = d.activeBoss.name;
      const curr = BigInt(d.activeBoss.current_hp || '0');
      const max = BigInt(d.activeBoss.max_hp || '1');
      const pct = max > 0n ? Number((curr * 100n) / max) : 0;
      document.getElementById('metric-boss-sub').textContent = `${pct}% Khí Huyết`;
    } else {
      document.getElementById('metric-boss').textContent = 'Chưa có Boss';
      document.getElementById('metric-boss-sub').textContent = 'Có thể triệu hồi';
    }

    renderRealmsChart(d.realmDistribution);
    renderLeaderboards(d.leaderboards);
  } catch (err) {
    console.error('Lỗi nạp stats:', err);
  }
}

function renderRealmsChart(distribution) {
  const ctx = document.getElementById('realmsChart')?.getContext('2d');
  if (!ctx) return;

  const labels = distribution.map(r => r.name);
  const data = distribution.map(r => r.count);
  const colors = distribution.map(r => r.color);

  if (state.realmsChart) {
    state.realmsChart.data.labels = labels;
    state.realmsChart.data.datasets[0].data = data;
    state.realmsChart.data.datasets[0].backgroundColor = colors;
    state.realmsChart.update();
    return;
  }

  state.realmsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Số lượng tu tiên giả',
        data,
        backgroundColor: colors,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8', stepSize: 1 },
          grid: { color: 'rgba(51, 65, 85, 0.3)' }
        },
        x: {
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderLeaderboards(lb) {
  const renderItem = (p, valueText, idx) => `
    <div class="flex items-center justify-between p-2 rounded bg-slate-800/40 hover:bg-slate-700/40 transition">
      <div class="flex items-center gap-2 truncate">
        <span class="w-5 text-center font-bold ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'}">#${idx + 1}</span>
        <span class="text-white font-medium truncate">${p.username}</span>
      </div>
      <span class="text-xs font-semibold text-sky-400 shrink-0">${valueText}</span>
    </div>
  `;

  const topRealmEl = document.getElementById('top-realm-list');
  if (topRealmEl) {
    topRealmEl.innerHTML = lb.topRealm.length ? lb.topRealm.map((p, i) => {
      const rName = state.constants?.realms[p.realm_id]?.name || 'Linh Sĩ';
      return renderItem(p, `${rName} [Cấp ${p.level}]`, i);
    }).join('') : '<p class="text-slate-500 italic">Chưa có dữ liệu</p>';
  }

  const topSilverEl = document.getElementById('top-silver-list');
  if (topSilverEl) {
    topSilverEl.innerHTML = lb.topSilver.length ? lb.topSilver.map((p, i) => {
      return renderItem(p, `${Number(p.silver).toLocaleString()} 💰`, i);
    }).join('') : '<p class="text-slate-500 italic">Chưa có dữ liệu</p>';
  }

  const topPvpEl = document.getElementById('top-pvp-list');
  if (topPvpEl) {
    topPvpEl.innerHTML = lb.topPvp.length ? lb.topPvp.map((p, i) => {
      return renderItem(p, `${p.pvp_points} Điểm`, i);
    }).join('') : '<p class="text-slate-500 italic">Chưa có dữ liệu</p>';
  }
}

// ==========================================
// 4. PLAYERS CONTROLLER
// ==========================================
async function loadPlayers() {
  try {
    const search = document.getElementById('player-search')?.value || '';
    const race = document.getElementById('player-filter-race')?.value || '';
    const realm_id = document.getElementById('player-filter-realm')?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (race) params.append('race', race);
    if (realm_id !== '') params.append('realm_id', realm_id);

    const res = await fetch(`/api/players?${params.toString()}`).then(r => r.json());
    if (!res.success) return;

    state.players = res.data;
    populateUserSelects();

    const tbody = document.getElementById('players-table-body');
    if (!tbody) return;

    if (!state.players.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500">Không tìm thấy người chơi nào.</td></tr>';
      return;
    }

    tbody.innerHTML = state.players.map(p => {
      const realm = state.constants?.realms[p.realm_id] || { name: 'Linh Sĩ', id: 0 };
      const raceInfo = state.constants?.races[p.race] || { name: p.race, icon: '🧘' };
      const rootInfo = state.constants?.spiritRoots[p.spirit_root] || { name: p.spirit_root, icon: '✨' };

      return `
        <tr>
          <td>
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shadow">
                ${raceInfo.icon}
              </div>
              <div>
                <div class="font-bold text-white hover:text-sky-400 cursor-pointer" onclick="openPlayerInspector('${p.user_id}')">${p.dao_hieu || p.username}</div>
                <div class="text-[11px] text-slate-500 font-mono">${p.user_id}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="text-xs font-medium text-slate-200">${raceInfo.icon} ${raceInfo.name}</div>
            <div class="text-[11px] text-slate-400">${rootInfo.icon} ${rootInfo.name}</div>
          </td>
          <td>
            <span class="px-2 py-0.5 rounded text-xs font-semibold realm-badge-${realm.id}">
              ${realm.name} [Cấp ${p.level}]
            </span>
            <div class="text-[10px] text-slate-400 mt-0.5">${BigInt(p.xp || '0').toLocaleString()} XP</div>
          </td>
          <td class="font-semibold text-amber-300">
            ${Number(p.silver).toLocaleString()}
          </td>
          <td>
            <div class="text-xs text-slate-200">Tháp: <span class="text-sky-400 font-bold">Tầng ${p.tower_floor}</span></div>
            <div class="text-[11px] text-slate-400">PvP: <span class="text-purple-400 font-medium">${p.pvp_points}</span></div>
          </td>
          <td>
            <span class="text-xs ${p.sect_name ? 'text-indigo-300' : 'text-slate-500 italic'}">
              ${p.sect_name ? `🏛️ ${p.sect_name}` : 'Tán Tu'}
            </span>
            ${p.sect_role ? `<div class="text-[10px] text-slate-400">Chức vị: ${p.sect_role}</div>` : ''}
          </td>
          <td class="text-right">
            <div class="flex items-center justify-end gap-1.5">
              <!-- Quick Action Level 10 -->
              <button onclick="handlePlayerQuickAction('${p.user_id}', 'level10')" title="Đạt Cấp 10 Tức Thì" class="p-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 rounded border border-slate-700">
                <i class="fa-solid fa-angles-up"></i>
              </button>
              <!-- Quick Action Breakthrough -->
              <button onclick="handlePlayerQuickAction('${p.user_id}', 'breakthrough')" title="Đột Phá Cảnh Giới (+1 Realm)" class="p-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-purple-400 rounded border border-slate-700">
                <i class="fa-solid fa-bolt"></i>
              </button>
              <!-- Quick Action +100k Silver -->
              <button onclick="handlePlayerQuickAction('${p.user_id}', 'add-silver', 100000)" title="Cộng +100,000 Ngân lượng" class="p-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded border border-slate-700">
                <i class="fa-solid fa-coins"></i>
              </button>
              <!-- Inspector -->
              <button onclick="openPlayerInspector('${p.user_id}')" title="Xem Toàn Bộ Hồ Sơ & Trang Bị" class="p-1.5 text-xs btn-cyan rounded">
                <i class="fa-solid fa-eye"></i>
              </button>
              <!-- Edit -->
              <button onclick="openEditPlayerModal('${p.user_id}')" title="Sửa Chỉ Số" class="p-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <!-- Delete -->
              <button onclick="handleDeletePlayer('${p.user_id}', '${p.dao_hieu || p.username}')" title="Xóa Nhân Vật" class="p-1.5 text-xs bg-red-950/60 hover:bg-red-800 text-red-300 rounded border border-red-800/40">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Lỗi nạp players:', err);
  }
}

function openCreatePlayerModal() {
  document.getElementById('player-modal-title').textContent = 'Thêm Tu Tiên Giả Mới';
  document.getElementById('player-form-mode').value = 'create';
  document.getElementById('pf-user-id').disabled = false;
  document.getElementById('form-player').reset();
  document.getElementById('pf-banner-image').value = '';
  updateBannerImagePreview();
  openModal('modal-player-form');
}

function openEditPlayerModal(userId) {
  const p = state.players.find(x => x.user_id === userId);
  if (!p) return;

  document.getElementById('player-modal-title').textContent = `Chỉnh Sửa Tu Tiên Giả: ${p.dao_hieu || p.username}`;
  document.getElementById('player-form-mode').value = 'edit';
  document.getElementById('pf-user-id').value = p.user_id;
  document.getElementById('pf-user-id').disabled = true;
  document.getElementById('pf-username').value = p.dao_hieu || p.username;
  document.getElementById('pf-banner-image').value = p.banner_image_url || '';
  updateBannerImagePreview();
  document.getElementById('pf-race').value = p.race;
  document.getElementById('pf-spirit-root').value = p.spirit_root;
  document.getElementById('pf-realm-id').value = p.realm_id;
  document.getElementById('pf-level').value = p.level;
  document.getElementById('pf-silver').value = p.silver;
  document.getElementById('pf-xp').value = p.xp;
  document.getElementById('pf-tower-floor').value = p.tower_floor;
  document.getElementById('pf-pvp').value = p.pvp_points;
  document.getElementById('pf-rule').value = p.rule_enlightenment || '';

  openModal('modal-player-form');
}

async function handlePlayerFormSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById('player-form-mode').value;
  const userId = document.getElementById('pf-user-id').value.trim();
  const dao_hieu = document.getElementById('pf-username').value.trim();
  const banner_image_url = document.getElementById('pf-banner-image').value.trim();
  const race = document.getElementById('pf-race').value;
  const spirit_root = document.getElementById('pf-spirit-root').value;
  const realm_id = Number(document.getElementById('pf-realm-id').value);
  const level = Number(document.getElementById('pf-level').value);
  const silver = Number(document.getElementById('pf-silver').value);
  const xp = document.getElementById('pf-xp').value.trim() || '0';
  const tower_floor = Number(document.getElementById('pf-tower-floor').value);
  const pvp_points = Number(document.getElementById('pf-pvp').value);
  const rule_enlightenment = document.getElementById('pf-rule').value.trim() || null;

  try {
    let res;
    if (mode === 'create') {
      res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, dao_hieu, banner_image_url, race, spirit_root, realm_id, level, silver })
      }).then(r => r.json());
    } else {
      res = await fetch(`/api/players/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dao_hieu, banner_image_url, race, spirit_root, realm_id, level, silver, xp, tower_floor, pvp_points, rule_enlightenment })
      }).then(r => r.json());
    }

    if (!res.success) {
      showToast(res.error || 'Thao tác thất bại!', 'error');
      return;
    }

    showToast(res.message || 'Thành công!', 'success');
    closeModal('modal-player-form');
    await loadPlayers();
    loadStats();
  } catch (err) {
    showToast('Lỗi máy chủ khi lưu người chơi: ' + err.message, 'error');
  }
}

async function handlePlayerQuickAction(userId, action, amount = null) {
  try {
    const res = await fetch(`/api/players/${userId}/quick-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, amount })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    await loadPlayers();
    loadStats();
  } catch (err) {
    showToast('Lỗi thực hiện tác vụ nhanh: ' + err.message, 'error');
  }
}

async function handleDeletePlayer(userId, username) {
  if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ dữ liệu nhân vật "${username}" (ID: ${userId})? Không thể hoàn tác!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/players/${userId}`, { method: 'DELETE' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    await loadPlayers();
    loadStats();
  } catch (err) {
    showToast('Lỗi khi xóa người chơi: ' + err.message, 'error');
  }
}

// Player Inspector Modal
async function openPlayerInspector(userId) {
  try {
    const res = await fetch(`/api/players/${userId}`).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    const { player, inventory, pets, weapons, helpers, skills, dongphu, sect } = res.data;
    const realm = state.constants?.realms[player.realm_id] || { name: 'Linh Sĩ' };
    const race = state.constants?.races[player.race] || { name: player.race, icon: '🧘' };
    const root = state.constants?.spiritRoots[player.spirit_root] || { name: player.spirit_root, icon: '✨' };

    document.getElementById('ins-username').textContent = `${player.dao_hieu || player.username} (${race.name})`;
    document.getElementById('ins-userid').textContent = `User ID: ${player.user_id} | Căn: ${root.name}`;

    // Stats bar
    const statsBar = document.getElementById('ins-stats-bar');
    statsBar.innerHTML = `
      <div class="p-2.5 rounded bg-slate-900 border border-slate-800">
        <div class="text-slate-400 text-[10px]">Cảnh Giới</div>
        <div class="font-bold text-amber-300">${realm.name} [Cấp ${player.level}]</div>
      </div>
      <div class="p-2.5 rounded bg-slate-900 border border-slate-800">
        <div class="text-slate-400 text-[10px]">Ngân Lượng</div>
        <div class="font-bold text-amber-400">${Number(player.silver).toLocaleString()} 💰</div>
      </div>
      <div class="p-2.5 rounded bg-slate-900 border border-slate-800">
        <div class="text-slate-400 text-[10px]">Thí Luyện Tháp</div>
        <div class="font-bold text-sky-400">Tầng ${player.tower_floor}</div>
      </div>
      <div class="p-2.5 rounded bg-slate-900 border border-slate-800">
        <div class="text-slate-400 text-[10px]">Điểm PvP</div>
        <div class="font-bold text-purple-400">${player.pvp_points}</div>
      </div>
    `;

    // Pets
    const petsList = document.getElementById('ins-pets-list');
    petsList.innerHTML = pets.length ? pets.map(p => `
      <div class="flex items-center justify-between p-1.5 rounded bg-slate-800/40">
        <span>${p.is_equipped ? '⭐ ' : ''}${p.name} [${p.element} - ${p.star}⭐]</span>
        <span class="text-emerald-400">${p.is_equipped ? `(Ô ${p.slot})` : '(Dự bị)'}</span>
      </div>
    `).join('') : '<p class="text-slate-500 italic">Không có linh thú</p>';

    // Weapons
    const weapsList = document.getElementById('ins-weapons-list');
    weapsList.innerHTML = weapons.length ? weapons.map(w => `
      <div class="flex items-center justify-between p-1.5 rounded bg-slate-800/40">
        <span>${w.is_natal ? '🗡️ ' : ''}${w.name} [Tier ${w.tier}]</span>
        <span class="text-sky-400">+${w.atk} Công / +${w.def} Thủ</span>
      </div>
    `).join('') : '<p class="text-slate-500 italic">Không có vũ khí</p>';

    // Helpers
    const helpsList = document.getElementById('ins-helpers-list');
    helpsList.innerHTML = helpers.length ? helpers.map(h => `
      <div class="flex items-center justify-between p-1.5 rounded bg-slate-800/40">
        <span>${h.name} [${h.type === 'combat' ? 'Hộ Đạo Giả' : 'Đạo Đồng'}]</span>
        <span class="${h.is_equipped ? 'text-cyan-400 font-semibold' : 'text-slate-500'}">${h.is_equipped ? 'Xuất Chiến' : 'Nghỉ'}</span>
      </div>
    `).join('') : '<p class="text-slate-500 italic">Chưa có trợ thủ</p>';

    // Skills
    const skillsList = document.getElementById('ins-skills-list');
    skillsList.innerHTML = skills.length ? skills.map(s => `
      <div class="flex items-center justify-between p-1.5 rounded bg-slate-800/40">
        <span>📜 ${s.name} [${s.element}]</span>
        <span class="text-yellow-400">x${s.damage_mult} ST</span>
      </div>
    `).join('') : '<p class="text-slate-500 italic">Chưa học kỹ năng</p>';

    // Inventory
    const invTags = document.getElementById('ins-inventory-tags');
    invTags.innerHTML = inventory.length ? inventory.map(i => `
      <span class="px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
        ${i.item_name}: <strong class="text-amber-300">${i.amount}</strong>
      </span>
    `).join('') : '<p class="text-slate-500 italic">Túi trữ vật trống rỗng</p>';

    openModal('modal-player-inspector');
  } catch (err) {
    showToast('Lỗi xem hồ sơ: ' + err.message, 'error');
  }
}

// ==========================================
// 5. INVENTORY & ITEMS CONTROLLER
// ==========================================
async function loadInventory() {
  try {
    const search = document.getElementById('inv-search')?.value || '';
    const item_type = document.getElementById('inv-filter-type')?.value || '';
    const user_id = document.getElementById('inv-filter-user')?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (item_type) params.append('item_type', item_type);
    if (user_id) params.append('user_id', user_id);

    const res = await fetch(`/api/inventory?${params.toString()}`).then(r => r.json());
    if (!res.success) return;

    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500">Túi đồ không có vật phẩm nào khớp bộ lọc.</td></tr>';
      return;
    }

    const typeLabels = {
      spirit_gold: { label: 'Linh Kim', color: 'text-amber-400' },
      pill: { label: 'Đan Dược', color: 'text-rose-400' },
      herb: { label: 'Linh Thảo', color: 'text-emerald-400' },
      seed: { label: 'Hạt Giống', color: 'text-lime-400' },
      material: { label: 'Khoáng Thạch', color: 'text-blue-400' }
    };

    tbody.innerHTML = res.data.map(item => {
      const typeInfo = typeLabels[item.item_type] || { label: item.item_type, color: 'text-slate-400' };

      return `
        <tr>
          <td class="text-slate-500 font-mono text-xs">#${item.id}</td>
          <td>
            <div class="font-medium text-white">${item.username || 'Không xác định'}</div>
            <div class="text-[11px] text-slate-500 font-mono">${item.user_id}</div>
          </td>
          <td>
            <span class="text-xs font-semibold ${typeInfo.color}">${typeInfo.label}</span>
          </td>
          <td class="font-mono text-xs text-slate-400">${item.item_key}</td>
          <td class="font-medium text-slate-100">${item.item_name}</td>
          <td>
            <span class="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold">
              ${item.amount.toLocaleString()}
            </span>
          </td>
          <td class="text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="openEditItemModal(${item.id}, '${item.item_name.replace(/'/g, "\\'")}', ${item.amount})" title="Chỉnh Sửa Số Lượng" class="p-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button onclick="handleDeleteInventoryItem(${item.id})" title="Xóa Vật Phẩm" class="p-1.5 text-xs bg-red-950/60 hover:bg-red-800 text-red-300 rounded border border-red-800/40">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Lỗi nạp inventory:', err);
  }
}

function openGiveItemModal() {
  document.getElementById('form-give-item').reset();
  openModal('modal-give-item');
}

function applyGiftCodePreset(index) {
  if (index === '') return;
  const preset = state.itemPresets[Number(index)];
  if (!preset) return;
  document.getElementById('gift-code-item-type').value = preset.item_type;
  handleGiftCodeTypeChange();
  document.getElementById('gift-code-item-key').value = preset.item_key;
  document.getElementById('gift-code-item-name').value = preset.item_name;
  document.getElementById('gift-code-amount').value = preset.defaultAmount;
}

function handleGiftCodeTypeChange() {
  const isSilver = document.getElementById('gift-code-item-type').value === 'silver';
  const itemKey = document.getElementById('gift-code-item-key');
  const itemName = document.getElementById('gift-code-item-name');
  if (isSilver) {
    itemKey.value = 'silver';
    itemName.value = 'Ngân Lượng (Bạc)';
  } else {
    if (itemKey.value === 'silver') itemKey.value = '';
    if (itemName.value === 'Ngân Lượng (Bạc)') itemName.value = '';
  }
  itemKey.disabled = isSilver;
  itemName.disabled = isSilver;
}

async function loadGiftCodes() {
  const tbody = document.getElementById('gift-codes-table-body');
  if (!tbody) return;
  try {
    const response = await fetch('/api/gift-codes').then(r => r.json());
    if (!response.success) throw new Error(response.error || 'Không thể tải mã quà tặng.');
    if (!response.data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">Chưa có mã quà tặng nào.</td></tr>';
      return;
    }

    const now = Date.now();
    tbody.innerHTML = response.data.map(giftCode => {
      const expired = Number(giftCode.expires_at) <= now;
      return `
        <tr>
          <td class="font-mono font-semibold text-amber-300">${escapeHtml(giftCode.code)}</td>
          <td>${escapeHtml(giftCode.item_name)} <span class="text-slate-400">×${Number(giftCode.amount).toLocaleString()}</span></td>
          <td class="text-xs text-slate-300">${new Date(Number(giftCode.expires_at)).toLocaleString('vi-VN')}</td>
          <td class="text-center">${Number(giftCode.claim_count).toLocaleString()}</td>
          <td><span class="${expired ? 'text-red-400' : 'text-emerald-400'}">${expired ? 'Hết hạn' : 'Còn hiệu lực'}</span></td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Lỗi tải mã quà tặng:', error);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-400">Không thể tải danh sách mã quà tặng.</td></tr>';
  }
}

async function handleGiftCodeSubmit(event) {
  event.preventDefault();
  const expiresAt = Date.parse(document.getElementById('gift-code-expiry').value);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    showToast('Thời điểm hết hạn phải ở tương lai.', 'error');
    return;
  }

  const payload = {
    code: document.getElementById('gift-code-value').value.trim(),
    item_type: document.getElementById('gift-code-item-type').value.trim(),
    item_key: document.getElementById('gift-code-item-key').value.trim(),
    item_name: document.getElementById('gift-code-item-name').value.trim(),
    amount: Number(document.getElementById('gift-code-amount').value),
    expires_at: expiresAt
  };
  try {
    const response = await fetch('/api/gift-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());
    if (!response.success) {
      showToast(response.error || 'Không thể tạo mã quà tặng.', 'error');
      return;
    }
    showToast(response.message, 'success');
    document.getElementById('form-gift-code').reset();
    document.getElementById('gift-code-item-type').value = 'pill';
    handleGiftCodeTypeChange();
    await loadGiftCodes();
  } catch (error) {
    showToast('Lỗi máy chủ khi tạo mã quà tặng: ' + error.message, 'error');
  }
}

async function handleGiveItemSubmit(e) {
  e.preventDefault();
  const target_user_id = document.getElementById('give-item-user').value;
  const item_type = document.getElementById('give-item-type').value;
  const item_key = document.getElementById('give-item-key').value.trim();
  const item_name = document.getElementById('give-item-name').value.trim();
  const amount = Number(document.getElementById('give-item-amount').value) || 1;

  try {
    const res = await fetch('/api/inventory/give', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id, item_type, item_key, item_name, amount })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-give-item');
    loadInventory();
  } catch (err) {
    showToast('Lỗi ban phát vật phẩm: ' + err.message, 'error');
  }
}

function openEditItemModal(id, name, amount) {
  document.getElementById('edit-item-id').value = id;
  document.getElementById('edit-item-name').value = name;
  document.getElementById('edit-item-amount').value = amount;
  openModal('modal-edit-item');
}

async function handleEditItemSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-item-id').value;
  const item_name = document.getElementById('edit-item-name').value.trim();
  const amount = Number(document.getElementById('edit-item-amount').value);

  try {
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name, amount })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-edit-item');
    loadInventory();
  } catch (err) {
    showToast('Lỗi cập nhật: ' + err.message, 'error');
  }
}

async function handleDeleteInventoryItem(id) {
  if (!confirm('Xác nhận xóa vật phẩm này khỏi túi đồ?')) return;
  try {
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadInventory();
  } catch (err) {
    showToast('Lỗi xóa vật phẩm: ' + err.message, 'error');
  }
}

// ==========================================
// 6. PETS CONTROLLER
// ==========================================
async function loadPets() {
  try {
    const search = document.getElementById('pet-search')?.value || '';
    const element = document.getElementById('pet-filter-element')?.value || '';
    const is_mythic = document.getElementById('pet-filter-mythic')?.value || '';
    const user_id = document.getElementById('pet-filter-user')?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (element) params.append('element', element);
    if (is_mythic !== '') params.append('is_mythic', is_mythic);
    if (user_id) params.append('user_id', user_id);

    const res = await fetch(`/api/pets?${params.toString()}`).then(r => r.json());
    if (!res.success) return;

    const tbody = document.getElementById('pets-table-body');
    if (!tbody) return;

    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-slate-500">Chưa có linh thú nào khớp bộ lọc.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(p => `
      <tr>
        <td class="text-slate-500 font-mono text-xs">#${p.id}</td>
        <td>
          <div class="font-medium text-white">${p.username || 'N/A'}</div>
          <div class="text-[11px] text-slate-500 font-mono">${p.user_id}</div>
        </td>
        <td class="font-bold text-white">
          ${safeImageUrl(p.image_url) ? `<img src="${escapeHtml(safeImageUrl(p.image_url))}" alt="" class="w-10 h-10 rounded object-cover inline-block mr-2 align-middle">` : ''}
          <span>${p.is_mythic ? '🐉' : '🦊'}</span>
          <span>${p.name}</span>
        </td>
        <td>
          <span class="px-2 py-0.5 rounded text-xs font-semibold ${p.is_mythic ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-300'}">
            Hệ ${p.element} ${p.is_mythic ? '• Thần Thoại' : ''}
          </span>
        </td>
        <td class="text-amber-400 font-bold">${'⭐'.repeat(p.star)}</td>
        <td class="text-xs">
          <div>HP: <span class="text-emerald-400 font-medium">${p.hp}</span> | Công: <span class="text-red-400 font-medium">${p.atk}</span></div>
          <div class="text-[11px] text-slate-400">Thủ: ${p.def} | Tốc: ${p.speed} | Bạo: ${(p.crit * 100).toFixed(0)}%</div>
        </td>
        <td class="text-xs text-slate-300 max-w-xs truncate" title="${p.effect_desc}">${p.effect_desc}</td>
        <td>
          <span class="px-2 py-0.5 rounded text-xs ${p.is_equipped ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : 'bg-slate-800 text-slate-500'}">
            ${p.is_equipped ? `Ô Số ${p.slot}` : 'Dự bị'}
          </span>
        </td>
        <td class="text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openItemImageModal(this, 'pets', ${p.id})" data-image-url="${escapeHtml(p.image_url || '')}" title="Đổi ảnh Linh Thú" class="p-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-sky-300 rounded border border-slate-700">
              <i class="fa-solid fa-image"></i>
            </button>
            <button onclick="handleDeletePet(${p.id})" title="Xóa Linh Thú" class="p-1.5 text-xs bg-red-950/60 hover:bg-red-800 text-red-300 rounded border border-red-800/40">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Lỗi nạp pets:', err);
  }
}

function openCreatePetModal() {
  document.getElementById('form-pet').reset();
  document.getElementById('pet-form-id').value = '';
  document.getElementById('pet-user-select-box').style.display = 'block';
  openModal('modal-pet-form');
}

async function handlePetFormSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('pet-user-id').value;
  const name = document.getElementById('pet-name').value.trim();
  const element = document.getElementById('pet-element').value;
  const star = Number(document.getElementById('pet-star').value);
  const is_mythic = Number(document.getElementById('pet-is-mythic').value);
  const slot = Number(document.getElementById('pet-slot').value);
  const is_equipped = slot > 0 ? 1 : 0;
  const hp = Number(document.getElementById('pet-hp').value);
  const atk = Number(document.getElementById('pet-atk').value);
  const def = Number(document.getElementById('pet-def').value);
  const speed = Number(document.getElementById('pet-speed').value);
  const effect_desc = document.getElementById('pet-effect').value.trim();
  const image_url = document.getElementById('pet-image-url').value.trim();

  try {
    const res = await fetch('/api/pets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, name, element, star, is_mythic, is_equipped, slot, hp, atk, def, speed, effect_desc, image_url })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-pet-form');
    loadPets();
  } catch (err) {
    showToast('Lỗi ban thưởng linh thú: ' + err.message, 'error');
  }
}

async function handleDeletePet(id) {
  if (!confirm('Xác nhận xóa linh thú này?')) return;
  try {
    const res = await fetch(`/api/pets/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadPets();
  } catch (err) {
    showToast('Lỗi xóa linh thú: ' + err.message, 'error');
  }
}

// ==========================================
// 7. WEAPONS CONTROLLER
// ==========================================
async function loadWeapons() {
  try {
    const search = document.getElementById('weapon-search')?.value || '';
    const tier = document.getElementById('weapon-filter-tier')?.value || '';
    const user_id = document.getElementById('weapon-filter-user')?.value || '';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (tier) params.append('tier', tier);
    if (user_id) params.append('user_id', user_id);

    const res = await fetch(`/api/weapons?${params.toString()}`).then(r => r.json());
    if (!res.success) return;

    const tbody = document.getElementById('weapons-table-body');
    if (!tbody) return;

    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-500">Chưa có linh khí nào khớp bộ lọc.</td></tr>';
      return;
    }

    const tierColors = {
      1: 'text-slate-400',
      2: 'text-emerald-400',
      3: 'text-sky-400',
      4: 'text-purple-400',
      5: 'text-amber-400',
      6: 'text-rose-400',
      7: 'text-yellow-300 font-bold'
    };

    tbody.innerHTML = res.data.map(w => `
      <tr>
        <td class="text-slate-500 font-mono text-xs">#${w.id}</td>
        <td>
          <div class="font-medium text-white">${w.username || 'N/A'}</div>
          <div class="text-[11px] text-slate-500 font-mono">${w.user_id}</div>
        </td>
        <td class="font-bold text-white">
          ${safeImageUrl(w.image_url) ? `<img src="${escapeHtml(safeImageUrl(w.image_url))}" alt="" class="w-10 h-10 rounded object-cover inline-block mr-2 align-middle">` : ''}
          <span>🗡️</span>
          <span>${w.name}</span>
        </td>
        <td>
          <span class="text-xs font-semibold ${tierColors[w.tier] || 'text-white'}">
            Bậc ${w.tier}
          </span>
        </td>
        <td class="text-xs">
          <span class="text-red-400 font-semibold">+${w.atk} Công</span> / 
          <span class="text-sky-400 font-semibold">+${w.def} Thủ</span>
        </td>
        <td class="text-xs">
          <div class="font-medium text-purple-300">${w.effect_name}</div>
          <div class="text-[11px] text-slate-400 truncate max-w-xs" title="${w.effect_desc}">${w.effect_desc}</div>
        </td>
        <td>
          <div class="flex items-center gap-2 text-xs">
            ${w.is_natal ? '<span class="text-amber-400 font-semibold">Bản Mệnh</span>' : '<span class="text-slate-500">Thường</span>'}
            ${w.is_equipped ? '<span class="text-emerald-400 font-semibold">• Đang Mang</span>' : ''}
          </div>
        </td>
        <td class="text-right">
          <button onclick="openItemImageModal(this, 'weapons', ${w.id})" data-image-url="${escapeHtml(w.image_url || '')}" title="Đổi ảnh Linh Khí" class="p-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-sky-300 rounded border border-slate-700">
            <i class="fa-solid fa-image"></i>
          </button>
          <button onclick="handleDeleteWeapon(${w.id})" title="Xóa Linh Khí" class="p-1.5 text-xs bg-red-950/60 hover:bg-red-800 text-red-300 rounded border border-red-800/40">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Lỗi nạp weapons:', err);
  }
}

function openCreateWeaponModal() {
  document.getElementById('form-weapon').reset();
  openModal('modal-weapon-form');
}

async function handleWeaponFormSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('weapon-user-id').value;
  const name = document.getElementById('weapon-name').value.trim();
  const tier = Number(document.getElementById('weapon-tier').value);
  const atk = Number(document.getElementById('weapon-atk').value);
  const def = Number(document.getElementById('weapon-def').value);
  const effect_name = document.getElementById('weapon-effect-name').value.trim();
  const effect_desc = document.getElementById('weapon-effect-desc').value.trim();
  const image_url = document.getElementById('weapon-image-url').value.trim();
  const is_natal = document.getElementById('weapon-is-natal').checked ? 1 : 0;
  const is_equipped = document.getElementById('weapon-is-equipped').checked ? 1 : 0;

  try {
    const res = await fetch('/api/weapons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, name, tier, atk, def, effect_name, effect_desc, image_url, is_natal, is_equipped })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-weapon-form');
    loadWeapons();
  } catch (err) {
    showToast('Lỗi ban thưởng linh khí: ' + err.message, 'error');
  }
}

async function handleDeleteWeapon(id) {
  if (!confirm('Xác nhận xóa linh khí này?')) return;
  try {
    const res = await fetch(`/api/weapons/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadWeapons();
  } catch (err) {
    showToast('Lỗi xóa linh khí: ' + err.message, 'error');
  }
}

// ==========================================
// 8. HELPERS CONTROLLER
// ==========================================
async function loadHelpers() {
  try {
    const type = document.getElementById('helper-filter-type')?.value || '';
    const user_id = document.getElementById('helper-filter-user')?.value || '';

    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (user_id) params.append('user_id', user_id);

    const res = await fetch(`/api/helpers?${params.toString()}`).then(r => r.json());
    if (!res.success) return;

    const tbody = document.getElementById('helpers-table-body');
    if (!tbody) return;

    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-500">Chưa có trợ thủ nào.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(h => `
      <tr>
        <td class="text-slate-500 font-mono text-xs">#${h.id}</td>
        <td>
          <div class="font-medium text-white">${h.username || 'N/A'}</div>
          <div class="text-[11px] text-slate-500 font-mono">${h.user_id}</div>
        </td>
        <td class="font-bold text-white">
          ${safeImageUrl(h.image_url) ? `<img src="${escapeHtml(safeImageUrl(h.image_url))}" alt="" class="w-10 h-10 rounded object-cover inline-block mr-2 align-middle">` : ''}
          <span>${h.type === 'combat' ? '⚔️' : '🌾'}</span>
          <span>${h.name}</span>
        </td>
        <td>
          <span class="px-2 py-0.5 rounded text-xs font-semibold ${h.type === 'combat' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}">
            ${h.type === 'combat' ? 'Hộ Đạo Giả' : 'Đạo Đồng'}
          </span>
        </td>
        <td class="text-amber-400 font-semibold">Tier ${h.tier}</td>
        <td class="text-xs text-slate-300 max-w-xs truncate" title="${h.effect_desc}">${h.effect_desc}</td>
        <td>
          <span class="text-xs font-semibold ${h.is_equipped ? 'text-emerald-400' : 'text-slate-500'}">
            ${h.is_equipped ? 'Đang Xuất Chiến' : 'Dự Bị'}
          </span>
        </td>
        <td class="text-right">
          <button onclick="openItemImageModal(this, 'helpers', ${h.id})" data-image-url="${escapeHtml(h.image_url || '')}" title="Đổi ảnh Trợ Thủ" class="p-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-sky-300 rounded border border-slate-700">
            <i class="fa-solid fa-image"></i>
          </button>
          <button onclick="handleDeleteHelper(${h.id})" title="Xóa Trợ Thủ" class="p-1.5 text-xs bg-red-950/60 hover:bg-red-800 text-red-300 rounded border border-red-800/40">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Lỗi nạp helpers:', err);
  }
}

function openCreateHelperModal() {
  document.getElementById('form-helper').reset();
  openModal('modal-helper-form');
}

async function handleHelperFormSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('helper-user-id').value;
  const name = document.getElementById('helper-name').value.trim();
  const type = document.getElementById('helper-type').value;
  const tier = Number(document.getElementById('helper-tier').value);
  const is_equipped = document.getElementById('helper-is-equipped').checked ? 1 : 0;
  const effect_desc = document.getElementById('helper-effect-desc').value.trim();
  const image_url = document.getElementById('helper-image-url').value.trim();

  try {
    const res = await fetch('/api/helpers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, name, type, tier, is_equipped, effect_desc, image_url })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-helper-form');
    loadHelpers();
  } catch (err) {
    showToast('Lỗi ban thưởng trợ thủ: ' + err.message, 'error');
  }
}

async function handleDeleteHelper(id) {
  if (!confirm('Xác nhận xóa trợ thủ này?')) return;
  try {
    const res = await fetch(`/api/helpers/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadHelpers();
  } catch (err) {
    showToast('Lỗi xóa trợ thủ: ' + err.message, 'error');
  }
}

function openItemImageModal(button, itemType, itemId) {
  const imageUrl = safeImageUrl(button.dataset.imageUrl || '');
  document.getElementById('item-image-modal-title').textContent = `Đổi ảnh ${itemType === 'pets' ? 'Linh Thú' : itemType === 'weapons' ? 'Linh Khí' : 'Trợ Thủ'} #${itemId}`;
  document.getElementById('item-image-type').value = itemType;
  document.getElementById('item-image-id').value = itemId;
  document.getElementById('item-image-url').value = imageUrl;
  updateItemImagePreview();
  openModal('modal-item-image');
}

function updateItemImagePreview() {
  const preview = document.getElementById('item-image-preview');
  if (!preview) return;
  const imageUrl = safeImageUrl(document.getElementById('item-image-url').value.trim());
  preview.src = imageUrl;
  preview.classList.toggle('hidden', !imageUrl);
}

async function handleItemImageSubmit(e) {
  e.preventDefault();
  const itemType = document.getElementById('item-image-type').value;
  const itemId = document.getElementById('item-image-id').value;
  const image_url = document.getElementById('item-image-url').value.trim();
  if (!['pets', 'weapons', 'helpers'].includes(itemType)) {
    showToast('Loại vật phẩm không hợp lệ!', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/${itemType}/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url })
    }).then(r => r.json());
    if (!res.success) {
      showToast(res.error || 'Không thể cập nhật ảnh vật phẩm.', 'error');
      return;
    }

    showToast(res.message || 'Đã cập nhật ảnh vật phẩm!', 'success');
    closeModal('modal-item-image');
    if (itemType === 'pets') loadPets();
    else if (itemType === 'weapons') loadWeapons();
    else loadHelpers();
  } catch (err) {
    showToast('Lỗi cập nhật ảnh vật phẩm: ' + err.message, 'error');
  }
}

// ==========================================
// 9. SKILLS CONTROLLER
// ==========================================
async function loadSkills() {
  try {
    const user_id = document.getElementById('skill-filter-user')?.value || '';
    const params = new URLSearchParams();
    if (user_id) params.append('user_id', user_id);

    const res = await fetch(`/api/skills?${params.toString()}`).then(r => r.json());
    if (!res.success) return;

    const tbody = document.getElementById('skills-table-body');
    if (!tbody) return;

    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-slate-500">Chưa có kỹ năng nào.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(s => `
      <tr>
        <td class="text-slate-500 font-mono text-xs">#${s.id}</td>
        <td>
          <div class="font-medium text-white">${s.username || 'N/A'}</div>
          <div class="text-[11px] text-slate-500 font-mono">${s.user_id}</div>
        </td>
        <td class="font-bold text-white flex items-center gap-1.5">
          <span>📜</span>
          <span>${s.name}</span>
        </td>
        <td>
          <span class="text-xs px-2 py-0.5 rounded ${s.type === 'active' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}">
            ${s.type === 'active' ? 'Chủ Động' : 'Bị Động'}
          </span>
        </td>
        <td class="text-xs font-semibold text-slate-200">Hệ ${s.element}</td>
        <td class="text-amber-400 font-bold">x${s.damage_mult}</td>
        <td class="text-xs text-slate-300 max-w-xs truncate" title="${s.desc}">${s.desc}</td>
        <td>
          <span class="text-xs ${s.is_equipped ? 'text-emerald-400 font-semibold' : 'text-slate-500'}">
            ${s.is_equipped ? `Ô ${s.slot}` : 'Chưa trang bị'}
          </span>
        </td>
        <td class="text-right">
          <button onclick="handleDeleteSkill(${s.id})" title="Xóa Kỹ Năng" class="p-1.5 text-xs bg-red-950/60 hover:bg-red-800 text-red-300 rounded border border-red-800/40">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Lỗi nạp skills:', err);
  }
}

function openCreateSkillModal() {
  document.getElementById('form-skill').reset();
  openModal('modal-skill-form');
}

async function handleSkillFormSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('skill-user-id').value;
  const name = document.getElementById('skill-name').value.trim();
  const element = document.getElementById('skill-element').value;
  const type = document.getElementById('skill-type').value;
  const damage_mult = Number(document.getElementById('skill-dmg-mult').value);
  const slot = Number(document.getElementById('skill-slot').value);
  const is_equipped = slot > 0 ? 1 : 0;
  const desc = document.getElementById('skill-desc').value.trim();

  try {
    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, name, element, type, damage_mult, is_equipped, slot, desc })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-skill-form');
    loadSkills();
  } catch (err) {
    showToast('Lỗi truyền dạy kỹ năng: ' + err.message, 'error');
  }
}

async function handleDeleteSkill(id) {
  if (!confirm('Xác nhận xóa kỹ năng này?')) return;
  try {
    const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadSkills();
  } catch (err) {
    showToast('Lỗi xóa kỹ năng: ' + err.message, 'error');
  }
}

// ==========================================
// 10. DONG PHU CONTROLLER
// ==========================================
async function loadDongPhu() {
  try {
    const res = await fetch('/api/dongphu').then(r => r.json());
    if (!res.success) return;

    const tbody = document.getElementById('dongphu-table-body');
    if (!tbody) return;

    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500">Chưa có động phủ nào.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(dp => {
      let garden = [];
      try { garden = JSON.parse(dp.garden_data || '[]'); } catch (_) {}

      return `
        <tr>
          <td>
            <div class="font-medium text-white">${dp.username || 'N/A'}</div>
            <div class="text-[11px] text-slate-500 font-mono">${dp.user_id}</div>
          </td>
          <td>
            <span class="px-2 py-0.5 rounded text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
              Tụ Linh Trận: Cấp ${dp.array_level}/50 • ${2 * Number(dp.array_level)} XP/phút
            </span>
            <div class="text-[11px] mt-1 ${Number(dp.afk_enabled) === 1 ? 'text-emerald-400' : 'text-slate-500'}">
              ${Number(dp.afk_enabled) === 1 ? '🌙 AFK đang bật' : '💤 AFK đang tắt'}
            </div>
          </td>
          <td class="text-xs text-rose-300 font-semibold">Cấp ${dp.alchemy_furnace_level}</td>
          <td class="text-xs text-amber-300 font-semibold">Cấp ${dp.forge_level}</td>
          <td class="text-xs text-slate-200">${garden.length}/${dp.garden_slots} Ô Đất</td>
          <td>
            <div class="text-xs text-emerald-400">
              ${garden.length ? garden.map(g => `${g.herbName}`).join(', ') : '<span class="text-slate-500 italic">Đất trống</span>'}
            </div>
          </td>
          <td class="text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="handleResetDongPhuCooldown('${dp.user_id}')" title="Xóa Cooldown (Thu Hoạch Tức Thì Toàn Bộ)" class="px-2.5 py-1 text-xs btn-emerald rounded font-semibold flex items-center gap-1">
                <i class="fa-solid fa-forward-fast"></i>
                <span>Thu Hoạch Ngay</span>
              </button>
              <button onclick="openEditDongPhuModal('${dp.user_id}', ${dp.array_level}, ${dp.alchemy_furnace_level}, ${dp.forge_level}, ${dp.garden_slots})" title="Sửa Cấp Độ Động Phủ" class="p-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700">
                <i class="fa-solid fa-pen"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Lỗi nạp dongphu:', err);
  }
}

function openEditDongPhuModal(userId, arrayLvl, alchLvl, forgeLvl, gardenSlots) {
  document.getElementById('dp-user-id').value = userId;
  document.getElementById('dp-array-level').value = arrayLvl;
  document.getElementById('dp-alchemy-level').value = alchLvl;
  document.getElementById('dp-forge-level').value = forgeLvl;
  document.getElementById('dp-garden-slots').value = gardenSlots;
  openModal('modal-dongphu-form');
}

async function handleDongPhuSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('dp-user-id').value;
  const array_level = Number(document.getElementById('dp-array-level').value);
  const alchemy_furnace_level = Number(document.getElementById('dp-alchemy-level').value);
  const forge_level = Number(document.getElementById('dp-forge-level').value);
  const garden_slots = Number(document.getElementById('dp-garden-slots').value);

  try {
    const res = await fetch(`/api/dongphu/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ array_level, alchemy_furnace_level, forge_level, garden_slots })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-dongphu-form');
    loadDongPhu();
  } catch (err) {
    showToast('Lỗi cập nhật động phủ: ' + err.message, 'error');
  }
}

async function handleResetDongPhuCooldown(userId) {
  try {
    const res = await fetch(`/api/dongphu/${userId}/reset-cooldown`, { method: 'POST' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadDongPhu();
  } catch (err) {
    showToast('Lỗi reset cooldown: ' + err.message, 'error');
  }
}

// ==========================================
// 11. SECTS & MINES CONTROLLER
// ==========================================
async function loadSects() {
  try {
    const res = await fetch('/api/sects').then(r => r.json());
    if (!res.success) return;

    state.sects = res.data;
    const tbody = document.getElementById('sects-table-body');
    if (!tbody) return;

    if (!state.sects.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-slate-500">Chưa có tông môn nào được thành lập.</td></tr>';
      return;
    }

    tbody.innerHTML = state.sects.map(s => `
      <tr>
        <td class="text-slate-500 font-mono text-xs">#${s.id}</td>
        <td class="font-bold text-white flex items-center gap-1.5">
          <span>🏛️</span>
          <span>${s.name}</span>
        </td>
        <td>
          <div class="font-medium text-slate-200">${s.leader_name || 'N/A'}</div>
          <div class="text-[11px] text-slate-500 font-mono">${s.leader_id}</div>
        </td>
        <td class="text-purple-300 font-bold">Cấp ${s.level}</td>
        <td class="text-amber-400 font-semibold">${Number(s.fund_silver).toLocaleString()} 💰</td>
        <td class="text-sky-400 font-semibold">${Number(s.fund_spirit_gold).toLocaleString()} 💎</td>
        <td class="text-xs text-slate-300">${s.sect_skill || 'Chưa lập'}</td>
        <td class="text-xs font-semibold text-emerald-400">${s.member_count} Đệ Tử</td>
        <td class="text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="handleDisbandSect(${s.id}, '${s.name.replace(/'/g, "\\'")}')" title="Giải Tán Tông Môn" class="p-1.5 text-xs bg-red-950/60 hover:bg-red-800 text-red-300 rounded border border-red-800/40">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Lỗi nạp sects:', err);
  }
}

async function loadMines() {
  try {
    const res = await fetch('/api/mines').then(r => r.json());
    if (!res.success) return;

    const tbody = document.getElementById('mines-table-body');
    if (!tbody) return;

    tbody.innerHTML = res.data.map(m => `
      <tr>
        <td class="text-slate-500 font-mono text-xs">#${m.id}</td>
        <td class="font-bold text-white flex items-center gap-1.5">
          <span>💎</span>
          <span>${m.name}</span>
        </td>
        <td class="text-xs font-semibold text-amber-300">Phẩm ${m.tier_name}</td>
        <td>
          <span class="px-2 py-0.5 rounded text-xs font-semibold ${m.sect_name ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-slate-800 text-slate-500 italic'}">
            ${m.sect_name ? `🏛️ ${m.sect_name}` : 'Chưa có tông môn chiếm'}
          </span>
        </td>
        <td class="text-amber-300 font-medium">+${Number(m.daily_silver).toLocaleString()} / ngày</td>
        <td class="text-sky-300 font-medium">+${Number(m.daily_spirit_gold).toLocaleString()} / ngày</td>
        <td class="text-right">
          <button onclick="openEditMineModal(${m.id}, '${m.name.replace(/'/g, "\\'")}', ${m.occupying_sect_id || 'null'}, ${m.daily_silver}, ${m.daily_spirit_gold})" class="px-2.5 py-1 text-xs btn-cyan rounded font-semibold">
            Thay Đổi
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Lỗi nạp mines:', err);
  }
}

function openCreateSectModal() {
  document.getElementById('form-sect').reset();
  openModal('modal-sect-form');
}

async function handleSectFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('sect-name').value.trim();
  const leader_id = document.getElementById('sect-leader-id').value;
  const level = Number(document.getElementById('sect-level').value);
  const fund_silver = Number(document.getElementById('sect-fund-silver').value);
  const fund_spirit_gold = Number(document.getElementById('sect-fund-gold').value);
  const sect_skill = document.getElementById('sect-skill').value.trim();
  const notice = document.getElementById('sect-notice').value.trim();

  try {
    const res = await fetch('/api/sects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, leader_id, level, fund_silver, fund_spirit_gold, sect_skill, notice })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-sect-form');
    loadSects();
  } catch (err) {
    showToast('Lỗi lập tông môn: ' + err.message, 'error');
  }
}

async function handleDisbandSect(id, name) {
  if (!confirm(`Xác nhận giải tán Tông Môn "${name}"? Các thành viên sẽ trở thành Tán Tu!`)) return;
  try {
    const res = await fetch(`/api/sects/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadSects();
    loadMines();
  } catch (err) {
    showToast('Lỗi giải tán tông môn: ' + err.message, 'error');
  }
}

function openEditMineModal(id, name, occupyingId, dailySilver, dailyGold) {
  document.getElementById('mine-id').value = id;
  document.getElementById('mine-name').value = name;
  document.getElementById('mine-silver').value = dailySilver;
  document.getElementById('mine-spirit-gold').value = dailyGold;

  const occSelect = document.getElementById('mine-occupier');
  occSelect.innerHTML = '<option value="">(Trống - Chưa ai chiếm)</option>' +
    state.sects.map(s => `<option value="${s.id}" ${s.id === occupyingId ? 'selected' : ''}>🏛️ ${s.name}</option>`).join('');

  openModal('modal-mine-form');
}

async function handleMineSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('mine-id').value;
  const occupying_sect_id = document.getElementById('mine-occupier').value || null;
  const daily_silver = Number(document.getElementById('mine-silver').value);
  const daily_spirit_gold = Number(document.getElementById('mine-spirit-gold').value);

  try {
    const res = await fetch(`/api/mines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ occupying_sect_id, daily_silver, daily_spirit_gold })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-mine-form');
    loadMines();
  } catch (err) {
    showToast('Lỗi cập nhật mỏ: ' + err.message, 'error');
  }
}

// ==========================================
// 12. WORLD BOSS CONTROLLER
// ==========================================
async function loadBoss() {
  try {
    const res = await fetch('/api/boss').then(r => r.json());
    if (!res.success) return;

    const boss = res.data;
    const nameEl = document.getElementById('boss-name');
    const badgeEl = document.getElementById('boss-badge');
    const hpTextEl = document.getElementById('boss-hp-text');
    const hpBarEl = document.getElementById('boss-hp-bar');

    if (!boss) {
      nameEl.textContent = 'Hiện Chưa Có Boss Nào Xuất Hiện';
      badgeEl.textContent = 'Trống';
      badgeEl.className = 'px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400';
      hpTextEl.textContent = '0 / 0';
      hpBarEl.style.width = '0%';
      return;
    }

    nameEl.textContent = boss.name;
    const isAlive = boss.status === 'alive';
    badgeEl.textContent = isAlive ? 'Đang Sống' : 'Đã Bị Đánh Bại';
    badgeEl.className = isAlive
      ? 'px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
      : 'px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/40';

    const curr = BigInt(boss.current_hp || '0');
    const max = BigInt(boss.max_hp || '1');
    const pct = max > 0n ? Math.max(0, Math.min(100, Number((curr * 100n) / max))) : 0;

    hpTextEl.textContent = `${curr.toLocaleString()} / ${max.toLocaleString()} (${pct}%)`;
    hpBarEl.style.width = `${pct}%`;

    // Leaderboard
    const lbContainer = document.getElementById('boss-damage-table');
    const dmgData = res.damageLeaderboard || {};
    const entries = Object.entries(dmgData).sort((a, b) => Number(b[1]) - Number(a[1]));

    if (!entries.length) {
      lbContainer.innerHTML = '<p class="text-slate-500 italic">Chưa có người chơi nào tham gia đánh boss này.</p>';
    } else {
      lbContainer.innerHTML = entries.map(([uid, dmg], idx) => {
        const player = state.players.find(p => p.user_id === uid);
        const name = player ? player.username : `User ${uid}`;
        return `
          <div class="flex items-center justify-between p-2 rounded bg-slate-800/40">
            <span class="font-medium text-slate-200">#${idx + 1}. ${name} (${uid})</span>
            <span class="font-bold text-rose-400">${Number(dmg).toLocaleString()} Sát thương</span>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Lỗi nạp boss:', err);
  }
}

async function handleBossAction(action, percent = null) {
  try {
    let body = { action };
    if (action === 'damage' && percent) {
      // Calculate amount based on current boss max
      body.damage_amount = 25000000;
    }

    const res = await fetch('/api/boss/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    loadBoss();
  } catch (err) {
    showToast('Lỗi tác vụ boss: ' + err.message, 'error');
  }
}

function openSpawnBossModal() {
  document.getElementById('form-spawn-boss').reset();
  openModal('modal-spawn-boss');
}

async function handleSpawnBossSubmit(e) {
  e.preventDefault();
  const boss_name = document.getElementById('boss-spawn-name').value.trim();
  const max_hp = document.getElementById('boss-spawn-hp').value.trim();

  try {
    const res = await fetch('/api/boss/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'spawn', boss_name, max_hp })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-spawn-boss');
    loadBoss();
    loadStats();
  } catch (err) {
    showToast('Lỗi triệu hồi boss: ' + err.message, 'error');
  }
}

// ==========================================
// 13. MARKET CONTROLLER
// ==========================================
async function loadMarket() {
  try {
    const status = document.getElementById('market-filter-status')?.value || '';
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const res = await fetch(`/api/market?${params.toString()}`).then(r => r.json());
    if (!res.success) return;

    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;

    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-500">Chợ Đen hiện không có tin rao bán nào.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(m => `
      <tr>
        <td class="text-slate-500 font-mono text-xs">#${m.id}</td>
        <td>
          <div class="font-medium text-white">${m.seller_name}</div>
          <div class="text-[11px] text-slate-500 font-mono">${m.seller_id}</div>
        </td>
        <td class="text-xs font-semibold text-slate-300">${m.item_category}</td>
        <td class="font-bold text-amber-300">${m.item_title}</td>
        <td class="font-bold text-amber-400">${Number(m.price_silver).toLocaleString()} 💰</td>
        <td>
          <span class="px-2 py-0.5 rounded text-xs font-semibold ${m.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : m.status === 'sold' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-500'}">
            ${m.status === 'active' ? 'Đang Bán' : m.status === 'sold' ? 'Đã Bán' : 'Đã Hủy'}
          </span>
        </td>
        <td class="text-xs text-slate-400">${new Date(Number(m.created_at)).toLocaleString('vi-VN')}</td>
        <td class="text-right">
          <div class="flex items-center justify-end gap-1.5">
            ${m.status === 'active' ? `
              <button onclick="handleCancelMarket(${m.id})" title="Hủy & Hoàn Đồ" class="px-2.5 py-1 text-xs btn-gold rounded font-semibold">
                Hủy & Trả Đồ
              </button>
            ` : ''}
            <button onclick="handleDeleteMarket(${m.id})" title="Xóa Tin" class="p-1.5 text-xs bg-red-950/60 hover:bg-red-800 text-red-300 rounded border border-red-800/40">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Lỗi nạp market:', err);
  }
}

async function handleCancelMarket(id) {
  if (!confirm('Xác nhận hủy tin rao bán và hoàn trả lại vật phẩm cho người bán?')) return;
  try {
    const res = await fetch(`/api/market/${id}/cancel`, { method: 'POST' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadMarket();
  } catch (err) {
    showToast('Lỗi hủy tin chợ đen: ' + err.message, 'error');
  }
}

async function handleDeleteMarket(id) {
  if (!confirm('Xóa vĩnh viễn tin đăng này khỏi CSDL?')) return;
  try {
    const res = await fetch(`/api/market/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadMarket();
  } catch (err) {
    showToast('Lỗi xóa tin: ' + err.message, 'error');
  }
}

// ==========================================
// 14. TOOLS, SQL RUNNER & SYSTEM INFO
// ==========================================
function setSqlPreset(sql) {
  const el = document.getElementById('sql-input');
  if (el) el.value = sql;
}

async function handleResetPlayerResources() {
  const confirmed = confirm(
    'CẢNH BÁO: Thao tác này sẽ đưa Ngân Lượng về 0 và xóa toàn bộ vật phẩm/tài nguyên trong túi của TẤT CẢ người chơi, bao gồm Linh Kim. Cảnh giới, cấp độ, Linh Khí, Linh Thú và Trợ Thủ được giữ nguyên. Bạn có chắc chắn muốn tiếp tục?'
  );
  if (!confirmed) return;

  if (prompt('Để xác nhận lần cuối, hãy nhập chính xác RESET TAI NGUYEN:') !== 'RESET TAI NGUYEN') {
    showToast('Xác nhận không khớp. Không có tài nguyên nào bị reset.', 'info');
    return;
  }

  const button = document.getElementById('btn-reset-player-resources');
  if (button) button.disabled = true;

  try {
    const res = await fetch('/api/reset-player-resources', { method: 'POST' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error || 'Không thể reset tài nguyên người chơi.', 'error');
      return;
    }

    await Promise.all([loadStats(), loadPlayers(), loadInventory()]);
    showToast(res.message, 'success');
  } catch (err) {
    showToast('Lỗi reset tài nguyên người chơi: ' + err.message, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleResetGameData() {
  const confirmed = confirm(
    'CẢNH BÁO: Thao tác này sẽ xóa toàn bộ dữ liệu người chơi và tiến trình game. Cấu hình Gacha, linh thú và mỏ vẫn được giữ lại. Bạn có chắc chắn muốn tiếp tục?'
  );
  if (!confirmed) return;

  if (prompt('Để xác nhận lần cuối, hãy nhập chính xác RESET:') !== 'RESET') {
    showToast('Xác nhận không khớp. Không có dữ liệu nào bị xóa.', 'info');
    return;
  }

  const button = document.getElementById('btn-reset-game-data');
  if (button) button.disabled = true;

  try {
    const res = await fetch('/api/reset-game-data', { method: 'POST' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error || 'Không thể reset dữ liệu game.', 'error');
      return;
    }

    await Promise.all([loadStats(), loadPlayers(), loadSects()]);
    showToast(res.message, 'success');
  } catch (err) {
    showToast('Lỗi reset dữ liệu game: ' + err.message, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function executeSql() {
  const sql = document.getElementById('sql-input')?.value.trim();
  if (!sql) {
    showToast('Vui lòng nhập câu lệnh SQL!', 'warning');
    return;
  }

  const resultContainer = document.getElementById('sql-result-container');
  const table = document.getElementById('sql-result-table');

  try {
    const res = await fetch('/api/sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    resultContainer.classList.remove('hidden');

    if (!res.rows || !res.rows.length) {
      table.innerHTML = `<thead><tr><th class="p-3 text-emerald-400">Kết quả thực thi</th></tr></thead><tbody><tr><td class="p-3 text-slate-300">Câu lệnh hoàn tất thành công. Số dòng ảnh hưởng: <strong>${res.rowsAffected}</strong></td></tr></tbody>`;
      showToast(`Hoàn tất! Số dòng ảnh hưởng: ${res.rowsAffected}`, 'success');
      return;
    }

    const columns = Object.keys(res.rows[0]);
    let thead = '<thead><tr>' + columns.map(c => `<th>${c}</th>`).join('') + '</tr></thead>';
    let tbody = '<tbody>' + res.rows.map(r => `
      <tr>${columns.map(c => `<td>${r[c] !== null && r[c] !== undefined ? r[c] : '<span class="text-slate-500 italic">null</span>'}</td>`).join('')}</tr>
    `).join('') + '</tbody>';

    table.innerHTML = thead + tbody;
    showToast(`Thực thi thành công, trả về ${res.rows.length} hàng!`, 'success');
  } catch (err) {
    showToast('Lỗi thực thi SQL: ' + err.message, 'error');
  }
}

async function loadSystemInfo() {
  try {
    const res = await fetch('/api/system/info').then(r => r.json());
    if (!res.success) return;

    const d = res.data;
    document.getElementById('info-node').textContent = d.nodeVersion;
    document.getElementById('info-memory').textContent = `${d.memoryMB.heapUsed} MB / ${d.memoryMB.heapTotal} MB`;
    document.getElementById('info-uptime').textContent = `${Math.floor(d.uptimeSeconds / 60)} phút`;
    document.getElementById('info-platform').textContent = d.platform;
    document.getElementById('sys-node-version').textContent = d.nodeVersion;
  } catch (err) {
    console.error('Lỗi nạp system info:', err);
  }
}

// Airdrop Handlers
function toggleAirdropInputs(val) {
  const silverBox = document.getElementById('airdrop-silver-box');
  const itemBox = document.getElementById('airdrop-item-box');
  if (val === 'silver') {
    silverBox.classList.remove('hidden');
    itemBox.classList.add('hidden');
  } else {
    silverBox.classList.add('hidden');
    itemBox.classList.remove('hidden');
  }
}

async function handleAirdropSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('airdrop-type').value;

  let body = { type };
  if (type === 'silver') {
    body.amount = Number(document.getElementById('airdrop-silver-amount').value);
  } else {
    const presetIdx = document.getElementById('airdrop-preset-select').value;
    if (presetIdx === '') {
      showToast('Vui lòng chọn vật phẩm muốn airdrop!', 'warning');
      return;
    }
    const preset = state.itemPresets[Number(presetIdx)];
    body.item_type = preset.item_type;
    body.item_key = preset.item_key;
    body.item_name = preset.item_name;
    body.amount = Number(document.getElementById('airdrop-item-amount').value);
  }

  try {
    const res = await fetch('/api/batch/airdrop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message, 'success');
    closeModal('modal-airdrop');
    loadStats();
    loadPlayers();
  } catch (err) {
    showToast('Lỗi airdrop: ' + err.message, 'error');
  }
}

// ==========================================
// 14. GACHA & WISH MANAGEMENT (GENSHIN IMPACT FORMAT)
// ==========================================

async function loadGachaStats() {
  try {
    const res = await fetch('/api/gacha/stats').then(r => r.json());
    if (!res.success) return;
    const d = res.data;

    const totalEl = document.getElementById('gacha-stat-total');
    if (totalEl) totalEl.textContent = (d.totalItems || 0).toLocaleString();

    let count5 = 0, count4 = 0, count3 = 0;
    (d.rarities || []).forEach(r => {
      if (Number(r.rarity) === 5) count5 = Number(r.cnt);
      if (Number(r.rarity) === 4) count4 = Number(r.cnt);
      if (Number(r.rarity) === 3) count3 = Number(r.cnt);
    });

    const el5 = document.getElementById('gacha-stat-5star');
    if (el5) el5.textContent = count5.toLocaleString();

    const el4 = document.getElementById('gacha-stat-4star');
    if (el4) el4.textContent = count4.toLocaleString();

    const el3 = document.getElementById('gacha-stat-3star');
    if (el3) el3.textContent = count3.toLocaleString();

    const elWishes = document.getElementById('gacha-stat-wishes');
    if (elWishes) elWishes.textContent = (d.totalWishesPulled || 0).toLocaleString();
  } catch (err) {
    console.error('Lỗi tải thống kê gacha:', err);
  }
}

async function loadGachaItems() {
  const tbody = document.getElementById('gacha-table-body');
  if (!tbody) return;

  const search = document.getElementById('gacha-search')?.value?.trim() || '';
  const item_type = document.getElementById('gacha-filter-type')?.value || '';
  const rarity = document.getElementById('gacha-filter-rarity')?.value || '';
  const banner_type = document.getElementById('gacha-filter-banner')?.value || '';
  const is_active = document.getElementById('gacha-filter-active')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (item_type) params.append('item_type', item_type);
  if (rarity) params.append('rarity', rarity);
  if (banner_type) params.append('banner_type', banner_type);
  if (is_active !== '') params.append('is_active', is_active);

  try {
    const res = await fetch(`/api/gacha/items?${params.toString()}`).then(r => r.json());
    if (!res.success) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-rose-400">Lỗi: ${res.error}</td></tr>`;
      return;
    }

    const items = res.data || [];
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400">Không tìm thấy vật phẩm nào trong Bể Cầu Nguyện!</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => {
      // Type badge
      let typeBadge = '';
      if (item.item_type === 'weapon') {
        typeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">⚔️ Linh Khí</span>';
      } else if (item.item_type === 'pet') {
        typeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🐾 Linh Thú</span>';
      } else {
        typeBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">🤝 Trợ Thủ</span>';
      }

      // Rarity stars
      let rarityBadge = '';
      if (item.rarity === 5) {
        rarityBadge = '<span class="text-amber-400 font-bold">🌟🌟🌟🌟🌟 5★</span>';
      } else if (item.rarity === 4) {
        rarityBadge = '<span class="text-purple-400 font-bold">⭐⭐⭐⭐ 4★</span>';
      } else {
        rarityBadge = '<span class="text-blue-400 font-bold">⭐⭐⭐ 3★</span>';
      }

      // Banner text
      let bannerText = '🌌 Mọi Banner';
      if (item.banner_type === 'weapon') bannerText = '⚔️ Thần Binh';
      else if (item.banner_type === 'pet') bannerText = '🐾 Vạn Thú';
      else if (item.banner_type === 'helper') bannerText = '🤝 Hộ Đạo';
      else if (item.banner_type === 'standard') bannerText = '🌌 Thường';

      const rateUpBadge = item.rate_up ? '<span class="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">🔥 RATE-UP</span>' : '';

      // Stats
      let statsText = '';
      if (item.item_type === 'weapon') {
        statsText = `Công: <b class="text-amber-400">+${Number(item.atk).toLocaleString()}</b> | Thủ: <b class="text-sky-400">+${Number(item.def).toLocaleString()}</b>`;
      } else if (item.item_type === 'pet') {
        statsText = `HP: <b>+${Number(item.hp).toLocaleString()}</b> | Công: <b class="text-amber-400">+${Number(item.atk).toLocaleString()}</b> | Thủ: <b class="text-sky-400">+${Number(item.def).toLocaleString()}</b>`;
      } else {
        statsText = item.type_detail === 'combat' ? '<span class="text-amber-300">Chiến Đấu (+Sát thương)</span>' : '<span class="text-emerald-300">Sinh Hoạt (+Treo Máy / Chợ)</span>';
      }

      // Status
      const statusBadge = item.is_active 
        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">🟢 Kích Hoạt</span>'
        : '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">🔴 Tạm Ẩn</span>';

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="text-slate-400 font-mono text-[11px]">#${item.id}</td>
          <td>
            <div class="font-bold text-slate-100 flex items-center gap-1.5">
              ${safeImageUrl(item.image_url) ? `<img src="${escapeHtml(safeImageUrl(item.image_url))}" alt="" class="w-10 h-10 rounded object-cover">` : ''}
              <span>${item.name}</span>
            </div>
            <div class="mt-1">${typeBadge}</div>
          </td>
          <td>${rarityBadge}</td>
          <td>
            <div class="text-slate-300 text-xs">${bannerText}</div>
            ${rateUpBadge}
          </td>
          <td>
            <div class="text-xs">Bậc <b class="text-amber-400">${item.tier}</b></div>
            <div class="text-[11px] text-slate-400">Hệ: <span class="text-sky-300">${item.element || 'Hỏa'}</span></div>
          </td>
          <td class="text-xs text-slate-300">${statsText}</td>
          <td class="max-w-[200px]">
            ${item.effect_name ? `<div class="text-xs font-semibold text-amber-300">${item.effect_name}</div>` : ''}
            <div class="text-[11px] text-slate-400 truncate" title="${item.effect_desc}">${item.effect_desc || 'Không có'}</div>
          </td>
          <td>${statusBadge}</td>
          <td class="text-right whitespace-nowrap">
            <button onclick="toggleGachaActive(${item.id})" title="${item.is_active ? 'Tạm ẩn' : 'Kích hoạt'}" class="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition">
              <i class="fa-solid ${item.is_active ? 'fa-eye-slash text-amber-400' : 'fa-eye text-emerald-400'}"></i>
            </button>
            <button onclick="openEditGachaModal(${item.id})" title="Chỉnh sửa" class="p-1.5 rounded hover:bg-slate-700 text-sky-400 hover:text-sky-300 transition">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="deleteGachaItem(${item.id})" title="Xóa" class="p-1.5 rounded hover:bg-slate-700 text-rose-400 hover:text-rose-300 transition">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Lỗi tải danh sách gacha items:', err);
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-rose-400">Lỗi nạp dữ liệu: ${err.message}</td></tr>`;
  }
}

function handleGachaTypeChange() {
  const type = document.getElementById('gacha-type')?.value || 'weapon';
  const elementGroup = document.getElementById('gacha-element-group');
  const typeDetailGroup = document.getElementById('gacha-type-detail-group');
  const typeDetailLabel = document.getElementById('gacha-type-detail-label');
  const typeDetailSelect = document.getElementById('gacha-type-detail');

  if (type === 'weapon') {
    if (elementGroup) elementGroup.classList.remove('hidden');
    if (typeDetailGroup) typeDetailGroup.classList.add('hidden');
  } else if (type === 'pet') {
    if (elementGroup) elementGroup.classList.remove('hidden');
    if (typeDetailGroup) {
      typeDetailGroup.classList.remove('hidden');
      if (typeDetailLabel) typeDetailLabel.textContent = 'Dòng Dị Thú:';
      if (typeDetailSelect) {
        typeDetailSelect.innerHTML = `
          <option value="mythic">🐉 Thần Thoại</option>
          <option value="normal">🐾 Thường / Thượng Cổ</option>
        `;
      }
    }
  } else if (type === 'helper') {
    if (elementGroup) elementGroup.classList.add('hidden');
    if (typeDetailGroup) {
      typeDetailGroup.classList.remove('hidden');
      if (typeDetailLabel) typeDetailLabel.textContent = 'Phân Loại Trợ Thủ:';
      if (typeDetailSelect) {
        typeDetailSelect.innerHTML = `
          <option value="combat">⚔️ Chiến Đấu (Hộ Đạo Giả)</option>
          <option value="life">🌾 Sinh Hoạt (Đạo Đồng Treo Máy)</option>
        `;
      }
    }
  }
}

function openCreateGachaModal() {
  const form = document.getElementById('form-gacha');
  if (form) form.reset();

  document.getElementById('gacha-form-id').value = '';
  document.getElementById('gacha-modal-title').innerHTML = '<span>✨</span> Thêm Vật Phẩm Mới Vào Bể Cầu Nguyện';
  document.getElementById('gacha-type').value = 'weapon';
  document.getElementById('gacha-rarity').value = '5';
  document.getElementById('gacha-banner').value = 'all';
  document.getElementById('gacha-rate-up').value = '0';
  document.getElementById('gacha-tier').value = '5';
  document.getElementById('gacha-hp').value = '0';
  document.getElementById('gacha-atk').value = '1000';
  document.getElementById('gacha-def').value = '500';
  document.getElementById('gacha-speed').value = '50';
  document.getElementById('gacha-crit').value = '0.05';
  document.getElementById('gacha-is-active').value = '1';
  document.getElementById('gacha-image-url').value = '';

  handleGachaTypeChange();
  openModal('modal-gacha-form');
}

async function openEditGachaModal(id) {
  try {
    const res = await fetch(`/api/gacha/items/${id}`).then(r => r.json());
    if (!res.success) {
      showToast('Không thể nạp thông tin vật phẩm: ' + res.error, 'error');
      return;
    }

    const item = res.data;
    document.getElementById('gacha-form-id').value = item.id;
    document.getElementById('gacha-modal-title').innerHTML = `<span>✏️</span> Chỉnh Sửa Vật Phẩm #${item.id} - ${item.name}`;
    document.getElementById('gacha-name').value = item.name || '';
    document.getElementById('gacha-type').value = item.item_type || 'weapon';
    document.getElementById('gacha-rarity').value = item.rarity || 3;
    document.getElementById('gacha-banner').value = item.banner_type || 'all';
    document.getElementById('gacha-rate-up').value = item.rate_up ? '1' : '0';
    document.getElementById('gacha-tier').value = item.tier || 1;
    document.getElementById('gacha-element').value = item.element || 'Hỏa';
    document.getElementById('gacha-hp').value = item.hp || 0;
    document.getElementById('gacha-atk').value = item.atk || 0;
    document.getElementById('gacha-def').value = item.def || 0;
    document.getElementById('gacha-speed').value = item.speed || 0;
    document.getElementById('gacha-crit').value = item.crit || 0.05;
    document.getElementById('gacha-effect-name').value = item.effect_name || '';
    document.getElementById('gacha-effect-desc').value = item.effect_desc || '';
    document.getElementById('gacha-image-url').value = item.image_url || '';
    document.getElementById('gacha-is-active').value = item.is_active ? '1' : '0';

    handleGachaTypeChange();
    if (document.getElementById('gacha-type-detail')) {
      document.getElementById('gacha-type-detail').value = item.type_detail || 'combat';
    }

    openModal('modal-gacha-form');
  } catch (err) {
    showToast('Lỗi khi mở form chỉnh sửa: ' + err.message, 'error');
  }
}

async function handleGachaFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('gacha-form-id').value;
  const body = {
    name: document.getElementById('gacha-name').value.trim(),
    item_type: document.getElementById('gacha-type').value,
    rarity: Number(document.getElementById('gacha-rarity').value),
    banner_type: document.getElementById('gacha-banner').value,
    rate_up: Number(document.getElementById('gacha-rate-up').value),
    tier: Number(document.getElementById('gacha-tier').value),
    element: document.getElementById('gacha-element').value,
    type_detail: document.getElementById('gacha-type-detail')?.value || 'combat',
    hp: Number(document.getElementById('gacha-hp').value) || 0,
    atk: Number(document.getElementById('gacha-atk').value) || 0,
    def: Number(document.getElementById('gacha-def').value) || 0,
    speed: Number(document.getElementById('gacha-speed').value) || 0,
    crit: Number(document.getElementById('gacha-crit').value) || 0.05,
    effect_name: document.getElementById('gacha-effect-name').value.trim(),
    effect_desc: document.getElementById('gacha-effect-desc').value.trim(),
    image_url: document.getElementById('gacha-image-url').value.trim(),
    is_active: Number(document.getElementById('gacha-is-active').value)
  };

  try {
    const url = id ? `/api/gacha/items/${id}` : '/api/gacha/items';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());

    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    showToast(res.message || 'Thao tác thành công!', 'success');
    closeModal('modal-gacha-form');
    loadGachaStats();
    loadGachaItems();
  } catch (err) {
    showToast('Lỗi gửi biểu mẫu: ' + err.message, 'error');
  }
}

async function toggleGachaActive(id) {
  try {
    const res = await fetch(`/api/gacha/items/${id}/toggle`, { method: 'PATCH' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadGachaStats();
    loadGachaItems();
  } catch (err) {
    showToast('Lỗi thay đổi trạng thái: ' + err.message, 'error');
  }
}

async function deleteGachaItem(id) {
  if (!confirm(`Đạo hữu có chắc chắn muốn xóa vĩnh viễn vật phẩm Gacha ID #${id} khỏi Bể Cầu Nguyện?`)) return;

  try {
    const res = await fetch(`/api/gacha/items/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.message, 'success');
    loadGachaStats();
    loadGachaItems();
  } catch (err) {
    showToast('Lỗi xóa vật phẩm: ' + err.message, 'error');
  }
}

function openSimulateGachaModal() {
  openModal('modal-gacha-simulate');
}

async function runGachaSimulation(count = 10) {
  const bannerType = document.getElementById('sim-banner-type')?.value || 'standard';
  const container = document.getElementById('sim-results-container');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-8 text-amber-400 animate-pulse">
      <i class="fa-solid fa-spinner fa-spin text-3xl mb-2"></i>
      <div>Đang triệu hoán linh quang từ Thiên Đạo Đài...</div>
    </div>
  `;

  try {
    const res = await fetch('/api/gacha/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banner_type: bannerType, count })
    }).then(r => r.json());

    if (!res.success) {
      container.innerHTML = `<div class="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-center">Lỗi: ${res.error}</div>`;
      return;
    }

    const { results, highestRarity, finalPity4, finalPity5 } = res.data;

    let highestBadge = '🔵 Ánh Lam Linh Quang (3★)';
    if (highestRarity === 5) {
      highestBadge = '🌟✨ KIM QUANG GIÁNG THẾ (5★ HOÀNG KIM) ✨🌟';
    } else if (highestRarity === 4) {
      highestBadge = '🟣✨ TỬ SẮC KỲ DUYÊN (4★ TIÊN PHẨM) ✨🟣';
    }

    const cardsHtml = results.map(item => {
      let cardClass = 'gacha-card-3';
      let starStr = '⭐⭐⭐';
      let borderGlow = 'border-blue-500/30';
      let textCol = 'text-blue-300';

      if (item.rarity === 5) {
        cardClass = 'gacha-card-5 wish-glow-5';
        starStr = '🌟🌟🌟🌟🌟';
        borderGlow = 'border-amber-500/60';
        textCol = 'text-amber-400 font-bold';
      } else if (item.rarity === 4) {
        cardClass = 'gacha-card-4';
        starStr = '⭐⭐⭐⭐';
        borderGlow = 'border-purple-500/50';
        textCol = 'text-purple-300 font-bold';
      }

      let typeIcon = '⚔️';
      let typeLabel = 'Linh Khí';
      if (item.item_type === 'pet') {
        typeIcon = '🐾';
        typeLabel = 'Linh Thú';
      } else if (item.item_type === 'helper') {
        typeIcon = '🤝';
        typeLabel = 'Trợ Thủ';
      }

      return `
        <div class="rounded-xl p-3 text-xs flex flex-col justify-between ${cardClass}">
          <div>
            <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>${typeIcon} ${typeLabel}</span>
              <span class="text-amber-400">Bậc ${item.tier}</span>
            </div>
            <div class="${textCol} text-sm mb-1">${item.name}</div>
            <div class="text-[11px] mb-2">${starStr}</div>
            <div class="text-[11px] text-slate-300 line-clamp-2" title="${item.effect_desc}">${item.effect_name ? `<b>${item.effect_name}:</b> ` : ''}${item.effect_desc}</div>
          </div>
          <div class="mt-2 pt-2 border-t border-slate-700/40 text-[10px] text-slate-400 flex justify-between">
            <span>Hệ: ${item.element || 'Không'}</span>
            ${item.rate_up ? '<span class="text-rose-400 font-bold">🔥 Rate-up</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between">
        <div>
          <div class="text-xs text-slate-400">Kết quả đắc được (${results.length} lượt):</div>
          <div class="text-sm font-bold text-amber-300">${highestBadge}</div>
        </div>
        <div class="text-xs text-slate-300 text-right">
          <div>Pity 5★ mô phỏng: <b class="text-amber-400">${finalPity5}/90</b></div>
          <div>Pity 4★ mô phỏng: <b class="text-purple-400">${finalPity4}/10</b></div>
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        ${cardsHtml}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-center">Lỗi: ${err.message}</div>`;
  }
}

// ==========================================
// 15. UI HELPERS & TOASTS
// ==========================================
function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('hidden');
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('hidden');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'fa-circle-check text-emerald-400',
    error: 'fa-circle-exclamation text-rose-400',
    warning: 'fa-triangle-exclamation text-amber-400',
    info: 'fa-circle-info text-sky-400'
  };

  const toast = document.createElement('div');
  toast.className = `toast-msg toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-base"></i>
    <span class="flex-1 text-slate-100 font-medium">${msg}</span>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
