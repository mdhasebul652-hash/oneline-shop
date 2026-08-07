const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;

// ফাইল আপলোড কনফিগারেশন (ছবি এবং ভিডিও উভয়ের জন্য)
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // ভিডিওর জন্য সাইজ লিমিট বাড়ানো হলো (৫০ মেগাবাইট)
});

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

const correctedDbURI = 'mongodb+srv://hasebul:hasebul1234@hasebul.v1tb47m.mongodb.net/?appName=hasebul';

mongoose.connect(correctedDbURI)
    .then(() => console.log('Database connected successfully!'))
    .catch(err => console.log('DB Connection Error:', err));

// ================= Schemas =================
const userSchema = new mongoose.Schema({ 
    email: { type: String, unique: true }, 
    password: String, 
    role: { type: String, default: 'user' },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' }
});
const User = mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema({ 
    name: String, 
    category: String, 
    price: Number, 
    description: String, 
    mainImage: String, 
    gallery: [String], 
    stock: Number,
    isFeatured: { type: Boolean, default: false },
    fbLink: { type: String, default: '' } // নতুন: পণ্যের জন্য ফেসবুক শপ/অর্ডার নাও লিংক
});
const Product = mongoose.model('Product', productSchema);

// নতুন স্কিমা: শর্ট ভিডিও কন্টেন্ট (১০ সেকেন্ড থেকে ১.৫ মিনিট)
const shortVideoSchema = new mongoose.Schema({
    title: String,
    videoFileName: String,
    fbLink: String,
    date: { type: String, default: () => new Date().toLocaleString() }
});
const ShortVideo = mongoose.model('ShortVideo', shortVideoSchema);

const cartSchema = new mongoose.Schema({ 
    userEmail: String, 
    items: [{ productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, quantity: Number }] 
});
const Cart = mongoose.model('Cart', cartSchema);

const wishlistSchema = new mongoose.Schema({ 
    userEmail: String, 
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }] 
});
const Wishlist = mongoose.model('Wishlist', wishlistSchema);

const couponSchema = new mongoose.Schema({
    code: { type: String, unique: true },
    discountPercentage: Number
});
const Coupon = mongoose.model('Coupon', couponSchema);

const orderSchema = new mongoose.Schema({ 
    userEmail: { type: String, default: '' }, 
    isGuest: { type: Boolean, default: false },
    guestName: { type: String, default: '' },
    guestPhone: { type: String, default: '' },
    guestEmail: { type: String, default: '' },
    items: Array, 
    subTotal: Number,
    discountAmount: { type: Number, default: 0 },
    deliveryCharge: Number,
    totalAmount: Number, 
    paymentMethod: String, 
    senderPhone: String, 
    trxId: String, 
    shippingAddress: String,
    status: { type: String, default: 'Pending' }, 
    paymentStatus: { type: String, default: 'Unverified' }, 
    trackingLocation: { type: String, default: 'Order received in warehouse' },
    date: { type: String, default: () => new Date().toLocaleString() } 
});
const Order = mongoose.model('Order', orderSchema);

const reviewSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    userEmail: String,
    rating: Number,
    comment: String,
    date: { type: String, default: () => new Date().toLocaleString() }
});
const Review = mongoose.model('Review', reviewSchema);

const settingSchema = new mongoose.Schema({ 
    key: String, 
    bkashNumber: String, 
    nagadNumber: String,
    insideDhakaCharge: { type: Number, default: 60 },
    outsideDhakaCharge: { type: Number, default: 120 }
});
const Setting = mongoose.model('Setting', settingSchema);

const chatSchema = new mongoose.Schema({ userEmail: String, productName: String, message: String, sender: String, date: String });
const Chat = mongoose.model('Chat', chatSchema);

const comparisonSchema = new mongoose.Schema({
    userEmail: String,
    sessionId: String,
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
});
const Comparison = mongoose.model('Comparison', comparisonSchema);

app.use((req, res, next) => {
    req.user = req.cookies.userSession ? JSON.parse(req.cookies.userSession) : null;
    next();
});

// ================= Floating Live Chat Widget HTML Snippet =================
const chatWidgetHTML = `
    <div id="live-chat-widget" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
        <button onclick="toggleChat()" style="background:#28a745; color:white; border:none; width:55px; height:55px; border-radius:50%; font-size:22px; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.3);">💬</button>
        <div id="chat-box" style="display:none; width:300px; background:white; border:1px solid #ccc; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.15); margin-bottom:10px;">
            <div style="background:#007bff; color:white; padding:10px; border-top-left-radius:8px; border-top-right-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <span>Live Customer Support</span>
                <button onclick="toggleChat()" style="background:none; border:none; color:white; font-size:16px; cursor:pointer;">✖</button>
            </div>
            <div style="padding:15px; height:200px; overflow-y:auto; font-size:13px; color:#555;">
                <p>স্বাগতম! আপনার কোনো প্রশ্ন থাকলে আমাদের সাথে চ্যাট করুন।</p>
            </div>
            <div style="padding:10px; border-top:1px solid #eee;">
                <form action="/api/send-chat" method="POST" style="display:flex; gap:5px;">
                    <input type="hidden" name="productName" value="General Chat">
                    <input type="text" name="message" placeholder="মেসেজ লিখুন..." style="flex:1; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px;" required>
                    <button style="background:#007bff; color:white; border:none; padding:6px 10px; border-radius:4px; font-size:12px; cursor:pointer;">Send</button>
                </form>
            </div>
        </div>
    </div>
    <script>
    function toggleChat() {
        var box = document.getElementById('chat-box');
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }
    </script>
`;

