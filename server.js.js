const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

const ADMIN_CREDENTIALS = {
    email: "mdhasibul652@gmail.com",
    password: "khan1234"
};

let adminPaymentNumbers = {
    bkash: "01700000000",
    nagad: "01800000000"
};

let coupons = {
    "EID2026": { discountPercent: 10, minSpend: 0 }
};

const CATEGORIES = [
    "ইলেকট্রনিক্স (Electronics)",
    "ফ্যাশন ও পোশাক (Fashion)",
    "স্পোর্টস ও ফিটনেস (Sports)",
    "গ্রোসারি ও খাবার (Grocery)",
    "মোবাইল ও এক্সেসরিজ (Mobile)",
    "ঘরকন্না ও লাইফস্টাইল (Home & Living)"
];

let products = [];
let orders = [];
let reviews = [];         // লাইভ রিভিউ
let pendingReviews = [];  // মডারেশনের অপেক্ষায় থাকা রিভিউ
let broadcastMessages = []; // কাস্টমারদের জন্য ব্রডকাস্ট নোটিফিকেশন
let chatMessages = [];
let userProfiles = {};
let userPasswords = {}; 
let userCarts = {}; 
let userWishlists = {}; 

function isSimilarWord(str1, str2) {
    if (!str1 || !str2) return false;
    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();

    if (str1.includes(str2) || str2.includes(str1)) return true;

    const track = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= str2.length; j += 1) {
        for (let i = 1; i <= str1.length; i += 1) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1,
                track[j - 1][i] + 1,
                track[j - 1][i - 1] + indicator,
            );
        }
    }
    const distance = track[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return ((maxLength - distance) / maxLength) >= 0.45;
}

function checkAuth(req, res, next) {
    const userCookie = req.cookies.loggedInUser;
    if (userCookie) {
        try { req.user = JSON.parse(userCookie); } catch (e) { req.user = null; }
    }
    next();
}
app.use(checkAuth);

// ==========================================
// ১. লগইন ও রেজিস্ট্রেশন পেজ
// ==========================================
app.get('/', (req, res) => {
    if (req.user) {
        return res.redirect(req.user.role === 'admin' ? '/admin-dashboard' : '/user-dashboard');
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="bn">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>লগইন - দারাজ শপ</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 90vh; }
                .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); width: 100%; max-width: 350px; }
                input { width: 92%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; }
                button { width: 100%; padding: 12px; background: #f57224; color: white; border: none; font-size: 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2 style="text-align:center; color:#f57224;">দারাজ শপ লগইন</h2>
                <form action="/api/login" method="POST" autocomplete="off">
                    <input type="email" name="email" placeholder="ইমেইল (যেমন: user@gmail.com)" required><br>
                    <input type="password" name="password" placeholder="পাসওয়ার্ড" required><br>
                    <button type="submit">প্রবেশ করুন</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (email === ADMIN_CREDENTIALS.email) {
        if (password === ADMIN_CREDENTIALS.password) {
            const adminUser = { email: email, role: 'admin' };
            res.cookie('loggedInUser', JSON.stringify(adminUser), { maxAge: 30 * 24 * 60 * 60 * 1000 });
            return res.redirect('/admin-dashboard');
        } else {
            return res.send('<h3 style="color:red; text-align:center;">ভুল এডমিন পাসওয়ার্ড!</h3><a href="/">ফিরে যান</a>');
        }
    }

    if (!userPasswords[email]) {
        userPasswords[email] = password; 
    } else if (userPasswords[email] !== password) {
        return res.send('<h3 style="color:red; text-align:center;">ভুল পাসওয়ার্ড!</h3><a href="/">ফিরে যান</a>');
    }

    if (!userProfiles[email]) userProfiles[email] = { name: '', phone: '', address: '' };
    if (!userCarts[email]) userCarts[email] = [];
    if (!userWishlists[email]) userWishlists[email] = [];

    const loggedUser = { email, role: 'user' };
    res.cookie('loggedInUser', JSON.stringify(loggedUser), { maxAge: 30 * 24 * 60 * 60 * 1000 });
    return res.redirect('/user-dashboard');
});

app.get('/logout', (req, res) => {
    res.clearCookie('loggedInUser');
    res.redirect('/');
});

