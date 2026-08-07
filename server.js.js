const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3000;

// ডেটাবেস কানেকশন (আপনার নতুন ইউজার ও পাসওয়ার্ড দিয়ে আপডেট করা)
const dbURI = 'mongodb+srv://hasebul:hasebul1234@hasebul.v1tb47m.mongodb.net/?appName=hasebul';

mongoose.connect(dbURI)
    .then(() => console.log('সফলভাবে ডেটাবেস কানেক্ট হয়েছে!'))
    .catch(err => console.log('কানেকশন এরর:', err));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ইন-মেমোরি ডেটাবেস
let users = []; // { email, password, role }
let userProfiles = {}; // email -> { name, phone, address }
let products = [
    { id: '1', name: 'T-Shirt', category: 'fashion', price: 500, image: 'https://via.placeholder.com/150' },
    { id: '2', name: 'Smart Watch', category: 'electronics', price: 1500, image: 'https://via.placeholder.com/150' },
    { id: '3', name: 'Book', category: 'books', price: 250, image: 'https://via.placeholder.com/150' }
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
            <span style="color:green; font-size:13px;">Price: ${p.price} BDT</span><br>
            <a href="/product/${p.id}" style="background:#007bff; color:white; padding:4px 8px; text-decoration:none; display:inline-block; margin-top:5px; border-radius:4px; font-size:12px;">View Details</a>
        </div>
    `).join('');

    let topIconsHTML = '';
    if (user && user.role === 'user') {
        topIconsHTML = `
            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                <div style="display:flex; gap:15px;">
                    <div style="text-align:center;"><a href="/user-dashboard" style="text-decoration:none; font-size:18px;">🛒</a><br><span style="font-size:11px;">Cart</span></div>
                    <div style="text-align:center;"><a href="/my-orders" style="text-decoration:none; font-size:18px;">📦</a><br><span style="font-size:11px;">My Orders</span></div>
                </div>
                <div style="display:flex; gap:15px;">
                    <div style="text-align:center;"><a href="/profile" style="text-decoration:none; font-size:18px;">👤</a><br><span style="font-size:11px;">Profile</span></div>
                    <div style="text-align:center;"><a href="/logout" style="text-decoration:none; font-size:18px;">🚪</a><br><span style="font-size:11px;">Logout</span></div>
                </div>
            </div>
        `;
    } else {
        topIconsHTML = `
            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                <div style="display:flex; gap:15px;">
                    <div style="text-align:center;"><a href="/login" style="text-decoration:none; font-size:18px;">🔑</a><br><span style="font-size:11px;">Login</span></div>
                    <div style="text-align:center;"><a href="/register" style="text-decoration:none; font-size:18px;">📝</a><br><span style="font-size:11px;">Register</span></div>
                </div>
            </div>
        `;
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>E-Commerce Home Page</title>
        </head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; margin:0; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:white; padding:15px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="margin:0; color:#333;">Our Shop</h2>
                <div>${topIconsHTML}</div>
            </div>

            <div style="margin-top:20px; background:white; padding:10px; border-radius:8px;">
                <strong>Category: </strong>
                <a href="/?category=all" style="margin-right:10px; text-decoration:none; color:${selectedCategory === 'all' ? 'red' : 'blue'};">All</a>
                <a href="/?category=fashion" style="margin-right:10px; text-decoration:none; color:${selectedCategory === 'fashion' ? 'red' : 'blue'};">Fashion</a>
                <a href="/?category=electronics" style="margin-right:10px; text-decoration:none; color:${selectedCategory === 'electronics' ? 'red' : 'blue'};">Electronics</a>
                <a href="/?category=books" style="margin-right:10px; text-decoration:none; color:${selectedCategory === 'books' ? 'red' : 'blue'};">Books</a>
            </div>

            <div style="margin-top:20px;">
                <h3>Product List</h3>
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
        <html lang="en">
        <head><meta charset="UTF-8"><title>Profile Settings</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:20px;">
            <div style="max-width:400px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2>Your Profile Info</h2>
                <form action="/api/save-profile" method="POST">
                    <label>Name:</label><br>
                    <input type="text" name="name" value="${profile.name}" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <label>Phone Number:</label><br>
                    <input type="text" name="phone" value="${profile.phone}" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <label>Delivery Address:</label><br>
                    <textarea name="address" style="width:100%; padding:8px; margin:5px 0;" required>${profile.address}</textarea><br>
                    <button type="submit" style="background:#28a745; color:white; border:none; padding:10px 15px; border-radius:4px; cursor:pointer; width:100%;">Save Profile</button>
                </form>
                <br><a href="/">Go Back Home</a>
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

app.get('/product/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.send('Product not found!');

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>${product.name}</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:20px;">
            <div style="max-width:500px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <img src="${product.image}" width="150"><br>
                <h2>${product.name}</h2>
                <p style="color:green; font-size:16px;">Price: ${product.price} BDT</p>
               
                <form action="/api/place-order" method="POST">
                    <input type="hidden" name="productId" value="${product.id}">
                    <button type="submit" style="background:#ffc107; color:black; border:none; padding:10px 20px; border-radius:4px; font-size:16px; cursor:pointer; font-weight:bold;">Buy Now</button>
                </form>
                <br><a href="/">Go Back Home</a>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/place-order', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/login');
    
    const profile = userProfiles[req.user.email];
    if (!profile || !profile.address || !profile.phone) {
        return res.send(`
            <script>
                alert('Please complete your profile info (Name, Phone, Address) before placing an order!');
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
            alert('Your order has been placed successfully!');
            window.location.href = '/my-orders';
        </script>
    `);
});

app.get('/my-orders', (req, res) => {
    if (!req.user || req.user.role !== 'user') return res.redirect('/login');
    
    const userOrders = orders.filter(o => o.userEmail === req.user.email);
    let ordersHTML = userOrders.length > 0 ? userOrders.map(o => `
        <div style="border-bottom:1px solid #ddd; padding:10px; margin-bottom:10px;">
            <strong>Product:</strong> ${o.productName} <br>
            <strong>Price:</strong> ${o.price} BDT <br>
            <strong>Date:</strong> ${o.date} <br>
            <strong>Delivery Address:</strong> ${o.shippingInfo.address} (${o.shippingInfo.phone})
        </div>
    `).join('') : '<p>You have no orders.</p>';

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>My Orders</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:20px;">
            <div style="max-width:600px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2>My Orders</h2>
                <div>${ordersHTML}</div>
                <br><a href="/">Go Back Home</a>
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
        <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Login</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:50px;">
            <div style="max-width:300px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2>Login</h2>
                <form action="/api/login" method="POST">
                    <input type="email" name="email" placeholder="Email" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <input type="password" name="password" placeholder="Password" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <button type="submit" style="background:#007bff; color:white; border:none; padding:10px; width:100%; border-radius:4px; cursor:pointer;">Login</button>
                </form>
                <br><a href="/">Go Back Home</a>
            </div>
        </body></html>
    `);
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
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
        <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Register</title></head>
        <body style="font-family:Arial, sans-serif; background:#f4f4f4; padding:50px;">
            <div style="max-width:300px; margin:auto; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <h2>Register</h2>
                <form action="/api/register" method="POST">
                    <input type="email" name="email" placeholder="Email" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <input type="password" name="password" placeholder="Password" style="width:100%; padding:8px; margin:5px 0;" required><br>
                    <button type="submit" style="background:#28a745; color:white; border:none; padding:10px; width:100%; border-radius:4px; cursor:pointer;">Register</button>
                </form>
                <br><a href="/">Go Back Home</a>
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

app.get('/admin-dashboard', (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    res.send(`<h2>Admin Panel</h2><br><a href="/logout">Logout</a>`);
});

// সার্ভার স্টার্ট
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
