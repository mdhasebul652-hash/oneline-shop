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

const uploadDir = path.join(__dirname, 'public', 'uploads');
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

// ================= Global Header & Image Modal Setup =================
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
        
        /* ফিক্সড: হোম পেজের প্রোডাক্ট কার্ডের ছবি যেন সমান ও সুন্দরভাবে ফিট হয় */
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
    <!-- Image Modal CSS for Large Preview -->
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
    
    ${user && user.role !== 'admin' ? `
        <div style="position: fixed; bottom: 75px; right: 20px; z-index: 1001;">
            <button onclick="toggleUserChatBox()" style="background: #f85606; color: white; border: none; border-radius: 50px; padding: 12px 18px; font-size: 15px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px;">
                💬 মেসেজ বক্স
            </button>
            <div id="userChatModal" style="display: none; position: fixed; bottom: 135px; right: 20px; width: 320px; max-height: 450px; background: white; border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); z-index: 1002; flex-direction: column; overflow: hidden; border: 1px solid #ddd;">
                <div style="background: #f85606; color: white; padding: 12px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>💬 প্রোডাক্ট ইনবক্স ও চ্যাট</span>
                    <button onclick="toggleUserChatBox()" style="background: none; border: none; color: white; font-size: 16px; cursor: pointer;">✕</button>
                </div>
                <div id="userChatContentContainer" style="padding: 10px; overflow-y: auto; flex: 1; max-height: 380px; font-size: 13px;">
                    <p style="text-align: center; color: #777;">লোড হচ্ছে...</p>
                </div>
            </div>
        </div>
        <script>
            let isChatOpen = false;
            async function toggleUserChatBox() {
                let modal = document.getElementById('userChatModal');
                isChatOpen = !isChatOpen;
                modal.style.display = isChatOpen ? 'flex' : 'none';
                if(isChatOpen) {
                    try {
                        let res = await fetch('/api/user-chats-json');
                        let chats = await res.json();
                        let container = document.getElementById('userChatContentContainer');
                        if(chats.length === 0) {
    if(chats.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #777; padding: 20px;">কোনো প্রশ্ন বা চ্যাট নেই</p>';
    } else {
        container.innerHTML = chats.map(c => 
            '<div style="background: #f9f9f9; padding: 8px; margin-bottom: 8px; border-radius: 4px;">' +
                (c.productImage ? '<img src="/uploads/' + c.productImage + '" style="width: 40px; height: 40px; object-fit: cover; margin-right: 8px; border-radius: 4px;">' : '') +
                '<div style="flex:1;">' +
                    '<p style="margin: 0 0 2px 0; font-weight: bold; color: #333; font-size: 13px;">পণ্য: ' + (c.productName || 'N/A') + '</p>' +
                    '<p style="margin: 0 0 2px 0; color: #555; font-size: 12px;">প্রশ্ন: ' + c.message + '</p>' +
                    '<p style="margin: 0; color: ' + (c.reply ? 'green' : '#e67e22') + '; font-size: 12px;">উত্তর: ' + (c.reply || 'উত্তর এখনো দেওয়া হয়নি') + '</p>' +
                '</div>' +
            '</div>'
        ).join('');
    }

                    } catch(e) {
                        document.getElementById('userChatContentContainer').innerHTML = '<p style="color:red; text-align:center;">ডেটা লোড করতে সমস্যা হয়েছে।</p>';
                    }
                }
            }
        </script>
    ` : ''}
`;

// ================= Public & Homepage Routes =================
app.get('/', async (req, res, next) => {
    try {
        let categoryFilter = req.query.category;
        let query = categoryFilter ? { category: categoryFilter } : {};
        let products = await Product.find(query).sort({ _id: -1 });
        let fbContents = await FbContent.find().sort({ _id: -1 });
        
        let productsHTML = products.map(p => `
            <a href="/product/${p._id}" class="product-card">
                <img src="/uploads/${p.mainImage}" alt="${p.name}" onclick="event.preventDefault(); openImageModal('/uploads/${p.mainImage}');">
                <h4>${p.name}</h4>
                <div class="price">৳${p.price}</div>
                <div style="font-size:11px; color:#888;">Stock: ${p.stock} | Max Limit: ${p.maxOrderLimit || 5}</div>
            </a>
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

