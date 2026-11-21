/* ---------------------------------------------------------
   Staff accounts (demo)
   Only staff with an account can open the management panel.
   Accounts live in this browser's localStorage ("cafe_staff"), passwords
   are stored as salted SHA-256 hashes, and the first run creates the two
   demo accounts listed on the login page. A live site must do this on a
   server with a real database.
   --------------------------------------------------------- */
const STAFF_KEY = "cafe_staff";
const STAFF_SESSION_KEY = "cafe_staff_session";
const STAFF_LOCK_KEY = "cafe_staff_lock";
const DEMO_STAFF = [
    { username: "admin@shafracafe.com", name: "Admin", role: "Admin", password: "Shafra@2026" },
    { username: "staff@shafracafe.com", name: "Staff", role: "Staff", password: "Barista@2026" },];
const MAX_TRIES = 5;
const LOCK_SECONDS = 60;

function readJson(storage, key, fallback) {
    try {
        const value = JSON.parse(storage.getItem(key));
        return value === null || value === undefined ? fallback : value;
    } catch (error) {
        return fallback;}
}

async function hashStaffPassword(password, salt) {
    const data = new TextEncoder().encode(salt + ":" + password);
    if (window.crypto && window.crypto.subtle) {
        const buffer = await window.crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(buffer)).map(function (b) {
            return b.toString(16).padStart(2, "0");}).join("");
    }
    return btoa(salt + ":" + password);}

async function loadStaff() {
    let staff = readJson(localStorage, STAFF_KEY, null);
    if (staff && staff.length) return staff;
    staff = [];
    for (const person of DEMO_STAFF) {
        const salt = "s" + Math.random().toString(36).slice(2, 10);
        staff.push({
            username: person.username,
            name: person.name,
            role: person.role,
            salt: salt,
            hash: await hashStaffPassword(person.password, salt),});
    }
    localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
    return staff;}

function staffSession() {
    return readJson(sessionStorage, STAFF_SESSION_KEY, null) || readJson(localStorage, STAFF_SESSION_KEY, null);}

function staffLogout() {
    sessionStorage.removeItem(STAFF_SESSION_KEY);
    localStorage.removeItem(STAFF_SESSION_KEY);
    window.location.replace("login.html");}

const currentPage = document.body.dataset.page;

// Every page except the login page needs a signed-in staff member
if (currentPage !== "login" && !staffSession()) {
    window.location.replace("login.html");
}

if (currentPage === "login") {
    loginPage();
} else if (currentPage === "orders") {
    ordersPage();
} else if (currentPage === "qr-generator") {
    qrGeneratorPage();
} else if (currentPage === "menu-items") {
    menuItemsPage();
} else if (currentPage === "hidden-menu-items") {
    hiddenMenuItemsPage();
} else if (currentPage === "sales-report") {
    salesReportPage();
} else if (currentPage === "best-sellers") {
    bestSellersPage();}

if (currentPage !== "login") addLogoutLink();

// "Signed in as ..." and a Log out link at the bottom of the sidebar
function addLogoutLink() {
    const session = staffSession();
    const side = document.querySelector(".side");
    if (!side || !session) return;
    const who = document.createElement("small");
    who.textContent = "Signed in as " + session.name + " (" + session.role + ")";
    side.appendChild(who);
    const link = document.createElement("a");
    link.href = "login.html";
    link.className = "logout";
    link.textContent = "Log out";
    link.onclick = function (event) {
        event.preventDefault();
        staffLogout();};
    side.appendChild(link);}

function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");}

