const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= Database Connection (MongoDB Atlas) =================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://hasebul:hasebul1234@hasebul.v1tb47m.mongodb.net/?appName=hasebul';
mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch(err => console.log("DB Connection Error: ", err));

// ================= Middlewares & Setup =================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Ensure upload directory exists to prevent Multer crashes
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ================= Mongoose Schemas & Models =================
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    isBlocked: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true },
    maxLimit: { type: Number, default: 4 }, // Daraj style max purchase limit per order set by admin
    description: { type: String, default: '' },
    mainImage: { type: String, default: '' },
    gallery: [String],
    soldCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

const reviewSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    userEmail: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});
const Review = mongoose.model('Review', reviewSchema);

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    discountAmount: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Coupon = mongoose.model('Coupon', couponSchema);

const orderSchema = new mongoose.Schema({
    userEmail: String,
    items: Array, 
    productPrice: Number,
    deliveryCharge: Number,
    discountPrice: { type: Number, default: 0 },
    totalAmount: Number,
    deliveryArea: String,
    customerNote: { type: String, default: '' },
    paymentMethod: String,
    senderNumber: String,
    paidAmount: Number,
    trxId: String,
    status: { type: String, default: 'Pending' },
    previousStatus: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

const chatSchema = new mongoose.Schema({
    productId: String,
    productName: String,
    productImage: String, // Added image support for admin message box
    userEmail: String,
    message: String,
    reply: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', chatSchema);

const siteSettingSchema = new mongoose.Schema({
    bkashNumber: { type: String, default: '01700000000' },
    nagadNumber: { type: String, default: '01800000000' },
    pageId: { type: String, default: '' },
    accessToken: { type: String, default: '' }
});
const SiteSetting = mongoose.model('SiteSetting', siteSettingSchema);

// Middleware to load logged-in user
app.use(async (req, res, next) => {
    try {
        if (req.cookies && req.cookies.userSession) {
            let sessionData = JSON.parse(req.cookies.userSession);
            let user = await User.findOne({ email: sessionData.email });
            if (user) req.user = user;
        }
    } catch (e) {
        req.user = null;
    }
    next();
});

// ================= Daraj-Style Global CSS & Layout =================
const globalHeaderHTML = `
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0 0 65px 0; background: #f4f4f4; color: #222; -webkit-text-size-adjust: 100%; }
        header { background: #f85606; color: white; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 5px rgba(0,0,0,0.1); width: 100%; }
        .logo { font-size: 18px; font-weight: bold; text-decoration: none; color: white; white-space: nowrap; }
        .search-bar { display: flex; flex: 1; max-width: 550px; margin: 0 10px; }
        .search-bar input { width: 100%; padding: 8px 12px; border: none; border-radius: 4px 0 0 4px; outline: none; font-size: 14px; }
        .search-bar button { background: #ffe11b; border: none; padding: 0 15px; border-radius: 0 4px 4px 0; cursor: pointer; font-weight: bold; font-size: 14px; color: #333; }
        .categories-nav { background: white; padding: 10px 15px; display: flex; gap: 10px; overflow-x: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.05); white-space: nowrap; -webkit-overflow-scrolling: touch; position: sticky; top: 55px; z-index: 999; }
        .categories-nav::-webkit-scrollbar { display: none; }
        .categories-nav a { text-decoration: none; color: #333; font-size: 13px; font-weight: 500; padding: 6px 12px; background: #f0f0f0; border-radius: 20px; transition: 0.2s; }
        .categories-nav a:hover { background: #f85606; color: white; }
        .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; background: #fff; display: flex; justify-content: space-around; padding: 8px 0; border-top: 1px solid #ddd; z-index: 1000; box-shadow: 0 -2px 5px rgba(0,0,0,0.05); }
        .bottom-nav a { text-decoration: none; color: #666; font-size: 11px; display: flex; flex-direction: column; align-items: center; text-align: center; font-weight: 500; }
        .bottom-nav a span { font-size: 18px; margin-bottom: 2px; }
        .bottom-nav a:hover, .bottom-nav a.active { color: #f85606; }
        .container { max-width: 1200px; margin: 15px auto; padding: 0 10px; width: 100%; }
        .product-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .product-card { background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; justify-content: space-between; text-decoration: none; color: inherit; transition: transform 0.2s; }
        .product-card img { width: 100%; height: 160px; object-fit: cover; border-radius: 4px; }
        .product-card h4 { font-size: 14px; color: #222; margin: 8px 0 4px 0; height: 38px; overflow: hidden; line-height: 1.3; font-weight: 600; }
        .price { color: #f85606; font-size: 16px; font-weight: bold; margin: 4px 0; }
        .btn { background: #f85606; color: white; border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer; text-decoration: none; text-align: center; display: inline-block; font-size: 14px; font-weight: 600; }
        .btn-buy { background: #ffe11b; color: #333; font-weight: bold; }
        @media (min-width: 768px) {
            .product-grid { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 15px; }
            .product-card img { height: 190px; }
            .bottom-nav { display: none; }
            body { padding-bottom: 0; }
        }
    </style>
`;

const getNavbarHTML = (user) => `
    <header>
        <a href="/" class="logo">🛒 Online Shop</a>
        <form action="/search" method="GET" class="search-bar">
            <input type="text" name="q" placeholder="Search in Online Shop..." required>
            <button type="submit">🔍</button>
        </form>
    </header>
    <div class="categories-nav">
        <a href="/">🔥 All</a>
        <a href="/category/Fashion">👗 ফ্যাশন</a>
        <a href="/category/Supershop">🛒 সুপার শপ</a>
        <a href="/category/Pharmacy">💊 ফার্মেসি</a>
        <a href="/category/Food">🍲 খাদ্যপণ্য</a>
        <a href="/category/Sports">⚽ স্পোর্টস</a>
        <a href="/category/Books">📚 বই</a>
        <a href="/category/Stationery">✏️ স্টেশনারি</a>
        <a href="/category/HomeDecor">🛋️ হোম ডেকোর ও ফার্নিচার</a>
        <a href="/category/BeautyCare">💄 বিউটি পার্লার কেয়ার</a>
        <a href="/category/Electric">⚡ ইলেকট্রিক</a>
    </div>
    <div class="bottom-nav">
        <a href="/"><span>🏠</span>Home</a>
        <a href="/wishlist"><span>❤️</span>Wishlist</a>
        <a href="/cart"><span>🛒</span>Cart</a>
        <a href="/my-orders"><span>📦</span>Orders</a>
        ${user ? `<a href="/dashboard"><span>👤</span>Account</a>` : `<a href="/login"><span>🔑</span>Login</a>`}
        ${user && user.role === 'admin' ? `<a href="/admin-dashboard"><span>⚙️</span>Admin</a>` : ''}
    </div>
`;

// ================= Public & Homepage Routes =================
app.get('/', async (req, res, next) => {
    try {
        let categoryFilter = req.query.category;
        let query = categoryFilter ? { category: categoryFilter } : {};
        let products = await Product.find(query).sort({ _id: -1 });
        
        let productsHTML = products.map(p => `
            <a href="/product/${p._id}" class="product-card">
                <img src="/uploads/${p.mainImage}" alt="${p.name}">
                <h4>${p.name}</h4>
                <div class="price">৳${p.price}</div>
                <div style="font-size:11px; color:#888;">Stock: ${p.stock}</div>
            </a>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Online Shop - Home</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container">
                    <h3 style="margin: 10px 0 15px 0; font-size: 17px; color: #333;">Flash Sale & Recommended</h3>
                    <div class="product-grid">${productsHTML.length ? productsHTML : '<p style="padding:20px; background:white; text-align:center;">No products found.</p>'}</div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

app.get('/category/:name', async (req, res, next) => {
    try {
        let catName = req.params.name;
        let products = await Product.find({ category: catName });
        let productsHTML = products.map(p => `
            <a href="/product/${p._id}" class="product-card">
                <img src="/uploads/${p.mainImage}" alt="${p.name}">
                <h4>${p.name}</h4>
                <div class="price">৳${p.price}</div>
            </a>
        `).join('');
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>${catName} - Online Shop</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container">
                    <h3 style="margin: 10px 0 15px 0;">Category: ${catName}</h3>
                    <div class="product-grid">${productsHTML.length ? productsHTML : '<div style="background:white; padding:30px; text-align:center; border-radius:6px; grid-column: span 2;"><h3>No products found.</h3></div>'}</div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

app.get('/search', async (req, res, next) => {
    try {
        let keyword = req.query.q || '';
        let searchRegex = new RegExp(keyword.split('').join('.*?'), 'i');
        let products = await Product.find({ 
            $or: [
                { name: { $regex: keyword, $options: 'i' } },
                { category: { $regex: keyword, $options: 'i' } },
                { name: { $regex: searchRegex } }
            ]
        });
        let productsHTML = products.map(p => `
            <a href="/product/${p._id}" class="product-card">
                <img src="/uploads/${p.mainImage}" alt="${p.name}">
                <h4>${p.name}</h4>
                <div class="price">৳${p.price}</div>
            </a>
        `).join('');
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Search: ${keyword}</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container">
                    <h3 style="margin: 10px 0 15px 0;">Search Results for "${keyword}"</h3>
                    <div class="product-grid">${productsHTML.length ? productsHTML : '<div style="background:white; padding:30px; text-align:center; border-radius:6px; grid-column: span 2;"><h3>No matching products found.</h3></div>'}</div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// Product Details with Daraj-style Gallery Preview & Live Chat & Quantity Selector
app.get('/product/:id', async (req, res, next) => {
    try {
        let product = await Product.findById(req.params.id);
        if (!product) return res.send('Product not found');
        
        let chats = await Chat.find({ productId: product._id }).sort({ _id: -1 });
        let reviews = await Review.find({ productId: product._id }).sort({ _id: -1 });
        let relatedProducts = await Product.find({ category: product.category, _id: { $ne: product._id } }).limit(4);
        
        let allImages = [product.mainImage, ...(product.gallery || [])].filter(Boolean);
        let galleryHTML = allImages.map((img, idx) => `
            <img src="/uploads/${img}" onclick="changeMainImage('/uploads/${img}', '${img}')" style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:2px solid ${idx===0?'#f85606':'#ccc'}; cursor:pointer;" class="thumb-img">
        `).join('');
        
        let chatsHTML = chats.map(c => `
            <div style="border-bottom:1px solid #eee; padding:10px 0;">
                <p style="margin:0 0 4px 0;"><b>${c.userEmail}:</b> ${c.message}</p>
                ${c.reply ? `<p style="color:green; font-size:13px; margin:4px 0 0 15px;"><b>Admin Reply:</b> ${c.reply}</p>` : '<p style="color:#888; font-size:12px; margin:4px 0 0 15px;">Pending admin reply...</p>'}
            </div>
        `).join('');
        
        let reviewsHTML = reviews.map(r => `
            <div style="border-bottom:1px solid #eee; padding:8px 0; font-size:13px;">
                <p style="margin:0 0 2px 0;"><b>${r.userEmail}</b> - <span style="color:#ff9800; font-weight:bold;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></p>
                <p style="margin:0; color:#444;">${r.comment}</p>
            </div>
        `).join('');
        
        let relatedHTML = relatedProducts.map(p => `
            <a href="/product/${p._id}" class="product-card">
                <img src="/uploads/${p.mainImage}" alt="${p.name}">
                <h4 style="font-size:13px; height:32px;">${p.name}</h4>
                <div class="price" style="font-size:15px;">৳${p.price}</div>
            </a>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>${product.name}</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="background:white; padding:15px; border-radius:6px;">
                    <div style="display:flex; gap:20px; flex-wrap:wrap;">
                        <div style="width:100%; max-width:320px; margin:0 auto;">
                            <img id="activeMainImg" src="/uploads/${product.mainImage}" style="width:100%; height:300px; object-fit:cover; border-radius:6px; border:1px solid #ddd;"><br>
                            <div style="display:flex; gap:8px; margin-top:10px; overflow-x:auto;">${galleryHTML}</div>
                        </div>
                        <div style="flex:1; min-width: 260px;">
                            <h2 style="font-size:18px; margin-top:0;">${product.name}</h2>
                            <p style="font-size:13px; color:#666;"><b>Category:</b> ${product.category}</p>
                            <div class="price">৳${product.price}</div>
                            <p style="font-size:13px;"><b>Stock Available:</b> ${product.stock} | <b>Max Order Limit:</b> ${product.maxLimit || 4} pcs</p>
                            <p style="font-size:14px; color:#440;">${product.description}</p>
                            
                            <div style="margin: 15px 0; display:flex; align-items:center; gap:10px;">
                                <label style="font-size:13px; font-weight:bold;">Quantity:</label>
                                <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px;">
                                    <button type="button" onclick="decreaseQty()" style="padding:6px 12px; background:#f0f0f0; border:none; cursor:pointer; font-weight:bold;">-</button>
                                    <input type="number" id="orderQty" value="1" min="1" max="${product.maxLimit || 4}" readonly style="width:40px; text-align:center; border:none; font-size:14px; font-weight:bold;">
                                    <button type="button" onclick="increaseQty(${product.maxLimit || 4}, ${product.stock})" style="padding:6px 12px; background:#f0f0f0; border:none; cursor:pointer; font-weight:bold;">+</button>
                                </div>
                            </div>

                            <div style="display: flex; gap: 10px;">
                                <button type="button" onclick="buyNowAction('${product._id}')" class="btn btn-buy" style="flex: 1; padding:12px; font-size:15px; text-align:center;">Buy Now</button>
                                <button type="button" onclick="addToCartAction('${product._id}')" class="btn" style="flex: 1; padding:12px; font-size:15px; text-align:center; background:#28a745;">🛒 Add to Cart</button>
                            </div>
                        </div>
                    </div>
                    
                    <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
                    
                    <h3>Ratings & Reviews</h3>
                    <form action="/api/add-review" method="POST" style="background:#f9f9f9; padding:12px; border-radius:4px; margin-bottom:15px;">
                        <input type="hidden" name="productId" value="${product._id}">
                        <label style="font-size:13px; font-weight:600;">Rate this product:</label>
                        <select name="rating" style="padding:5px; margin-bottom:8px; border-radius:4px; border:1px solid #ccc;" required>
                            <option value="5">★★★★★ (5 Stars)</option>
                            <option value="4">★★★★☆ (4 Stars)</option>
                            <option value="3">★★★☆☆ (3 Stars)</option>
                            <option value="2">★★☆☆☆ (2 Stars)</option>
                            <option value="1">★☆☆☆☆ (1 Star)</option>
                        </select><br>
                        <textarea name="comment" placeholder="Write your review here..." style="width:100%; height:50px; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px;" required></textarea>
                        <button type="submit" class="btn" style="padding:6px 12px; font-size:12px; margin-top:5px;">Submit Review</button>
                    </form>
                    <div>${reviewsHTML.length ? reviewsHTML : '<p style="color:#777; font-size:13px;">No reviews yet.</p>'}</div>
                    
                    <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
                    <h3>You May Also Like</h3>
                    <div class="product-grid" style="margin-top:10px;">${relatedHTML.length ? relatedHTML : '<p>No related products.</p>'}</div>
                    
                    <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
                    <h3>Ask Question About This Product</h3>
                    <form action="/api/chat" method="POST">
                        <input type="hidden" name="productId" value="${product._id}">
                        <input type="hidden" name="productName" value="${product.name}">
                        <input type="hidden" name="productImage" id="selectedChatImage" value="${product.mainImage}">
                        <textarea name="message" placeholder="Ask your question here..." style="width:100%; height:70px; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:14px;" required></textarea><br>
                        <button type="submit" class="btn" style="margin-top:6px; padding:8px 14px;">Send Question</button>
                    </form>
                    <div style="margin-top:20px;">
                        <h4 style="margin-bottom:10px;">Customer Q&A (পণ্যের বিষয়ে আপনার ও এডমিনের কথোপকথন):</h4>
                        ${chatsHTML.length ? chatsHTML : '<p style="color:#777; font-size:13px;">No questions yet.</p>'}
                    </div>
                </div>

                <script>
                    let selectedImg = '${product.mainImage}';
                    function changeMainImage(imgUrl, imgName) {
                        document.getElementById('activeMainImg').src = imgUrl;
                        selectedImg = imgName;
                        document.getElementById('selectedChatImage').value = imgName;
                        document.querySelectorAll('.thumb-img').forEach(el => el.style.borderColor = '#ccc');
                        event.target.style.borderColor = '#f85606';
                    }
                    function increaseQty(maxLimit, stock) {
                        let qInput = document.getElementById('orderQty');
                        let current = Number(qInput.value);
                        let limit = maxLimit || 4;
                        if (current < limit && current < stock) {
                            qInput.value = current + 1;
                        } else {
                            alert('সর্বোচ্চ ' + limit + 'টি পণ্য একসাথে কিনতে পারবেন।');
                        }
                    }
                    function decreaseQty() {
                        let qInput = document.getElementById('orderQty');
                        let current = Number(qInput.value);
                        if (current > 1) {
                            qInput.value = current - 1;
                        }
                    }
                    function buyNowAction(productId) {
                        let qty = document.getElementById('orderQty').value;
                        window.location.href = '/buy-now/' + productId + '?qty=' + qty + '&img=' + encodeURIComponent(selectedImg);
                    }
                    function addToCartAction(productId) {
                        let qty = document.getElementById('orderQty').value;
                        window.location.href = '/api/add-to-cart/' + productId + '?qty=' + qty + '&img=' + encodeURIComponent(selectedImg);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

app.post('/api/add-review', async (req, res, next) => {
    try {
        if (!req.user) return res.redirect('/login');
        const { productId, rating, comment } = req.body;
        await new Review({
            productId,
            userEmail: req.user.email,
            rating: Number(rating),
            comment
        }).save();
        res.redirect('back');
    } catch (err) {
        next(err);
    }
});

app.post('/api/chat', async (req, res, next) => {
    try {
        let email = req.user ? req.user.email : 'Guest User';
        await new Chat({
            productId: req.body.productId,
            productName: req.body.productName,
            productImage: req.body.productImage || '',
            userEmail: email,
            message: req.body.message
        }).save();
        res.redirect('back');
    } catch (err) {
        next(err);
    }
});

// ================= Shopping Cart System (With Quantity & Daraj Max Limit) =================
app.get('/api/add-to-cart/:id', async (req, res, next) => {
    try {
        let productId = req.params.id;
        let qty = Number(req.query.qty) || 1;
        let selectedImg = req.query.img;

        let product = await Product.findById(productId);
        if (!product) return res.send(`<script>alert('Product not found!'); window.history.back();</script>`);
        
        let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
        let limit = product.maxLimit || 4;
        if (qty > limit) qty = limit;

        let existingIndex = cart.findIndex(item => item.productId === productId);
        if (existingIndex > -1) {
            cart[existingIndex].quantity = qty;
            if (selectedImg) cart[existingIndex].mainImage = selectedImg;
        } else {
            if (cart.length >= 10) {
                return res.send(`<script>alert('কার্টে অনেকগুলো আইটেম রয়েছে!'); window.location.href='/cart';</script>`);
            }
            cart.push({
                productId: product._id.toString(),
                productName: product.name,
                price: product.price,
                mainImage: selectedImg || product.mainImage,
                quantity: qty,
                maxLimit: limit
            });
        }
        res.cookie('cart', JSON.stringify(cart));
        res.redirect('/cart');
    } catch (err) {
        next(err);
    }
});

app.get('/api/update-cart-qty/:id/:action', (req, res) => {
    let productId = req.params.id;
    let action = req.params.action;
    let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];

    let item = cart.find(i => i.productId === productId);
    if (item) {
        let limit = item.maxLimit || 4;
        if (action === 'increase' && item.quantity < limit) {
            item.quantity += 1;
        } else if (action === 'decrease' && item.quantity > 1) {
            item.quantity -= 1;
        }
    }
    res.cookie('cart', JSON.stringify(cart));
    res.redirect('/cart');
});

app.get('/api/remove-from-cart/:id', (req, res) => {
    let productId = req.params.id;
    let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
    cart = cart.filter(item => item.productId !== productId);
    res.cookie('cart', JSON.stringify(cart));
    res.redirect('/cart');
});

app.get('/cart', async (req, res, next) => {
    try {
        let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
        let subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        
        let cartItemsHTML = cart.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px; margin-bottom:10px; border-radius:4px; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="/uploads/${item.mainImage}" width="50" height="50" style="object-fit:cover; border-radius:4px;">
                    <div>
                        <h4 style="margin:0 0 4px 0; font-size:14px;">${item.productName}</h4>
                        <p style="margin:0; color:#f85606; font-weight:bold;">৳${item.price} x ${item.quantity || 1}</p>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="display:flex; align-items:center; border:1px solid #ccc; border-radius:4px; background:white;">
                        <a href="/api/update-cart-qty/${item.productId}/decrease" style="padding:4px 8px; text-decoration:none; color:#333; font-weight:bold;">-</a>
                        <span style="padding:0 6px; font-size:13px; font-weight:bold;">${item.quantity || 1}</span>
                        <a href="/api/update-cart-qty/${item.productId}/increase" style="padding:4px 8px; text-decoration:none; color:#333; font-weight:bold;">+</a>
                    </div>
                    <a href="/api/remove-from-cart/${item.productId}" class="btn" style="background:#dc3545; padding:6px 10px; font-size:12px;">Remove</a>
                </div>
            </div>
        `).join('');

        let checkoutBtn = cart.length > 0 ? `<a href="/cart-checkout" class="btn btn-buy" style="width:100%; text-align:center; padding:12px; margin-top:15px; display:block; font-size:16px;">Proceed to Checkout (${cart.length} Items)</a>` : '';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Shopping Cart</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="max-width:700px; background:white; padding:20px; border-radius:6px;">
                    <h3 style="margin-top:0;">🛒 Shopping Cart (Daraj Style Limits)</h3>
                    ${cartItemsHTML.length ? cartItemsHTML : '<p style="color:#777; text-align:center; padding:30px;">Your cart is empty.</p>'}
                    ${cart.length > 0 ? `<hr style="border:0; border-top:1px solid #ddd; margin:15px 0;"><h4 style="text-align:right; margin:0;">Subtotal: ৳${subtotal}</h4>` : ''}
                    ${checkoutBtn}
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// ================= Cart Checkout & Order Flow =================
app.get('/cart-checkout', async (req, res, next) => {
    try {
        let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
        if (cart.length === 0) return res.redirect('/cart');
        if (!req.user) return res.redirect('/login?redirect=/cart-checkout');
        
        let subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        let siteSetting = await SiteSetting.findOne() || { bkashNumber: '01700000000', nagadNumber: '01800000000' };
        
        let codOptionHTML = req.user.isBlocked ? 
            `<p style="color:red; font-size:12px;"><b>Note:</b> Cash on Delivery is disabled for your account.</p>` :
            `<option value="COD">Cash on Delivery</option>`;

        let itemsSummaryHTML = cart.map(i => `<span style="font-size:13px; display:block;">• ${i.productName} (৳${i.price} x ${i.quantity || 1})</span>`).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Cart Checkout</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="max-width:600px; background:white; padding:20px; border-radius:6px;">
                    <h3 style="margin-top:0;">Cart Order Checkout</h3>
                    <div style="background:#f9f9f9; padding:10px; border-radius:4px; margin-bottom:15px;">
                        <p style="margin:0 0 5px 0; font-weight:bold;">Selected Items (${cart.length}):</p>
                        ${itemsSummaryHTML}
                    </div>
                    
                    <form action="/api/place-cart-order" method="POST">
                        <input type="hidden" name="discountPrice" id="discountPriceInput" value="0">
                        <label style="font-size:13px; font-weight:600;">Full Name:</label><br>
                        <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Phone Number:</label><br>
                        <input type="text" name="phone" value="${req.user.phone || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Delivery Area:</label><br>
                        <select name="deliveryArea" id="deliveryArea" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" onchange="calculateTotal()" required>
                            <option value="Local Town">লোকাল টাউন (Local) - ৳60</option>
                            <option value="Inside Dhaka">ঢাকার ভেতরে (Inside Dhaka) - ৳120</option>
                            <option value="Outside Dhaka">ঢাকার বাইরে (Outside Dhaka) - ৳150</option>
                        </select><br>
                        
                        <label style="font-size:13px; font-weight:600;">Delivery Address:</label><br>
                        <textarea name="address" style="width:100%; height:60px; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required>${req.user.address || ''}</textarea><br>
                        
                        <label style="font-size:13px; font-weight:600;">Coupon Code:</label><br>
                        <div style="display:flex; gap:5px; margin:4px 0 10px 0;">
                            <input type="text" name="couponCode" id="couponCodeInput" placeholder="Enter Coupon Code" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                            <button type="button" onclick="applyCoupon()" class="btn" style="padding:8px 12px; font-size:12px;">Apply</button>
                        </div>
                        <p id="couponMsg" style="font-size:12px; margin:0 0 10px 0; color:green;"></p>
                        
                        <div style="background:#f0f8ff; padding:12px; border-radius:4px; margin-bottom:12px; font-size:14px; border:1px solid #bce8f1;">
                            <p style="margin:2px 0;">Subtotal Price: ৳<span id="subtotalPrice">${subtotal}</span></p>
                            <p style="margin:2px 0;">Delivery Charge: ৳<span id="deliveryChargeText">60</span></p>
                            <p style="margin:2px 0; color:red; display:none;" id="discountRow">Discount: -৳<span id="discountText">0</span></p>
                            <hr style="border:0; border-top:1px solid #ccc; margin:6px 0;">
                            <p style="margin:2px 0; font-weight:bold; color:#f85606; font-size:16px;">Total Payable Amount: ৳<span id="totalAmountText">${subtotal + 60}</span></p>
                        </div>
                        
                        <label style="font-size:13px; font-weight:600;">Payment Method:</label><br>
                        <select name="paymentMethod" id="paymentMethod" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" onchange="togglePaymentFields()" required>
                            ${codOptionHTML}
                            <option value="bKash">বিকাশ (bKash Payment)</option>
                            <option value="Nagad">নগদ (Nagad Payment)</option>
                        </select><br>
                        
                        <div id="onlinePaymentDiv" style="display:${req.user.isBlocked ? 'block' : 'none'}; background:#f9f9f9; padding:12px; border-radius:4px; margin-bottom:10px; border:1px dashed #f85606;">
                            <p style="font-size:13px; color:#333; margin:0 0 6px 0;">বিকাশ: <b>${siteSetting.bkashNumber}</b> | নগদ: <b>${siteSetting.nagadNumber}</b></p>
                            <label style="font-size:12px; font-weight:600;">Sender Number:</label><br>
                            <input type="text" name="senderNumber" id="senderNumber" placeholder="01XXXXXXXXX" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                            <label style="font-size:12px; font-weight:600;">Paid Amount:</label><br>
                            <input type="number" name="paidAmount" id="paidAmount" placeholder="Amount" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                            <label style="font-size:12px; font-weight:600;">TrxID:</label><br>
                            <input type="text" name="trxId" placeholder="TrxID" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                        </div>
                        
                        <button type="submit" class="btn btn-buy" style="width:100%; padding:12px; font-size:16px; margin-top:5px;">⚡ Confirm Cart Order</button>
                    </form>
                </div>
                
                <script>
                    let appliedDiscount = 0;
                    async function applyCoupon() {
                        let code = document.getElementById('couponCodeInput').value;
                        let msg = document.getElementById('couponMsg');
                        if(!code) return;
                        try {
                            let res = await fetch('/api/verify-coupon', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({code})
                            });
                            let data = await res.json();
                            if(data.success) {
                                appliedDiscount = data.discountAmount;
                                document.getElementById('discountPriceInput').value = appliedDiscount;
                                document.getElementById('discountText').innerText = appliedDiscount;
                                document.getElementById('discountRow').style.display = 'block';
                                msg.style.color = 'green';
                                msg.innerText = 'Coupon applied successfully! Discount: ৳' + appliedDiscount;
                                calculateTotal();
                            } else {
                                msg.style.color = 'red';
                                msg.innerText = data.message;
                            }
                        } catch(e) {
                            msg.style.color = 'red';
                            msg.innerText = 'Invalid coupon request.';
                        }
                    }
                    function calculateTotal() {
                        let subtotal = Number(document.getElementById('subtotalPrice').innerText);
                        let area = document.getElementById('deliveryArea').value;
                        let deliveryCharge = 60;
                        if (area === 'Inside Dhaka') deliveryCharge = 120;
                        else if (area === 'Outside Dhaka') deliveryCharge = 150;
                        let total = (subtotal + deliveryCharge) - appliedDiscount;
                        if(total < 0) total = 0;
                        document.getElementById('deliveryChargeText').innerText = deliveryCharge;
                        document.getElementById('totalAmountText').innerText = total;
                    }
                    function togglePaymentFields() {
                        let method = document.getElementById('paymentMethod').value;
                        let div = document.getElementById('onlinePaymentDiv');
                        let senderInput = document.getElementById('senderNumber');
                        let amountInput = document.getElementById('paidAmount');
                        if (method === 'bKash' || method === 'Nagad') {
                            div.style.display = 'block';
                            senderInput.setAttribute('required', 'true');
                            amountInput.setAttribute('required', 'true');
                        } else {
                            div.style.display = 'none';
                            senderInput.removeAttribute('required');
                            amountInput.removeAttribute('required');
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

app.post('/api/place-cart-order', async (req, res, next) => {
    try {
        if (!req.user) return res.redirect('/login');
        let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
        if (cart.length === 0) return res.redirect('/cart');
        
        const { name, phone, address, deliveryArea, discountPrice, paymentMethod, senderNumber, paidAmount, trxId } = req.body;
        
        let deliveryCharge = 60;
        if (deliveryArea === 'Inside Dhaka') deliveryCharge = 120;
        else if (deliveryArea === 'Outside Dhaka') deliveryCharge = 150;
        
        let productPrice = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        let discount = Number(discountPrice) || 0;
        let totalAmount = (productPrice + deliveryCharge) - discount;
        
        await User.findByIdAndUpdate(req.user._id, { name, phone, address });
        
        for (let item of cart) {
            let qty = item.quantity || 1;
            await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -qty, soldCount: qty } });
        }
        
        await new Order({
            userEmail: req.user.email,
            items: cart,
            productPrice,
            deliveryCharge,
            discountPrice: discount,
            totalAmount,
            deliveryArea,
            paymentMethod,
            senderNumber: senderNumber || '',
            paidAmount: Number(paidAmount) || 0,
            trxId: trxId || '',
            status: 'Pending',
            previousStatus: 'Pending'
        }).save();
        
        res.clearCookie('cart');
        res.send(`<script>alert('Order placed successfully!'); window.location.href='/my-orders';</script>`);
    } catch (err) {
        next(err);
    }
});

// ================= Buy Now Direct Checkout Flow (With Qty & Image) =================
app.get('/buy-now/:id', async (req, res, next) => {
    try {
        let product = await Product.findById(req.params.id);
        if (!product) return res.send('Product not found');
        if (!req.user) return res.redirect('/login?redirect=/buy-now/' + product._id);
        
        let qty = Number(req.query.qty) || 1;
        let selectedImg = req.query.img || product.mainImage;
        let unitPrice = product.price;
        let totalPrice = unitPrice * qty;

        let siteSetting = await SiteSetting.findOne() || { bkashNumber: '01700000000', nagadNumber: '01800000000' };
        let codOptionHTML = req.user.isBlocked ? `<p style="color:red; font-size:12px;">COD disabled.</p>` : `<option value="COD">Cash on Delivery</option>`;
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Checkout</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="max-width:600px; background:white; padding:20px; border-radius:6px;">
                    <h3 style="margin-top:0;">Direct Checkout</h3>
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                        <img src="/uploads/${selectedImg}" width="60" height="60" style="object-fit:cover; border-radius:4px;">
                        <div>
                            <p style="font-size:14px; margin:0; font-weight:bold;">${product.name}</p>
                            <p style="font-size:14px; margin:4px 0 0 0; color:#f85606;">Price: ৳${unitPrice} x ${qty} = ৳<span id="productPrice">${totalPrice}</span></p>
                        </div>
                    </div>
                    
                    <form action="/api/place-order" method="POST">
                        <input type="hidden" name="productId" value="${product._id}">
                        <input type="hidden" name="productName" value="${product.name}">
                        <input type="hidden" name="mainImage" value="${selectedImg}">
                        <input type="hidden" name="price" value="${totalPrice}">
                        <input type="hidden" name="quantity" value="${qty}">
                        <input type="hidden" name="discountPrice" id="discountPriceInput" value="0">
                        
                        <label style="font-size:13px; font-weight:600;">Full Name:</label><br>
                        <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Phone Number:</label><br>
                        <input type="text" name="phone" value="${req.user.phone || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Delivery Area:</label><br>
                        <select name="deliveryArea" id="deliveryArea" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" onchange="calculateTotal()" required>
                            <option value="Local Town">লোকাল টাউন - ৳60</option>
                            <option value="Inside Dhaka">ঢাকার ভেতরে - ৳120</option>
                            <option value="Outside Dhaka">ঢাকার বাইরে - ৳150</option>
                        </select><br>
                        
                        <label style="font-size:13px; font-weight:600;">Delivery Address:</label><br>
                        <textarea name="address" style="width:100%; height:60px; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required>${req.user.address || ''}</textarea><br>
                        
                        <label style="font-size:13px; font-weight:600;">Coupon Code:</label><br>
                        <div style="display:flex; gap:5px; margin:4px 0 10px 0;">
                            <input type="text" name="couponCode" id="couponCodeInput" placeholder="Enter Coupon Code" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                            <button type="button" onclick="applyCoupon()" class="btn" style="padding:8px 12px; font-size:12px;">Apply</button>
                        </div>
                        <p id="couponMsg" style="font-size:12px; margin:0 0 10px 0; color:green;"></p>
                        
                        <div style="background:#f0f8ff; padding:12px; border-radius:4px; margin-bottom:12px; font-size:14px; border:1px solid #bce8f1;">
                            <p style="margin:2px 0;">Product Price: ৳${totalPrice}</p>
                            <p style="margin:2px 0;">Delivery Charge: ৳<span id="deliveryChargeText">60</span></p>
                            <p style="margin:2px 0; color:red; display:none;" id="discountRow">Discount: -৳<span id="discountText">0</span></p>
                            <hr style="border:0; border-top:1px solid #ccc; margin:6px 0;">
                            <p style="margin:2px 0; font-weight:bold; color:#f85606; font-size:16px;">Total Payable Amount: ৳<span id="totalAmountText">${totalPrice + 60}</span></p>
                        </div>
                        
                        <label style="font-size:13px; font-weight:600;">Payment Method:</label><br>
                        <select name="paymentMethod" id="paymentMethod" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" onchange="togglePaymentFields()" required>
                            ${codOptionHTML}
                            <option value="bKash">বিকাশ</option>
                            <option value="Nagad">নগদ</option>
                        </select><br>
                        
                        <div id="onlinePaymentDiv" style="display:${req.user.isBlocked ? 'block' : 'none'}; background:#f9f9f9; padding:12px; border-radius:4px; margin-bottom:10px; border:1px dashed #f85606;">
                            <p style="font-size:13px; color:#333; margin:0 0 6px 0;">বিকাশ: <b>${siteSetting.bkashNumber}</b> | নগদ: <b>${siteSetting.nagadNumber}</b></p>
                            <label style="font-size:12px; font-weight:600;">Sender Number:</label><br>
                            <input type="text" name="senderNumber" id="senderNumber" placeholder="01XXXXXXXXX" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                            <label style="font-size:12px; font-weight:600;">Paid Amount:</label><br>
                            <input type="number" name="paidAmount" id="paidAmount" placeholder="Amount" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                            <label style="font-size:12px; font-weight:600;">TrxID:</label><br>
                            <input type="text" name="trxId" placeholder="TrxID" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                        </div>
                        
                        <button type="submit" class="btn btn-buy" style="width:100%; padding:12px; font-size:16px; margin-top:5px;">⚡ Order Now</button>
                    </form>
                </div>
                
                <script>
                    let appliedDiscount = 0;
                    async function applyCoupon() {
                        let code = document.getElementById('couponCodeInput').value;
                        let msg = document.getElementById('couponMsg');
                        if(!code) return;
                        try {
                            let res = await fetch('/api/verify-coupon', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({code})
                            });
                            let data = await res.json();
                            if(data.success) {
                                appliedDiscount = data.discountAmount;
                                document.getElementById('discountPriceInput').value = appliedDiscount;
                                document.getElementById('discountText').innerText = appliedDiscount;
                                document.getElementById('discountRow').style.display = 'block';
                                msg.style.color = 'green';
                                msg.innerText = 'Coupon applied successfully!';
                                calculateTotal();
                            } else {
                                msg.style.color = 'red';
                                msg.innerText = data.message;
                            }
                        } catch(e) {
                            msg.style.color = 'red';
                            msg.innerText = 'Error';
                        }
                    }
                    function calculateTotal() {
                        let productPrice = Number(document.getElementById('productPrice').innerText);
                        let area = document.getElementById('deliveryArea').value;
                        let deliveryCharge = 60;
                        if (area === 'Inside Dhaka') deliveryCharge = 120;
                        else if (area === 'Outside Dhaka') deliveryCharge = 150;
                        let total = (productPrice + deliveryCharge) - appliedDiscount;
                        if(total < 0) total = 0;
                        document.getElementById('deliveryChargeText').innerText = deliveryCharge;
                        document.getElementById('totalAmountText').innerText = total;
                    }
                    function togglePaymentFields() {
                        let method = document.getElementById('paymentMethod').value;
                        let div = document.getElementById('onlinePaymentDiv');
                        let senderInput = document.getElementById('senderNumber');
                        let amountInput = document.getElementById('paidAmount');
                        if (method === 'bKash' || method === 'Nagad') {
                            div.style.display = 'block';
                            senderInput.setAttribute('required', 'true');
                            amountInput.setAttribute('required', 'true');
                        } else {
                            div.style.display = 'none';
                            senderInput.removeAttribute('required');
                            amountInput.removeAttribute('required');
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

app.post('/api/verify-coupon', async (req, res, next) => {
    try {
        let { code } = req.body;
        let coupon = await Coupon.findOne({ code: code.trim() });
        if(coupon) {
            res.json({ success: true, discountAmount: coupon.discountAmount });
        } else {
            res.json({ success: false, message: 'Invalid coupon.' });
        }
    } catch (err) {
        next(err);
    }
});

app.post('/api/place-order', async (req, res, next) => {
    try {
        if (!req.user) return res.redirect('/login');
        const { productId, productName, mainImage, price, quantity, name, phone, address, deliveryArea, discountPrice, paymentMethod, senderNumber, paidAmount, trxId } = req.body;
        
        let qty = Number(quantity) || 1;
        let deliveryCharge = 60;
        if (deliveryArea === 'Inside Dhaka') deliveryCharge = 120;
        else if (deliveryArea === 'Outside Dhaka') deliveryCharge = 150;
        
        let productPrice = Number(price);
        let discount = Number(discountPrice) || 0;
        let totalAmount = (productPrice + deliveryCharge) - discount;
        
        await User.findByIdAndUpdate(req.user._id, { name, phone, address });
        await Product.findByIdAndUpdate(productId, { $inc: { stock: -qty, soldCount: qty } });
        
        await new Order({
            userEmail: req.user.email,
            items: [{ productId, productName, mainImage, price: productPrice / qty, quantity: qty }],
            productPrice,
            deliveryCharge,
            discountPrice: discount,
            totalAmount,
            deliveryArea,
            paymentMethod,
            senderNumber: senderNumber || '',
            paidAmount: Number(paidAmount) || 0,
            trxId: trxId || '',
            status: 'Pending',
            previousStatus: 'Pending'
        }).save();
        
        res.send(`<script>alert('Order placed successfully!'); window.location.href='/my-orders';</script>`);
    } catch (err) {
        next(err);
    }
});

// ================= User Authentication & Dashboard (Admin configured to admin@gmail.com / KHA) =================
app.get('/login', (req, res) => {
    let redirectUrl = req.query.redirect || '/';
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Login</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container" style="max-width:350px; background:white; padding:20px; border-radius:6px; margin-top:30px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h3 style="margin-top:0;">Login</h3>
                <form action="/api/login" method="POST">
                    <input type="hidden" name="redirect" value="${redirectUrl}">
                    <label style="font-size:13px; font-weight:600;">Email:</label><br>
                    <input type="email" name="email" placeholder="admin@gmail.com" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                    
                    <label style="font-size:13px; font-weight:600;">Password:</label><br>
                    <input type="password" name="password" placeholder="KHA" style="width:100%; padding:10px; margin:4px 0 15px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                    
                    <button type="submit" class="btn" style="width:100%; padding:10px;">Login</button>
                </form>
                <p style="font-size:13px; text-align:center; margin-top:15px;">New user? <a href="/register?redirect=${encodeURIComponent(redirectUrl)}">Register here</a></p>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password, redirect } = req.body;
        
        // Built-in hardcoded Admin Check as requested: admin@gmail.com and password KHA
        if (email.trim().toLowerCase() === 'admin@gmail.com' && password === 'KHA') {
            let adminUser = await User.findOne({ email: 'admin@gmail.com' });
            if (!adminUser) {
                let hashedPassword = await bcrypt.hash('KHA', 10);
                adminUser = await new User({ email: 'admin@gmail.com', password: hashedPassword, role: 'admin', name: 'Admin' }).save();
            } else if (adminUser.role !== 'admin') {
                adminUser.role = 'admin';
                await adminUser.save();
            }
            res.cookie('userSession', JSON.stringify({ email: adminUser.email, role: 'admin' }));
            return res.redirect(redirect || '/admin-dashboard');
        }

        let user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.send(`<script>alert('Invalid email or password!'); window.location.href='/login';</script>`);
        }
        res.cookie('userSession', JSON.stringify({ email: user.email, role: user.role }));
        res.redirect(redirect || '/');
    } catch (err) {
        next(err);
    }
});

app.get('/register', (req, res) => {
    let redirectUrl = req.query.redirect || '/dashboard';
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Register</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container" style="max-width:350px; background:white; padding:20px; border-radius:6px; margin-top:30px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h3 style="margin-top:0;">Register Account</h3>
                <form action="/api/register" method="POST">
                    <input type="hidden" name="redirect" value="${redirectUrl}">
                    <label style="font-size:13px; font-weight:600;">Email:</label><br>
                    <input type="email" name="email" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                    
                    <label style="font-size:13px; font-weight:600;">Password:</label><br>
                    <input type="password" name="password" style="width:100%; padding:10px; margin:4px 0 15px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                    
                    <button type="submit" class="btn btn-buy" style="width:100%; padding:10px;">Register</button>
                </form>
                <p style="font-size:13px; text-align:center; margin-top:15px;">Already have an account? <a href="/login?redirect=${encodeURIComponent(redirectUrl)}">Login here</a></p>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/register', async (req, res, next) => {
    try {
        const { email, password, redirect } = req.body;
        let existing = await User.findOne({ email });
        if (existing) return res.send(`<script>alert('Email already exists!'); window.location.href='/register';</script>`);
        
        let role = (email.trim().toLowerCase() === 'admin@gmail.com') ? 'admin' : 'user';
        let hashedPassword = await bcrypt.hash(password, 10);
        let newUser = new User({ email, password: hashedPassword, role });
        await newUser.save();
        res.cookie('userSession', JSON.stringify({ email: newUser.email, role: newUser.role }));
        res.redirect(redirect || '/dashboard');
    } catch (err) {
        next(err);
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('userSession');
    res.redirect('/');
});

app.get('/dashboard', async (req, res, next) => {
    try {
        if (!req.user) return res.redirect('/login');
        let orders = await Order.find({ userEmail: req.user.email });
        let ordersHTML = orders.map(o => `<tr><td>${o._id}</td><td>৳${o.totalAmount}</td><td>${o.paymentMethod}</td><td>${o.status}</td></tr>`).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>User Dashboard</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="background:white; padding:20px; border-radius:6px;">
                    <h3 style="margin-top:0;">My Account Dashboard</h3>
                    <p style="font-size:14px;"><b>Email:</b> ${req.user.email}</p>
                    
                    <form action="/api/update-profile" method="POST" style="max-width:400px; margin-top:20px;">
                        <h4 style="margin-bottom:10px;">Update Profile Info</h4>
                        <label style="font-size:13px;">Name:</label><br>
                        <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        <label style="font-size:13px;">Phone:</label><br>
                        <input type="text" name="phone" value="${req.user.phone || ''}" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        <label style="font-size:13px;">Address:</label><br>
                        <textarea name="address" style="width:100%; height:60px; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required>${req.user.address || ''}</textarea><br>
                        <button type="submit" class="btn" style="padding:8px 16px;">Save Profile</button>
                    </form>
                    
                    <hr style="margin:25px 0; border:0; border-top:1px solid #eee;">
                    <h4>My Orders History</h4>
                    <div style="overflow-x:auto;">
                        <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; font-size:13px;">
                            <tr><th>Order ID</th><th>Total</th><th>Payment</th><th>Status</th></tr>
                            ${ordersHTML.length ? ordersHTML : '<tr><td colspan="4" style="text-align:center;">No orders placed yet.</td></tr>'}
                        </table>
                    </div>
                    <br><a href="/logout" class="btn" style="background:#d9534f; padding:8px 16px;">Logout</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

app.post('/api/update-profile', async (req, res, next) => {
    try {
        if (!req.user) return res.redirect('/login');
        const { name, phone, address } = req.body;
        await User.findByIdAndUpdate(req.user._id, { name, phone, address });
        res.redirect('/dashboard');
    } catch (err) {
        next(err);
    }
});

app.get('/wishlist', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Wishlist</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container" style="background:white; padding:20px; border-radius:6px; text-align:center;"><h3>❤️ My Wishlist</h3><p style="color:#777;">Your wishlist items will appear here.</p></div></body></html>`);
});

// ================= My Orders & Status Tracking =================
app.get('/my-orders', async (req, res, next) => {
    try {
        if (!req.user) return res.redirect('/login?redirect=/my-orders');
        let orders = await Order.find({ userEmail: req.user.email, status: { $ne: 'Trash' } }).sort({ _id: -1 });
        
        let ordersHTML = orders.map(o => {
            let statusColor = '#f85606'; 
            let statusText = 'Pending (অর্ডার অপেক্ষমান আছে)';
            if (o.status === 'Confirmed') {
                statusColor = '#007bff';
                statusText = 'Confirmed (আপনার অর্ডারটি কনফার্ম করা হয়েছে)';
            } else if (o.status === 'Delivered') {
                statusColor = '#28a745';
                statusText = 'Completed / Delivered (সম্পন্ন হয়েছে)';
            } else if (o.status === 'Cancelled') {
                statusColor = '#dc3545';
                statusText = 'Cancelled (বাতিল করা হয়েছে)';
            }
            let itemsList = o.items.map(i => `
                <div style="display:flex; align-items:center; gap:8px; margin:4px 0;">
                    ${i.mainImage ? `<img src="/uploads/${i.mainImage}" width="40" height="40" style="object-fit:cover; border-radius:4px;">` : ''}
                    <span>${i.productName} (৳${i.price} x ${i.quantity || 1})</span>
                </div>
            `).join('');

            return `
                <div style="background:#fff; padding:15px; margin-bottom:12px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1); font-size:14px;">
                    <p style="margin:5px 0;"><b>Order ID:</b> ${o._id}</p>
                    <div style="background:#f9f9f9; padding:8px; border-radius:4px;">${itemsList}</div>
                    <p style="margin:5px 0;"><b>Total:</b> <span style="color:#f85606; font-weight:bold;">৳${o.totalAmount}</span> (${o.paymentMethod})</p>
                    <p style="margin:5px 0;"><b>Status:</b> <span style="color:${statusColor}; font-weight:bold;">${statusText}</span></p>
                </div>
            `;
        }).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>My Orders</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="max-width:800px;">
                    <h3>📦 My Orders Tracking</h3>
                    ${ordersHTML.length ? ordersHTML : '<div style="background:white; padding:30px; text-align:center; border-radius:6px;"><p>No orders placed yet.</p></div>'}
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// ================= Admin Dashboard & Chat Reply with Product Image =================
app.get('/admin-dashboard', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        
        let products = await Product.find().sort({ _id: -1 });
        let chats = await Chat.find().sort({ _id: -1 });
        let orders = await Order.find({ status: { $ne: 'Trash' } }).sort({ _id: -1 });

        let productsHTML = products.map(p => `
            <tr>
                <td><img src="/uploads/${p.mainImage}" width="35" height="35" style="object-fit:cover; border-radius:3px;"></td>
                <td>${p.name} (Max: ${p.maxLimit || 4})</td>
                <td>৳${p.price}</td>
                <td>${p.stock}</td>
                <td><b>${p.soldCount || 0}</b></td>
                <td>
                    <a href="/api/delete-product/${p._id}" class="btn" style="background:#d9534f; padding:3px 6px; font-size:11px;" onclick="return confirm('Delete?');">Delete</a>
                </td>
            </tr>
        `).join('');

        let chatsHTML = chats.map(c => `
            <div style="background:#f9f9f9; padding:10px; margin-bottom:10px; border-radius:4px; font-size:13px; display:flex; gap:10px; align-items:center;">
                ${c.productImage ? `<img src="/uploads/${c.productImage}" width="50" height="50" style="object-fit:cover; border-radius:4px; border:1px solid #ccc;">` : ''}
                <div style="flex:1;">
                    <p style="margin:0 0 2px 0;"><b>Product:</b> ${c.productName} | <b>User:</b> ${c.userEmail}</p>
                    <p style="margin:0 0 6px 0;"><b>Question:</b> ${c.message}</p>
                    <form action="/api/reply-chat" method="POST" style="display:flex; gap:5px;">
                        <input type="hidden" name="chatId" value="${c._id}">
                        <input type="text" name="reply" value="${c.reply || ''}" placeholder="Write reply..." style="padding:5px; flex:1; border:1px solid #ccc; border-radius:4px; font-size:13px;" required>
                        <button type="submit" class="btn" style="padding:5px 10px; font-size:12px;">Reply</button>
                    </form>
                </div>
            </div>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Admin Dashboard</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container">
                    <h3>⚙️ Admin Control Dashboard</h3>
                    
                    <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px;">
                        <h4 style="margin-top:0;">📦 Add New Product (with Max Limit & 5 Gallery Images)</h4>
                        <form action="/api/add-product" method="POST" enctype="multipart/form-data" style="display:grid; gap:8px; max-width:500px;">
                            <input type="text" name="name" placeholder="Product Name" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                            <input type="text" name="category" placeholder="Category (e.g. Fashion)" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                            <input type="number" name="price" placeholder="Price (Tk)" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                            <input type="number" name="stock" placeholder="Stock Quantity" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                            <input type="number" name="maxLimit" placeholder="Max Order Limit (e.g. 4)" value="4" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                            <textarea name="description" placeholder="Description" style="padding:8px; border:1px solid #ccc; border-radius:4px;"></textarea>
                            <label style="font-size:12px;">Main Image:</label>
                            <input type="file" name="mainImage" accept="image/*" required>
                            <label style="font-size:12px;">Gallery Images (Up to 5):</label>
                            <input type="file" name="gallery" accept="image/*" multiple>
                            <button type="submit" class="btn">Add Product</button>
                        </form>
                    </div>

                    <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px;">
                        <h4>💬 Customer Q&A / Chat Box (Product Image View)</h4>
                        <div>${chatsHTML.length ? chatsHTML : '<p>No chats.</p>'}</div>
                    </div>

                    <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px;">
                        <h4>📋 All Products</h4>
                        <div style="overflow-x:auto;">
                            <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse; font-size:12px;">
                                <tr><th>Img</th><th>Name</th><th>Price</th><th>Stock</th><th>Sold</th><th>Action</th></tr>
                                ${productsHTML}
                            </table>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// Admin Product Upload Route with multi-gallery support
const cpUpload = upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'gallery', maxCount: 5 }]);
app.post('/api/add-product', cpUpload, async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        const { name, category, price, stock, maxLimit, description } = req.body;
        
        let mainImage = req.files['mainImage'] ? req.files['mainImage'][0].filename : '';
        let gallery = req.files['gallery'] ? req.files['gallery'].map(file => file.filename) : [];
        
        await new Product({
            name,
            category,
            price: Number(price),
            stock: Number(stock),
            maxLimit: Number(maxLimit) || 4,
            description,
            mainImage,
            gallery
        }).save();

        res.redirect('/admin-dashboard');
    } catch (err) {
        next(err);
    }
});

app.post('/api/reply-chat', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        const { chatId, reply } = req.body;
        await Chat.findByIdAndUpdate(chatId, { reply });
        res.redirect('/admin-dashboard');
    } catch (err) {
        next(err);
    }
});

app.get('/api/delete-product/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin-dashboard');
    } catch (err) {
        next(err);
    }
});

// ================= Error Handling Middleware =================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send(`<h3 style="color:red; text-align:center; margin-top:50px;">Something went wrong! Server Error.</h3>`);
});

// ================= Start Server =================
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
