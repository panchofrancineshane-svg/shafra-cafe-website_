/* =========================================================
   Shafra Cafe - item-modal.js  (menu page only)
   Tap a menu item -> a pop-up (<dialog>) shows its details.

   Two modes use the same pop-up:
   - item mode:   regular menu. Pick a size, add-ons and quantity,
                  then add it to the cart.
   - reward mode: secret menu. Same details, but the button spends
                  beans (Redeem) instead of adding to the cart.

   Pair it with: in item mode the customer can tick other menu items (a pastry
   with a coffee, a drink with a meal...) and add everything to the cart at once.

   Item details come from js/menu-data.js.
   ========================================================= */

(function () {
  const dialog = document.getElementById('itemDialog');
  if (!dialog || typeof MENU_ITEMS === 'undefined') return;

  const SIZE_NAMES = { S: 'Small', M: 'Medium', L: 'Large' };

  const items = {};
  MENU_ITEMS.forEach(function (item) { items[item.id] = item; });

  const $ = function (id) { return document.getElementById(id); };
  let current = null;
  let qty = 1;
  let mode = 'item';          // 'item' or 'reward'
  let armed = false;          // reward button: waiting for the second tap
  let armTimer = null;

  /* ---------- pair it with (item mode) ---------- */
  // Drinks are paired with food and food with drinks. The combo offer is already a pair.
  const DRINK_CATEGORIES = ['coffee', 'tea'];
  const FOOD_CATEGORIES = ['pastries', 'meals'];

  function kindOf(item) {
    if (DRINK_CATEGORIES.indexOf(item.category) !== -1) return 'drink';
    if (FOOD_CATEGORIES.indexOf(item.category) !== -1) return 'food';
    // offers: drinks have sizes, the combo does not
    if (item.category === 'offers' && item.sizes.length > 0) return 'drink';
    return 'other';
  }

  function pairChoices(item) {
    const kind = kindOf(item);
    if (kind === 'other') return [];
    const wanted = kind === 'drink' ? 'food' : 'drink';
    return MENU_ITEMS.filter(function (other) {
      return other.id !== item.id && other.available !== false && kindOf(other) === wanted;
    });
  }

  // Paired items are added the plain way: default size, no add-ons
  function pairLine(item, count) {
    const defaultSize = item.sizes.find(function (s) { return s[1] === 0; }) || item.sizes[0];
    return {
      id: item.id,
      name: item.name,
      image: item.image,
      size: defaultSize ? (SIZE_NAMES[defaultSize[0]] || defaultSize[0]) : '',
      addons: [],
      note: '',
      unitPrice: item.price,
      beans: item.beans,
      qty: count
    };
  }

  function checkedPairs() {
    const picked = [];
    dialog.querySelectorAll('input[name="dlgPair"]:checked').forEach(function (box) {
      if (items[box.value]) picked.push(items[box.value]);
    });
    return picked;
  }

  function buildPairs() {
    const wrap = $('dlgPairs');
    wrap.textContent = '';
    const choices = pairChoices(current);
    $('dlgPairWrap').hidden = choices.length === 0;

    choices.forEach(function (item) {
      const label = document.createElement('label');
      label.className = 'pair-option';

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.name = 'dlgPair';
      box.value = item.id;
      box.addEventListener('change', refreshTotal);

      const img = document.createElement('img');
      img.src = item.image;
      img.alt = '';
      img.loading = 'lazy';

      const name = document.createElement('span');
      name.className = 'pair-name';
      name.textContent = item.name;

      const price = document.createElement('span');
      price.className = 'pair-price';
      price.textContent = '+' + Store.peso(item.price);

      label.append(box, img, name, price);
      wrap.appendChild(label);
    });
  }

  /* ---------- price (item mode) ---------- */
  function unitPrice() {
    let price = current.price;

    const size = dialog.querySelector('input[name="dlgSize"]:checked');
    if (size) price += Number(size.dataset.delta);

    dialog.querySelectorAll('input[name="dlgAddon"]:checked').forEach(function (box) {
      price += Number(box.dataset.price);
    });
    return price;
  }

  function refreshTotal() {
    if (mode !== 'item') return;
    $('dlgQty').textContent = qty;

    const pairs = checkedPairs();
    const pairPrice = pairs.reduce(function (sum, p) { return sum + p.price; }, 0);
    const pairBeans = pairs.reduce(function (sum, p) { return sum + p.beans; }, 0);
    const beansEach = current.beans + pairBeans;

    $('dlgBeans').textContent = 'Earn +' + (beansEach * qty) + ' beans' +
      (qty > 1 ? ' (' + beansEach + ' each)' : '') + ' when your order is received';
    $('dlgAdd').textContent = (pairs.length ? 'Add ' + (pairs.length + 1) + ' items to cart' : 'Add to cart') +
      ' · ' + Store.peso((unitPrice() + pairPrice) * qty);
  }

  /* ---------- build the choices (item mode) ---------- */
  function signed(amount) {
    return (amount > 0 ? '+' : '−') + Store.peso(Math.abs(amount));
  }

  function buildSizes() {
    const wrap = $('dlgSizes');
    wrap.textContent = '';
    $('dlgSizesWrap').hidden = current.sizes.length === 0;

    const defaultIndex = Math.max(0, current.sizes.findIndex(function (s) { return s[1] === 0; }));

    current.sizes.forEach(function (size, i) {
      const label = document.createElement('label');
      label.className = 'chip-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'dlgSize';
      input.value = SIZE_NAMES[size[0]] || size[0];
      input.dataset.delta = size[1];
      input.checked = (i === defaultIndex);
      input.addEventListener('change', refreshTotal);

      const text = document.createElement('span');
      text.textContent = (SIZE_NAMES[size[0]] || size[0]) + (size[1] ? ' (' + signed(size[1]) + ')' : '');

      label.append(input, text);
      wrap.appendChild(label);
    });
  }

  function buildAddons() {
    const wrap = $('dlgAddons');
    wrap.textContent = '';
    $('dlgAddonsWrap').hidden = current.addons.length === 0;

    current.addons.forEach(function (addon) {
      const label = document.createElement('label');

      const left = document.createElement('span');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.name = 'dlgAddon';
      box.value = addon[0];
      box.dataset.price = addon[1];
      box.addEventListener('change', refreshTotal);
      left.append(box, ' ' + addon[0]);

      const right = document.createElement('span');
      right.textContent = addon[1] ? '+' + Store.peso(addon[1]) : 'Free';

      label.append(left, right);
      wrap.appendChild(label);
    });
  }

  /* ---------- parts both modes share ---------- */
  function fillCommon() {
    $('dlgImg').src = current.image;
    $('dlgImg').alt = current.name;
    $('dlgName').textContent = current.name;
    $('dlgLong').textContent = current.long;
    $('dlgIngredients').textContent = current.ingredients.join(', ');

    const allergens = $('dlgAllergens');
    if (current.allergens.length) {
      allergens.textContent = 'Contains: ' + current.allergens.join(', ');
    } else {
      allergens.textContent = mode === 'reward'
        ? ''
        : 'No common allergens listed. Ask us if you have a severe allergy.';
    }

    armed = false;
    clearTimeout(armTimer);
  }

  function showItemControls(show) {
    $('dlgNoteWrap').hidden = !show;
    $('dlgQtyBox').hidden = !show;
    if (!show) {
      $('dlgPairWrap').hidden = true;
      $('dlgSizesWrap').hidden = true;
      $('dlgAddonsWrap').hidden = true;
    }
  }

  /* ---------- open: regular item ---------- */
  function open(id) {
    current = items[id];
    if (!current) return;
    mode = 'item';
    qty = 1;

    fillCommon();
    showItemControls(true);

    $('dlgPrice').textContent = Store.peso(current.price);

    const old = $('dlgOld');
    old.textContent = current.old ? Store.peso(current.old) : '';
    old.hidden = !current.old;

    const badge = $('dlgBadge');
    badge.textContent = current.tags.join(' · ');
    badge.hidden = current.tags.length === 0;

    $('dlgNote').value = '';
    $('dlgNote').placeholder = current.notePlaceholder || 'Anything we should know? (optional)';
    $('dlgAdd').disabled = false;

    buildSizes();
    buildAddons();
    buildPairs();
    refreshTotal();

    dialog.showModal();
    dialog.scrollTop = 0;
  }

  /* ---------- open: secret-menu reward ---------- */
  function renderRewardButton() {
    const button = $('dlgAdd');
    const user = Store.currentUser();
    const info = user ? Store.beansInfo(user.email) : null;
    const balance = info ? info.balance : 0;

    armed = false;
    clearTimeout(armTimer);

    $('dlgBeans').textContent = 'Costs ' + current.cost + ' beans · You have ' + balance + ' beans';

    if (!info || !info.unlocked) {
      button.disabled = true;
      button.textContent = 'Secret menu locked';
    } else if (balance < current.cost) {
      button.disabled = true;
      button.textContent = 'Need ' + (current.cost - balance) + ' more beans';
    } else {
      button.disabled = false;
      button.textContent = 'Redeem · ' + current.cost + ' beans';
    }
  }

  function openReward(id) {
    const catalog = (typeof SECRET_ITEMS !== 'undefined') ? SECRET_ITEMS : [];
    const reward = catalog.find(function (r) { return r.id === id; });
    if (!reward) return;

    current = reward;
    mode = 'reward';

    fillCommon();
    showItemControls(false);

    const old = $('dlgOld');
    old.textContent = '';
    old.hidden = true;
    $('dlgPrice').textContent = reward.cost + ' beans';

    const badge = $('dlgBadge');
    badge.textContent = 'Secret menu';
    badge.hidden = false;

    renderRewardButton();

    dialog.showModal();
    dialog.scrollTop = 0;
  }

  // The secret menu (secret-menu.js) calls this
  window.openRewardDialog = openReward;

  /* ---------- the big button ---------- */
  function redeemReward() {
    const button = $('dlgAdd');

    // Two taps so nobody spends beans by accident
    if (!armed) {
      armed = true;
      button.textContent = 'Tap again to confirm (−' + current.cost + ' beans)';
      armTimer = setTimeout(renderRewardButton, 4000);
      return;
    }
    clearTimeout(armTimer);
    armed = false;

    const result = Store.redeem(current.id);
    if (!result.ok) {
      Store.toast(result.error);
      renderRewardButton();
      return;
    }

    dialog.close();
    Store.toast(current.name + ' redeemed! Find it under My account → orders.', 5000);
    Store.updateNav();
    document.dispatchEvent(new CustomEvent('beans:changed'));
  }

  function addToCart() {
    const size = dialog.querySelector('input[name="dlgSize"]:checked');
    const addons = [];
    dialog.querySelectorAll('input[name="dlgAddon"]:checked').forEach(function (box) {
      addons.push({ name: box.value, price: Number(box.dataset.price) });
    });

    Store.addToCart({
      id: current.id,
      name: current.name,
      image: current.image,
      size: size ? size.value : '',
      addons: addons,
      note: $('dlgNote').value.trim().slice(0, 140),
      unitPrice: unitPrice(),
      beans: current.beans,
      qty: qty
    });

    // Everything ticked under "Pair it with" goes in the same order, same quantity
    const pairs = checkedPairs();
    pairs.forEach(function (item) { Store.addToCart(pairLine(item, qty)); });

    dialog.close();
    Store.toast(pairs.length
      ? (pairs.length + 1) + ' items added to your cart: ' + current.name + ' + ' + pairs.map(function (p) { return p.name; }).join(', ')
      : qty + ' × ' + current.name + ' added to your cart', pairs.length ? 4000 : 2400);
  }

  $('dlgAdd').addEventListener('click', function () {
    if (mode === 'reward') redeemReward();
    else addToCart();
  });

  /* ---------- quantity, closing ---------- */
  $('dlgMinus').addEventListener('click', function () { if (qty > 1)  { qty--; refreshTotal(); } });
  $('dlgPlus').addEventListener('click',  function () { if (qty < 20) { qty++; refreshTotal(); } });
  $('dlgClose').addEventListener('click', function () { dialog.close(); });

  dialog.addEventListener('close', function () {
    armed = false;
    clearTimeout(armTimer);
  });

  // Clicking the dark area around the pop-up closes it. (Esc works by itself.)
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });

  /* ---------- make every regular menu item tappable ---------- */
  document.querySelectorAll('.menu-item[data-id], .card[data-id], .coupon[data-id]').forEach(function (el) {
    el.addEventListener('click', function () { open(el.dataset.id); });
    el.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(el.dataset.id);
      }
    });
  });

  // A link like menu.html#pumpkin-spice-latte opens that item directly
  if (location.hash && items[location.hash.slice(1)]) {
    open(location.hash.slice(1));
  }
})();