// ==========================================
// ২. এডমিন ড্যাশবোর্ড (রিভিউ মডারেশন ও ব্রডকাস্ট ফিচার সহ)
// ==========================================
app.get('/admin-dashboard', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');

    const orderFilter = req.query.orderFilter || '';
    const orderSearch = req.query.orderSearch ? req.query.orderSearch.trim().toLowerCase() : '';

    let totalOrdersCount = orders.length;
    let totalRevenue = orders.reduce((sum, o) => sum + Number(o.price), 0);
    let totalProductsCount = products.length;
    let outOfStockCount = products.filter(p => !p.inStock).length;
    let inStockCount = totalProductsCount - outOfStockCount;

    let lowStockProducts = products.filter(p => p.inStock && (p.stockCount !== undefined && p.stockCount <= 5));
    let lowStockAlertHTML = lowStockProducts.length > 0 ? `
        <div style="background:#fff3cd; border:1px solid #ffeeba; color:#856404; padding:12px; border-radius:6px; margin-bottom:15px; font-size:13px;">
            ⚠️ <b>লো স্টক ওয়ার্নিং:</b> নিচের পণ্যগুলোর স্টক ৫ বা তার নিচে নেমে এসেছে:
            <ul style="margin:5px 0 0 15px; padding:0;">
                ${lowStockProducts.map(p => `<li><b>${p.name}</b> (স্টক বাকি: ${p.stockCount}টি)</li>`).join('')}
            </ul>
        </div>
    ` : '';

    let couponListHTML = Object.keys(coupons).length > 0 ? Object.entries(coupons).map(([code, c]) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:6px 10px; margin-bottom:4px; border-radius:4px; font-size:12px;">
            <span>কোড: <b>${code}</b> | ছাড়: <b>${c.discountPercent}%</b></span>
            <form action="/api/delete-coupon" method="POST" style="margin:0;">
                <input type="hidden" name="couponCode" value="${code}">
                <button type="submit" style="background:#dc3545; color:white; border:none; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:11px;">ডিলিট</button>
            </form>
        </div>
    `).join('') : '<p style="font-size:12px; color:#777;">কোনো কুপন নেই।</p>';

    // ৪. রিভিউ মডারেশন HTML
    let pendingReviewsHTML = pendingReviews.length > 0 ? pendingReviews.map((r, index) => `
        <div style="background:#f9f9f9; padding:8px; margin-bottom:6px; border-radius:4px; font-size:12px; border-left:3px solid #ffc107;">
            <b>কাস্টমার:</b> ${r.userName} | <b>রেটিং:</b> ${'⭐'.repeat(r.rating)}<br>
            <b>কমেন্ট:</b> ${r.comment}
            <div style="margin-top:5px; display:flex; gap:5px;">
                <form action="/api/approve-review" method="POST" style="margin:0;">
                    <input type="hidden" name="index" value="${index}">
                    <button type="submit" style="background:#28a745; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:11px;">অনুমোদন করুন</button>
                </form>
                <form action="/api/delete-pending-review" method="POST" style="margin:0;">
                    <input type="hidden" name="index" value="${index}">
                    <button type="submit" style="background:#dc3545; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:11px;">বাতিল</button>
                </form>
            </div>
        </div>
    `).join('') : '<p style="font-size:12px; color:#777;">মডারেশনের জন্য কোনো রিভিউ নেই।</p>';

    let categoryOptions = CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    
    let filteredOrders = orders.filter(o => {
        let matchStatus = orderFilter ? o.status === orderFilter : true;
        let matchSearch = orderSearch ? (o.orderId.toLowerCase().includes(orderSearch) || o.customerPhone.includes(orderSearch) || o.customerName.toLowerCase().includes(orderSearch)) : true;
        return matchStatus && matchSearch;
    });

    let orderList = filteredOrders.map(o => `
        <li style="margin-bottom:10px; background:#f9f9f9; padding:10px; border-radius:5px; font-size:13px; border-left:4px solid #f57224;">
            <b>অর্ডার আইডি:</b> ${o.orderId}<br>
            <b>কাস্টমার:</b> ${o.customerName} (${o.customerPhone})<br>
            <b>ঠিকানা:</b> ${o.customerAddress}<br>
            <b>পণ্য:</b> ${o.productName} - ৳${o.price}<br>
            <b>পেমেন্ট:</b> <span style="color:#f57224; font-weight:bold;">${o.paymentMethod}</span>
            ${o.paymentMethod !== 'Cash on Delivery' ? `<br><b>প্রেরক নম্বর:</b> ${o.senderPhone} | <b>TrxID:</b> ${o.trxId}` : ''}<br>
            <b>বর্তমান স্ট্যাটাস:</b> <span style="color:green; font-weight:bold;">${o.status}</span>
            <form action="/api/update-order-status" method="POST" style="margin-top:6px; display:inline;">
                <input type="hidden" name="orderId" value="${o.orderId}">
                <select name="status" onchange="this.form.submit()" style="padding:3px; font-size:11px;">
                    <option value="প্রক্রিয়াদীন" ${o.status === 'প্রক্রিয়াদীন' ? 'selected' : ''}>প্রক্রিয়াদীন (Processing)</option>
                    <option value="শিপমেন্ট হয়েছে" ${o.status === 'শিপমেন্ট হয়েছে' ? 'selected' : ''}>শিপমেন্ট হয়েছে (Shipped)</option>
                    <option value="ডেলিভারি সম্পন্ন" ${o.status === 'ডেলিভারি সম্পন্ন' ? 'selected' : ''}>ডেলিভারি সম্পন্ন (Delivered)</option>
                    <option value="বাতিল" ${o.status === 'বাতিল' ? 'selected' : ''}>বাতিল (Cancelled)</option>
                </select>
            </form>
        </li>
    `).join('');

    let customerListHTML = Object.keys(userProfiles).length > 0 ? Object.entries(userProfiles).map(([email, prof]) => `
        <div style="background:#f8f9fa; padding:8px; margin-bottom:5px; border-radius:4px; font-size:12px; border-bottom:1px solid #ddd;">
            <b>নাম:</b> ${prof.name || 'নাম নেই'} | <b>ফোন:</b> ${prof.phone || 'নেই'} <br>
            <b>ইমেইল:</b> ${email} | <b>ঠিকানা:</b> ${prof.address || 'নেই'}
        </div>
    `).join('') : '<p style="font-size:12px; color:#777;">কোনো কাস্টমার রেজিস্টার্ড নেই।</p>';

    let chatHTML = chatMessages.map(c => `<p><b>${c.sender}:</b> ${c.text}</p>`).join('');

    let productListHTML = products.map(p => `
        <div class="product-card">
            <img src="${p.mainImage}" alt="${p.name}">
            <h4>${p.name} ${p.inStock ? '' : '<span style="color:red; font-size:11px;">(স্টক শেষ)</span>'}</h4>
            <p class="price">৳${p.price}</p>
            <p style="font-size:11px; margin:2px 0; color:#555;">স্টক: ${p.stockCount ?? 10}টি</p>
            <div style="margin-top:5px; display:flex; gap:3px; justify-content:center;">
                <form action="/api/toggle-stock" method="POST" style="display:inline;">
                    <input type="hidden" name="productId" value="${p.id}">
                    <button type="submit" style="background:${p.inStock ? '#ffc107' : '#28a745'}; border:none; padding:4px 6px; font-size:10px; border-radius:3px; cursor:pointer;">${p.inStock ? 'স্টক শেষ' : 'স্টক ইন'}</button>
                </form>
                <form action="/api/delete-product" method="POST" style="display:inline;" onsubmit="return confirm('ডিলিট করতে চান?');">
                    <input type="hidden" name="productId" value="${p.id}">
                    <button type="submit" style="background:#dc3545; color:white; border:none; padding:4px 6px; font-size:10px; border-radius:3px; cursor:pointer;">ডিলিট</button>
                </form>
            </div>
        </div>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>এডমিন ড্যাশবোর্ড - হাসিবুল শপ</title>
            <style>
                body { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; }
                .header { background:#343a40; color:white; padding:15px; display:flex; justify-content:space-between; align-items:center; }
                .container { padding:15px; }
                .card { background:white; padding:15px; margin-bottom:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); }
                .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px; }
                .stat-box { background: #f8f9fa; border: 1px solid #ddd; padding: 10px; border-radius: 6px; text-align: center; }
                .stat-box h4 { margin: 0 0 5px 0; font-size: 13px; color: #555; }
                .stat-box p { margin: 0; font-size: 16px; font-weight: bold; color: #f57224; }
                .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
                .product-card { border:1px solid #eee; padding:8px; border-radius:5px; text-align:center; background:#fff; }
                .product-card img { width:100%; height:90px; object-fit:cover; border-radius:4px; }
                .product-card h4 { margin:5px 0 2px 0; font-size:12px; }
                .price { color:#f57224; font-weight:bold; margin:0; font-size:12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h3 style="margin:0;">এডমিন প্যানেল (হাসিবুল ভাই)</h3>
                <a href="/logout" style="color:white; background:#dc3545; padding:6px 12px; text-decoration:none; border-radius:4px;">লগআউট</a>
            </div>
            <div class="container">
                ${lowStockAlertHTML}
                
                <div class="card">
                    <h3 style="margin-top:0; color:#f57224;">📊 সেলস ও স্টক অ্যানালিটিক্স</h3>
                    <div class="stats-grid">
                        <div class="stat-box"><h4>মোট অর্ডার</h4><p>${totalOrdersCount}টি</p></div>
                        <div class="stat-box"><h4>মোট বিক্রয়</h4><p>৳${totalRevenue}</p></div>
                        <div class="stat-box"><h4>স্টকে আছে</h4><p>${inStockCount}টি পণ্য</p></div>
                        <div class="stat-box"><h4>স্টক শেষ</h4><p style="color:red;">${outOfStockCount}টি পণ্য</p></div>
                    </div>
                    <a href="/api/export-sales" style="display:block; background:#17a2b8; color:white; text-align:center; padding:8px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:13px; margin-top:10px;">📥 ডাউনলোড সেলস রিপোর্ট (Excel/CSV)</a>
                </div>

                <!-- ৩. ব্রডকাস্ট নোটিফিকেশন ম্যানেজার -->
                <div class="card">
                    <h3 style="margin-top:0; color:#f57224;">📢 কাস্টমার ব্রডকাস্ট নোটিফিকেশন</h3>
                    <form action="/api/send-broadcast" method="POST">
                        <textarea name="broadcastText" placeholder="সকল কাস্টমারের জন্য কোনো বিশেষ ঘোষণা বা অফার লিখুন..." style="width:96%; padding:8px; margin:5px 0; height:50px; font-size:12px;" required></textarea><br>
                        <button type="submit" style="background:#007bff; color:white; border:none; padding:7px 12px; border-radius:4px; font-size:12px; cursor:pointer;">সবার কাছে পাঠান</button>
                    </form>
                </div>

                <!-- ৪. প্রোডাক্ট রিভিউ মডারেশন প্যানেল -->
                <div class="card">
                    <h3 style="margin-top:0; color:#f57224;">⭐ প্রোডাক্ট রিভিউ মডারেশন (${pendingReviews.length})</h3>
                    <div>${pendingReviewsHTML}</div>
                </div>

                <div class="card">
                    <h3 style="margin-top:0; color:#f57224;">🎟️ ডিসকাউন্ট কুপন ম্যানেজমেন্ট</h3>
                    <div style="margin-bottom:10px;">${couponListHTML}</div>
                    <form action="/api/add-coupon" method="POST" style="display:flex; gap:5px;">
                        <input type="text" name="code" placeholder="কোড (যেমন: EID50)" style="flex:1; padding:7px; font-size:12px;" required>
                        <input type="number" name="discountPercent" placeholder="ছাড় (%)" style="width:70px; padding:7px; font-size:12px;" required>
                        <button type="submit" style="background:#28a745; color:white; border:none; padding:7px 12px; border-radius:4px; font-size:12px; cursor:pointer;">কুপন যুক্ত করুন</button>
                    </form>
                </div>

                <div class="card">
                    <h3>বিকাশ ও নগদ নম্বর সেটআপ</h3>
                    <form action="/api/update-payment-numbers" method="POST">
                        <label>বিকাশ নম্বর:</label><input type="text" name="bkash" value="${adminPaymentNumbers.bkash}" required style="width:100%; padding:8px; margin:4px 0;"><br>
                        <label>নগদ নম্বর:</label><input type="text" name="nagad" value="${adminPaymentNumbers.nagad}" required style="width:100%; padding:8px; margin:4px 0;"><br><br>
                        <button type="submit" style="background:#007bff; color:white; padding:8px 15px; border:none; border-radius:4px;">আপডেট করুন</button>
                    </form>
                </div>

                <div class="card">
                    <h3>নতুন পণ্য আপলোড করুন</h3>
                    <form action="/api/add-product" method="POST" enctype="multipart/form-data">
                        <select name="category" style="width:100%; padding:8px; margin:5px 0;" required>${categoryOptions}</select><br>
                        <input type="text" name="name" placeholder="পণ্যের নাম" required style="width:96%; padding:8px; margin:5px 0;"><br>
                        <input type="number" name="price" placeholder="দাম (৳)" required style="width:96%; padding:8px; margin:5px 0;"><br>
                        <input type="number" name="stockCount" placeholder="স্টক পরিমাণ (যেমন: 10)" value="10" required style="width:96%; padding:8px; margin:5px 0;"><br>
                        <textarea name="description" placeholder="পণ্যের বিবরণ" style="width:96%; padding:8px; margin:5px 0; height:50px;"></textarea><br>
                        <label><b>প্রধান ছবি ও সাব ছবি দিন (সর্বোচ্চ ৫টি):</b></label><br>
                        <input type="file" name="images" accept="image/*" multiple required style="margin:5px 0;"><br><br>
                        <button type="submit" style="background:#28a745; color:white; padding:10px 20px; border:none; border-radius:4px;">পণ্য ছাড়ুন</button>
                    </form>
                </div>

                <div class="card">
                    <h3>পণ্য ম্যানেজমেন্ট</h3>
                    <div class="product-grid">${productListHTML || '<p>কোন পণ্য নেই।</p>'}</div>
                </div>

                <div class="card">
                    <h3>👥 রেজিস্টার্ড কাস্টমার তালিকা (${Object.keys(userProfiles).length} জন)</h3>
                    <div style="max-height:120px; overflow-y:scroll;">${customerListHTML}</div>
                </div>

                <div class="card">
                    <h3>📦 গ্রাহকদের অর্ডারসমূহ ও ফিল্টার</h3>
                    <form action="/admin-dashboard" method="GET" style="display:flex; gap:5px; margin-bottom:10px;">
                        <input type="text" name="orderSearch" value="${orderSearch}" placeholder="আইডি বা ফোন দিয়ে খুঁজুন..." style="flex:1; padding:6px; font-size:12px;">
                        <select name="orderFilter" style="padding:6px; font-size:12px;">
                            <option value="">সকল স্ট্যাটাস</option>
                            <option value="প্রক্রিয়াদীন" ${orderFilter === 'প্রক্রিয়াদীন' ? 'selected' : ''}>প্রক্রিয়াদীন</option>
                            <option value="শিপমেন্ট হয়েছে" ${orderFilter === 'শিপমেন্ট হয়েছে' ? 'selected' : ''}>শিপমেন্ট হয়েছে</option>
                            <option value="ডেলিভারি সম্পন্ন" ${orderFilter === 'ডেলিভারি সম্পন্ন' ? 'selected' : ''}>ডেলিভারি সম্পন্ন</option>
                            <option value="বাতিল" ${orderFilter === 'বাতিল' ? 'selected' : ''}>বাতিল</option>
                        </select>
                        <button type="submit" style="background:#f57224; color:white; border:none; padding:6px 10px; border-radius:4px; font-size:12px;">ফিল্টার</button>
                    </form>
                    <ul style="padding-left:0; list-style:none;">${orderList || '<p>কোন অর্ডার পাওয়া যায়নি।</p>'}</ul>
                </div>

                <div class="card">
                    <h3>কাস্টমার চ্যাট বক্স</h3>
                    <div style="height:100px; overflow-y:scroll; border:1px solid #ccc; padding:8px; margin-bottom:8px; font-size:13px; background:#fafafa;">${chatHTML}</div>
                    <form action="/api/admin-chat" method="POST">
                        <input type="text" name="message" placeholder="উত্তর লিখুন..." style="width:75%; padding:7px;" required>
                        <button type="submit" style="padding:7px 10px; background:#007bff; color:white; border:none; border-radius:4px;">পাঠান</button>
                    </form>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ব্রডকাস্ট রাউট
app.post('/api/send-broadcast', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    const text = req.body.broadcastText;
    if (text) {
        broadcastMessages.push({ text: text.trim(), date: new Date().toLocaleDateString() });
    }
    res.redirect('/admin-dashboard');
});

// রিভিউ মডারেশন রাউটসমূহ
app.post('/api/approve-review', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    const index = parseInt(req.body.index);
    if (pendingReviews[index]) {
        reviews.push(pendingReviews[index]);
        pendingReviews.splice(index, 1);
    }
    res.redirect('/admin-dashboard');
});

app.post('/api/delete-pending-review', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    const index = parseInt(req.body.index);
    if (pendingReviews[index]) {
        pendingReviews.splice(index, 1);
    }
    res.redirect('/admin-dashboard');
});

app.post('/api/add-coupon', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    const { code, discountPercent } = req.body;
    if (code && discountPercent) {
        coupons[code.trim().toUpperCase()] = { discountPercent: parseFloat(discountPercent), minSpend: 0 };
    }
    res.redirect('/admin-dashboard');
});

app.post('/api/delete-coupon', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    const code = req.body.couponCode;
    if (code && coupons[code]) {
        delete coupons[code];
    }
    res.redirect('/admin-dashboard');
});

app.get('/api/export-sales', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    let csvContent = "OrderId,CustomerName,Phone,Address,Product,Price,PaymentMethod,Status\n";
    orders.forEach(o => {
        csvContent += `${o.orderId},"${o.customerName}",${o.customerPhone},"${o.customerAddress}","${o.productName}",${o.price},${o.paymentMethod},${o.status}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sales_report.csv');
    res.send(csvContent);
});

app.post('/api/update-payment-numbers', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    adminPaymentNumbers.bkash = req.body.bkash;
    adminPaymentNumbers.nagad = req.body.nagad;
    res.redirect('/admin-dashboard');
});

app.post('/api/update-order-status', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    const { orderId, status } = req.body;
    let order = orders.find(o => o.orderId === orderId);
    if (order) order.status = status;
    res.redirect('/admin-dashboard');
});

app.post('/api/add-product', upload.array('images', 5), (req, res) => {
    const { category, name, price, stockCount, description } = req.body;
    const imagePaths = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];

    products.push({
        id: Date.now().toString(),
        category,
        name,
        price,
        stockCount: parseInt(stockCount) || 10,
        description: description || '',
        mainImage: imagePaths[0] || '',
        subImages: imagePaths.slice(1),
        inStock: true
    });

    res.redirect('/admin-dashboard');
});

app.post('/api/delete-product', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    products = products.filter(p => p.id !== req.body.productId);
    res.redirect('/admin-dashboard');
});

app.post('/api/toggle-stock', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    let product = products.find(p => p.id === req.body.productId);
    if (product) product.inStock = !product.inStock;
    res.redirect('/admin-dashboard');
});

// ==========================================
// ৩. ইউজার ড্যাশবোর্ড
// ==========================================
app.get('/user-dashboard', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');

    const selectedCategory = req.query.category || CATEGORIES[0];
    const searchQuery = req.query.search ? req.query.search.trim() : '';
    const trackQuery = req.query.trackId ? req.query.trackId.trim() : '';
    
    const profile = userProfiles[req.user.email] || {};
    const cart = userCarts[req.user.email] || [];
    const wishlist = userWishlists[req.user.email] || [];

    let categoryFiltered = products.filter(p => p.category === selectedCategory);
    let searchFiltered = searchQuery ? products.filter(p => isSimilarWord(p.name, searchQuery) || isSimilarWord(p.description, searchQuery)) : [];

    let trackedOrderResult = null;
    if (trackQuery) {
        trackedOrderResult = orders.find(o => o.orderId.toLowerCase() === trackQuery.toLowerCase());
    }

    let categoryMenuHTML = CATEGORIES.map(cat => {
        let isActive = selectedCategory === cat ? 'active' : '';
        return `<a href="/user-dashboard?category=${encodeURIComponent(cat)}" class="cat-chip ${isActive}">${cat}</a>`;
    }).join('');

    const renderGrid = (list) => list.map(p => `
        <div class="product-card">
            <a href="/product/${p.id}" style="text-decoration:none; color:black;">
                <div style="position:relative;">
                    <img src="${p.mainImage}" alt="${p.name}">
                    ${!p.inStock ? '<span class="stock-badge">স্টক শেষ</span>' : ''}
                </div>
                <h4 class="product-title">${p.name}</h4>
                <p class="price">৳${p.price}</p>
            </a>
            <div style="display:flex; gap:4px; margin-top:5px;">
                ${p.inStock ? `
                    <form action="/api/add-to-cart" method="POST" style="flex:1; margin:0;">
                        <input type="hidden" name="productId" value="${p.id}">
                        <button type="submit" class="cart-btn">কার্টে দিন</button>
                    </form>
                ` : ''}
                <form action="/api/add-to-wishlist" method="POST" style="margin:0;">
                    <input type="hidden" name="productId" value="${p.id}">
                    <button type="submit" style="background:#e9ecef; border:1px solid #ccc; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:12px;" title="উইশলিস্টে যোগ করুন">❤️</button>
                </form>
            </div>
        </div>
    `).join('');

    let cartHTML = cart.length > 0 ? cart.map((item, index) => `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:6px 0; font-size:13px;">
            <span>${item.name} (৳${item.price})</span>
            <form action="/api/remove-from-cart" method="POST" style="margin:0;">
                <input type="hidden" name="index" value="${index}">
                <button type="submit" style="background:#dc3545; color:white; border:none; padding:3px 6px; border-radius:3px; font-size:11px; cursor:pointer;">রিমুভ</button>
            </form>
        </div>
    `).join('') : '<p style="font-size:12px; color:#777;">আপনার কার্ট খালি।</p>';

    let wishlistHTML = wishlist.length > 0 ? wishlist.map((item, index) => `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:6px 0; font-size:13px;">
            <a href="/product/${item.id}" style="text-decoration:none; color:#333;">${item.name} (৳${item.price})</a>
            <div style="display:flex; gap:4px;">
                <form action="/api/wishlist-to-cart" method="POST" style="margin:0;">
                    <input type="hidden" name="index" value="${index}">
                    <button type="submit" style="background:#28a745; color:white; border:none; padding:3px 6px; border-radius:3px; font-size:11px; cursor:pointer;">কার্টে নিন</button>
                </form>
                <form action="/api/remove-from-wishlist" method="POST" style="margin:0;">
                    <input type="hidden" name="index" value="${index}">
                    <button type="submit" style="background:#dc3545; color:white; border:none; padding:3px 6px; border-radius:3px; font-size:11px; cursor:pointer;">ডিলিট</button>
                </form>
            </div>
        </div>
    `).join('') : '<p style="font-size:12px; color:#777;">উইশলিস্ট খালি।</p>';

    let myOrders = orders.filter(o => o.userEmail === req.user.email);
    let myOrderListHTML = myOrders.length > 0 ? myOrders.map(o => `
        <div style="background:#f9f9f9; padding:8px; margin-bottom:5px; border-radius:4px; font-size:12px; border-left:3px solid #f57224;">
            <b>অর্ডার আইডি:</b> ${o.orderId} | <b>পণ্য:</b> ${o.productName} (৳${o.price})<br>
            <b>স্ট্যাটাস:</b> <span style="color:green; font-weight:bold;">${o.status}</span>
        </div>
    `).join('') : '<p style="font-size:12px; color:#777;">কোন অর্ডার করেননি।</p>';

    let broadcastHTML = broadcastMessages.length > 0 ? broadcastMessages.map(b => `
        <div style="background:#e2f0d9; border:1px solid #c8e6c9; padding:8px; margin-bottom:5px; border-radius:4px; font-size:12px; color:#2e7d32;">
            📢 <b>এডমিন ঘোষণা:</b> ${b.text} <span style="float:right; font-size:10px; color:#666;">${b.date}</span>
        </div>
    `).join('') : '';

    let chatHTML = chatMessages.map(c => `<p style="margin:4px 0; font-size:12px;"><b>${c.sender}:</b> ${c.text}</p>`).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>দারাজ শপ - অনলাইন শপিং</title>
            <style>
                body { font-family: Arial, sans-serif; margin:0; background:#f4f4f4; padding-bottom: 40px; }
                .nav { background:#f57224; color:white; padding:12px 15px; display:flex; justify-content:space-between; align-items:center; }
                .container { padding:10px; max-width:600px; margin:auto; }
                .box { background:white; padding:15px; border-radius:8px; margin-bottom:12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .search-box { display: flex; gap: 5px; margin-bottom: 8px; }
                .search-input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
                .search-btn { background: #f57224; color: white; border: none; padding: 10px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; }
                .category-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px; margin-bottom: 10px; }
                .category-scroll::-webkit-scrollbar { display: none; }
                .cat-chip { background: #eee; color: #333; padding: 7px 12px; border-radius: 20px; text-decoration: none; font-size: 12px; white-space: nowrap; }
                .cat-chip.active { background: #f57224; color: white; font-weight: bold; }
                .product-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
                .product-card { border:1px solid #eee; padding:8px; border-radius:6px; background:#fff; text-align:left; position:relative; }
                .product-card img { width:100%; height:130px; object-fit:cover; border-radius:4px; }
                .product-title { margin:5px 0; font-size:13px; font-weight:normal; height:32px; overflow:hidden; }
                .price { color:#f57224; font-weight:bold; margin:0; font-size:14px; }
                .stock-badge { position:absolute; top:5px; left:5px; background:red; color:white; padding:2px 5px; font-size:9px; border-radius:3px; font-weight:bold; }
                .cart-btn { background:#f57224; color:white; border:none; width:100%; padding:6px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:bold; }
            </style>
        </head>
        <body>
            <div class="nav">
                <h3 style="margin:0;">🛒 দারাজ ই-কমার্স শপ</h3>
                <a href="/logout" style="color:white; background:#333; padding:5px 10px; text-decoration:none; border-radius:4px; font-size:12px;">লগআউট</a>
            </div>
            <div class="container">
                ${broadcastHTML}

                <div style="background:linear-gradient(135deg, #f57224, #ff8c42); color:white; padding:15px; border-radius:8px; text-align:center; margin-bottom:12px;">
                    <h3 style="margin:0 0 5px 0;">মেগা ডিসকাউন্ট ও ফ্রি ডেলিভারি!</h3>
                    <p style="margin:0; font-size:13px;">হাসিবুল শপ থেকে লুফে নিন সেরা অফারগুলো। (কুপন: EID2026)</p>
                </div>

                <div class="box">
                    <h4 style="margin-top:0; color:#f57224; font-size:15px;">👤 আমার প্রোফাইল, ঠিকানা ও পাসওয়ার্ড</h4>
                    <form action="/api/update-profile" method="POST">
                        <input type="text" name="name" value="${profile.name || ''}" placeholder="পূর্ণ নাম" required style="width:94%; padding:7px; margin:3px 0; border:1px solid #ddd; border-radius:4px; font-size:13px;"><br>
                        <input type="text" name="phone" value="${profile.phone || ''}" placeholder="মোবাইল নম্বর" required style="width:94%; padding:7px; margin:3px 0; border:1px solid #ddd; border-radius:4px; font-size:13px;"><br>
                        <input type="text" name="address" value="${profile.address || ''}" placeholder="পূর্ণ ডেলিভারি ঠিকানা" required style="width:94%; padding:7px; margin:3px 0; border:1px solid #ddd; border-radius:4px; font-size:13px;"><br>
                        <input type="password" name="newPassword" placeholder="নতুন পাসওয়ার্ড (ঐচ্ছিক)" style="width:94%; padding:7px; margin:3px 0; border:1px solid #ddd; border-radius:4px; font-size:13px;"><br>
                        <button type="submit" style="background:#28a745; color:white; padding:7px 12px; border:none; border-radius:4px; cursor:pointer; margin-top:4px; font-size:12px; font-weight:bold;">প্রোফাইল আপডেট করুন</button>
                    </form>
                </div>

                <div class="box">
                    <h4 style="margin-top:0; color:#f57224; font-size:15px;">🚚 অর্ডার ট্র্যাকিং করুন</h4>
                    <form action="/user-dashboard" method="GET" class="search-box">
                        <input type="text" name="trackId" value="${trackQuery}" placeholder="অর্ডার আইডি দিন (যেমন: DRZ-123456)..." class="search-input" required>
                        <button type="submit" class="search-btn" style="background:#007bff;">ট্র্যাক</button>
                    </form>
                    ${trackQuery ? `
                        <div style="background:#f8f9fa; border:1px solid #ddd; padding:10px; border-radius:6px; margin-top:8px; font-size:13px;">
                            ${trackedOrderResult ? `
                                <b>অর্ডার আইডি:</b> ${trackedOrderResult.orderId}<br>
                                <b>পণ্য:</b> ${trackedOrderResult.productName} (৳${trackedOrderResult.price})<br>
                                <b>বর্তমান স্ট্যাটাস:</b> <span style="color:green; font-weight:bold;">${trackedOrderResult.status}</span><br>
                                <b>ডেলিভারি ঠিকানা:</b> ${trackedOrderResult.customerAddress}
                            ` : '<p style="color:red; margin:0;">দুঃখিত, এই অর্ডার আইডি দিয়ে কোনো অর্ডার পাওয়া যায়নি!</p>'}
                        </div>
                    ` : ''}
                </div>

                <div class="box">
                    <h4 style="margin-top:0; color:#f57224; font-size:15px;">🔍 পণ্য খুঁজুন</h4>
                    <form action="/user-dashboard" method="GET" class="search-box">
                        <input type="text" name="search" value="${searchQuery}" placeholder="পণ্যের নাম লিখে সার্চ করুন..." class="search-input" required>
                        <button type="submit" class="search-btn">সার্চ</button>
                    </form>
                    ${searchQuery ? `
                        <p style="font-size:12px; color:#f57224; font-weight:bold;">"${searchQuery}" এর সার্চ রেজাল্ট: (<a href="/user-dashboard">ক্লিয়ার</a>)</p>
                        <div class="product-grid">${renderGrid(searchFiltered) || '<p style="font-size:12px;">কোন পণ্য পাওয়া যায়নি।</p>'}</div>
                    ` : ''}
                </div>

                <div class="box">
                    <h4 style="margin-top:0; color:#f57224; font-size:15px;">🛍️ শপিং কার্ট (${cart.length}টি)</h4>
                    ${cartHTML}
                    ${cart.length > 0 ? `<a href="/checkout" style="display:block; background:#28a745; color:white; text-align:center; padding:8px; border-radius:4px; text-decoration:none; font-weight:bold; font-size:13px; margin-top:8px;">অর্ডার কনফার্ম করুন (চেকআউট)</a>` : ''}
                </div>

                <div class="box">
                    <h4 style="margin-top:0; color:#f57224; font-size:15px;">❤️ আমার উইশলিস্ট বা পছন্দ (${wishlist.length}টি)</h4>
                    ${wishlistHTML}
                </div>

                <div class="box">
                    <h4 style="margin-top:0; color:#f57224; font-size:15px;">📦 ক্যাটাগরি অনুযায়ী পণ্য</h4>
                    <div class="category-scroll">${categoryMenuHTML}</div>
                    <hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
                    <div class="product-grid">
                        ${renderGrid(categoryFiltered) || '<p style="font-size:12px; color:#777;">এই ক্যাটাগরিতে কোনো পণ্য নেই।</p>'}
                    </div>
                </div>

                <div class="box">
                    <h4 style="margin-top:0; color:#f57224; font-size:15px;">📜 আমার অর্ডারসমূহ</h4>
                    ${myOrderListHTML}
                </div>

                <div class="box">
                    <h4 style="margin-top:0; color:#f57224; font-size:15px;">💬 এডমিনের সাথে চ্যাট করুন</h4>
                    <div style="height:90px; overflow-y:scroll; border:1px solid #eee; padding:5px; margin-bottom:6px; background:#fafafa;">${chatHTML}</div>
                    <form action="/api/user-chat" method="POST">
                        <input type="text" name="message" placeholder="আপনার বার্তা লিখুন..." style="width:74%; padding:7px; font-size:12px;" required>
                        <button type="submit" style="padding:7px 10px; background:#f57224; color:white; border:none; border-radius:4px; font-size:12px;">পাঠান</button>
                    </form>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/update-profile', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    userProfiles[req.user.email] = {
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address
    };
    if (req.body.newPassword && req.body.newPassword.trim() !== '') {
        userPasswords[req.user.email] = req.body.newPassword.trim();
    }
    res.redirect('/user-dashboard');
});

app.post('/api/add-to-cart', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    const product = products.find(p => p.id === req.body.productId);
    if (product && product.inStock) {
        if (!userCarts[req.user.email]) userCarts[req.user.email] = [];
        userCarts[req.user.email].push(product);
    }
    res.redirect('/user-dashboard');
});

app.post('/api/remove-from-cart', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    const index = parseInt(req.body.index);
    if (userCarts[req.user.email] && userCarts[req.user.email][index]) {
        userCarts[req.user.email].splice(index, 1);
    }
    res.redirect('/user-dashboard');
});

app.post('/api/add-to-wishlist', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    const product = products.find(p => p.id === req.body.productId);
    if (product) {
        if (!userWishlists[req.user.email]) userWishlists[req.user.email] = [];
        const exists = userWishlists[req.user.email].some(item => item.id === product.id);
        if (!exists) {
            userWishlists[req.user.email].push(product);
        }
    }
    res.redirect('/user-dashboard');
});

app.post('/api/remove-from-wishlist', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    const index = parseInt(req.body.index);
    if (userWishlists[req.user.email] && userWishlists[req.user.email][index]) {
        userWishlists[req.user.email].splice(index, 1);
    }
    res.redirect('/user-dashboard');
});

app.post('/api/wishlist-to-cart', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    const index = parseInt(req.body.index);
    let wishlist = userWishlists[req.user.email];
    if (wishlist && wishlist[index]) {
        let product = wishlist[index];
        if (product.inStock) {
            if (!userCarts[req.user.email]) userCarts[req.user.email] = [];
            userCarts[req.user.email].push(product);
        }
        wishlist.splice(index, 1);
    }
    res.redirect('/user-dashboard');
});

app.get('/checkout', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    const cart = userCarts[req.user.email] || [];
    const profile = userProfiles[req.user.email] || {};

    if (cart.length === 0) return res.redirect('/user-dashboard');

    let totalPrice = cart.reduce((sum, item) => sum + Number(item.price), 0);
    const couponError = req.query.error || '';
    const discountAmount = req.query.discount ? parseFloat(req.query.discount) : 0;
    const finalPrice = Math.max(0, totalPrice - discountAmount);

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>চেকআউট - দারাজ</title>
            <style>
                body { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:15px; }
                .card { background:white; padding:15px; border-radius:8px; max-width:450px; margin:auto; }
                input, select { width:95%; padding:8px; margin:5px 0; border:1px solid #ddd; border-radius:4px; }
                .btn { background:#28a745; color:white; padding:10px; border:none; border-radius:4px; font-weight:bold; width:100%; cursor:pointer; }
            </style>
            <script>
                function togglePayment(method) {
                    document.getElementById('mobile-pay-info').style.display = (method === 'Cash on Delivery') ? 'none' : 'block';
                }
            </script>
        </head>
        <body>
            <div class="card">
                <a href="/user-dashboard" style="text-decoration:none; color:#333; font-size:12px;">← ড্যাশবোর্ডে ফিরে যান</a>
                <h3 style="color:#f57224;">অর্ডার কনফার্মেশন</h3>
                <p>পণ্যের মোট মূল্য: <b>৳${totalPrice}</b></p>
                ${discountAmount > 0 ? `<p style="color:green;">কুপন ডিসকাউন্ট: <b>-৳${discountAmount}</b></p><p>সর্বমোট প্রদেয়: <b>৳${finalPrice}</b></p>` : ''}
                
                <form action="/api/apply-coupon" method="POST" style="display:flex; gap:5px; margin-bottom:10px;">
                    <input type="text" name="couponCode" placeholder="প্রোমো কোড (যেমন: EID2026)" style="flex:1; padding:6px; font-size:12px; margin:0;" required>
                    <button type="submit" style="background:#007bff; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:pointer;">প্রয়োগ</button>
                </form>
                ${couponError ? `<p style="color:red; font-size:12px;">${couponError}</p>` : ''}

                <form action="/api/place-order" method="POST">
                    <input type="hidden" name="discount" value="${discountAmount}">
                    <label>নাম:</label><input type="text" name="customerName" value="${profile.name || ''}" required><br>
                    <label>মোবাইল নম্বর:</label><input type="text" name="customerPhone" value="${profile.phone || ''}" required><br>
                    <label>ঠিকানা:</label><input type="text" name="customerAddress" value="${profile.address || ''}" required><br>
                    <label>পেমেন্ট মেথড:</label>
                    <select name="paymentMethod" onchange="togglePayment(this.value)" required>
                        <option value="Cash on Delivery">Cash on Delivery (ক্যাশ অন ডেলিভারি)</option>
                        <option value="Bkash">বিকাশ (Bkash - ${adminPaymentNumbers.bkash})</option>
                        <option value="Nagad">নগদ (Nagad - ${adminPaymentNumbers.nagad})</option>
                    </select><br>
                    <div id="mobile-pay-info" style="display:none; background:#fff3cd; padding:8px; font-size:12px; border-radius:4px; margin-top:5px;">
                        উপরের নম্বরে টাকা পাঠিয়ে নিচের ঘরে আপনার প্রেরক নম্বর ও ট্রানজেকশন আইডি দিন。<br>
                        <input type="text" name="senderPhone" placeholder="আপনার বিকাশ/নগদ নম্বর"><br>
                        <input type="text" name="trxId" placeholder="TrxID (লেনদেন আইডি)">
                    </div><br>
                    <button type="submit" class="btn">অর্ডার সম্পন্ন করুন</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/apply-coupon', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    const cart = userCarts[req.user.email] || [];
    let totalPrice = cart.reduce((sum, item) => sum + Number(item.price), 0);
    const code = req.body.couponCode ? req.body.couponCode.trim().toUpperCase() : '';

    if (coupons[code]) {
        let coupon = coupons[code];
        let discount = (totalPrice * coupon.discountPercent) / 100;
        res.redirect(`/checkout?discount=${discount}`);
    } else {
        res.redirect('/checkout?error=দুঃখিত, কুপনটি সঠিক নয়!');
    }
});

app.post('/api/place-order', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    const cart = userCarts[req.user.email] || [];
    if (cart.length === 0) return res.redirect('/user-dashboard');

    const { customerName, customerPhone, customerAddress, paymentMethod, senderPhone, trxId, discount } = req.body;
    let discountValue = discount ? parseFloat(discount) : 0;
    let perItemDiscount = discountValue / cart.length;

    cart.forEach(item => {
        let finalItemPrice = Math.max(0, Number(item.price) - perItemDiscount);
        
        let targetProd = products.find(p => p.id === item.id);
        if (targetProd && targetProd.stockCount > 0) {
            targetProd.stockCount -= 1;
            if (targetProd.stockCount <= 0) {
                targetProd.inStock = false;
            }
        }

        orders.push({
            orderId: 'DRZ-' + Math.floor(100000 + Math.random() * 900000),
            userEmail: req.user.email,
            customerName,
            customerPhone,
            customerAddress,
            productName: item.name,
            price: finalItemPrice.toFixed(2),
            paymentMethod,
            senderPhone: senderPhone || '',
            trxId: trxId || '',
            status: 'প্রক্রিয়াদীন'
        });
    });

    userCarts[req.user.email] = [];
    res.send(`
        <div style="text-align:center; margin-top:50px; font-family:Arial;">
            <h2 style="color:green;">অভিনন্দন! আপনার অর্ডারটি সফলভাবে গৃহিত হয়েছে।</h2>
            <a href="/user-dashboard" style="background:#f57224; color:white; padding:10px 20px; text-decoration:none; border-radius:5px; font-weight:bold;">ড্যাশবোর্ডে ফিরে যান</a>
        </div>
    `);
});

// ==========================================
// ৪. পণ্যের বিস্তারিত পেজ
// ==========================================
app.get('/product/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.send('পণ্যটি পাওয়া যায়নি! <a href="/user-dashboard">ফিরে যান</a>');

    let allImages = [product.mainImage, ...product.subImages].filter(Boolean);
    let subImagesHTML = allImages.map(img => `<img src="${img}" onclick="changeMainImage('${img}')" style="width:55px; height:55px; object-fit:cover; border-radius:4px; cursor:pointer; border:2px solid #ddd; transition:0.2s;" onmouseover="this.style.borderColor='#f57224'" onmouseout="this.style.borderColor='#ddd'">`).join('');

    let productReviews = reviews.filter(r => r.productId === product.id);
    let reviewsHTML = productReviews.length > 0 ? productReviews.map(r => `
        <div style="border-bottom:1px solid #eee; padding:5px 0; font-size:12px;">
            <b>${r.userName}:</b> <span style="color:#f57224;">${'⭐'.repeat(r.rating)}</span><br>
            <span>${r.comment}</span>
        </div>
    `).join('') : '<p style="font-size:12px; color:#777;">কোন অনুমোদিত রিভিউ নেই।</p>';

    let reviewSuccessMsg = req.query.msg ? `<p style="color:green; font-size:12px;"><b>আপনার রিভিউটি এডমিনের অনুমোদনের জন্য জমা হয়েছে!</b></p>` : '';

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${product.name}</title>
            <style>
                body { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:15px; }
                .card { background:white; padding:15px; border-radius:8px; max-width:450px; margin:auto; }
                .main-img-container { overflow:hidden; border-radius:6px; background:#fafafa; border:1px solid #eee; text-align:center; }
                .main-img { width:100%; height:250px; object-fit:contain; transition: transform 0.3s ease; cursor: zoom-in; }
                .price { color:#f57224; font-size:20px; font-weight:bold; }
                .btn { background:#f57224; color:white; padding:10px; border:none; border-radius:4px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px; }
            </style>
            <script>
                function changeMainImage(imgSrc) {
                    document.getElementById('mainImage').src = imgSrc;
                }
                function zoomImage(e) {
                    const img = e.target;
                    const x = e.clientX - e.target.offsetLeft;
                    const y = e.clientY - e.target.offsetTop;
                    img.style.transformOrigin = \`\${x}px \${y}px\`;
                    img.style.transform = "scale(1.8)";
                }
                function resetZoom(e) {
                    const img = e.target;
                    img.style.transformOrigin = "center center";
                    img.style.transform = "scale(1)";
                }
            </script>
        </head>
        <body>
            <div class="card">
                <a href="/user-dashboard" style="text-decoration:none; color:#333; font-size:12px;">← ড্যাশবোর্ডে ফিরে যান</a>
                <h2>${product.name}</h2>
                <div class="main-img-container">
                    <img id="mainImage" src="${product.mainImage}" alt="${product.name}" class="main-img" onmousemove="zoomImage(event)" onmouseleave="resetZoom(event)">
                </div>
                <div style="display:flex; gap:6px; margin-top:8px; overflow-x:auto; padding-bottom:5px;">${subImagesHTML}</div>
                <p class="price">৳${product.price}</p>
                <p><b>ক্যাটাগরি:</b> ${product.category}</p>
                <p><b>স্টক বাকি:</b> ${product.stockCount ?? 10}টি</p>
                <p><b>বিবরণ:</b> ${product.description || 'কোন বিবরণ নেই।'}</p>
                ${product.inStock ? `
                    <form action="/api/add-to-cart" method="POST">
                        <input type="hidden" name="productId" value="${product.id}">
                        <button type="submit" class="btn">কার্টে যোগ করুন</button>
                    </form>
                ` : '<p style="color:red; font-weight:bold;">এই পণ্যটির স্টক শেষ</p>'}
                
                <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
                <h4>পণ্যের রিভিউ (${productReviews.length})</h4>
                <div style="max-height:100px; overflow-y:auto; margin-bottom:10px;">${reviewsHTML}</div>
                ${reviewSuccessMsg}
                <form action="/api/add-review" method="POST">
                    <input type="hidden" name="productId" value="${product.id}">
                    <select name="rating" style="width:100%; padding:5px; font-size:12px; margin-bottom:5px;" required>
                        <option value="5">⭐⭐⭐⭐⭐ (৫ স্টার)</option>
                        <option value="4">⭐⭐⭐⭐ (৪ স্টার)</option>
                        <option value="3">⭐⭐⭐ (৩ স্টার)</option>
                        <option value="2">⭐⭐ (২ স্টার)</option>
                        <option value="1">⭐ (১ স্টার)</option>
                    </select>
                    <input type="text" name="comment" placeholder="আপনার মতামত লিখুন..." style="width:94%; padding:6px; font-size:12px; margin-bottom:5px;" required>
                    <button type="submit" style="background:#007bff; color:white; border:none; padding:6px; width:100%; border-radius:4px; font-size:12px; cursor:pointer;">রিভিউ জমা দিন</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/add-review', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    const { productId, rating, comment } = req.body;
    const profile = userProfiles[req.user.email] || {};
    
    // রিভিউ প্রথমে pendingReviews-এ জমা হবে মডারেশনের জন্য
    pendingReviews.push({
        productId,
        userName: profile.name || 'কাস্টমার',
        rating,
        comment
    });
    
    res.redirect('/product/' + productId + '?msg=success');
});

app.post('/api/user-chat', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/');
    chatMessages.push({ sender: req.user.email, text: req.body.message });
    res.redirect('/user-dashboard');
});

app.post('/api/admin-chat', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    chatMessages.push({ sender: 'Admin (হাসিবুল ভাই)', text: req.body.message });
    res.redirect('/admin-dashboard');
});

app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});