function loginPage() {
    const loginForm = document.getElementById("loginForm");
    const forgotButton = document.getElementById("forgot");
    const userBox = document.getElementById("user");
    const passBox = document.getElementById("pass");
    const error = document.getElementById("err");

    // Already signed in: go straight to the panel
    if (staffSession()) {
        window.location.replace("orders.html");
        return;}

    forgotButton.onclick = function () {
        alert("Please contact your manager to reset your password.");};

    function fieldProblem(box, message) {
        document.getElementById(box.id + "Err").textContent = message;
        box.classList.toggle("invalid", message !== "");
        box.setAttribute("aria-invalid", message !== "" ? "true" : "false");
        return message === "";}

    function userProblem() {
        const value = userBox.value.trim();
        if (value === "") return "Please enter your username or email.";
        if (value.length > 254) return "That username is too long.";
        if (value.indexOf("@") !== -1 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return "Please enter a valid email address.";
        if (/\s/.test(value)) return "Your username cannot contain spaces.";
        return "";}

    function passProblem() {
        if (passBox.value === "") return "Please enter your password.";
        return "";}

    userBox.onblur = function () { if (userBox.value !== "") fieldProblem(userBox, userProblem()); };
    userBox.oninput = function () { if (userBox.classList.contains("invalid")) fieldProblem(userBox, userProblem()); };
    passBox.oninput = function () { if (passBox.classList.contains("invalid")) fieldProblem(passBox, passProblem()); };

    function lockSecondsLeft() {
        const lock = readJson(localStorage, STAFF_LOCK_KEY, { tries: 0, until: 0 });
        return Math.max(0, Math.ceil((lock.until - Date.now()) / 1000));}

    loginForm.onsubmit = async function (event) {
        event.preventDefault();
        error.textContent = "";

        const goodUser = fieldProblem(userBox, userProblem());
        const goodPass = fieldProblem(passBox, passProblem());
        if (!goodUser) { userBox.focus(); return; }
        if (!goodPass) { passBox.focus(); return; }

        const wait = lockSecondsLeft();
        if (wait > 0) {
            error.textContent = "Too many wrong attempts. Try again in " + wait + " seconds.";
            return;}

        const username = userBox.value.trim().toLowerCase();
        const staff = await loadStaff();
        const person = staff.find(function (p) { return p.username === username; });
        const hash = person ? await hashStaffPassword(passBox.value, person.salt) : "";

        if (!person || hash !== person.hash) {
            const lock = readJson(localStorage, STAFF_LOCK_KEY, { tries: 0, until: 0 });
            lock.tries = (lock.until && lock.until < Date.now() ? 0 : lock.tries) + 1;
            if (lock.tries >= MAX_TRIES) {
                lock.tries = 0;
                lock.until = Date.now() + LOCK_SECONDS * 1000;
                error.textContent = "Too many wrong attempts. Try again in " + LOCK_SECONDS + " seconds.";
            } else {
                error.textContent = "Incorrect username or password. " + (MAX_TRIES - lock.tries) + " tries left.";}
            localStorage.setItem(STAFF_LOCK_KEY, JSON.stringify(lock));
            passBox.value = "";
            passBox.focus();
            return;}

        localStorage.removeItem(STAFF_LOCK_KEY);
        const session = JSON.stringify({ username: person.username, name: person.name, role: person.role });
        // "Keep me signed in" lasts until they log out; otherwise only until the tab closes
        const keep = document.getElementById("keep").checked;
        (keep ? localStorage : sessionStorage).setItem(STAFF_SESSION_KEY, session);
        window.location.href = "orders.html";};
}

/* ---------------------------------------------------------
   Orders page (live)
   Reads the orders customers place on the customer website
   (shared browser storage key "cafe_orders"), lets the staff
   move them along, and confirms "Received". Confirming
   Received is what gives the customer their beans.
   Demo note: both sides must be opened from the same address
   (for example VS Code Live Server started in the SHAFRA folder).
   --------------------------------------------------------- */
function ordersPage() {
    const ORDERS_KEY = "cafe_orders";
    const USERS_KEY = "cafe_users";
    const body = document.getElementById("ordersBody");
    const empty = document.getElementById("ordersEmpty");
    const filterButtons = document.querySelectorAll(".pills button");
    let filter = "All";

    function load(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch (error) {
            return [];}
    }

    function typeOf(order) {
        return order.type === "reward" ? "Reward" : order.option;}

    function tagClass(type) {
        if (type === "Pick up") return "Pickup";
        if (type === "Dine in") return "DineIn";
        if (type === "Front door delivery") return "Delivery";
        return "Reward";}

    function statusText(status, order) {
        const delivery = order && order.option === "Front door delivery";
        if (status === "Ready") return delivery ? "Out for Delivery" : "Ready for Pick-up";
        if (status === "Received") return delivery ? "Delivered" : "Completed";
        if (status === "Cancelled") return "Cancelled";
        return status;}

    function itemsText(order) {
        const lines = order.items.map(function (line) {
            return line.qty + "x " + line.name + (line.size ? " (" + line.size + ")" : "");
        });
        let text = lines.join(", ");
        if (order.delivery) {
            text += " | Deliver to: " + order.delivery.address + " (" + order.delivery.phone + ")";
            if (order.delivery.note) text += " | Note: " + order.delivery.note;
        }
        return text;}

    function changeStatus(id, value) {
        const orders = load(ORDERS_KEY);
        const order = orders.find(function (o) { return o.id === id; });
        if (!order) return;

        if (value === "Received") {
            const beansText = order.type === "reward" ? "" : " The customer will receive +" + (order.beans || 0) + " beans.";
            if (!window.confirm("Confirm that order " + id + " was received by the customer?" + beansText)) {
                draw();
                return;}
            order.receivedAt = new Date().toISOString();
        }
        if (value === "Cancelled") {
            const warning = order.type === "reward"
                ? "The customer's beans will be refunded."
                : "The customer earns no beans and their order streak resets.";
            if (!window.confirm("Mark order " + id + " as cancelled? " + warning)) {
                draw();
                return;}
            order.cancelledAt = new Date().toISOString();
        }
        order.status = value;
        order.history = (order.history || []).concat([{ status: value, at: new Date().toISOString() }]);
        localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
        draw();}

    function actionCell(order) {
        const cell = document.createElement("td");
        if (order.status === "Received" || order.status === "Cancelled") {
            cell.textContent = "Closed";
            return cell;}

        const select = document.createElement("select");
        select.className = "act";
        select.setAttribute("aria-label", "Update order " + order.id);
        const delivery = order.option === "Front door delivery";
        const choices = [
            ["Preparing", "Being prepared"],
            ["Ready", delivery ? "Out for delivery" : "Ready for pick-up"],
            ["Received", delivery ? "Mark as delivered" : "Mark as received"],
            ["Cancelled", "Mark as cancelled"],];
        for (const choice of choices) {
            const option = document.createElement("option");
            option.value = choice[0];
            option.textContent = choice[1];
            if (choice[0] === order.status) option.selected = true;
            select.appendChild(option);}
        select.onchange = function () {
            changeStatus(order.id, select.value);};
        cell.appendChild(select);
        return cell;}

    function row(order, names) {
        const tr = document.createElement("tr");
        const type = typeOf(order);

        function cell(text) {
            const td = document.createElement("td");
            td.textContent = text;
            tr.appendChild(td);
            return td;}

        cell(order.id);
        cell(names[order.email] || order.email);
        cell(itemsText(order));

        const typeCell = document.createElement("td");
        const tag = document.createElement("span");
        tag.className = "tag " + tagClass(type);
        tag.textContent = type === "Pick up" ? "Pick-up" : type === "Dine in" ? "Dine-in" : type === "Front door delivery" ? "Delivery" : "Reward";
        typeCell.appendChild(tag);
        tr.appendChild(typeCell);

        const statusCell = document.createElement("td");
        const status = document.createElement("span");
        status.className = "status " + order.status;
        status.textContent = statusText(order.status, order);
        statusCell.appendChild(status);
        tr.appendChild(statusCell);

        tr.appendChild(actionCell(order));
        return tr;}

    function draw() {
        const orders = load(ORDERS_KEY).slice().sort(function (a, b) {
            return b.createdAt.localeCompare(a.createdAt);});
        const names = {};
        for (const user of load(USERS_KEY)) names[user.email] = user.name;

        const today = new Date().toDateString();
        let open = 0, ready = 0, todayCount = 0, sales = 0;
        for (const order of orders) {
            if (order.status === "Preparing") open++;
            if (order.status === "Ready") ready++;
            if (new Date(order.createdAt).toDateString() === today) {
                todayCount++;
                if (order.type !== "reward" && order.status !== "Cancelled") sales += order.total;}
        }
        document.getElementById("statOpen").textContent = open;
        document.getElementById("statReady").textContent = ready;
        document.getElementById("statToday").textContent = todayCount;
        document.getElementById("statSales").textContent = "\u20B1" + sales;

        body.textContent = "";
        let shown = 0;
        for (const order of orders) {
            if (filter !== "All" && typeOf(order) !== filter) continue;
            body.appendChild(row(order, names));
            shown++;}
        empty.hidden = shown > 0;}

    for (const button of filterButtons) {
        button.onclick = function () {
            for (const other of filterButtons) other.classList.remove("on");
            button.classList.add("on");
            filter = button.dataset.f;
            draw();};
    }

    // A new order from the customer side shows up without reloading
    window.addEventListener("storage", function (event) {
        if (event.key === ORDERS_KEY || event.key === null) draw();});

    draw();
}

function qrGeneratorPage() {
    const newStatus = {
        "Mark As Being Prepared": "Preparing",
        "Mark As Ready for Pick-up": "Ready for Pick-up",
        "Mark As Done": "Completed",
        "Mark As Cancelled": "Cancelled",};

    document.getElementById("processButton").onclick = function () {
        const status = newStatus[document.getElementById("action").value];
        document.getElementById("status").textContent = status;
        document.getElementById("message").textContent = "Order 4769 updated to " + status + ".";};
}

function salesReportPage() {
    const todayOrders = [
        { date: "Sept 5, 2026", id: 4769, type: "Grab", amount: 135, completed: true },
        { date: "Sept 5, 2026", id: 4770, type: "Pick-up", amount: 155, completed: true },
        { date: "Sept 5, 2026", id: 4771, type: "FoodPanda", amount: 115, completed: true },
        { date: "Sept 5, 2026", id: 4772, type: "Pick-up", amount: 135, completed: true },
        { date: "Sept 5, 2026", id: 4773, type: "FoodPanda", amount: 560, completed: false },];

    const earlierOrders = [
        { date: "Sept 4, 2026", id: 4765, type: "Grab", amount: 270, completed: true },
        { date: "Sept 4, 2026", id: 4766, type: "Pick-up", amount: 135, completed: true },
        { date: "Sept 3, 2026", id: 4762, type: "FoodPanda", amount: 210, completed: true },
        { date: "Sept 2, 2026", id: 4758, type: "Pick-up", amount: 150, completed: false },];

    const tableBody = document.getElementById("tableBody");
    const periodButtons = document.querySelectorAll(".tog");

    function showSales(period) {
        let orders = todayOrders;
        if (period === "week") {
            orders = todayOrders.concat(earlierOrders);}

        let sales_table = "";
        let revenue = 0;
        let cancelled = 0;

        for (const order of orders) {
            let typeClass = order.type;
            if (order.type === "Pick-up") {
                typeClass = "Pickup";}

            let statusClass = "drop";
            let statusText = "Cancelled";
            if (order.completed) {
                statusClass = "done";
                statusText = "Completed";
                revenue = revenue + order.amount;
            } else {
                cancelled = cancelled + 1; }

            sales_table += "<tr>";
            sales_table += "<td>" + order.date + "</td>";
            sales_table += "<td>" + order.id + "</td>";
            sales_table += "<td><span class='tag " + typeClass + "'>" + order.type + "</span></td>";
            sales_table += "<td>&#8369;" + order.amount + "</td>";
            sales_table += "<td><span class='st " + statusClass + "'>" + statusText + "</span></td>";
            sales_table += "</tr>";}

        tableBody.innerHTML = sales_table;
        document.getElementById("totalOrders").textContent = orders.length;
        document.getElementById("totalRevenue").innerHTML = "&#8369;" + revenue;
        document.getElementById("totalDropped").textContent = cancelled;
    }

    function selectPeriod(clickedButton) {
        for (const button of periodButtons) {
            button.classList.remove("on"); }
        clickedButton.classList.add("on");
        showSales(clickedButton.dataset.r);
    }

    for (const button of periodButtons) {
        button.onclick = function () {
            selectPeriod(button);};
    }

    showSales("today");
}

function bestSellersPage() {
    const products = [
        { name: "Iced Latte", category: "Drinks", price: 135, today: 6, week: 20 },
        { name: "Butter Croissant", category: "Pastry", price: 150, today: 4, week: 14 },
        { name: "Spanish Latte", category: "Drinks", price: 135, today: 3, week: 14 },
        { name: "Ube Latte", category: "Drinks", price: 135, today: 5, week: 13 },
        { name: "Cookie Swirl", category: "Pastry", price: 150, today: 2, week: 11 } ];

    const tableBody = document.getElementById("tableBody");
    const timeButtons = document.querySelectorAll("[data-t]");
    const categoryButtons = document.querySelectorAll("[data-c]");

    let period = "week";
    let category = "All";

    function drawTable() {
        const filtered_products = [];
        for (const product of products) {
            if (category === "All" || product.category === category) {
                filtered_products.push(product); }
        }

        filtered_products.sort(function (a, b) {
            return b[period] - a[period];});

        let best_sellers_table = "";
        for (let i = 0; i < filtered_products.length; i++) {
            const product = filtered_products[i];
            const sold = product[period];
            best_sellers_table += "<tr>";
            best_sellers_table += "<td>" + (i + 1) + "</td>";
            best_sellers_table += "<td>" + product.name + "</td>";
            best_sellers_table += "<td><span class='cat " + product.category + "'>" + product.category + "</span></td>";
            best_sellers_table += "<td>" + sold + "</td>";
            best_sellers_table += "<td>&#8369;" + sold * product.price + "</td>";
            best_sellers_table += "</tr>"; }
        tableBody.innerHTML = best_sellers_table;
    }

    function highlight(buttons, clickedButton) {
        for (const button of buttons) {
            button.classList.remove("on");   }
        clickedButton.classList.add("on");
    }

    for (const button of timeButtons) {
        button.onclick = function () {
            period = button.dataset.t;
            highlight(timeButtons, button);
            drawTable();  };
    }

    for (const button of categoryButtons) {
        button.onclick = function () {
            category = button.dataset.c;
            highlight(categoryButtons, button);
            drawTable(); };
    }
    drawTable();
}