// Product Details Page
app.get('/product/:id', async (req, res, next) => {
    try {
        let product = await Product.findById(req.params.id);
        if (!product) return res.send('Product not found');
        let chats = await Chat.find({ productId: product._id });
        let reviews = await Review.find({ productId: product._id }).sort({ _id: -1 });
        let relatedProducts = await Product.find({ category: product.category, _id: { $ne: product._id } }).limit(4);
        
        let allImages = [product.mainImage, ...(product.gallery || [])];
        let galleryHTML = allImages.map((img, idx) => `
            <img src="/uploads/${img}" onclick="changeMainImage('${img}', this)" style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:${idx === 0 ? '2px solid #f85606' : '1px solid #ccc'}; cursor:pointer;" class="thumb-img">
        `).join('');
        
        let chatsHTML = chats.map(c => `
            <div style="border-bottom:1px solid #eee; padding:8px 0; display:flex; gap:10px; align-items:center;">
                ${c.productImage ? `<img src="/uploads/${c.productImage}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #ccc; cursor:pointer;" onclick="openImageModal('/uploads/${c.productImage}')">` : ''}
                <div>
                    <p style="margin:0 0 4px 0;"><b>${c.userEmail}:</b> ${c.message}</p>
                    <p style="color:green; font-size:13px; margin:0;"><b>Admin Reply:</b> ${c.reply || 'Pending reply'}</p>
                </div>
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
                    
                    <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
                    <h3>Ask Question About This Product</h3>
                    <form action="/api/chat" method="POST">
                        <input type="hidden" name="productId" value="${product._id}">
                        <input type="hidden" name="productName" value="${product.name}">
                        <input type="hidden" name="productImage" value="${product.mainImage}">
                        <textarea name="message" placeholder="Ask your question here..." style="width:100%; height:70px; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:14px;" required></textarea><br>
                        <button type="submit" class="btn" style="margin-top:6px; padding:8px 14px;">Send Question</button>
                    </form>
                    <div style="margin-top:20px;">
                        <h4 style="margin-bottom:10px;">Customer Q&A (পণ্যের বিষয়ে আপনার ও এডমিনের কথোপকথন):</h4>
                        ${chatsHTML.length ? chatsHTML : '<p style="color:#777; font-size:13px;">No questions yet.</p>'}
                    </div>
                </div>
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

app.get('/api/user-chats-json', async (req, res, next) => {
    try {
        if (!req.user) return res.json([]);
        let chats = await Chat.find({ userEmail: req.user.email }).sort({ _id: -1 });
        res.json(chats);
    } catch (err) {
        res.json([]);
    }
});

// ================= Shopping Cart System =================
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

app.get('/api/update-cart-qty/:id/:action', async (req, res, next) => {
    try {
        let productId = req.params.id;
        let action = req.params.action;
        let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
        let itemIndex = cart.findIndex(item => item.productId === productId);
        if (itemIndex > -1) {
            let product = await Product.findById(productId);
            let maxLimit = product ? (product.maxOrderLimit || 5) : (cart[itemIndex].maxOrderLimit || 5);
            if (action === 'inc') {
                if (cart[itemIndex].quantity < maxLimit) {
                    cart[itemIndex].quantity += 1;
                } else {
                    return res.send(`<script>alert('সর্বোচ্চ লিমিট পূর্ণ হয়ে গেছে!'); window.location.href='/cart';</script>`);
                }
            } else if (action === 'dec') {
                if (cart[itemIndex].quantity > 1) {
                    cart[itemIndex].quantity -= 1;
                } else {
                    cart = cart.filter((item, idx) => idx !== itemIndex);
                }
            }
        }
        res.cookie('cart', JSON.stringify(cart));
        res.redirect('/cart');
    } catch (err) {
        next(err);
    }
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
        let maxDeliveryCharge = cart.length > 0 ? Math.max(...cart.map(i => i.deliveryCharge || 150)) : 150;
        
        let cartItemsHTML = cart.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px; margin-bottom:10px; border-radius:4px; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="/uploads/${item.mainImage}" width="50" height="50" style="object-fit:cover; border-radius:4px; border:1px solid #f85606; cursor:pointer;" onclick="openImageModal('/uploads/${item.mainImage}')">
                    <div>
                        <h4 style="margin:0 0 4px 0; font-size:14px;">${item.productName}</h4>
                        <p style="margin:0; color:#f85606; font-weight:bold;">৳${item.price} × ${item.quantity || 1} = ৳${item.price * (item.quantity || 1)}</p>
                        <p style="margin:2px 0 0 0; font-size:11px; color:#555;">ডেলিভারি চার্জ: ৳${item.deliveryCharge || 150}</p>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <a href="/api/update-cart-qty/${item.productId}/dec" class="btn" style="padding:2px 8px; font-size:14px; background:#ccc; color:#000; text-decoration:none;">-</a>
                        <span style="font-weight:bold; font-size:14px;">${item.quantity || 1}</span>
                        <a href="/api/update-cart-qty/${item.productId}/inc" class="btn" style="padding:2px 8px; font-size:14px; background:#ccc; color:#000; text-decoration:none;">+</a>
                    </div>
                    <a href="/api/remove-from-cart/${item.productId}" class="btn" style="background:#dc3545; padding:5px 10px; font-size:12px;">Remove</a>
                </div>
            </div>
        `).join('');
        
        let checkoutBtn = cart.length > 0 ? `<a href="/cart-checkout" class="btn btn-buy" style="width:100%; text-align:center; padding:12px; margin-top:15px; display:block; font-size:16px;">Proceed to Checkout</a>` : '';
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Shopping Cart</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="max-width:700px; background:white; padding:20px; border-radius:6px;">
                    <h3 style="margin-top:0;">🛒 Shopping Cart</h3>
                    ${cartItemsHTML.length ? cartItemsHTML : '<p style="color:#777; text-align:center; padding:30px;">Your cart is empty.</p>'}
                    ${cart.length > 0 ? `<hr style="border:0; border-top:1px solid #ddd; margin:15px 0;"><h4 style="text-align:right; margin:0;">Subtotal: ৳${subtotal} <br><span style="font-size:13px; color:#666;">Standard Delivery Charge: ৳${maxDeliveryCharge}</span></h4>` : ''}
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
        if (!req.user) {
            return res.redirect('/login?redirect=/cart-checkout');
        }
        let subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        let deliveryCharge = cart.length > 0 ? Math.max(...cart.map(i => i.deliveryCharge || 150)) : 150;
        let siteSetting = await SiteSetting.findOne() || { bkashNumber: '01700000000', nagadNumber: '01800000000' };
        
        let codOptionHTML = req.user.isBlocked ? 
            `<p style="color:red; font-size:12px;"><b>Note:</b> Cash on Delivery is disabled for your account.</p>` :
            `<option value="COD">Cash on Delivery</option>`;
        let advanceWarning = req.user.isBlocked ? 
            `<div style="background:#fff3cd; padding:10px; border-radius:4px; margin-bottom:10px; color:#856404; font-size:13px;">⚠️ <b>Notice:</b> Please pay via bKash/Nagad.</div>` : '';
        
        let itemsSummaryHTML = cart.map(i => `
            <div style="display:flex; align-items:center; gap:8px; margin:4px 0;">
                <img src="/uploads/${i.mainImage}" width="35" height="35" style="object-fit:cover; border-radius:3px; cursor:pointer;" onclick="openImageModal('/uploads/${i.mainImage}')">
                <span style="font-size:13px;">• ${i.productName} (৳${i.price} × ${i.quantity || 1})</span>
            </div>
        `).join('');
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Cart Checkout</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="max-width:600px; background:white; padding:20px; border-radius:6px;">
                    <h3 style="margin-top:0;">Cart Order Checkout</h3>
                    ${advanceWarning}
                    <div style="background:#f9f9f9; padding:10px; border-radius:4px; margin-bottom:15px;">
                        <p style="margin:0 0 5px 0; font-weight:bold;">Selected Items:</p>
                        ${itemsSummaryHTML}
                    </div>
                    
                    <form action="/api/place-cart-order" method="POST" onsubmit="prepareAddress()">
                        <input type="hidden" name="discountPrice" id="discountPriceInput" value="0">
                        <input type="hidden" name="deliveryCharge" value="${deliveryCharge}">
                        <input type="hidden" name="address" id="fullAddressInput">
                        
                        <label style="font-size:13px; font-weight:600;">Full Name:</label><br>
                        <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Phone Number:</label><br>
                        <input type="text" name="phone" value="${req.user.phone || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        
                        <!-- সুনির্দিষ্ট ডেলিভারি এড্রেস ঘরসমূহ -->
                        <div style="background:#fdfdfd; padding:12px; border:1px solid #e0e0e0; border-radius:6px; margin-bottom:10px;">
                            <label style="font-size:13px; font-weight:600; color:#f85606;">জেলা (District):</label><br>
                            <input type="text" id="inputDistrict" placeholder="যেমন: ঢাকা / ফরিদপুর" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                            
                            <label style="font-size:13px; font-weight:600; color:#f85606;">থানা (Thana / Upazila):</label><br>
                            <input type="text" id="inputThana" placeholder="যেমন: ভাঙ্গা / তেজগাঁও" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                            
                            <label style="font-size:13px; font-weight:600; color:#f85606;">মেইন এড্রেস (গ্রাম / রোড / বাসা নং):</label><br>
                            <textarea id="inputVillage" placeholder="যেমন: আমতলা গ্রাম, কাজী বাড়ি" style="width:100%; height:50px; padding:8px; margin:3px 0 5px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required></textarea>
                        </div>
                        
                        <label style="font-size:13px; font-weight:600;">Coupon Code:</label><br>
                        <div style="display:flex; gap:5px; margin:4px 0 10px 0;">
                            <input type="text" name="couponCode" id="couponCodeInput" placeholder="Enter Coupon Code" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                            <button type="button" onclick="applyCoupon()" class="btn" style="padding:8px 12px; font-size:12px;">Apply</button>
                        </div>
                        <p id="couponMsg" style="font-size:12px; margin:0 0 10px 0; color:green;"></p>
                        
                        <label style="font-size:13px; font-weight:600;">Customer Note:</label><br>
                        <input type="text" name="customerNote" placeholder="যেমন: বিকালে কল করবেন" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;"><br>
                        
                        <div style="background:#f0f8ff; padding:12px; border-radius:4px; margin-bottom:12px; font-size:14px; border:1px solid #bce8f1;">
                            <p style="margin:2px 0;">Subtotal Price: ৳<span id="subtotalPrice">${subtotal}</span></p>
                            <p style="margin:2px 0;">Delivery Charge: ৳<span id="deliveryChargeText">${deliveryCharge}</span></p>
                            <p style="margin:2px 0; color:red; display:none;" id="discountRow">Discount: -৳<span id="discountText">0</span></p>
                            <hr style="border:0; border-top:1px solid #ccc; margin:6px 0;">
                            <p style="margin:2px 0; font-weight:bold; color:#f85606; font-size:16px;">Total Payable Amount: ৳<span id="totalAmountText">${subtotal + deliveryCharge}</span></p>
                        </div>
                        
                        <label style="font-size:13px; font-weight:600;">Payment Method:</label><br>
                        <select name="paymentMethod" id="paymentMethod" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" onchange="togglePaymentFields()" required>
                            ${codOptionHTML}
                            <option value="bKash">বিকাশ (বিকাশ পার্সোনাল পেমেন্ট)</option>
                            <option value="Nagad">নগদ (নগদ পার্সোনাল পেমেন্ট)</option>
                        </select><br>
                        
                        <div id="onlinePaymentDiv" style="display:${req.user.isBlocked ? 'block' : 'none'}; background:#f9f9f9; padding:12px; border-radius:4px; margin-bottom:10px; border:1px dashed #f85606;">
                            <p style="font-size:13px; color:#333; margin:0 0 6px 0;">বিকাশ: <b style="color:#f85606;">${siteSetting.bkashNumber}</b> | নগদ: <b style="color:#f85606;">${siteSetting.nagadNumber}</b></p>
                            <label style="font-size:12px; font-weight:600;">আপনার বিকাশ/নগদ নাম্বার:</label><br>
                            <input type="text" name="senderNumber" id="senderNumber" placeholder="যেমন: 01XXXXXXXXX" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                            
                            <label style="font-size:12px; font-weight:600;">প্রেরিত টাকার পরিমাণ:</label><br>
                            <input type="number" name="paidAmount" id="paidAmount" placeholder="যেমন: মোট টাকা" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                            
                            <label style="font-size:12px; font-weight:600;">ট্রানজেকশন আইডি (TrxID):</label><br>
                            <input type="text" name="trxId" placeholder="যেমন: 9N7A6..." style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                        </div>
                        
                        <button type="submit" class="btn btn-buy" style="width:100%; padding:12px; font-size:16px; margin-top:5px;">⚡ Confirm Cart Order</button>
                    </form>
                </div>
                
                <script>
                    let appliedDiscount = 0;
                    let currentDeliveryCharge = ${deliveryCharge};
                    function prepareAddress() {
                        let dist = document.getElementById('inputDistrict').value.trim();
                        let thana = document.getElementById('inputThana').value.trim();
                        let village = document.getElementById('inputVillage').value.trim();
                        let fullAddr = "জেলা: " + dist + ", থানা: " + thana + ", ঠিকানা: " + village;
                        document.getElementById('fullAddressInput').value = fullAddr;
                    }
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
                            msg.innerText = 'Invalid coupon request.';
                        }
                    }
                    function calculateTotal() {
                        let subtotal = Number(document.getElementById('subtotalPrice').innerText);
                        let total = (subtotal + currentDeliveryCharge) - appliedDiscount;
                        if(total < 0) total = 0;
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
        const { name, phone, address, discountPrice, customerNote, paymentMethod, senderNumber, paidAmount, trxId, deliveryCharge } = req.body;
        
        if (req.user.isBlocked && paymentMethod === 'COD') {
            return res.send(`<script>alert('COD is disabled for your account.'); window.history.back();</script>`);
        }
        if ((paymentMethod === 'bKash' || paymentMethod === 'Nagad') && (!senderNumber || !paidAmount)) {
            return res.send(`<script>alert('বিকাশ বা নগদ সিলেক্ট করলে নাম্বার ও পরিমাণ দিতে হবে!'); window.history.back();</script>`);
        }
        let dCharge = Number(deliveryCharge) || 150;
        let productPrice = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        let discount = Number(discountPrice) || 0;
        let totalAmount = (productPrice + dCharge) - discount;
        
        await User.findByIdAndUpdate(req.user._id, { name, phone, address });
        
        for (let item of cart) {
            let qty = item.quantity || 1;
            await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -qty, soldCount: qty } });
        }
        await new Order({
            userEmail: req.user.email,
            userName: name || '',
            userPhone: phone || '',
            userAddress: address || '',
            items: cart,
            productPrice,
            deliveryCharge: dCharge,
            discountPrice: discount,
            totalAmount,
            deliveryArea: 'Product Delivery Charge',
            customerNote: customerNote || '',
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

// ================= Buy Now Direct Checkout Flow =================
app.get('/buy-now/:id', async (req, res, next) => {
    try {
        let product = await Product.findById(req.params.id);
        if (!product) return res.send('Product not found');
        if (!req.user) {
            return res.redirect('/login?redirect=/buy-now/' + product._id);
        }
        let qty = Number(req.query.qty) || 1;
        let selectedImage = req.query.selectedImage || product.mainImage;
        let maxLimit = product.maxOrderLimit || 5;
        if (qty > maxLimit) qty = maxLimit;
        let deliveryCharge = product.deliveryCharge || 150;
        let siteSetting = await SiteSetting.findOne() || { bkashNumber: '01700000000', nagadNumber: '01800000000' };
        
        let codOptionHTML = req.user.isBlocked ? 
            `<p style="color:red; font-size:12px;"><b>Note:</b> Cash on Delivery is disabled.</p>` :
            `<option value="COD">Cash on Delivery</option>`;
        let advanceWarning = req.user.isBlocked ? 
            `<div style="background:#fff3cd; padding:10px; border-radius:4px; margin-bottom:10px; color:#856404; font-size:13px;">⚠️ <b>Notice:</b> Please pay via bKash/Nagad.</div>` : '';
        
        let totalPriceWithoutDelivery = product.price * qty;
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Checkout</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="max-width:600px; background:white; padding:20px; border-radius:6px;">
                    <h3 style="margin-top:0;">Checkout Order</h3>
                    ${advanceWarning}
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                        <img src="/uploads/${selectedImage}" width="60" height="60" style="object-fit:cover; border-radius:4px; border:1px solid #f85606; cursor:pointer;" onclick="openImageModal('/uploads/${selectedImage}')">
                        <div>
                            <p style="font-size:14px; margin:0; font-weight:bold;">${product.name}</p>
                            <p style="font-size:14px; margin:4px 0 0 0; color:#f85606;">Price: ৳${product.price} × ${qty} = ৳${totalPriceWithoutDelivery}</p>
                            <p style="font-size:12px; color:#666; margin:2px 0 0 0;">ডেলিভারি চার্জ: ৳${deliveryCharge}</p>
                        </div>
                    </div>
                    
                    <form action="/api/place-order" method="POST" onsubmit="prepareAddress()">
                        <input type="hidden" name="productId" value="${product._id}">
                        <input type="hidden" name="productName" value="${product.name}">
                        <input type="hidden" name="mainImage" value="${selectedImage}">
                        <input type="hidden" name="price" value="${product.price}">
                        <input type="hidden" name="quantity" value="${qty}">
                        <input type="hidden" name="deliveryCharge" value="${deliveryCharge}">
                        <input type="hidden" name="discountPrice" id="discountPriceInput" value="0">
                        <input type="hidden" name="address" id="fullAddressInput">
                        
                        <label style="font-size:13px; font-weight:600;">Full Name:</label><br>
                        <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Phone Number:</label><br>
                        <input type="text" name="phone" value="${req.user.phone || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                        
                        <!-- জেলা, থানা ও গ্রাম ইনপুট ঘর -->
                        <div style="background:#fdfdfd; padding:12px; border:1px solid #e0e0e0; border-radius:6px; margin-bottom:10px;">
                            <label style="font-size:13px; font-weight:600; color:#f85606;">জেলা (District):</label><br>
                            <input type="text" id="inputDistrict" placeholder="যেমন: ঢাকা / ফরিদপুর" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                            
                            <label style="font-size:13px; font-weight:600; color:#f85606;">থানা (Thana / Upazila):</label><br>
                            <input type="text" id="inputThana" placeholder="যেমন: ভাঙ্গা / তেজগাঁও" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                            
                            <label style="font-size:13px; font-weight:600; color:#f85606;">মেইন এড্রেস (গ্রাম / রোড / বাসা নং):</label><br>
                            <textarea id="inputVillage" placeholder="যেমন: আমতলা গ্রাম, কাজী বাড়ি" style="width:100%; height:50px; padding:8px; margin:3px 0 5px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required></textarea>
                        </div>
                        
                        <label style="font-size:13px; font-weight:600;">Coupon Code:</label><br>
                        <div style="display:flex; gap:5px; margin:4px 0 10px 0;">
                            <input type="text" name="couponCode" id="couponCodeInput" placeholder="Enter Coupon Code" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                            <button type="button" onclick="applyCoupon()" class="btn" style="padding:8px 12px; font-size:12px;">Apply</button>
                        </div>
                        <p id="couponMsg" style="font-size:12px; margin:0 0 10px 0; color:green;"></p>
                        
                        <label style="font-size:13px; font-weight:600;">Customer Note:</label><br>
                        <input type="text" name="customerNote" placeholder="যেমন: বিকালে কল করবেন" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;"><br>
                        
                        <div style="background:#f0f8ff; padding:12px; border-radius:4px; margin-bottom:12px; font-size:14px; border:1px solid #bce8f1;">
                            <p style="margin:2px 0;">Product Price: ৳<span id="productPriceText">${totalPriceWithoutDelivery}</span></p>
                            <p style="margin:2px 0;">Delivery Charge: ৳<span id="deliveryChargeText">${deliveryCharge}</span></p>
                            <p style="margin:2px 0; color:red; display:none;" id="discountRow">Discount: -৳<span id="discountText">0</span></p>
                            <hr style="border:0; border-top:1px solid #ccc; margin:6px 0;">
                            <p style="margin:2px 0; font-weight:bold; color:#f85606; font-size:16px;">Total Payable Amount: ৳<span id="totalAmountText">${totalPriceWithoutDelivery + deliveryCharge}</span></p>
                        </div>
                        
                        <label style="font-size:13px; font-weight:600;">Payment Method:</label><br>
                        <select name="paymentMethod" id="paymentMethod" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" onchange="togglePaymentFields()" required>
                            ${codOptionHTML}
                            <option value="bKash">বিকাশ (বিকাশ পার্সোনাল পেমেন্ট)</option>
                            <option value="Nagad">নগদ (নগদ পার্সোনাল পেমেন্ট)</option>
                        </select><br>
                        
                        <div id="onlinePaymentDiv" style="display:${req.user.isBlocked ? 'block' : 'none'}; background:#f9f9f9; padding:12px; border-radius:4px; margin-bottom:10px; border:1px dashed #f85606;">
                            <p style="font-size:13px; color:#333; margin:0 0 6px 0;">বিকাশ: <b style="color:#f85606;">${siteSetting.bkashNumber}</b> | নগদ: <b style="color:#f85606;">${siteSetting.nagadNumber}</b></p>
                            <label style="font-size:12px; font-weight:600;">আপনার বিকাশ/নগদ নাম্বার:</label><br>
                            <input type="text" name="senderNumber" id="senderNumber" placeholder="যেমন: 01XXXXXXXXX" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                            
                            <label style="font-size:12px; font-weight:600;">প্রেরিত টাকার পরিমাণ:</label><br>
                            <input type="number" name="paidAmount" id="paidAmount" placeholder="যেমন: মোট টাকা" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                            
                            <label style="font-size:12px; font-weight:600;">ট্রানজেকশন আইডি (TrxID):</label><br>
                            <input type="text" name="trxId" placeholder="যেমন: 9N7A6..." style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                        </div>
                        
                        <button type="submit" class="btn btn-buy" style="width:100%; padding:12px; font-size:16px; margin-top:5px;">⚡ Order Now</button>
                    </form>
                </div>
                
                <script>
                    let appliedDiscount = 0;
                    let currentDeliveryCharge = ${deliveryCharge};
                    function prepareAddress() {
                        let dist = document.getElementById('inputDistrict').value.trim();
                        let thana = document.getElementById('inputThana').value.trim();
                        let village = document.getElementById('inputVillage').value.trim();
                        let fullAddr = "জেলা: " + dist + ", থানা: " + thana + ", ঠিকানা: " + village;
                        document.getElementById('fullAddressInput').value = fullAddr;
                    }
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
                            msg.innerText = 'Invalid coupon request.';
                        }
                    }
                    function calculateTotal() {
                        let productPrice = Number(document.getElementById('productPriceText').innerText);
                        let total = (productPrice + currentDeliveryCharge) - appliedDiscount;
                        if(total < 0) total = 0;
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
            res.json({ success: false, message: 'Invalid or expired coupon code.' });
        }
    } catch (err) {
        next(err);
    }
});

