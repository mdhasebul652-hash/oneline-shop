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

// নতুন এডমিন ক্রিক্রেডিশিয়াল
const ADMIN_CREDENTIALS = {
    email: "mdhasibul652@gmail.com",
    password: "mdhasibul1234"
};

let adminPaymentNumbers = {
    bkash: "01700000000",
    nagad: "01800000000"
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
let reviews = [];
let chatMessages = [];
let userProfiles = {};

// সার্চ ফিল্টারিং অ্যালগরিদম
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
// ১. লগইন পেজ (ইউজার ও এডমিন আলাদা)
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
            <title>লগইন - অনলাইন শপ</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 90vh; }
                .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); width: 100%; max-width: 350px; text-align: center; }
                input { width: 92%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; }
                button { width: 100%; padding: 12px; background: #f57224; color: white; border: none; font-size: 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
                .guest-link { display: block; margin-top: 15px; color: #f57224; text-decoration: none; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2 style="color:#f57224; margin-top:0;">অনলাইন শপ লগইন</h2>
                <form action="/api/login" method="POST" autocomplete="off">
                    <input type="email" name="email" placeholder="ইমেইল" required><br>
                    <input type="password" name="password" placeholder="পাসওয়ার্ড" required><br>
                    <button type="submit">প্রবেশ করুন</button>
                </form>
                <a href="/user-dashboard" class="guest-link">লগইন ছাড়াই ব্রাউজ করুন →</a>
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

    if (!userProfiles[email]) {
        userProfiles[email] = { name: '', phone: '', address: '' };
    }

    const loggedUser = { email, role: 'user' };
    res.cookie('loggedInUser', JSON.stringify(loggedUser), { maxAge: 30 * 24 * 60 * 60 * 1000 });
    return res.redirect('/user-dashboard');
});

app.get('/logout', (req, res) => {
    res.clearCookie('loggedInUser');
    res.redirect('/');
});

