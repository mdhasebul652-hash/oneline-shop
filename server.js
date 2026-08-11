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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

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
    maxOrderLimit: { type: Number, default: 5 },
    deliveryCharge: { type: Number, default: 150 },
    description: { type: String, default: '' },
    mainImage: { type: String, default: '' },
    additionalImages: [String],
    productVideo: { type: String, default: '' },
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
    userName: { type: String, default: '' },
    userPhone: { type: String, default: '' },
    userAddress: { type: String, default: '' },
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
    productImage: String,
    userEmail: String,
    message: String,
    reply: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', chatSchema);

const fbContentSchema = new mongoose.Schema({
    title: String,
    mediaUrl: String,
    mediaType: String,
    productLink: { type: String, default: '/' },
    createdAt: { type: Date, default: Date.now }
});
const FbContent = mongoose.model('FbContent', fbContentSchema);

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

const ALL_CATEGORIES = [
    'Fashion', 'Supershop', 'Pharmacy', 'Food', 'Sports', 'Books', 'Stationery', 'HomeDecor', 'BeautyCare', 'Electric'
];

const globalHeaderHTML = `
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0 0 65px 0; background: #f4f4f4; color: #222; -webkit-text-size-adjust: 100%; }
        header { background: #f85606; color: white; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 5px rgba(0,0,0,0.1); width: 100%; }
        .logo { font-size: 18px; font-weight: bold; text-decoration: none; color: white; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
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
        .product-card img { width: 100%; height: 160px; object-fit: contain; background: #fff; border-radius: 4px; cursor: pointer; }
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
    <div id="imageModal" style="display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.8); justify-content:center; align-items:center;">
        <span onclick="closeImageModal()" style="position:absolute; top:20px; right:30px; color:#fff; font-size:40px; font-weight:bold; cursor:pointer;">&times;</span>
        <img id="modalImg" style="max-width:90%; max-height:90%; border-radius:6px; box-shadow:0 0 20px rgba(255,255,255,0.3);">
    </div>
    <script>
        function openImageModal(src) {
            document.getElementById('modalImg').src = src;
            document.getElementById('imageModal').style.display = 'flex';
        }
        function closeImageModal() {
            document.getElementById('imageModal').style.display = 'none';
        }
    </script>
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
        let fbContents = await FbContent.find().sort({ _id: -1 });
        
        let productsHTML = products.map(p => `
            <div class="product-card" onclick="window.location.href='/product/${p._id}'" style="cursor: pointer;">
                <img src="/uploads/${p.mainImage}" alt="${p.name}">
                <h4 style="font-size:14px; height:38px; overflow:hidden;">${p.name}</h4>
                <div class="price">৳${p.price}</div>
                <div style="font-size:11px; color:#888;">Stock: ${p.stock}</div>
            </div>
        `).join('');
        
        let fbHTML = fbContents.map(fb => `
            <div style="background:white; padding:15px; margin-bottom:15px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <p style="font-weight:bold; margin-bottom:8px;">${fb.title}</p>
                ${fb.mediaType === 'image' ? `<img src="/uploads/${fb.mediaUrl}" style="max-width:100%; height:auto; border-radius:4px; cursor:pointer;" onclick="openImageModal('/uploads/${fb.mediaUrl}')">` : `<video src="/uploads/${fb.mediaUrl}" controls style="max-width:100%; border-radius:4px;"></video>`}
                <br><a href="${fb.productLink || '/'}" class="btn btn-buy" style="margin-top:10px; display:inline-block;">⚡ Order Now (Buy Direct)</a>
            </div>
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
                    <h3 style="margin-top:30px; font-size: 17px;">Facebook Posts & Reels Highlights</h3>
                    <div>${fbHTML}</div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// Category Route