// ================= Home Page =================
app.get('/', async (req, res) => {
    const { category, search, minPrice, maxPrice, sort } = req.query;
    let query = {};
    
    if (category && category !== 'all') query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };
    
    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortOption = {};
    if (sort === 'low-high') sortOption.price = 1;
    else if (sort === 'high-low') sortOption.price = -1;
    else if (sort === 'newest') sortOption._id = -1;

    const products = await Product.find(query).sort(sortOption);
    const featuredProducts = await Product.find({ isFeatured: true }).limit(4);
    const shortVideos = await ShortVideo.find().sort({ _id: -1 }).limit(6); // শর্ট ভিডিও ডাটা ফেচ করা হলো

    res.send(`
        <body style="font-family:Arial; background:#f4f4f4; margin:0; padding:20px;">
            <div style="max-width:1100px; margin:auto;">
                <div style="background:white; padding:15px 25px; display:flex; justify-content:space-between; align-items:center; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <h2 style="margin:0; color:#007bff;"><a href="/" style="text-decoration:none; color:#007bff;">অনলাইন শপ</a></h2>
                    <form action="/" method="GET" style="display:flex; gap:5px;">
                        <input name="search" placeholder="পণ্য খুঁজুন..." value="${search || ''}" style="padding:8px; width:200px; border:1px solid #ddd; border-radius:4px;">
                        <button style="padding:8px 15px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer;">Search</button>
                    </form>
                    <div style="display:flex; gap:12px; font-size:18px; align-items:center;">
                        <a href="/compare" title="Compare Products" style="font-size:14px; text-decoration:none; background:#17a2b8; color:white; padding:5px 10px; border-radius:4px;">⚖️ Compare</a>
                        <a href="/track-order" title="Track Order" style="font-size:14px; text-decoration:none; background:#ffc107; color:black; padding:5px 10px; border-radius:4px; font-weight:bold;">🚚 Track</a>
                        <a href="/wishlist" title="Wishlist">❤️</a>
                        <a href="/cart" title="Cart">🛒</a> 
                        <a href="/my-orders" title="Orders">📦</a> 
                        <a href="/profile-check" title="Profile">👤</a> 
                        ${req.user?.role === 'admin' ? '<a href="/admin-dashboard" title="Admin">⚙️</a>' : ''}
                        ${req.user ? '<a href="/logout" title="Logout" style="font-size:14px; text-decoration:none; background:#dc3545; color:white; padding:6px 12px; border-radius:4px;">Logout</a>' : '<a href="/login" style="font-size:14px; text-decoration:none; background:#007bff; color:white; padding:6px 12px; border-radius:4px;">Login</a>'}
                    </div>
                </div>

                <!-- Filter & Sort Bar -->
                <div style="margin-top:15px; padding:15px; background:white; border-radius:8px; display:flex; flex-wrap:wrap; gap:15px; align-items:center; justify-content:space-between; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <div>
                        <strong>Categories: </strong>
                        <a href="/?category=all" style="margin-right:8px; text-decoration:none; color:#007bff;">All</a> | 
                        <a href="/?category=fashion" style="margin:0 8px; text-decoration:none; color:#007bff;">Fashion</a> | 
                        <a href="/?category=electronics" style="margin-left:8px; text-decoration:none; color:#007bff;">Electronics</a>
                    </div>
                    
                    <form action="/" method="GET" style="display:flex; gap:8px; align-items:center;">
                        <input type="hidden" name="category" value="${category || 'all'}">
                        <input type="number" name="minPrice" placeholder="Min ৳" value="${minPrice || ''}" style="width:70px; padding:6px; border:1px solid #ddd; border-radius:4px;">
                        <span>-</span>
                        <input type="number" name="maxPrice" placeholder="Max ৳" value="${maxPrice || ''}" style="width:70px; padding:6px; border:1px solid #ddd; border-radius:4px;">
                        
                        <select name="sort" style="padding:6px; border:1px solid #ddd; border-radius:4px;">
                            <option value="">Sort By</option>
                            <option value="low-high" ${sort === 'low-high' ? 'selected' : ''}>Price: Low to High</option>
                            <option value="high-low" ${sort === 'high-low' ? 'selected' : ''}>Price: High to Low</option>
                            <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest Arrivals</option>
                        </select>
                        <button style="padding:6px 12px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer;">Filter</button>
                    </form>
                </div>

                <!-- শর্ট ভিডিও কন্টেন্ট সেকশন (১০ সেঃ থেকে ১.৫ মিনিট ভিডিও এবং Order Now বাটন) -->
                ${shortVideos.length > 0 ? `
                    <h3 style="margin-top:25px; color:#333;">🎬 শর্ট ভিডিও কন্টেন্ট ও অর্ডার নাও</h3>
                    <div style="display:flex; flex-wrap:wrap; gap:15px;">
                        ${shortVideos.map(v => `
                            <div style="width:220px; background:white; padding:12px; text-align:center; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                                <video width="100" height="150" controls style="object-fit:cover; border-radius:4px; background:black;">
                                    <source src="/uploads/${v.videoFileName}" type="video/mp4">
                                </video>
                                <h4 style="margin:8px 0 5px 0; font-size:14px; height:35px; overflow:hidden;">${v.title}</h4>
                                ${v.fbLink ? `<a href="${v.fbLink}" target="_blank" style="display:block; background:#1877f2; color:white; padding:6px 10px; border-radius:4px; text-decoration:none; font-size:12px; font-weight:bold; margin-top:5px;">🛒 Order Now</a>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${!search && !category ? `
                    <h3 style="margin-top:25px; color:#333;">🔥 Featured / Best Seller Products</h3>
                    <div style="display:flex; flex-wrap:wrap; gap:15px;">
                        ${featuredProducts.map(fp => `
                            <div style="width:200px; background:white; padding:15px; text-align:center; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); position:relative;">
                                <span style="background:#ffc107; color:black; font-size:10px; font-weight:bold; padding:3px 6px; position:absolute; top:10px; left:10px; border-radius:3px;">Featured</span>
                                <img src="/uploads/${fp.mainImage}" width="140" height="140" style="object-fit:cover; border-radius:4px;"><br>
                                <h4 style="margin:10px 0 5px 0;">${fp.name}</h4>
                                <p style="color:#007bff; font-weight:bold; margin:5px 0;">৳ ${fp.price}</p>
                                <a href="/product/${fp._id}" style="display:inline-block; margin-top:5px; padding:6px 12px; background:#007bff; color:white; text-decoration:none; border-radius:4px; font-size:13px;">View Details</a>
                                ${fp.fbLink ? `<a href="${fp.fbLink}" target="_blank" style="display:block; margin-top:5px; padding:5px 10px; background:#1877f2; color:white; text-decoration:none; border-radius:4px; font-size:12px; font-weight:bold;">🛒 Order Now</a>` : ''}
                            </div>`).join('')}
                    </div>
                ` : ''}

                <h3 style="margin-top:25px; color:#333;">📦 All Products</h3>
                <div style="display:flex; flex-wrap:wrap; gap:15px;">
                    ${products.map(p => `
                        <div style="width:200px; background:white; padding:15px; text-align:center; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); position:relative;">
                            ${p.stock <= 0 ? '<span style="background:red; color:white; font-size:10px; padding:3px 6px; position:absolute; top:10px; left:10px; border-radius:3px;">Stock Out</span>' : ''}
                            <img src="/uploads/${p.mainImage}" width="140" height="140" style="object-fit:cover; border-radius:4px;"><br>
                            <h4 style="margin:10px 0 5px 0;">${p.name}</h4>
                            <p style="color:#007bff; font-weight:bold; margin:5px 0;">৳ ${p.price}</p>
                            <div style="display:flex; justify-content:center; gap:5px; margin-top:5px;">
                                <a href="/product/${p._id}" style="padding:5px 8px; background:#007bff; color:white; text-decoration:none; border-radius:4px; font-size:12px;">View</a>
                                <a href="/api/add-to-compare/${p._id}" style="padding:5px 8px; background:#17a2b8; color:white; text-decoration:none; border-radius:4px; font-size:12px;">Compare</a>
                            </div>
                            ${p.fbLink ? `<a href="${p.fbLink}" target="_blank" style="display:block; margin-top:6px; padding:5px 10px; background:#1877f2; color:white; text-decoration:none; border-radius:4px; font-size:12px; font-weight:bold;">🛒 Order Now</a>` : ''}
                        </div>`).join('')}
                </div>
            </div>
            ${chatWidgetHTML}
        </body>
    `);
});

// ================= Product Comparison Routes =================
app.get('/api/add-to-compare/:id', async (req, res) => {
    let productId = req.params.id;
    let userEmail = req.user ? req.user.email : '';
    let sessionId = req.cookies.sessionId || Math.random().toString();
    if (!req.cookies.sessionId) {
        res.cookie('sessionId', sessionId);
    }

    let comparison = await Comparison.findOne({ $or: [{ userEmail }, { sessionId }] });
    if (!comparison) {
        await new Comparison({ userEmail, sessionId, products: [productId] }).save();
    } else if (!comparison.products.includes(productId) && comparison.products.length < 3) {
        comparison.products.push(productId);
        await comparison.save();
    }
    res.redirect('/compare');
});

app.get('/compare', async (req, res) => {
    let userEmail = req.user ? req.user.email : '';
    let sessionId = req.cookies.sessionId || '';
    let comparison = await Comparison.findOne({ $or: [{ userEmail }, { sessionId }] }).populate('products');

    res.send(`
        <body style="font-family:Arial; background:#f4f4f4; padding:30px;">
            <div style="max-width:800px; margin:auto; background:white; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h2>⚖️ Product Comparison (সর্বোচ্চ ৩টি)</h2>
                <div style="display:flex; gap:20px; margin-top:20px;">
                    ${comparison && comparison.products.length > 0 ? comparison.products.map(p => `
                        <div style="flex:1; background:#f9f9f9; padding:15px; border-radius:6px; border:1px solid #ddd; text-align:center;">
                            <img src="/uploads/${p.mainImage}" width="120" height="120" style="object-fit:cover; border-radius:4px;"><br>
                            <h4 style="margin:10px 0 5px 0;">${p.name}</h4>
                            <p style="color:#007bff; font-weight:bold;">৳ ${p.price}</p>
                            <p style="font-size:13px; color:#555;">Category: ${p.category}</p>
                            <p style="font-size:13px; color:#555;">Stock: ${p.stock > 0 ? p.stock + ' pcs' : 'Out'}</p>
                            <p style="font-size:12px; color:#666;">${p.description || 'No description'}</p>
                            <a href="/api/remove-compare/${p._id}" style="background:#dc3545; color:white; text-decoration:none; padding:4px 8px; font-size:11px; border-radius:3px;">Remove</a>
                        </div>
                    `).join('') : '<p>No products added for comparison yet.</p>'}
                </div>
                <br><a href="/" style="text-decoration:none; color:#007bff;">← Back to Home</a>
            </div>
            ${chatWidgetHTML}
        </body>
    `);
});

app.get('/api/remove-compare/:id', async (req, res) => {
    let productId = req.params.id;
    let userEmail = req.user ? req.user.email : '';
    let sessionId = req.cookies.sessionId || '';
    await Comparison.updateOne({ $or: [{ userEmail }, { sessionId }] }, { $pull: { products: productId } });
    res.redirect('/compare');
});

// ================= Order Tracking Page =================
app.get('/track-order', async (req, res) => {
    let orderId = req.query.orderId || '';
    let orderData = null;
    if (orderId) {
        try {
            orderData = await Order.findById(orderId);
        } catch(e) {}
    }

    res.send(`
        <body style="font-family:Arial; background:#f4f4f4; padding:30px;">
            <div style="max-width:500px; margin:auto; background:white; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h2>🚚 Real-Time Order Tracking</h2>
                <form action="/track-order" method="GET" style="display:flex; gap:5px; margin-bottom:20px;">
                    <input type="text" name="orderId" placeholder="আপনার Order ID দিন..." value="${orderId}" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                    <button style="background:#007bff; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">Track</button>
                </form>

                ${orderId ? (orderData ? `
                    <div style="background:#f9f9f9; padding:15px; border-radius:6px; border:1px solid #ddd;">
                        <p style="margin:5px 0;"><strong>Order ID:</strong> ${orderData._id}</p>
                        <p style="margin:5px 0;"><strong>Status:</strong> <span style="color:green; font-weight:bold;">${orderData.status}</span></p>
                        <p style="margin:5px 0;"><strong>Tracking Location / Note:</strong> ${orderData.trackingLocation}</p>
                        <p style="margin:5px 0;"><strong>Total Amount:</strong> ৳ ${orderData.totalAmount}</p>
                    </div>
                ` : '<p style="color:red;">Invalid Order ID or not found!</p>') : ''}

                <br><a href="/" style="text-decoration:none; color:#007bff;">← Back to Home</a>
            </div>
            ${chatWidgetHTML}
        </body>
    `);
});

// ================= Profile Check =================
app.get('/profile-check', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    let dbUser = await User.findOne({ email: req.user.email });
    
    if (!dbUser || !dbUser.address || !dbUser.phone) {
        return res.redirect('/profile');
    } else {
        return res.redirect('/my-orders');
    }
});

// ================= Profile Setup =================
app.get('/profile', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    let dbUser = await User.findOne({ email: req.user.email });

    res.send(`
        <body style="font-family:Arial; background:#f4f4f4; padding:30px;">
            <div style="max-width:400px; margin:auto; background:white; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h2>Profile & Address Setup</h2>
                <form action="/api/update-profile" method="POST">
                    <label>Full Name:</label><br>
                    <input type="text" name="name" value="${dbUser?.name || ''}" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                    
                    <label>Phone Number:</label><br>
                    <input type="text" name="phone" value="${dbUser?.phone || ''}" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                    
                    <label>Shipping Address:</label><br>
                    <textarea name="address" style="width:100%; height:80px; padding:8px; margin:5px 0 15px 0; border:1px solid #ccc; border-radius:4px;" required>${dbUser?.address || ''}</textarea><br>
                    
                    <button style="background:#28a745; color:white; border:none; padding:10px; width:100%; border-radius:4px; cursor:pointer; font-size:15px;">Save & Continue</button>
                </form>
                <br><a href="/" style="text-decoration:none; color:#007bff;">← Back to Home</a>
            </div>
            ${chatWidgetHTML}
        </body>
    `);
});

app.post('/api/update-profile', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    const { name, phone, address } = req.body;
    await User.updateOne({ email: req.user.email }, { name, phone, address });
    res.send(`<script>alert('Profile updated successfully!'); window.location.href='/cart';</script>`);
});

// ================= Product Details & Lightbox Zoom =================
app.get('/product/:id', async (req, res) => {
    try {
        const p = await Product.findById(req.params.id);
        if (!p) return res.send('Product not found');
        
        const related = await Product.find({ category: p.category, _id: { $ne: p._id } }).limit(4);
        const reviews = await Review.find({ productId: p._id });

        res.send(`
            <body style="font-family:Arial; background:#f4f4f4; padding:30px;">
                <div style="max-width:800px; margin:auto; background:white; padding:30px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                    <div style="display:flex; gap:30px;">
                        <div>
                            <!-- Lightbox Zoom Preview Effect -->
                            <a href="/uploads/${p.mainImage}" target="_blank" title="Click to view full image">
                                <img id="mainImg" src="/uploads/${p.mainImage}" width="300" height="300" style="object-fit:cover; border:1px solid #ddd; border-radius:6px; cursor:zoom-in;">
                            </a><br>
                            <small style="color:#666; font-size:11px;">ছবির ওপর ক্লিক করে বড় সাইজে দেখতে পারেন</small>
                            <div style="display:flex; gap:5px; margin-top:10px;">
                                <img src="/uploads/${p.mainImage}" width="60" height="60" style="object-fit:cover; border:1px solid #ccc; cursor:pointer; border-radius:4px;" onclick="document.getElementById('mainImg').src='/uploads/${p.mainImage}'">
                                ${p.gallery.map(img => `<img src="/uploads/${img}" width="60" height="60" style="object-fit:cover; border:1px solid #ccc; cursor:pointer; border-radius:4px;" onclick="document.getElementById('mainImg').src='/uploads/${img}'">`).join('')}
                            </div>
                        </div>
                        <div>
                            <h2>${p.name}</h2>
                            <p style="color:#666;">Category: ${p.category}</p>
                            <h3 style="color:#007bff;">Price: ৳ ${p.price}</h3>
                            <p><strong>Stock Available:</strong> ${p.stock > 0 ? p.stock + ' pcs' : '<span style="color:red;">Stock Out</span>'}</p>
                            <p><strong>Description:</strong> ${p.description || 'No description'}</p>
                            
                            ${p.stock > 0 ? `
                                <form action="/api/add-to-cart" method="POST" style="display:inline;">
                                    <input type="hidden" name="productId" value="${p._id}">
                                    <button style="background:#28a745; color:white; border:none; padding:10px 15px; border-radius:4px; cursor:pointer; font-size:14px;">Add to Cart</button>
                                </form>
                            ` : ''}
                            
                            <form action="/api/add-to-wishlist" method="POST" style="display:inline; margin-left:5px;">
                                <input type="hidden" name="productId" value="${p._id}">
                                <button style="background:#dc3545; color:white; border:none; padding:10px 15px; border-radius:4px; cursor:pointer; font-size:14px;">❤️ Wishlist</button>
                            </form>
                            
                            ${p.fbLink ? `<div style="margin-top:12px;"><a href="${p.fbLink}" target="_blank" style="display:inline-block; padding:10px 15px; background:#1877f2; color:white; text-decoration:none; border-radius:4px; font-weight:bold;">🛒 Order Now (Facebook Link)</a></div>` : ''}
                        </div>
                    </div>
                    
                    <hr style="margin:30px 0;">
                    <h3>Customer Reviews & Ratings:</h3>
                    ${reviews.map(r => `
                        <div style="background:#f9f9f9; padding:10px; margin-bottom:8px; border-radius:4px; border:1px solid #eee;">
                            <strong>${r.userEmail}</strong> - <span style="color:orange;">${'★'.repeat(r.rating)}</span>
                            <p style="margin:5px 0;">${r.comment}</p>
                            <small style="color:#888;">${r.date}</small>
                        </div>
                    `).join('') || '<p>No reviews yet.</p>'}

                    ${req.user ? `
                        <form action="/api/add-review" method="POST" style="background:#f1f1f1; padding:15px; border-radius:6px; margin-top:15px;">
                            <input type="hidden" name="productId" value="${p._id}">
                            <label>Rating (1 to 5):</label>
                            <select name="rating" style="padding:5px; margin-right:10px;">
                                <option value="5">5 - Excellent</option>
                                <option value="4">4 - Good</option>
                                <option value="3">3 - Average</option>
                                <option value="2">2 - Poor</option>
                                <option value="1">1 - Bad</option>
                            </select><br><br>
                            <textarea name="comment" placeholder="আপনার রিভিউ লিখুন..." style="width:100%; height:50px; padding:6px; border:1px solid #ccc; border-radius:4px;" required></textarea><br>
                            <button style="background:#007bff; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Submit Review</button>
                        </form>
                    ` : ''}

                    <br><a href="/" style="text-decoration:none; color:#007bff;">← Back to Home</a>
                </div>
                ${chatWidgetHTML}
            </body>
        `);
    } catch (e) {
        res.send('Invalid Product ID');
    }
});

// ================= Wishlist Routes =================
app.post('/api/add-to-wishlist', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    const { productId } = req.body;
    let wishlist = await Wishlist.findOne({ userEmail: req.user.email });
    if (!wishlist) {
        wishlist = new Wishlist({ userEmail: req.user.email, products: [productId] });
    } else if (!wishlist.products.includes(productId)) {
        wishlist.products.push(productId);
    }
    await wishlist.save();
    res.redirect('/wishlist');
});

app.get('/wishlist', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    let wishlist = await Wishlist.findOne({ userEmail: req.user.email }).populate('products');

    res.send(`
        <body style="font-family:Arial; background:#f4f4f4; padding:30px;">
            <div style="max-width:650px; margin:auto; background:white; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h2>My Wishlist (❤️)</h2>
                <div style="display:flex; flex-wrap:wrap; gap:15px; margin-top:20px;">
                    ${wishlist && wishlist.products.length > 0 ? wishlist.products.map(p => `
                        <div style="width:160px; background:#f9f9f9; padding:10px; text-align:center; border-radius:6px; border:1px solid #ddd;">
                            <img src="/uploads/${p.mainImage}" width="100" height="100" style="object-fit:cover; border-radius:4px;"><br>
                            <h5 style="margin:5px 0; height:30px; overflow:hidden;">${p.name}</h5>
                            <p style="color:#007bff; margin:5px 0; font-weight:bold;">৳ ${p.price}</p>
                            <div style="display:flex; justify-content:center; gap:5px; margin-top:5px;">
                                <a href="/product/${p._id}" style="font-size:11px; text-decoration:none; background:#007bff; color:white; padding:4px 6px; border-radius:3px;">View</a>
                                ${p.stock > 0 ? `
                                    <form action="/api/add-to-cart-from-wishlist" method="POST">
                                        <input type="hidden" name="productId" value="${p._id}">
                                        <button style="font-size:11px; background:#28a745; color:white; border:none; padding:4px 6px; border-radius:3px; cursor:pointer;">Add to Cart</button>
                                    </form>
                                ` : '<span style="font-size:10px; color:red;">Stock Out</span>'}
                            </div>
                        </div>
                    `).join('') : '<p>Wishlist is empty.</p>'}
                </div>
                <br><a href="/" style="text-decoration:none; color:#007bff;">← Back to Home</a>
            </div>
            ${chatWidgetHTML}
        </body>
    `);
});

app.post('/api/add-to-cart-from-wishlist', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    const { productId } = req.body;
    let product = await Product.findById(productId);
    if (!product || product.stock <= 0) return res.redirect('/wishlist');

    let cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) {
        cart = new Cart({ userEmail: req.user.email, items: [{ productId, quantity: 1 }] });
    } else {
        let itemIndex = cart.items.findIndex(i => i.productId.toString() === productId);
        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += 1;
        } else {
            cart.items.push({ productId, quantity: 1 });
        }
    }
    await cart.save();
    res.redirect('/cart');
});

// ================= Review Submission =================
app.post('/api/add-review', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    const { productId, rating, comment } = req.body;
    await new Review({ productId, userEmail: req.user.email, rating, comment }).save();
    res.redirect(`/product/${productId}`);
});

// ================= Add to Cart =================
app.post('/api/add-to-cart', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    
    let dbUser = await User.findOne({ email: req.user.email });
    if (!dbUser || !dbUser.address || !dbUser.phone) {
        return res.send(`<script>alert('দয়া করে প্রথমে আপনার প্রোফাইল এবং ঠিকানা সেট করুন!'); window.location.href='/profile';</script>`);
    }

    const { productId } = req.body;
    let product = await Product.findById(productId);
    if (!product || product.stock <= 0) {
        return res.send(`<script>alert('দুঃখিত, পণ্যটি স্টক আউট!'); window.location.href='/';</script>`);
    }

    let cart = await Cart.findOne({ userEmail: req.user.email });
    if (!cart) {
        cart = new Cart({ userEmail: req.user.email, items: [{ productId, quantity: 1 }] });
    } else {
        let itemIndex = cart.items.findIndex(i => i.productId.toString() === productId);
        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += 1;
        } else {
            cart.items.push({ productId, quantity: 1 });
        }
    }
    await cart.save();
    res.redirect('/cart');
});

// ================= Cart, Guest Checkout & Place Order =================
app.get('/cart', async (req, res) => {
    let userEmail = req.user ? req.user.email : '';
    let dbUser = req.user ? await User.findOne({ email: userEmail }) : null;
    
    let cartQuery = req.user ? { userEmail } : { userEmail: 'guest_cart' }; 
    let cart = await Cart.findOne(cartQuery).populate('items.productId');
    let setting = await Setting.findOne({ key: 'adminSettings' }) || { bkashNumber: '01XXXXXXXXX', nagadNumber: '01XXXXXXXXX', insideDhakaCharge: 60, outsideDhakaCharge: 120 };
    
    let subTotal = 0;
    let itemsHTML = '';
    if (cart && cart.items.length > 0) {
        itemsHTML = cart.items.map(i => {
            if (!i.productId) return '';
            let subtotal = i.productId.price * i.quantity;
            subTotal += subtotal;
            return `<tr>
                <td style="padding:10px; border-bottom:1px solid #ddd;">${i.productId.name}</td>
                <td style="padding:10px; border-bottom:1px solid #ddd;">৳ ${i.productId.price}</td>
                <td style="padding:10px; border-bottom:1px solid #ddd;">${i.quantity}</td>
                <td style="padding:10px; border-bottom:1px solid #ddd;">৳ ${subtotal}</td>
            </tr>`;
        }).join('');
    }

    let appliedCouponCode = req.query.coupon || '';
    let discountAmount = 0;
    let discountPercent = 0;
    if (appliedCouponCode) {
        let couponObj = await Coupon.findOne({ code: appliedCouponCode });
        if (couponObj) {
            discountPercent = couponObj.discountPercentage;
            discountAmount = (subTotal * discountPercent) / 100;
        }
    }

    let defaultCharge = setting.insideDhakaCharge;
    let finalPayable = subTotal - discountAmount + defaultCharge;

    res.send(`
        <body style="font-family:Arial; background:#f4f4f4; padding:30px;">
            <div style="max-width:650px; margin:auto; background:white; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h2>Shopping Cart & Checkout (🛒)</h2>
                
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <tr style="background:#eee;"><th style="padding:10px;">Product</th><th>Price</th><th>Qty</th><th>Total</th></tr>
                    ${itemsHTML || '<tr><td colspan="4" style="padding:15px; text-align:center;">Cart is empty</td></tr>'}
                </table>
                <p>SubTotal: ৳ ${subTotal}</p>
                
                ${subTotal > 0 ? `
                    <div style="background:#f9f9f9; padding:10px; border-radius:5px; margin-bottom:15px;">
                        <form action="/cart" method="GET" style="display:flex; gap:5px;">
                            <input type="text" name="coupon" placeholder="কুপন কোড দিন (যেমন: EID10)" value="${appliedCouponCode}" style="padding:6px; flex:1; border:1px solid #ccc; border-radius:4px;">
                            <button style="padding:6px 12px; background:#17a2b8; color:white; border:none; border-radius:4px; cursor:pointer;">Apply Coupon</button>
                        </form>
                        ${appliedCouponCode ? (discountPercent > 0 ? `<p style="color:green; font-size:13px; margin:5px 0 0 0;">কুপন সফলভাবে অ্যাপ্লাই হয়েছে! (${discountPercent}% ছাড়)</p>` : `<p style="color:red; font-size:13px; margin:5px 0 0 0;">ভুল কুপন কোড!</p>`) : ''}
                    </div>

                    <form action="/api/place-order" method="POST">
                        <input type="hidden" name="discountAmount" value="${discountAmount}">
                        
                        <h3>Delivery & Billing Information:</h3>
                        ${!req.user ? `
                            <p style="color:#d9534f; font-size:13px;">* আপনি লগইন করা ছাড়া গেস্ট চেকআউট ব্যবহার করছেন।</p>
                            <label>নাম:</label><br><input type="text" name="guestName" style="width:100%; padding:8px; margin:5px 0;" required><br>
                            <label>ফোন নম্বর:</label><br><input type="text" name="guestPhone" style="width:100%; padding:8px; margin:5px 0;" required><br>
                            <label>ইমেইল (অর্ডার আপডেটের জন্য):</label><br><input type="email" name="guestEmail" style="width:100%; padding:8px; margin:5px 0;" required><br>
                        ` : `<p><strong>Logged in as:</strong> ${req.user.email} (<a href="/profile">Edit Profile</a>)</p>`}

                        <label>ডেলিভারি ঠিকানা:</label><br>
                        <textarea name="shippingAddress" style="width:100%; height:60px; padding:8px; margin:5px 0;" required>${dbUser ? dbUser.address : ''}</textarea><br>

                        <h3>Select Delivery Area:</h3>
                        <label><input type="radio" name="deliveryArea" value="inside" onclick="updateTotal(${subTotal}, ${discountAmount}, ${setting.insideDhakaCharge})" checked> ঢাকার ভেতরে (চার্জ: ৳ ${setting.insideDhakaCharge})</label><br>
                        <label><input type="radio" name="deliveryArea" value="outside" onclick="updateTotal(${subTotal}, ${discountAmount}, ${setting.outsideDhakaCharge})"> ঢাকার বাইরে (চার্জ: ৳ ${setting.outsideDhakaCharge})</label><br>
                        
                        <div style="font-size:15px; margin:10px 0;">
                            ${discountAmount > 0 ? `Discount: - ৳ ${discountAmount}<br>` : ''}
                            <h3 style="margin:5px 0;">Total Amount: ৳ <span id="finalTotal">${finalPayable}</span></h3>
                        </div>

                        <h3>Select Payment Method:</h3>
                        <label><input type="radio" name="paymentMethod" value="Cash On Delivery" onclick="togglePaymentFields(false)" checked> Cash on Delivery</label><br>
                        <label><input type="radio" name="paymentMethod" value="bKash" onclick="togglePaymentFields(true)"> bKash (Personal: ${setting.bkashNumber})</label><br>
                        <label><input type="radio" name="paymentMethod" value="Nagad" onclick="togglePaymentFields(true)"> Nagad (Personal: ${setting.nagadNumber})</label><br><br>
                        
                        <div id="onlinePaymentFields" style="display:none; background:#f9f9f9; padding:15px; border-radius:6px; border:1px solid #ddd;">
                            <label>যে নম্বর থেকে টাকা পাঠিয়েছেন:</label><br>
                            <input type="text" name="senderPhone" placeholder="e.g. 017xxxxxxxx" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;"><br>
                            <label>Transaction ID (TrxID) - ঐচ্ছিক:</label><br>
                            <input type="text" name="trxId" placeholder="e.g. 9H7G6F5D (না বুঝলে খালি রাখতে পারেন)" style="width:100%; padding:8px; margin:5px 0; border:1px solid #ccc; border-radius:4px;">
                        </div><br>
                        
                        <button style="background:#28a745; color:white; border:none; padding:12px 20px; font-size:16px; border-radius:4px; cursor:pointer; width:100%;">Confirm & Place Order</button>
                    </form>
                ` : ''}
                <br><a href="/" style="text-decoration:none; color:#007bff;">← Continue Shopping</a>
            </div>
            
            <script>
                function togglePaymentFields(show) {
                    document.getElementById('onlinePaymentFields').style.display = show ? 'block' : 'none';
                }
                function updateTotal(sub, discount, charge) {
                    document.getElementById('finalTotal').innerText = (sub - discount) + charge;
                }
            </script>
            ${chatWidgetHTML}
        </body>
    `);
});

app.post('/api/place-order', async (req, res) => {
    let userEmail = req.user ? req.user.email : '';
    let isGuest = !req.user;
    const { paymentMethod, senderPhone, trxId, deliveryArea, discountAmount, guestName, guestPhone, guestEmail, shippingAddress } = req.body;

    let setting = await Setting.findOne({ key: 'adminSettings' }) || { insideDhakaCharge: 60, outsideDhakaCharge: 120 };
    let deliveryCharge = deliveryArea === 'outside' ? setting.outsideDhakaCharge : setting.insideDhakaCharge;

    let cartQuery = req.user ? { userEmail } : { userEmail: 'guest_cart' };
    let cart = await Cart.findOne(cartQuery).populate('items.productId');
    if (!cart || cart.items.length === 0) return res.redirect('/cart');

    let subTotal = 0;
    let orderItems = [];
    for (let i of cart.items) {
        if (!i.productId) continue;
        subTotal += i.productId.price * i.quantity;
        orderItems.push({ name: i.productId.name, price: i.productId.price, qty: i.quantity });
        await Product.findByIdAndUpdate(i.productId._id, { $inc: { stock: -i.quantity } });
    }

    let discount = parseFloat(discountAmount) || 0;
    let totalAmount = subTotal - discount + deliveryCharge;

    let newOrder = await new Order({
        userEmail: isGuest ? guestEmail : userEmail,
        isGuest,
        guestName: isGuest ? guestName : '',
        guestPhone: isGuest ? guestPhone : '',
        guestEmail: isGuest ? guestEmail : '',
        items: orderItems,
        subTotal,
        discountAmount: discount,
        deliveryCharge,
        totalAmount,
        paymentMethod,
        senderPhone: senderPhone || 'N/A',
        trxId: trxId || 'N/A',
        shippingAddress,
        status: 'Pending',
        trackingLocation: 'Order placed successfully and sent to warehouse',
        paymentStatus: paymentMethod === 'Cash On Delivery' ? 'Verified' : 'Unverified'
    }).save();

    await Cart.findOneAndDelete(cartQuery);
    res.send(`<script>alert('Order Placed Successfully! Order ID: ${newOrder._id}'); window.location.href='/track-order?orderId=${newOrder._id}';</script>`);
});

// ================= My Orders =================
app.get('/my-orders', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    let orders = await Order.find({ userEmail: req.user.email });

    res.send(`
        <body style="font-family:Arial; background:#f4f4f4; padding:30px;">
            <div style="max-width:700px; margin:auto; background:white; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h2>My Orders & Tracking (📦)</h2>
                <a href="/" style="text-decoration:none; color:#007bff;">← Home</a>
                ${orders.map(o => `
                    <div style="border:1px solid #ddd; padding:15px; margin-top:15px; border-radius:6px; background:#fff;">
                        <p style="margin:5px 0;"><strong>Order ID:</strong> ${o._id}</p>
                        <p style="margin:5px 0;"><strong>Total:</strong> ৳ ${o.totalAmount} | <strong>Status:</strong> <span style="color:green; font-weight:bold;">${o.status}</span></p>
                        <p style="margin:5px 0;"><strong>Location/Note:</strong> ${o.trackingLocation}</p>
                        <div style="margin-top:10px;">
                            <a href="/invoice/${o._id}" target="_blank" style="background:#17a2b8; color:white; padding:5px 10px; text-decoration:none; border-radius:4px; font-size:13px;">📄 Invoice</a>
                        </div>
                    </div>`).join('') || '<p>No orders yet.</p>'}
            </div>
            ${chatWidgetHTML}
        </body>
    `);
});

// ================= Invoice Page =================
app.get('/invoice/:id', async (req, res) => {
    let order = await Order.findById(req.params.id);
    if (!order) return res.send('Order not found');

    res.send(`
        <body style="font-family:Arial; padding:40px; background:white;">
            <div style="max-width:600px; margin:auto; border:1px solid #ddd; padding:30px; border-radius:8px;">
                <h2 style="text-align:center; color:#007bff;">অনলাইন শপ - ইনভয়েস</h2>
                <p><strong>Order ID:</strong> ${order._id}</p>
                <p><strong>Date:</strong> ${order.date}</p>
                <p><strong>Shipping Address:</strong> ${order.shippingAddress}</p>
                <table style="width:100%; border-collapse:collapse; margin-top:20px; text-align:left;">
                    <tr style="background:#f4f4f4;"><th style="padding:8px; border:1px solid #ddd;">Product</th><th style="padding:8px; border:1px solid #ddd;">Qty</th><th style="padding:8px; border:1px solid #ddd;">Price</th></tr>
                    ${order.items.map(i => `
                        <tr>
                            <td style="padding:8px; border:1px solid #ddd;">${i.name}</td>
                            <td style="padding:8px; border:1px solid #ddd;">${i.qty}</td>
                            <td style="padding:8px; border:1px solid #ddd;">৳ ${i.price * i.qty}</td>
                        </tr>
                    `).join('')}
                </table>
                <div style="margin-top:20px; text-align:right;">
                    <h3>Total Amount: ৳ ${order.totalAmount}</h3>
                </div>
                <div style="text-align:center; margin-top:30px;">
                    <button onclick="window.print()" style="background:#007bff; color:white; border:none; padding:10px 20px; border-radius:4px; cursor:pointer;">Print Invoice</button>
                </div>
            </div>
        </body>
    `);
});

// ================= Chat System =================
app.post('/api/send-chat', async (req, res) => {
    let userEmail = req.user ? req.user.email : 'guest@shop.com';
    await new Chat({ userEmail, productName: req.body.productName, message: req.body.message, sender: 'user', date: new Date().toLocaleString() }).save();
    res.send(`<script>alert('Message sent successfully!'); window.history.back();</script>`);
});

// ================= Admin Dashboard =================
app.get('/admin-dashboard', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    let orders = await Order.find();
    let products = await Product.find();
    let shortVideos = await ShortVideo.find();
    let setting = await Setting.findOne({ key: 'adminSettings' }) || { bkashNumber: '', nagadNumber: '', insideDhakaCharge: 60, outsideDhakaCharge: 120 };

    res.send(`
        <body style="font-family:Arial; background:#f4f4f4; padding:20px;">
            <div style="max-width:950px; margin:auto; background:white; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h2>Admin Panel (⚙️)</h2>
                <a href="/" style="text-decoration:none; color:#007bff;">← Home</a>
                
                <h3>ডেলিভারি চার্জ ও পেমেন্ট সেটআপ</h3>
                <form action="/api/save-settings" method="POST" style="background:#eef9ff; padding:15px; border-radius:6px; margin-bottom:20px;">
                    <label>bKash:</label> <input type="text" name="bkashNumber" value="${setting.bkashNumber}" style="padding:5px; width:120px; margin-right:10px;">
                    <label>Nagad:</label> <input type="text" name="nagadNumber" value="${setting.nagadNumber}" style="padding:5px; width:120px; margin-right:10px;"><br><br>
                    <button style="background:#007bff; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">Save Settings</button>
                </form>

                <h3>Add New Product (ফেসবুক শপ লিংক সহ)</h3>
                <form action="/api/add-product" method="POST" enctype="multipart/form-data" style="background:#f9f9f9; padding:15px; border-radius:6px; margin-bottom:20px;">
                    <input name="name" placeholder="Product Name" style="padding:8px; margin:5px;" required>
                    <input name="category" placeholder="Category" style="padding:8px; margin:5px;" required>
                    <input name="price" type="number" placeholder="Price" style="padding:8px; margin:5px;" required>
                    <input name="stock" type="number" placeholder="Stock Qty" style="padding:8px; margin:5px;" required><br>
                    <input name="fbLink" placeholder="Facebook Order/Home URL (যেমন: https://facebook.com/...)" style="width:98%; padding:8px; margin:5px;"><br>
                    <label><input type="checkbox" name="isFeatured" value="true"> Mark as Featured / Best Seller</label><br><br>
                    <label>Main Image:</label> <input type="file" name="mainImage" accept="image/*" required><br><br>
                    <label>Gallery Images:</label> <input type="file" name="gallery" accept="image/*" multiple><br><br>
                    <textarea name="description" placeholder="Description..." style="width:100%; height:60px; padding:8px; margin:5px 0;"></textarea><br>
                    <button style="background:#28a745; color:white; border:none; padding:10px 20px; border-radius:4px; cursor:pointer;">Add Product</button>
                </form>

                <h3>🎬 Add Short Video Content (১০ সেকেন্ড থেকে ১.৫ মিনিট ও Order Now বাটন)</h3>
                <form action="/api/add-short-video" method="POST" enctype="multipart/form-data" style="background:#fff3cd; padding:15px; border-radius:6px; margin-bottom:20px;">
                    <input name="title" placeholder="ভিডিওর শিরোনাম / পণ্যের নাম" style="padding:8px; margin:5px; width:40%;" required>
                    <input name="fbLink" placeholder="ফেসবুক অর্ডার নাও লিংক (প্রোডাক্ট বা হোমপেজ URL)" style="padding:8px; margin:5px; width:50%;" required><br><br>
                    <label>শর্ট ভিডিও ফাইল আপলোড করুন (১০ সেঃ থেকে ১.৫ মিনিট):</label><br>
                    <input type="file" name="videoFile" accept="video/*" required style="margin:5px 0;"><br><br>
                    <button style="background:#1877f2; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">শর্ট ভিডিও আপলোড করুন</button>
                </form>

                <h3>📦 Customer Orders & Real-time Tracking Update</h3>
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
                    <tr style="background:#eee;"><th style="padding:8px;">Customer</th><th>Total</th><th>Status & Tracking Note</th><th>Action</th></tr>
                    ${orders.map(o => `
                        <tr style="border-bottom:1px solid #ddd;">
                            <td style="padding:8px;">${o.userEmail || o.guestEmail}</td>
                            <td style="padding:8px;">৳ ${o.totalAmount}</td>
                            <td style="padding:8px;">
                                <form action="/api/update-order-status" method="POST">
                                    <input type="hidden" name="orderId" value="${o._id}">
                                    <select name="status" style="padding:3px;">
                                        <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                        <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
                                        <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                                        <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                                    </select><br>
                                    <input type="text" name="trackingLocation" value="${o.trackingLocation}" placeholder="Location update..." style="width:150px; padding:3px; margin-top:3px;">
                                    <button style="background:#007bff; color:white; border:none; padding:3px 6px; border-radius:3px; cursor:pointer; margin-top:3px;">Update</button>
                                </form>
                            </td>
                            <td style="padding:8px;"><a href="/invoice/${o._id}" target="_blank">Invoice</a></td>
                        </tr>
                    `).join('') || '<tr><td colspan="4" style="padding:8px;">No orders found</td></tr>'}
                </table>
            </div>
        </body>
    `);
});

app.post('/api/save-settings', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    const { bkashNumber, nagadNumber } = req.body;
    await Setting.findOneAndUpdate({ key: 'adminSettings' }, { bkashNumber, nagadNumber }, { upsert: true });
    res.redirect('/admin-dashboard');
});

app.post('/api/update-order-status', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    const { orderId, status, trackingLocation } = req.body;
    await Order.findByIdAndUpdate(orderId, { status, trackingLocation });
    res.redirect('/admin-dashboard');
});

app.post('/api/add-product', upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'gallery', maxCount: 5 }]), async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    const { name, category, price, description, stock, isFeatured, fbLink } = req.body;
    const mainImage = req.files['mainImage'] ? req.files['mainImage'][0].filename : '';
    const gallery = req.files['gallery'] ? req.files['gallery'].map(f => f.filename) : [];
    
    await new Product({ name, category, price, description, stock, mainImage, gallery, isFeatured: isFeatured === 'true', fbLink }).save();
    res.redirect('/admin-dashboard');
});

// নতুন রাউট: শর্ট ভিডিও আপলোড হ্যান্ডেল করার জন্য
app.post('/api/add-short-video', upload.single('videoFile'), async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    const { title, fbLink } = req.body;
    const videoFileName = req.file ? req.file.filename : '';

    if (videoFileName) {
        await new ShortVideo({ title, videoFileName, fbLink }).save();
    }
    res.redirect('/admin-dashboard');
});

// ================= Auth Routes =================
app.get('/login', (req, res) => res.send(`
    <body style="font-family:Arial; background:#f4f4f4; padding:50px;">
        <div style="max-width:300px; margin:auto; background:white; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
            <h2>Login</h2>
            <form action="/api/login" method="POST">
                <input type="email" name="email" placeholder="Email" style="width:100%; padding:8px; margin:5px 0 15px 0;" required><br>
                <input type="password" name="password" placeholder="Password" style="width:100%; padding:8px; margin:5px 0 10px 0;" required><br>
                <button style="background:#007bff; color:white; border:none; padding:10px; width:100%; border-radius:4px; cursor:pointer;">Login</button>
            </form>
            <br><a href="/register">Register</a>
        </div>
        ${chatWidgetHTML}
    </body>
`));

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    let role = (email === 'admin@gmail.com' && password === '1234') ? 'admin' : 'user';

    if (role === 'user') {
        let user = await User.findOne({ email });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.send(`<script>alert('Invalid credentials!'); window.location.href='/login';</script>`);
        }
    }
    res.cookie('userSession', JSON.stringify({ email, role }), { httpOnly: true });
    res.redirect(role === 'admin' ? '/admin-dashboard' : '/');
});

app.get('/register', (req, res) => res.send(`
    <body style="font-family:Arial; background:#f4f4f4; padding:50px;">
        <div style="max-width:300px; margin:auto; background:white; padding:25px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
            <h2>Register</h2>
            <form action="/api/register" method="POST">
                <input type="email" name="email" placeholder="Email" style="width:100%; padding:8px; margin:5px 0 15px 0;" required><br>
                <input type="password" name="password" placeholder="Password" style="width:100%; padding:8px; margin:5px 0 15px 0;" required><br>
                <button style="background:#28a745; color:white; border:none; padding:10px; width:100%; border-radius:4px; cursor:pointer;">Register</button>
            </form>
        </div>
        ${chatWidgetHTML}
    </body>
`));

app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await new User({ email, password: hashedPassword }).save();
        res.redirect('/login');
    } catch (e) {
        res.send(`<script>alert('Email already exists!'); window.location.href='/register';</script>`);
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('userSession');
    res.redirect('/');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