// ==========================================
// ২. এডমিন ড্যাশবোর্ড
// ==========================================
app.get('/admin-dashboard', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');

    let categoryOptions = CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    
    let orderList = orders.map(o => `
        <li style="margin-bottom:10px; background:#f9f9f9; padding:10px; border-radius:5px; font-size:13px; border-left:4px solid #f57224;">
            <b>অর্ডার আইডি:</b> ${o.orderId}<br>
            <b>কাস্টমার নাম:</b> ${o.customerName}<br>
            <b>মোবাইল নম্বর:</b> ${o.customerPhone}<br>
            <b>ডেলিভারি ঠিকানা:</b> ${o.customerAddress}<br>
            <b>পণ্য:</b> ${o.productName} (৳${o.price})<br>
            <b>পেমেন্ট মেথড:</b> <span style="color:#f57224; font-weight:bold;">${o.paymentMethod}</span><br>
            ${o.paymentMethod !== 'Cash on Delivery' ? `
                <b>প্রেরক পেমেন্ট নম্বর:</b> <mark>${o.senderPhone}</mark><br>
                <b>TrxID/মেসেজ:</b> ${o.trxId || 'দেওয়া হয়নি'}
            ` : ''}
        </li>
    `).join('');

    let chatHTML = chatMessages.map(c => `<p><b>${c.sender}:</b> ${c.text}</p>`).join('');

    let productListHTML = products.map(p => `
        <div class="product-card">
            <img src="${p.mainImage}" alt="${p.name}">
            <h4>${p.name} ${p.inStock ? '' : '<span style="color:red; font-size:11px;">(স্টক শেষ)</span>'}</h4>
            <p style="font-size:11px; color:#666;">${p.category}</p>
            <p class="price">৳${p.price}</p>
            <div style="margin-top:5px; display:flex; gap:3px; justify-content:center;">
                <form action="/api/toggle-stock" method="POST" style="display:inline;">
                    <input type="hidden" name="productId" value="${p.id}">
                    <button type="submit" style="background:${p.inStock ? '#ffc107' : '#28a745'}; border:none; padding:4px 6px; font-size:10px; border-radius:3px; cursor:pointer;">
                        ${p.inStock ? 'স্টক শেষ করুন' : 'স্টক ইন করুন'}
                    </button>
                </form>
                <form action="/api/delete-product" method="POST" style="display:inline;" onsubmit="return confirm('পণ্যটি মুছে ফেলতে চান?');">
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
            <title>এডমিন ড্যাশবোর্ড - অনলাইন শপ</title>
            <style>
                body { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; }
                .header { background:#343a40; color:white; padding:15px; display:flex; justify-content:space-between; align-items:center; }
                .container { padding:15px; }
                .card { background:white; padding:15px; margin-bottom:15px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); }
                .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
                .product-card { border:1px solid #eee; padding:8px; border-radius:5px; text-align:center; background:#fff; }
                .product-card img { width:100%; height:100px; object-fit:cover; border-radius:4px; }
                .product-card h4 { margin:5px 0 2px 0; font-size:12px; }
                .price { color:#f57224; font-weight:bold; margin:0; font-size:12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h3 style="margin:0;">অনলাইন শপ - এডমিন প্যানেল</h3>
                <a href="/logout" style="color:white; background:#dc3545; padding:6px 12px; text-decoration:none; border-radius:4px;">লগআউট</a>
            </div>
            <div class="container">
                <div class="card">
                    <h3>বিকাশ ও নগদ নম্বর সেটআপ</h3>
                    <form action="/api/update-payment-numbers" method="POST">
                        <label><b>বিকাশ নম্বর:</b></label><br>
                        <input type="text" name="bkash" value="${adminPaymentNumbers.bkash}" required style="width:90%; padding:8px; margin:4px 0;"><br>
                        <label><b>নগদ নম্বর:</b></label><br>
                        <input type="text" name="nagad" value="${adminPaymentNumbers.nagad}" required style="width:90%; padding:8px; margin:4px 0;"><br><br>
                        <button type="submit" style="background:#007bff; color:white; padding:8px 15px; border:none; border-radius:4px;">নম্বর আপডেট করুন</button>
                    </form>
                </div>

                <div class="card">
                    <h3>নতুন পণ্য আপলোড করুন</h3>
                    <form action="/api/add-product" method="POST" enctype="multipart/form-data">
                        <label><b>পণ্যের ক্যাটাগরি বেছে নিন:</b></label><br>
                        <select name="category" style="width:97%; padding:8px; margin:5px 0;" required>
                            ${categoryOptions}
                        </select><br><br>

                        <input type="text" name="name" placeholder="পণ্যের নাম" required style="width:95%; padding:8px; margin:5px 0;"><br>
                        <input type="number" name="price" placeholder="দাম (৳)" required style="width:95%; padding:8px; margin:5px 0;"><br>
                        <textarea name="description" placeholder="পণ্যের বিবরণ" style="width:95%; padding:8px; margin:5px 0; height:60px;"></textarea><br><br>
                        
                        <label><b>প্রধান কভার ছবি:</b></label><br>
                        <input type="file" name="images" accept="image/*" required><br><br>
                        
                        <label><b>অতিরিক্ত ছবি:</b></label><br>
                        <input type="file" name="images" accept="image/*" multiple><br><br>

                        <button type="submit" style="background:#28a745; color:white; padding:10px 20px; border:none; border-radius:4px; cursor:pointer;">পণ্য বাজারে ছাড়ুন</button>
                    </form>
                </div>

                <div class="card">
                    <h3>আপলোড করা পণ্য ম্যানেজমেন্ট</h3>
                    <div class="product-grid">${productListHTML || '<p>কোন পণ্য আপলোড করা হয়নি।</p>'}</div>
                </div>

                <div class="card">
                    <h3>গ্রাহকদের অর্ডারের তালিকা</h3>
                    <ul style="padding-left:0; list-style:none;">${orderList || '<p>কোন অর্ডার নেই</p>'}</ul>
                </div>

                <div class="card">
                    <h3>কাস্টমারদের চ্যাট</h3>
                    <div style="height:120px; overflow-y:scroll; border:1px solid #ccc; padding:10px; margin-bottom:10px;">${chatHTML}</div>
                    <form action="/api/admin-chat" method="POST">
                        <input type="text" name="message" placeholder="উত্তর লিখুন..." style="width:70%; padding:8px;" required>
                        <button type="submit" style="padding:8px 12px; background:#007bff; color:white; border:none; border-radius:4px;">পাঠান</button>
                    </form>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/update-payment-numbers', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/');
    adminPaymentNumbers.bkash = req.body.bkash;
    adminPaymentNumbers.nagad = req.body.nagad;
    res.redirect('/admin-dashboard');
});

app.post('/api/add-product', upload.array('images', 5), (req, res) => {
    const { category, name, price, description } = req.body;
    const imagePaths = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];

    products.push({
        id: Date.now().toString(),
        category,
        name,
        price,
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
// ৩. ইউজার ড্যাশবোর্ড (লগইন ছাড়াও প্রবেশযোগ্য)
// ==========================================
app.get('/user-dashboard', (req, res) => {
    const selectedCategory = req.query.category;
    const searchQuery = req.query.search ? req.query.search.trim() : '';
    
    let userEmail = req.user ? req.user.email : null;
    const profile = userEmail ? (userProfiles[userEmail] || {}) : {};

    let categoryFiltered = selectedCategory ? products.filter(p => p.category === selectedCategory) : [];
    let searchFiltered = [];
    if (searchQuery) {
        searchFiltered = products.filter(p => isSimilarWord(p.name, searchQuery) || isSimilarWord(p.description, searchQuery));
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
        </div>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>অনলাইন শপ</title>
            <style>
                body { font-family: Arial, sans-serif; margin:0; background:#f4f4f4; }
                .nav { background:#f57224; color:white; padding:12px 15px; display:flex; justify-content:space-between; align-items:center; }
                .container { padding:10px; }
                .box { background:white; padding:15px; border-radius:8px; margin-bottom:15px; }
                .search-box { display: flex; gap: 5px; margin-bottom: 8px; }
                .search-input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
                .search-btn { background: #f57224; color: white; border: none; padding: 10px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; }
                .category-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 5px; }
                .cat-chip { background: #eee; color: #333; padding: 8px 14px; border-radius: 20px; text-decoration: none; font-size: 13px; white-space: nowrap; }
                .cat-chip.active { background: #f57224; color: white; font-weight: bold; }
                .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
                .product-card { border:1px solid #eee; padding:8px; border-radius:6px; background:#fff; text-align:left; }
                .product-card img { width:100%; height:130px; object-fit:cover; border-radius:4px; }
                .product-title { margin:5px 0; font-size:13px; font-weight:normal; height:32px; overflow:hidden; }
                .price { color:#f57224; font-weight:bold; margin:0; font-size:15px; }
                .stock-badge { position:absolute; top:5px; left:5px; background:red; color:white; padding:2px 6px; font-size:10px; border-radius:3px; font-weight:bold; }
            </style>
        </head>
        <body>
            <div class="nav">
                <h3 style="margin:0;">অনলাইন শপ</h3>
                <div>
                    ${userEmail ? `
                        <span style="font-size:13px; margin-right:8px;">👤 প্রোফাইল সেট</span>
                        <a href="/logout" style="color:white; background:#333; padding:6px 12px; text-decoration:none; border-radius:4px; font-size:13px;">লগআউট</a>
                    ` : `
                        <a href="/" style="color:white; background:#333; padding:6px 12px; text-decoration:none; border-radius:4px; font-size:13px;">লগইন / এডমিন</a>
                    `}
                </div>
            </div>
            <div class="container">
                <div class="box">
                    <h4 style="margin-top:0;">আমার প্রোফাইল সেটআপ</h4>
                    <form action="/api/update-profile" method="POST">
                        <label style="font-size:13px;">আপনার নাম:</label><br>
                        <input type="text" name="name" value="${profile.name || ''}" placeholder="নাম লিখুন" required style="width:90%; padding:8px; margin:4px 0;"><br>
                        <label style="font-size:13px;">মোবাইল নম্বর:</label><br>
                        <input type="text" name="phone" value="${profile.phone || ''}" placeholder="মোবাইল নম্বর" required style="width:90%; padding:8px; margin:4px 0;"><br>
                        <label style="font-size:13px;">ডেলিভারি ঠিকানা:</label><br>
                        <input type="text" name="address" value="${profile.address || ''}" placeholder="ঠিকানা" required style="width:90%; padding:8px; margin:4px 0;"><br><br>
                        <button type="submit" style="background:#28a745; color:white; padding:8px 15px; border:none; border-radius:4px; cursor:pointer;">প্রোফাইল সেভ করুন</button>
                    </form>
                </div>

                <div class="box">
                    <h4 style="margin-top:0;">পণ্য খুঁজুন:</h4>
                    <form action="/user-dashboard" method="GET" class="search-box">
                        <input type="text" name="search" value="${searchQuery}" placeholder="পণ্যের নাম লিখে সার্চ করুন..." class="search-input" required>
                        <button type="submit" class="search-btn">সার্চ</button>
                    </form>
                    ${searchQuery ? `
                        <p style="font-size:13px; color:#f57224; font-weight:bold;">"${searchQuery}" এর সার্চ রেজাল্ট: (<a href="/user-dashboard">ক্লিয়ার</a>)</p>
                        <div class="product-grid">${renderGrid(searchFiltered) || '<p style="font-size:12px;">কোন পণ্য নেই।</p>'}</div>
                    ` : ''}
                </div>

                <div class="box">
                    <h4 style="margin-top:0;">ক্যাটাগরি:</h4>
                    <div class="category-scroll">${categoryMenuHTML}</div>
                    ${selectedCategory ? `
                        <p style="font-size:13px; color:#f57224; font-weight:bold;">ক্যাটাগরি: ${selectedCategory} (<a href="/user-dashboard">ক্লিয়ার</a>)</p>
                        <div class="product-grid">${renderGrid(categoryFiltered) || '<p style="font-size:12px;">এই ক্যাটাগরিতে পণ্য নেই।</p>'}</div>
                    ` : ''}
                </div>

                <div class="box">
                    <h3 style="margin-top:0; color:#f57224;">সব পণ্য (All Products)</h3>
                    <div class="product-grid">${renderGrid(products) || '<p style="padding:10px;">কোনো পণ্য নেই।</p>'}</div>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/update-profile', (req, res) => {
    const { name, phone, address } = req.body;
    let userEmail = req.user ? req.user.email : ('guest_' + phone);
    userProfiles[userEmail] = { name, phone, address };
    res.redirect('/user-dashboard');
});

// ==========================================
// ৪. একক পণ্য পেজ (নাম ও ঠিকানা দিয়ে অর্ডার এবং প্রোডাক্ট চ্যাট)
// ==========================================
app.get('/product/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.send('পণ্য পাওয়া যায়নি!');

    let userEmail = req.user ? req.user.email : null;
    const userProfile = userEmail ? (userProfiles[userEmail] || {}) : {};

    let subImagesHTML = product.subImages.map(img => `<img src="${img}" style="width:60px; height:60px; object-fit:cover; margin-right:5px; border:1px solid #ccc; border-radius:4px;">`).join('');
    let productReviews = reviews.filter(r => r.productId === product.id);
    let reviewHTML = productReviews.map(r => `<p style="font-size:13px;"><b>${r.user}:</b> ⭐ ${r.rating}/5 - ${r.comment}</p>`).join('');
    let chatHTML = chatMessages.map(c => `<p style="font-size:13px;"><b>${c.sender}:</b> ${c.text}</p>`).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${product.name}</title>
            <style>
                body { font-family: Arial, sans-serif; margin:0; background:#f4f4f4; padding:10px; }
                .box { background:white; padding:15px; border-radius:8px; margin-bottom:12px; }
                .main-img { width:100%; max-height:280px; object-fit:cover; border-radius:6px; }
                .btn-buy { background:#f57224; color:white; padding:12px; border:none; width:100%; font-size:16px; border-radius:4px; font-weight:bold; cursor:pointer; }
                .btn-disabled { background:#ccc; color:#666; padding:12px; border:none; width:100%; font-size:16px; border-radius:4px; font-weight:bold; cursor:not-allowed; }
                .payment-info { background:#eef7ff; padding:10px; border-radius:6px; border:1px solid #bce0fd; margin:10px 0; display:none; }
                input[type="text"] { width:93%; padding:9px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; }
            </style>
            <script>
                function togglePaymentInfo() {
                    var method = document.getElementById("paymentMethod").value;
                    var infoBox = document.getElementById("paymentInfoBox");
                    var numberText = document.getElementById("adminNumberText");

                    if (method === "bKash") {
                        infoBox.style.display = "block";
                        numberText.innerHTML = "বিকাশ নম্বর: <b>${adminPaymentNumbers.bkash}</b>";
                    } else if (method === "Nagad") {
                        infoBox.style.display = "block";
                        numberText.innerHTML = "নগদ নম্বর: <b>${adminPaymentNumbers.nagad}</b>";
                    } else {
                        infoBox.style.display = "none";
                    }
                }
            </script>
        </head>
        <body>
            <a href="/user-dashboard" style="text-decoration:none; color:#f57224; font-weight:bold;">← হোম পেজে ফিরে যান</a><br><br>
            
            <div class="box">
                <img src="${product.mainImage}" class="main-img"><br><br>
                <div><b>সাব-ছবিসমূহ:</b><br>${subImagesHTML || 'কোন অতিরিক্ত ছবি নেই'}</div>
                <h2>${product.name}</h2>
                <p style="color:#888; font-size:13px;">ক্যাটাগরি: ${product.category}</p>
                <h3 style="color:#f57224; margin:5px 0;">৳${product.price}</h3>
                <p><b>স্টক অবস্থা:</b> ${product.inStock ? '<b style="color:green;">স্টকে আছে (Available)</b>' : '<b style="color:red;">স্টক শেষ (Out of Stock)</b>'}</p>
                <p><b>বিবরণ:</b> ${product.description}</p>
                <hr>
                
                <h4>অর্ডার করুন (Order Details)</h4>
                ${product.inStock ? `
                    <form action="/api/place-order" method="POST">
                        <input type="hidden" name="productId" value="${product.id}">
                        <input type="hidden" name="productName" value="${product.name}">
                        <input type="hidden" name="price" value="${product.price}">

                        <label style="font-size:13px;"><b>আপনার নাম:</b></label><br>
                        <input type="text" name="customerName" value="${userProfile.name || ''}" placeholder="আপনার পূর্ণ নাম লিখুন" required><br>

                        <label style="font-size:13px;"><b>মোবাইল নম্বর:</b></label><br>
                        <input type="text" name="customerPhone" value="${userProfile.phone || ''}" placeholder="যেমন: 01700000000" required><br>

                        <label style="font-size:13px;"><b>ডেলিভারি ঠিকানা:</b></label><br>
                        <input type="text" name="customerAddress" value="${userProfile.address || ''}" placeholder="বাসা/গ্রাম, থানা, জেলা" required><br>

                        <label style="font-size:13px;"><b>পেমেন্ট মাধ্যম বেছে নিন:</b></label><br>
                        <select id="paymentMethod" name="paymentMethod" onchange="togglePaymentInfo()" style="width:97%; padding:10px; margin:8px 0;" required>
                            <option value="Cash on Delivery">ক্যাশ অন ডেলিভারি (Cash on Delivery)</option>
                            <option value="bKash">বিকাশ (bKash)</option>
                            <option value="Nagad">নগদ (Nagad)</option>
                        </select>

                        <div id="paymentInfoBox" class="payment-info">
                            <p id="adminNumberText" style="margin:0 0 8px 0; color:#0056b3; font-size:14px;"></p>
                            <p style="font-size:12px; color:#555; margin:0 0 8px 0;">উপরের নম্বরে টাকা পাঠানোর পর যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি নিচে লিখুন:</p>
                            
                            <label style="font-size:13px;"><b>প্রেরক পেমেন্ট নম্বর:</b></label><br>
                            <input type="text" name="senderPhone" placeholder="যে নম্বর থেকে টাকা পাঠিয়েছেন"><br>

                            <label style="font-size:13px;"><b>TrxID (ঐচ্ছিক / না দিলে সমস্যা নেই):</b></label><br>
                            <input type="text" name="trxId" placeholder="না দিলেও চলবে"><br>
                        </div>

                        <br>
                        <button type="submit" class="btn-buy">অর্ডার কনফার্ম করুন</button>
                    </form>
                ` : `
                    <button class="btn-disabled" disabled>স্টক শেষ (Out of Stock)</button>
                `}
            </div>

            <div class="box">
                <h4>কাস্টমার রিভিউ (${productReviews.length})</h4>
                <div>${reviewHTML || '<p style="font-size:13px;">এখনো কোনো রিভিউ নেই।</p>'}</div>
                <hr>
                <form action="/api/add-review" method="POST">
                    <input type="hidden" name="productId" value="${product.id}">
                    <select name="rating" style="padding:5px;">
                        <option value="5">5 ⭐⭐⭐⭐⭐</option>
                        <option value="4">4 ⭐⭐⭐⭐</option>
                    </select><br><br>
                    <input type="text" name="comment" placeholder="আপনার রিভিউ লিখুন..." required>
                    <button type="submit" style="padding:8px 12px; background:#28a745; color:white; border:none; border-radius:4px;">রিভিউ দিন</button>
                </form>
            </div>

            <div class="box">
                <h4>এই পণ্য নিয়ে এডমিনের সাথে চ্যাট করুন</h4>
                <div style="height:100px; overflow-y:scroll; border:1px solid #ccc; padding:8px; margin-bottom:8px;">${chatHTML}</div>
                <form action="/api/send-chat" method="POST">
                    <input type="text" name="message" placeholder="পণ্য নিয়ে কিছু জিজ্ঞেস করুন..." required>
                    <button type="submit" style="padding:8px 12px; background:#f57224; color:white; border:none; border-radius:4px;">পাঠান</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/place-order', (req, res) => {
    const { productId, productName, price, customerName, customerPhone, customerAddress, paymentMethod, senderPhone, trxId } = req.body;

    if (paymentMethod !== 'Cash on Delivery' && !senderPhone) {
        return res.send('<h3 style="color:red; text-align:center;">বিকাশ বা নগদে পেমেন্ট করলে আপনার প্রেরক মোবাইল নম্বর দেওয়া বাধ্যতামূলক!</h3><a href="javascript:history.back()">ফিরে যান</a>');
    }

    let userEmail = req.user ? req.user.email : ('guest_' + customerPhone);
    userProfiles[userEmail] = {
        name: customerName,
        phone: customerPhone,
        address: customerAddress
    };

    orders.push({
        orderId: Date.now(),
        user: userEmail,
        customerName,
        customerPhone,
        customerAddress,
        productId,
        productName,
        price,
        paymentMethod,
        senderPhone: senderPhone || '',
        trxId: trxId || ''
    });

    res.send(`
        <div style="text-align:center; font-family:Arial; padding:30px;">
            <h2 style="color:green;">আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!</h2>
            <p style="font-size:15px;">কাস্টমার নাম: <b>${customerName}</b></p>
            <p style="font-size:15px;">মোবাইল নম্বর: <b>${customerPhone}</b></p>
            <p style="font-size:15px;">ঠিকানা: <b>${customerAddress}</b></p>
            <p style="font-size:15px;">পেমেন্ট মেথড: <b>${paymentMethod}</b></p>
            <br><a href="/user-dashboard" style="background:#f57224; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">হোম পেজে ফিরে যান</a>
        </div>
    `);
});

app.post('/api/add-review', (req, res) => {
    const { productId, rating, comment } = req.body;
    let userName = req.user ? req.user.email : 'Guest User';
    reviews.push({ productId, user: userName, rating, comment });
    res.redirect('/product/' + productId);
});

app.post('/api/send-chat', (req, res) => {
    let senderName = req.user ? req.user.email : 'Guest User';
    chatMessages.push({ sender: senderName, text: req.body.message });
    res.redirect('back');
});

app.post('/api/admin-chat', (req, res) => {
    chatMessages.push({ sender: 'Admin (মালিক)', text: req.body.message });
    res.redirect('/admin-dashboard');
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
