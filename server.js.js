const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ইন-মেমোরি ডেটাবেস
let users = []; // { email, password, role }
let userProfiles = {}; // email -> { name, phone, address }
let products = [
    { id: '1', name: 'টি-শার্ট', category: 'fashion', price: ৫০০, image: 'https://via.placeholder.com/150' },
    { id: '2', name: 'স্মার্ট ওয়াচ', category: 'electronics', price: ১৫০০, image: 'https://via.placeholder.com/150' },
    { id: '3', name: 'বই', category: 'books', price: ২৫০, image: 'https://via.placeholder.com/150' }
];
let orders = [];
let pendingReviews = [];
let chatMessages = [];

// সিম্পল কুকি মিডলওয়্যার
app.use((req, res, next) => {
    const cookie = req.cookies.userSession;
    if (cookie) {
        try {
            req.user = JSON.parse(cookie);
        } catch (e) {
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
});

// ==========================================
// ১. হোম পেজ (লগইন ছাড়াই ক্যাটাগরি ও প্রোডাক্ট দেখা যাবে)
// ==========================================
app.get('/', (req, res) => {
    let user = req.user;
    let selectedCategory = req.query.category || 'all';

    let filteredProducts = products;
    if (selectedCategory !== 'all') {
        filteredProducts = products.filter(p => p.category === selectedCategory);
    }

    let productHTML = filteredProducts.map(p => `
        <div style="border:1px solid #ddd; padding:10px; margin:5px; width:150px; display:inline-block; text-align:center; border-radius:6px; background:#fff;">
            <img src="${p.image}" width="100" style="border-radius:4px;"><br>
            <strong>${p.name}</strong><br>
            <span style="color:green; font-size:13px;">মূল্য: ${p.price} টাকা</span><br>
            <a href="/product/${p.id}" style="background:#007bff; color:white; padding:4px 8px; text-decoration:none; display:inline-block; margin-top:5px; border-radius:4px; font-size:12px;">বিস্তারিত দেখুন</a>
        </div>
    `).join('');

    // আইকন সেকশন দুই লাইনে সাজানো এবং নামের লেবেল সহ
    let topIconsHTML = '';
    if (user && user.role === 'user') {
        topIconsHTML = `
            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                <!-- প্রথম লাইন -->
                <div style="display:flex; gap:15px;">
                    <div style="text-align:center;"><a href="/user-dashboard" style="text-decoration:none; font-size:18px;">🛒</a><br><span style="font-size:11px;">কার্ট</span></div>
                    <div style="text-align:center;"><a href="/my-orders" style="text-decoration:none; font-size:18px;">📦</a><br><span style="font-size:11px;">আমার অর্ডার</span></div>
                </div>
                <!-- দ্বিতীয় লাইন -->
                <div style="display:flex; gap:15px;">
                    <div style="text-align:center;"><a href="/profile" style="text-decoration:none; font-size:18px;">👤</a><br><span style="font-size:11px;">প্রোফাইল</span></div>
                    <div style="text-align:center;"><a href="/logout" style="text-decoration:none; font-size:18px;">🚪</a><br><span style="font-size:11px;">লগআউট</span></div>
                </div>
            </div>
        `;
    } else {
        topIconsHTML = `
            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                <!-- প্রথম লাইন -->
                <div style="display:flex; gap:15px;">
                    <div style="text-align:center;"><a href="/login" style="text-decoration:none; font-size:18px;">🔑</a><br><span style="font-size:11px;">লগইন</span></div>
                    <div style="text-align:center;"><a href="/register" style="text-decoration:none; font-size:18px;">📝</a><br><span style="font-size:11px;">রেজিস্ট্রেশন</span></div>
                </div>
            </div>
        `;
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="bn">
        <head>
            <meta charset="UTF-8">
            <title>ই-কমার্স হোম পেজ</title>
        </head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; margin:0; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:white; padding:15px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="margin:0; color:#333;">আমাদের শপ</h2>
                <div>${topIconsHTML}</div>
            </div>

            <div style="margin-top:20px; background:white; padding:10px; border-radius:8px;">
                <strong>ক্যাটাগরি: </strong>
                <a href="/?category=all" style="margin-right:10px; text-decoration:none; color:${selectedCategory === 'all' ? 'red' : 'blue'};">সব</a>
                <a href="/?category=fashion" style="margin-right:10px; text-decoration:none; color:${selectedCategory === 'fashion' ? 'red' : 'blue'};">ফ্যাশন</a>
                <a href="/?category=electronics" style="margin-right:10px; text-decoration:none; color:${selectedCategory === 'electronics' ? 'red' : 'blue'};">ইলেকট্রনিক্স</a>
                <a href="/?category=books" style="text-decoration:none; color:${selectedCategory === 'books' ? 'red' : 'blue'};">বই</a>
            </div>

            <div style="margin-top:20px;">
                <h3>প্রোডাক্ট তালিকা</h3>
                <div>${productHTML}</div>
            </div>
        </body>
        </html>
    `);
});

// ==========================================
// ২. প্রোফাইল ম্যানেজমেন্ট ও অর্ডার করার লজিক
// ==========================================
app.get('/profile', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/login');
    const profile = userProfiles[req.user.email] || { name: '', phone: '', address: '' };

    res.send(`
        <!DOCTYPE html>
        <html lang="bn">
        <head><meta charset="UTF-8"><title>প্রোফাইল সেটিংস</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:20px;">
            <div style="max-width:400px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2>আপনার প্রোফাইল তথ্য</h2>
                <form action="/api/save-profile" method="POST">
                    <label>নাম:</label><br>
                    <input type="text" name="name" value="${profile.name}" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <label>ফোন নম্বর:</label><br>
                    <input type="text" name="phone" value="${profile.phone}" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <label>ডেলিভারি ঠিকানা:</label><br>
                    <textarea name="address" style="width:100%; padding:8px; margin:5px 0;" required>${profile.address}</textarea><br>
                    <button type="submit" style="background:#28a745; color:white; border:none; padding:10px 15px; border-radius:4px; cursor:pointer; width:100%;">প্রোফাইল সেভ করুন</button>
                </form>
                <br><a href="/">হোমে ফিরে যান</a>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/save-profile', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/login');
    const { name, phone, address } = req.body;
    userProfiles[req.user.email] = { name, phone, address };
    res.redirect('/');
});

// প্রোডাক্ট বিস্তারিত ও অর্ডার পেজ (প্রোফাইল সেভ না থাকলে প্রোফাইলে রিডাইরেক্ট করবে)
app.get('/product/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.send('প্রোডাক্ট পাওয়া যায়নি!');

    res.send(`
        <!DOCTYPE html>
        <html lang="bn">
        <head><meta charset="UTF-8"><title>${product.name}</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:20px;">
            <div style="max-width:500px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <img src="${product.image}" width="150"><br>
                <h2>${product.name}</h2>
                <p style="color:green; font-size:16px;">মূল্য: ${product.price} টাকা</p>
                
                <form action="/api/place-order" method="POST">
                    <input type="hidden" name="productId" value="${product.id}">
                    <button type="submit" style="background:#ffc107; color:black; border:none; padding:10px 20px; border-radius:4px; font-size:16px; cursor:pointer; font-weight:bold;">এখনই কিনুন</button>
                </form>
                <br><a href="/">হোমে ফিরে যান</a>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/place-order', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/login');
    
    // চেক করা ইউজার প্রোফাইল আগে থেকে সেট করেছে কি না
    const profile = userProfiles[req.user.email];
    if (!profile || !profile.address || !profile.phone) {
        return res.send(`
            <script>
                alert('দয়া করে অর্ডার করার আগে আপনার প্রোফাইল তথ্য (নাম, ফোন, ঠিকানা) সম্পূর্ণ করুন!');
                window.location.href = '/profile';
            </script>
        `);
    }

    const { productId } = req.body;
    const product = products.find(p => p.id === productId);

    if (product) {
        orders.push({
            userEmail: req.user.email,
            productName: product.name,
            price: product.price,
            shippingInfo: profile,
            date: new Date().toLocaleString()
        });
    }

    res.send(`
        <script>
            alert('আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে!');
            window.location.href = '/my-orders';
        </script>
    `);
});

// আমার অর্ডার দেখার পেজ
app.get('/my-orders', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/login');
    
    const userOrders = orders.filter(o => o.userEmail === req.user.email);
    let ordersHTML = userOrders.length > 0 ? userOrders.map(o => `
        <div style="border-bottom:1px solid #ddd; padding:10px; margin-bottom:10px;">
            <strong>প্রোডাক্ট:</strong> ${o.productName} <br>
            <strong>মূল্য:</strong> ${o.price} টাকা <br>
            <strong>তারিখ:</strong> ${o.date} <br>
            <strong>ডেলিভারি ঠিকানা:</strong> ${o.shippingInfo.address} (${o.shippingInfo.phone})
        </div>
    `).join('') : '<p>আপনার কোনো অর্ডার নেই।</p>';

    res.send(`
        <!DOCTYPE html>
        <html lang="bn">
        <head><meta charset="UTF-8"><title>আমার অর্ডার</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:20px;">
            <div style="max-width:600px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2>আমার অর্ডারসমূহ</h2>
                <div>${ordersHTML}</div>
                <br><a href="/">হোমে ফিরে যান</a>
            </div>
        </body>
        </html>
    `);
});

// ==========================================
// ৩. সাধারণ লগইন ও রেজিস্ট্রেশন রাউট
// ==========================================
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>লগইন</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:50px;">
            <div style="max-width:300px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2>লগইন করুন</h2>
                <form action="/api/login" method="POST">
                    <input type="email" name="email" placeholder="ইমেইল" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <input type="password" name="password" placeholder="পাসওয়ার্ড" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <button type="submit" style="background:#007bff; color:white; border:none; padding:10px; width:100%; border-radius:4px; cursor:pointer;">লগইন</button>
                </form>
                <br><a href="/">হোমে ফিরে যান</a>
            </div>
        </body></html>
    `);
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    // সিম্পল এডমিন চেক
    let role = (email === 'admin@gmail.com' && password === '1234') ? 'admin' : 'user';
    
    res.cookie('userSession', JSON.stringify({ email, role }), { httpOnly: true });
    if (role === 'admin') {
        res.redirect('/admin-dashboard');
    } else {
        res.redirect('/');
    }
});

app.get('/register', (req, res) => {
    res.send(`
        <!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>রেজিস্ট্রেশন</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:50px;">
            <div style="max-width:300px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2>রেজিস্ট্রেশন করুন</h2>
                <form action="/api/register" method="POST">
                    <input type="email" name="email" placeholder="ইমেইল" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <input type="password" name="password" placeholder="পাসওয়ার্ড" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <button type="submit" style="background:#28a745; color:white; border:none; padding:10px; width:100%; border-radius:4px; cursor:pointer;">রেজিস্ট্রেশন</button>
                </form>
                <br><a href="/">হোমে ফিরে যান</a>
            </div>
        </body></html>
    `);
});

app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    users.push({ email, password, role: 'user' });
    res.redirect('/login');
});

app.get('/logout', (req, res) => {
    res.clearCookie('userSession');
    res.redirect('/');
});

// এডমিন ড্যাশবোর্ড (সংক্ষিপ্ত)
app.get('/admin-dashboard', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    res.send(`<h2>এডমিন প্যানেল</h2><br><a href="/logout">লগআউট</a>`);
});

// সার্ভার স্টার্ট
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