app.get('/category/:name', async (req, res, next) => {
    try {
        let catName = req.params.name;
        let products = await Product.find({ category: catName });
        let productsHTML = products.map(p => `
            <div class="product-card" onclick="window.location.href='/product/${p._id}'">
                <img src="/uploads/${p.mainImage}" alt="${p.name}">
                <h4>${p.name}</h4>
                <div class="price">৳${p.price}</div>
            </div>
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

// Search Route
app.get('/search', async (req, res, next) => {
    try {
        let keyword = req.query.q || '';
        let products = await Product.find({ name: { $regex: keyword, $options: 'i' } });
        let productsHTML = products.map(p => `
            <div class="product-card" onclick="window.location.href='/product/${p._id}'">
                <img src="/uploads/${p.mainImage}" alt="${p.name}">
                <h4>${p.name}</h4>
                <div class="price">৳${p.price}</div>
            </div>
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

// Product Details Page (সংশোধিত গ্যালারি কোড)
app.get('/product/:id', async (req, res, next) => {
    try {
        let product = await Product.findById(req.params.id);
        if (!product) return res.send('Product not found');
        let reviews = await Review.find({ productId: product._id }).sort({ _id: -1 });
        let relatedProducts = await Product.find({ category: product.category, _id: { $ne: product._id } }).limit(4);
        
        // এখানে product.gallery এর পরিবর্তে ঠিক করা হয়েছে যেন additionalImages কাজ করে
        let allImages = [product.mainImage, ...(product.additionalImages || [])];
        let galleryHTML = allImages.map((img, idx) => `
            <img src="/uploads/${img}" onclick="changeMainImage('${img}', this)" style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:${idx === 0 ? '2px solid #f85606' : '1px solid #ccc'}; cursor:pointer;" class="thumb-img">
        `).join('');
        
        let reviewsHTML = reviews.map(r => `
            <div style="border-bottom:1px solid #eee; padding:8px 0; font-size:13px;">
                <p style="margin:0 0 2px 0;"><b>${r.userEmail}</b> - <span style="color:#ff9800; font-weight:bold;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></p>
                <p style="margin:0; color:#444;">${r.comment}</p>
            </div>
        `).join('');
        
        let relatedHTML = relatedProducts.map(p => `
            <div class="product-card" onclick="window.location.href='/product/${p._id}'">
                <img src="/uploads/${p.mainImage}" alt="${p.name}">
                <h4 style="font-size:13px; height:32px;">${p.name}</h4>
                <div class="price" style="font-size:15px;">৳${p.price}</div>
            </div>
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
                            <img id="mainProductImg" src="/uploads/${product.mainImage}" style="width:100%; height:300px; object-fit:cover; border-radius:6px; border:1px solid #ddd; cursor:pointer;" onclick="openImageModal(this.src)"><br>
                            <div style="display:flex; gap:8px; margin-top:10px; overflow-x:auto;">${galleryHTML}</div>
                        </div>
                        <div style="flex:1; min-width: 260px;">
                            <h2 style="font-size:18px; margin-top:0;">${product.name}</h2>
                            <p style="font-size:13px; color:#666;"><b>Category:</b> ${product.category}</p>
                            <div class="price">৳${product.price}</div>
                            <p style="font-size:13px;"><b>Stock Available:</b> ${product.stock}</p>
                            <p style="font-size:13px; color:#d9534f;"><b>Maximum Order Limit:</b> ${product.maxOrderLimit || 5}</p>
                            <p style="font-size:13px; color:#007bff;"><b>Delivery Charge:</b> ৳${product.deliveryCharge || 150}</p>
                            <p style="font-size:14px; color:#440;">${product.description}</p>
                            <br>
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
                                <span style="font-weight:600; font-size:13px;">Quantity:</span>
                                <button type="button" onclick="decrementQty()" style="padding:6px 12px; font-size:16px; font-weight:bold; background:#ddd; border:none; border-radius:4px; cursor:pointer;">-</button>
                                <span id="qtyDisplay" style="font-size:16px; font-weight:bold; min-width:25px; text-align:center;">1</span>
                                <button type="button" onclick="incrementQty()" style="padding:6px 12px; font-size:16px; font-weight:bold; background:#ddd; border:none; border-radius:4px; cursor:pointer;">+</button>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <button type="button" onclick="buyNowAction()" class="btn btn-buy" style="flex: 1; padding:12px; font-size:15px; text-align:center;">Buy Now</button>
                                <button type="button" onclick="addToCartAction()" class="btn" style="flex: 1; padding:12px; font-size:15px; text-align:center; background:#28a745;">🛒 Add to Cart</button>
                            </div>
                        </div>
                    </div>
                    <script>
                        let currentQty = 1;
                        let maxLimit = ${product.maxOrderLimit || 5};
                        let stockAvail = ${product.stock};
                        let selectedImage = '${product.mainImage}';
                        function changeMainImage(imgFilename, element) {
                            selectedImage = imgFilename;
                            document.getElementById('mainProductImg').src = '/uploads/' + imgFilename;
                            let thumbs = document.querySelectorAll('.thumb-img');
                            thumbs.forEach(t => t.style.border = '1px solid #ccc');
                            element.style.border = '2px solid #f85606';
                        }
                        function incrementQty() {
                            if (currentQty < maxLimit && currentQty < stockAvail) {
                                currentQty++;
                                document.getElementById('qtyDisplay').innerText = currentQty;
                            } else {
                                alert('দুঃখিত, সর্বোচ্চ অর্ডারের লিমিট ' + maxLimit + ' টি অথবা স্টক শেষ!');
                            }
                        }
                        function decrementQty() {
                            if (currentQty > 1) {
                                currentQty--;
                                document.getElementById('qtyDisplay').innerText = currentQty;
                            }
                        }
                        function addToCartAction() {
                            window.location.href = '/api/add-to-cart/' + '${product._id}' + '?qty=' + currentQty + '&selectedImage=' + encodeURIComponent(selectedImage);
                        }
                        function buyNowAction() {
                            window.location.href = '/buy-now/' + '${product._id}' + '?qty=' + currentQty + '&selectedImage=' + encodeURIComponent(selectedImage);
                        }
                    </script>
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
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// ================= Shopping Cart & Checkout Routes =================
app.get('/api/add-to-cart/:id', async (req, res, next) => {
    try {
        let productId = req.params.id;
        let requestedQty = Number(req.query.qty) || 1;
        let selectedImage = req.query.selectedImage || '';
        let product = await Product.findById(productId);
        if (!product) return res.send(`<script>alert('Product not found!'); window.history.back();</script>`);
        
        if (!selectedImage) selectedImage = product.mainImage;
        let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
        let maxLimit = product.maxOrderLimit || 5;
        let itemDeliveryCharge = product.deliveryCharge || 150;
        
        let existingIndex = cart.findIndex(item => item.productId === productId && item.mainImage === selectedImage);
        if (existingIndex > -1) {
            let newTotalQty = cart[existingIndex].quantity + requestedQty;
            if (newTotalQty > maxLimit) {
                return res.send(`<script>alert('দুঃখিত! সর্বোচ্চ ক্রয়ের সীমা হলো ' + ${maxLimit} টি।'); window.location.href='/cart';</script>`);
            }
            cart[existingIndex].quantity = newTotalQty;
        } else {
            if (requestedQty > maxLimit) requestedQty = maxLimit;
            cart.push({
                productId: product._id.toString(),
                productName: product.name,
                price: product.price,
                deliveryCharge: itemDeliveryCharge,
                mainImage: selectedImage,
                quantity: requestedQty,
                maxOrderLimit: maxLimit
            });
        }
        res.cookie('cart', JSON.stringify(cart));
        res.redirect('/cart');
    } catch (err) {
        next(err);
    }
});

app.get('/cart', async (req, res, next) => {
    try {
        let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
        let subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        
        let cartItemsHTML = cart.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px; margin-bottom:10px; border-radius:4px; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="/uploads/${item.mainImage}" width="50" height="50" style="object-fit:cover; border-radius:4px; border:1px solid #f85606;">
                    <div>
                        <h4 style="margin:0 0 4px 0; font-size:14px;">${item.productName}</h4>
                        <p style="margin:0; color:#f85606; font-weight:bold;">৳${item.price} × ${item.quantity || 1} = ৳${item.price * (item.quantity || 1)}</p>
                    </div>
                </div>
            </div>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Shopping Cart</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="max-width:700px; background:white; padding:20px; border-radius:6px;">
                    <h3 style="margin-top:0;">🛒 Shopping Cart</h3>
                    ${cartItemsHTML.length ? cartItemsHTML : '<p style="color:#777; text-align:center; padding:30px;">Your cart is empty.</p>'}
                    ${cart.length > 0 ? `<a href="/cart-checkout" class="btn btn-buy" style="width:100%; text-align:center; padding:12px; margin-top:15px; display:block;">Proceed to Checkout</a>` : ''}
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// ================= Admin Panel (সংশোধিত রাউট) =================
app.get('/admin-dashboard', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let products = await Product.find().sort({ _id: -1 });
        let categoryOptions = ALL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
        
        let productsHTML = products.map(p => `
            <div style="background:#fff; padding:10px; margin-bottom:8px; border-radius:4px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <img src="/uploads/${p.mainImage}" width="40" height="40" style="object-fit:cover; border-radius:4px;">
                    <div><b>${p.name}</b><br><span style="font-size:12px; color:#f85606;">৳${p.price} | Stock: ${p.stock}</span></div>
                </div>
                <a href="/admin/delete-product/${p._id}" class="btn" style="background:#dc3545; padding:5px 8px; font-size:11px;">Delete</a>
            </div>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Admin Dashboard</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container">
                    <h2>⚙️ Admin Control Panel</h2>
                    <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px;">
                        <h3>➕ Add New Product & Direct Facebook Publish</h3>
                        <form action="/admin/add-product" method="POST" enctype="multipart/form-data" style="display:flex; flex-direction:column; gap:10px;">
                            <input type="text" name="name" placeholder="Product Name" style="padding:8px;" required>
                            <select name="category" style="padding:8px;" required>${categoryOptions}</select>
                            <input type="number" name="price" placeholder="Price (৳)" style="padding:8px;" required>
                            <input type="number" name="stock" placeholder="Stock" style="padding:8px;" required>
                            <textarea name="description" placeholder="Description" style="padding:8px;"></textarea>
                            
                            <label><b>Main Image:</b></label>
                            <input type="file" name="mainImage" required>
                            
                            <label><b>Additional Images (Multiple):</b></label>
                            <input type="file" name="additionalImages" multiple accept="image/*">
                            
                            <label><b>Product Video / Reels Video:</b></label>
                            <input type="file" name="productVideo" accept="video/*">
                            
                            <div>
                                <label><input type="checkbox" name="publishToFacebook" value="true"> সরাসরি ফেসবুক পেজে প্রকাশ করুন</label>
                            </div>
                            <button type="submit" class="btn btn-buy" style="padding:10px;">Add Product</button>
                        </form>
                    </div>
                    <div><h3>📦 Products Management</h3>${productsHTML}</div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// প্রোডাক্ট অ্যাড করার ফিক্সড রাউট (সার্ভার ক্র্যাশ ও ডুপ্লিকেট রিডাইরেক্ট সমস্যার সমাধান)
app.post('/admin/add-product', upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 10 },
    { name: 'productVideo', maxCount: 1 }
]), async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        
        const { name, category, price, stock, maxOrderLimit, deliveryCharge, description, publishToFacebook } = req.body;
        const mainImage = req.files && req.files.mainImage ? req.files.mainImage[0].filename : '';
        const additionalImages = req.files && req.files.additionalImages ? req.files.additionalImages.map(file => file.filename) : [];
        const productVideo = req.files && req.files.productVideo ? req.files.productVideo[0].filename : '';
        
        const newProd = new Product({
            name,
            category,
            price: Number(price),
            stock: Number(stock),
            maxOrderLimit: Number(maxOrderLimit) || 5,
            deliveryCharge: Number(deliveryCharge) || 150,
            description,
            mainImage,
            additionalImages,
            productVideo
        });
        
        await newProd.save();

        if (publishToFacebook === 'true' && mainImage) {
            await new FbContent({
                title: `🔥 নতুন পণ্য: ${name} - মূল্য: ৳${price}`,
                mediaUrl: mainImage,
                mediaType: 'image',
                productLink: `/product/${newProd._id}`
            }).save();
        }
        
        res.redirect('/admin-dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error: " + err.message);
    }
});

app.get('/admin/delete-product/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin-dashboard');
    } catch (err) {
        next(err);
    }
});

app.get('/login', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Login</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container" style="max-width:350px; background:white; padding:20px;"><form action="/api/login" method="POST"><input type="email" name="email" placeholder="Email" required><input type="password" name="password" placeholder="Password" required><button type="submit" class="btn">Login</button></form></div></body></html>`);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