app.post('/api/place-order', async (req, res, next) => {
    try {
        if (!req.user) return res.redirect('/login');
        const { productId, productName, mainImage, price, quantity, name, phone, address, discountPrice, customerNote, paymentMethod, senderNumber, paidAmount, trxId, deliveryCharge } = req.body;
        if (req.user.isBlocked && paymentMethod === 'COD') {
            return res.send(`<script>alert('COD is disabled.'); window.history.back();</script>`);
        }
        if ((paymentMethod === 'bKash' || paymentMethod === 'Nagad') && (!senderNumber || !paidAmount)) {
            return res.send(`<script>alert('বিকাশ বা নগদ সিলেক্ট করলে তথ্য দিতে হবে!'); window.history.back();</script>`);
        }
        let dCharge = Number(deliveryCharge) || 150;
        let qty = Number(quantity) || 1;
        let unitPrice = Number(price);
        let productPrice = unitPrice * qty;
        let discount = Number(discountPrice) || 0;
        let totalAmount = (productPrice + dCharge) - discount;
        
        await User.findByIdAndUpdate(req.user._id, { name, phone, address });
        await Product.findByIdAndUpdate(productId, { $inc: { stock: -qty, soldCount: qty } });
        
        let orderedItemObj = {
            productId,
            productName,
            mainImage,
            price: unitPrice,
            quantity: qty
        };
        await new Order({
            userEmail: req.user.email,
            userName: name || '',
            userPhone: phone || '',
            userAddress: address || '',
            items: [orderedItemObj],
            productPrice,
            deliveryCharge: dCharge,
            discountPrice: discount,
            totalAmount,
            deliveryArea: 'Product Delivery Charge',
            customerNote: customerNote || '',
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

// ================= User Authentication & Dashboard =================
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
                    <input type="email" name="email" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                    
                    <label style="font-size:13px; font-weight:600;">Password:</label><br>
                    <input type="password" name="password" style="width:100%; padding:10px; margin:4px 0 15px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>
                    
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
        let role = (email === 'admin@onlineshop.com') ? 'admin' : 'user';
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
        let blockStatusNotice = req.user.isBlocked ? `<p style="color:red; font-weight:bold; font-size:13px;">Account Status: Cash on Delivery Restricted</p>` : `<p style="color:green; font-weight:bold; font-size:13px;">Account Status: Good Standing</p>`;
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>User Dashboard</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="background:white; padding:20px; border-radius:6px;">
                    <h3 style="margin-top:0;">My Account Dashboard</h3>
                    <p style="font-size:14px;"><b>Email:</b> ${req.user.email}</p>
                    ${blockStatusNotice}
                    
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
                    <h4 style="margin-bottom:10px;">My Orders History</h4>
                    <div style="overflow-x:auto;">
                        <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin-top:5px; font-size:13px;">
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

// ================= My Orders Page =================
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
                statusText = 'Completed / Delivered (আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে)';
            } else if (o.status === 'Cancelled') {
                statusColor = '#dc3545';
                statusText = 'Cancelled (অর্ডারটি বাতিল করা হয়েছে)';
            }
            let itemsList = o.items.map(i => `
                <div style="display:flex; align-items:center; gap:8px; margin:4px 0;">
                    ${i.mainImage ? `<img src="/uploads/${i.mainImage}" width="40" height="40" style="object-fit:cover; border-radius:4px; border:1px solid #f85606; cursor:pointer;" onclick="openImageModal('/uploads/${i.mainImage}')">` : ''}
                    <span>${i.productName} (৳${i.price} × ${i.quantity || 1})</span>
                </div>
            `).join('');
            let cancelBtn = (o.status === 'Pending') ? `
                <a href="/api/cancel-order/${o._id}" class="btn" style="background:#dc3545; padding:5px 10px; font-size:12px; margin-top:8px; display:inline-block;" onclick="return confirm('Are you sure you want to cancel this order?');">❌ Cancel Order</a>
            ` : '';
            return `
                <div style="background:#fff; padding:15px; margin-bottom:12px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1); font-size:14px;">
                    <p style="margin:5px 0;"><b>Order ID:</b> ${o._id}</p>
                    <p style="margin:5px 0;"><b>Items Ordered:</b></p>
                    <div style="background:#f9f9f9; padding:8px; border-radius:4px;">${itemsList}</div>
                    <p style="margin:5px 0;"><b>Price:</b> ৳${o.productPrice} + Delivery: ৳${o.deliveryCharge || 0} ${o.discountPrice ? `- Discount: ৳${o.discountPrice}` : ''} = <b style="color:#f85606;">৳${o.totalAmount}</b> (${o.paymentMethod})</p>
                    <p style="margin:5px 0;"><b>Delivery Address:</b> ${o.userAddress || 'N/A'}</p>
                    ${o.customerNote ? `<p style="margin:5px 0; color:#555; font-size:13px;"><b>Note:</b> ${o.customerNote}</p>` : ''}
                    <p style="margin:5px 0;"><b>Status:</b> <span style="color:${statusColor}; font-weight:bold;">${statusText}</span></p>
                    <p style="margin:5px 0; color:#666; font-size:12px;"><b>Date:</b> ${new Date(o.createdAt).toLocaleString()}</p>
                    ${cancelBtn}
                </div>
            `;
        }).join('');
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>My Orders & Status</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="max-width:800px;">
                    <h3 style="margin-bottom:15px;">📦 My Orders Tracking</h3>
                    ${ordersHTML.length ? ordersHTML : '<div style="background:white; padding:30px; text-align:center; border-radius:6px;"><p>You have not placed any orders yet.</p></div>'}
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

app.get('/api/cancel-order/:id', async (req, res, next) => {
    try {
        if (!req.user) return res.redirect('/login');
        let order = await Order.findOne({ _id: req.params.id, userEmail: req.user.email });
        if (order && order.status === 'Pending') {
            order.status = 'Cancelled';
            order.previousStatus = 'Cancelled';
            await order.save();
            for (let item of order.items) {
                let qty = item.quantity || 1;
                await Product.findByIdAndUpdate(item.productId, { $inc: { stock: qty, soldCount: -qty } });
            }
        }
        res.redirect('/my-orders');
    } catch (err) {
        next(err);
    }
});

// ================= Admin Dashboard & Management (Fixed & Updated) =================
app.get('/admin-dashboard', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let activeTab = req.query.tab || 'pending'; 
        let products = await Product.find().sort({ _id: -1 });
        let chats = await Chat.find().sort({ _id: -1 });
        let users = await User.find({ role: 'user' });
        let coupons = await Coupon.find().sort({ _id: -1 });
        let siteSetting = await SiteSetting.findOne() || { bkashNumber: '01700000000', nagadNumber: '01800000000' };
        let orderQuery = {};
        if (activeTab === 'pending') orderQuery.status = 'Pending';
        else if (activeTab === 'confirmed') orderQuery.status = 'Confirmed';
        else if (activeTab === 'delivered') orderQuery.status = 'Delivered';
        else if (activeTab === 'cancelled') orderQuery.status = 'Cancelled';
        else if (activeTab === 'trash') orderQuery.status = 'Trash';
        let orders = await Order.find(orderQuery).sort({ _id: -1 });
        
        let ordersHTML = orders.map(o => {
            let itemsList = o.items.map(i => `
                <div style="display:flex; align-items:center; gap:8px; margin:4px 0; background:#fff; padding:6px; border-radius:4px; border:1px solid #eee;">
                    ${i.mainImage ? `<img src="/uploads/${i.mainImage}" width="45" height="45" style="object-fit:cover; border-radius:4px; cursor:pointer;" onclick="openImageModal('/uploads/${i.mainImage}')">` : ''}
                    <div>
                        <span style="font-size:13px; font-weight:600; display:block;">${i.productName}</span>
                        <span style="font-size:12px; color:#f85606;">৳${i.price} × ${i.quantity || 1} = ৳${i.price * (i.quantity || 1)}</span>
                    </div>
                </div>
            `).join('');
            
            let actionButtons = '';
            if (o.status === 'Pending') {
                actionButtons = `
                    <a href="/admin/order-action/${o._id}/Confirmed" class="btn" style="background:#007bff; padding:5px 10px; font-size:12px;">Confirm</a>
                    <a href="/admin/order-action/${o._id}/Cancelled" class="btn" style="background:#dc3545; padding:5px 10px; font-size:12px;">Cancel</a>
                    <a href="/admin/order-action/${o._id}/Trash" class="btn" style="background:#6c757d; padding:5px 10px; font-size:12px;">Trash</a>
                `;
            } else if (o.status === 'Confirmed') {
                actionButtons = `
                    <a href="/admin/order-action/${o._id}/Delivered" class="btn" style="background:#28a745; padding:5px 10px; font-size:12px;">Mark Delivered</a>
                    <a href="/admin/order-action/${o._id}/Trash" class="btn" style="background:#6c757d; padding:5px 10px; font-size:12px;">Trash</a>
                `;
            } else {
                actionButtons = `
                    <a href="/admin/order-action/${o._id}/Trash" class="btn" style="background:#6c757d; padding:5px 10px; font-size:12px;">Move to Trash</a>
                `;
            }
            
            /* ফিক্সড: এডমিন অর্ডার বক্সের লেআউট সুন্দর, ক্লিয়ার ও সুবিন্যস্ত করা হয়েছে */
            return `
                <div style="background:#fdfdfd; border:1px solid #ddd; padding:15px; margin-bottom:15px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:8px;">
                        <span style="font-size:13px; color:#555;"><b>Order ID:</b> ${o._id}</span>
                        <span style="font-size:12px; background:#e2e3e5; padding:2px 8px; border-radius:4px; font-weight:bold;">${o.paymentMethod}</span>
                    </div>
                    <div style="margin-bottom:8px; font-size:13px;">
                        <p style="margin:2px 0;"><b>Customer Name:</b> ${o.userName || 'N/A'}</p>
                        <p style="margin:2px 0;"><b>Phone:</b> ${o.userPhone || 'N/A'}</p>
                        <p style="margin:2px 0; color:#f85606;"><b>Delivery Address:</b> ${o.userAddress || 'N/A'}</p>
                    </div>
                    <div style="margin-bottom:8px;">
                        <p style="margin:0 0 4px 0; font-size:12px; font-weight:bold; color:#666;">Ordered Products:</p>
                        <div>${itemsList}</div>
                    </div>
                    <div style="background:#f1f1f1; padding:8px; border-radius:4px; font-size:13px; margin-bottom:8px;">
                        <p style="margin:0;"><b>Total Amount:</b> ৳${o.totalAmount} ${o.senderNumber ? '| Sender: ' + o.senderNumber + ' | Paid: ৳' + o.paidAmount : ''}</p>
                    </div>
                    ${o.customerNote ? '<p style="margin:0 0 8px 0; font-size:12px; color:#555;"><b>Note:</b> ' + o.customerNote + '</p>' : ''}
                    <div style="display:flex; gap:6px; margin-top:10px;">${actionButtons}</div>
                </div>
            `;
        }).join('');

        let productsHTML = products.map(p => `
            <div style="background:white; padding:10px; margin-bottom:10px; border-radius:6px; display:flex; align-items:center; gap:10px; justify-content:space-between; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="/uploads/${p.mainImage}" width="50" height="50" style="object-fit:cover; border-radius:4px; cursor:pointer;" onclick="openImageModal('/uploads/${p.mainImage}')">
                    <div>
                        <h4 style="margin:0 0 2px 0; font-size:14px;">${p.name}</h4>
                        <p style="margin:0; font-size:12px; color:#f85606;">৳${p.price} | Stock: ${p.stock} | Limit: ${p.maxOrderLimit || 5} | Delivery: ৳${p.deliveryCharge || 150}</p>
                    </div>
                </div>
                <div style="display:flex; gap:6px;">
                    <a href="/admin/edit-product/${p._id}" class="btn" style="padding:5px 10px; font-size:12px; background:#007bff;">Edit</a>
                    <a href="/admin/delete-product/${p._id}" class="btn" style="padding:5px 10px; font-size:12px; background:#dc3545;" onclick="return confirm('Are you sure?')">Delete</a>
                </div>
            </div>
        `).join('');

        let chatsHTML = chats.map(c => `
            <div style="background:white; padding:12px; margin-bottom:10px; border-radius:6px; display:flex; gap:10px; align-items:center;">
                ${c.productImage ? `<img src="/uploads/${c.productImage}" width="50" height="50" style="object-fit:cover; border-radius:4px; cursor:pointer;" onclick="openImageModal('/uploads/${c.productImage}')">` : ''}
                <div style="flex:1;">
                    <p style="margin:0 0 2px 0; font-size:13px;"><b>${c.userEmail}</b> on ${c.productName || 'General'}</p>
                    <p style="margin:0 0 4px 0; font-size:13px; color:#333;">প্রশ্ন: ${c.message}</p>
                    <form action="/admin/reply-chat/${c._id}" method="POST" style="display:flex; gap:5px; margin-top:5px;">
                        <input type="text" name="reply" value="${c.reply || ''}" placeholder="Write reply..." style="flex:1; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px;" required>
                        <button type="submit" class="btn" style="padding:6px 12px; font-size:12px;">Reply</button>
                    </form>
                </div>
            </div>
        `).join('');

        let usersHTML = users.map(u => `
            <div style="background:white; padding:10px; margin-bottom:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:13px;">
                <div>
                    <b>${u.email}</b> (${u.name || 'No Name'})<br>
                    <span style="color:${u.isBlocked ? 'red' : 'green'};">Status: ${u.isBlocked ? 'Blocked (COD Restricted)' : 'Active'}</span>
                </div>
                <div>
                    ${u.isBlocked ? 
                        `<a href="/admin/toggle-block/${u._id}" class="btn" style="padding:5px 10px; font-size:12px; background:#28a745;">Unblock</a>` : 
                        `<a href="/admin/toggle-block/${u._id}" class="btn" style="padding:5px 10px; font-size:12px; background:#dc3545;">Block COD</a>`}
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
                    <h2 style="margin-top:0;">⚙️ Admin Control Panel</h2>
                    <div style="display:flex; gap:8px; margin-bottom:15px; overflow-x:auto;">
                        <a href="/admin-dashboard?tab=pending" class="btn" style="background:${activeTab==='pending'?'#f85606':'#6c757d'}; padding:8px 12px; font-size:13px;">Pending Orders</a>
                        <a href="/admin-dashboard?tab=confirmed" class="btn" style="background:${activeTab==='confirmed'?'#f85606':'#6c757d'}; padding:8px 12px; font-size:13px;">Confirmed</a>
                        <a href="/admin-dashboard?tab=delivered" class="btn" style="background:${activeTab==='delivered'?'#f85606':'#6c757d'}; padding:8px 12px; font-size:13px;">Delivered</a>
                        <a href="/admin-dashboard?tab=cancelled" class="btn" style="background:${activeTab==='cancelled'?'#f85606':'#6c757d'}; padding:8px 12px; font-size:13px;">Cancelled</a>
                        <a href="/admin-dashboard?tab=trash" class="btn" style="background:${activeTab==='trash'?'#f85606':'#6c757d'}; padding:8px 12px; font-size:13px;">Trash</a>
                        <a href="/admin-dashboard?tab=products" class="btn" style="background:${activeTab==='products'?'#f85606':'#6c757d'}; padding:8px 12px; font-size:13px;">Products</a>
                        <a href="/admin-dashboard?tab=addproduct" class="btn" style="background:${activeTab==='addproduct'?'#f85606':'#6c757d'}; padding:8px 12px; font-size:13px;">Add Product</a>
                        <a href="/admin-dashboard?tab=chats" class="btn" style="background:${activeTab==='chats'?'#f85606':'#6c757d'}; padding:8px 12px; font-size:13px;">Messages</a>
                        <a href="/admin-dashboard?tab=users" class="btn" style="background:${activeTab==='users'?'#f85606':'#6c757d'}; padding:8px 12px; font-size:13px;">Users</a>
                    </div>
                    ${activeTab === 'addproduct' ? `
                        <div style="background:white; padding:20px; border-radius:6px; max-width:600px;">
                            <h3>Add New Product</h3>
                            <form action="/admin/add-product" method="POST" enctype="multipart/form-data">
                                <label style="font-size:13px; font-weight:600;">Product Name:</label><br>
                                <input type="text" name="name" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                                
                                <label style="font-size:13px; font-weight:600;">Category:</label><br>
                                <input type="text" name="category" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                                
                                <label style="font-size:13px; font-weight:600;">Price (৳):</label><br>
                                <input type="number" name="price" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                                
                                <label style="font-size:13px; font-weight:600;">Stock:</label><br>
                                <input type="number" name="stock" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                                
                                <label style="font-size:13px; font-weight:600;">Max Order Limit:</label><br>
                                <input type="number" name="maxOrderLimit" value="5" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                                <label style="font-size:13px; font-weight:600;">Delivery Charge (টাকা):</label><br>
                                <input type="number" name="deliveryCharge" value="150" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                                
                                <label style="font-size:13px; font-weight:600;">Main Image:</label><br>
                                <input type="file" name="mainImage" style="width:100%; margin:4px 0 10px 0;" required><br>
                                
                                <label style="font-size:13px; font-weight:600;">Gallery Images:</label><br>
                                <input type="file" name="gallery" multiple style="width:100%; margin:4px 0 10px 0;"><br>
                                
                                <label style="font-size:13px; font-weight:600;">Description:</label><br>
                                <textarea name="description" style="width:100%; height:70px; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;"></textarea><br>
                                
                                <button type="submit" class="btn" style="padding:10px 20px;">Save Product</button>
                            </form>
                        </div>
                    ` : activeTab === 'products' ? `
                        <div><h3>Manage Products</h3>${productsHTML}</div>
                    ` : activeTab === 'chats' ? `
                        <div><h3>Customer Inbox & Messages</h3>${chatsHTML.length ? chatsHTML : '<p style="background:white; padding:20px; text-align:center;">No messages found.</p>'}</div>
                    ` : activeTab === 'users' ? `
                        <div><h3>User Block & Status Management</h3>${usersHTML.length ? usersHTML : '<p style="background:white; padding:20px; text-align:center;">No users found.</p>'}</div>
                    ` : `
                        <div><h3>Orders List (${activeTab.toUpperCase()})</h3>${ordersHTML.length ? ordersHTML : '<p style="background:white; padding:20px; text-align:center;">No orders found in this section.</p>'}</div>
                    `}
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

// Admin Actions Handlers
app.get('/admin/order-action/:id/:status', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let orderId = req.params.id;
        let newStatus = req.params.status;
        await Order.findByIdAndUpdate(orderId, { status: newStatus });
        res.redirect('/admin-dashboard?tab=pending');
    } catch (err) {
        next(err);
    }
});

app.get('/admin/toggle-block/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let userId = req.params.id;
        let user = await User.findById(userId);
        if (user) {
            user.isBlocked = !user.isBlocked;
            await user.save();
        }
        res.redirect('/admin-dashboard?tab=users');
    } catch (err) {
        next(err);
    }
});

app.post('/admin/reply-chat/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let chatId = req.params.id;
        let replyText = req.body.reply;
        await Chat.findByIdAndUpdate(chatId, { reply: replyText });
        res.redirect('/admin-dashboard?tab=chats');
    } catch (err) {
        next(err);
    }
});

app.post('/admin/add-product', upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'gallery', maxCount: 5 }]), async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        const { name, category, price, stock, maxOrderLimit, deliveryCharge, description } = req.body;
        let mainImage = req.files && req.files['mainImage'] ? req.files['mainImage'][0].filename : '';
        let gallery = req.files && req.files['gallery'] ? req.files['gallery'].map(file => file.filename) : [];
        
        await new Product({
            name,
            category,
            price: Number(price),
            stock: Number(stock),
            maxOrderLimit: Number(maxOrderLimit) || 5,
            deliveryCharge: Number(deliveryCharge) || 150,
            description,
            mainImage,
            gallery
        }).save();
        
        res.redirect('/admin-dashboard?tab=products');
    } catch (err) {
        next(err);
    }
});

app.get('/admin/delete-product/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin-dashboard?tab=products');
    } catch (err) {
        next(err);
    }
});

app.get('/admin/edit-product/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let product = await Product.findById(req.params.id);
        if (!product) return res.send('Product not found');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Edit Product</title>${globalHeaderHTML}</head>
            <body>
                ${getNavbarHTML(req.user)}
                <div class="container" style="background:white; padding:20px; border-radius:6px; max-width:600px;">
                    <h3>Edit Product: ${product.name}</h3>
                    <form action="/admin/update-product/${product._id}" method="POST">
                        <label style="font-size:13px; font-weight:600;">Product Name:</label><br>
                        <input type="text" name="name" value="${product.name}" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Category:</label><br>
                        <input type="text" name="category" value="${product.category}" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Price (৳):</label><br>
                        <input type="number" name="price" value="${product.price}" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Stock:</label><br>
                        <input type="number" name="stock" value="${product.stock}" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Max Order Limit:</label><br>
                        <input type="number" name="maxOrderLimit" value="${product.maxOrderLimit || 5}" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Delivery Charge (টাকা):</label><br>
                        <input type="number" name="deliveryCharge" value="${product.deliveryCharge || 150}" style="width:100%; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                        
                        <label style="font-size:13px; font-weight:600;">Description:</label><br>
                        <textarea name="description" style="width:100%; height:70px; padding:8px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px;">${product.description || ''}</textarea><br>
                        
                        <button type="submit" class="btn" style="padding:10px 20px;">Update Product</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        next(err);
    }
});

app.post('/admin/update-product/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        const { name, category, price, stock, maxOrderLimit, deliveryCharge, description } = req.body;
        await Product.findByIdAndUpdate(req.params.id, {
            name,
            category,
            price: Number(price),
            stock: Number(stock),
            maxOrderLimit: Number(maxOrderLimit) || 5,
            deliveryCharge: Number(deliveryCharge) || 150,
            description
        });
        res.redirect('/admin-dashboard?tab=products');
    } catch (err) {
        next(err);
    }
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// ================= Server Listen =================
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
