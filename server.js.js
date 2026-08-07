const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');

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

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');
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
    description: { type: String, default: '' },
    mainImage: { type: String, default: '' },
    gallery: [String],
    soldCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    userEmail: String,
    items: Array,
    totalAmount: Number,
    paymentMethod: String,
    senderNumber: String,
    paidAmount: Number,
    trxId: String,
    status: { type: String, default: 'Pending' }, // Pending, Confirmed, Delivered, Trash
    previousStatus: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

const chatSchema = new mongoose.Schema({
    productId: String,
    productName: String,
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
        <a href="/category/Fashion">👗 Fashion</a>
        <a href="/category/Electronics">💻 Electronics</a>
        <a href="/category/Groceries">🍎 Groceries</a>
        <a href="/category/Home">🏠 Home & Living</a>
        <a href="/category/Beauty">💄 Beauty & Health</a>
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

app.get('/', async (req, res) => {
    let categoryFilter = req.query.category;
    let query = categoryFilter ? { category: categoryFilter } : {};
    let products = await Product.find(query).sort({ _id: -1 });
    let fbContents = await FbContent.find().sort({ _id: -1 });

    let productsHTML = products.map(p => `
        <a href="/product/${p._id}" class="product-card">
            <img src="/uploads/${p.mainImage}" alt="${p.name}">
            <h4>${p.name}</h4>
            <div class="price">৳${p.price}</div>
            <div style="font-size:11px; color:#888;">Stock: ${p.stock}</div>
        </a>
    `).join('');

    let fbHTML = fbContents.map(fb => `
        <div style="background:white; padding:15px; margin-bottom:15px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <p style="font-weight:bold; margin-bottom:8px;">${fb.title}</p>
            ${fb.mediaType === 'image' ? `<img src="/uploads/${fb.mediaUrl}" style="max-width:100%; height:auto; border-radius:4px;">` : `<video src="/uploads/${fb.mediaUrl}" controls style="max-width:100%; border-radius:4px;"></video>`}
            <br><a href="${fb.productLink || '/'}" class="btn btn-buy" style="margin-top:10px; display:inline-block;">⚡ Order Now</a>
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
});

app.get('/category/:name', async (req, res) => {
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
                <div class="product-grid">${productsHTML.length ? productsHTML : '<div style="background:white; padding:30px; text-align:center; border-radius:6px; grid-column: span 2;"><h3>No products found.</h3><p style="color:#777; font-size:13px;">This category currently has no products available.</p></div>'}</div>
            </div>
        </body>
        </html>
    `);
});

app.get('/search', async (req, res) => {
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
});

app.get('/product/:id', async (req, res) => {
    let product = await Product.findById(req.params.id);
    if (!product) return res.send('Product not found');
    let chats = await Chat.find({ productId: product._id });
    let relatedProducts = await Product.find({ category: product.category, _id: { $ne: product._id } }).limit(4);

    let galleryHTML = product.gallery.map(img => `<img src="/uploads/${img}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:1px solid #ccc;">`).join('');
    let chatsHTML = chats.map(c => `<div style="border-bottom:1px solid #eee; padding:8px 0;"><p style="margin:0 0 4px 0;"><b>${c.userEmail}:</b> ${c.message}</p><p style="color:green; font-size:13px; margin:0 0 0 15px;"><b>Admin Reply:</b> ${c.reply || 'Pending reply'}</p></div>`).join('');
    
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
                        <img src="/uploads/${product.mainImage}" style="width:100%; height:300px; object-fit:cover; border-radius:6px;"><br>
                        <div style="display:flex; gap:8px; margin-top:10px; overflow-x:auto;">${galleryHTML}</div>
                    </div>
                    <div style="flex:1; min-width: 260px;">
                        <h2 style="font-size:18px; margin-top:0;">${product.name}</h2>
                        <p style="font-size:13px; color:#666;"><b>Category:</b> ${product.category}</p>
                        <div class="price">৳${product.price}</div>
                        <p style="font-size:13px;"><b>Stock Available:</b> ${product.stock}</p>
                        <p style="font-size:14px; color:#440;">${product.description}</p>
                        <br>
                        <a href="/buy-now/${product._id}" class="btn btn-buy" style="width:100%; padding:12px; font-size:16px; text-align:center;">Buy Now</a>
                    </div>
                </div>
                
                <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
                <h3>You May Also Like</h3>
                <div class="product-grid" style="margin-top:10px;">${relatedHTML.length ? relatedHTML : '<p>No related products.</p>'}</div>

                <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
                <h3>Ask Question About This Product</h3>
                <form action="/api/chat" method="POST">
                    <input type="hidden" name="productId" value="${product._id}">
                    <input type="hidden" name="productName" value="${product.name}">
                    <textarea name="message" placeholder="Ask your question here..." style="width:100%; height:70px; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:14px;" required></textarea><br>
                    <button type="submit" class="btn" style="margin-top:6px; padding:8px 14px;">Send Question</button>
                </form>
                <div style="margin-top:20px;">
                    <h4 style="margin-bottom:10px;">Customer Q&A:</h4>
                    ${chatsHTML.length ? chatsHTML : '<p style="color:#777; font-size:13px;">No questions yet.</p>'}
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/chat', async (req, res) => {
    let email = req.user ? req.user.email : 'Guest User';
    await new Chat({
        productId: req.body.productId,
        productName: req.body.productName,
        userEmail: email,
        message: req.body.message
    }).save();
    res.redirect('back');
});

// ================= My Orders Page (With Status Tracking for Users) =================

app.get('/my-orders', async (req, res) => {
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
        }

        let itemsList = o.items.map(i => `${i.productName} (৳${i.price})`).join(', ');

        return `
            <div style="background:#fff; padding:15px; margin-bottom:12px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1); font-size:14px;">
                <p style="margin:5px 0;"><b>Order ID:</b> ${o._id}</p>
                <p style="margin:5px 0;"><b>Items:</b> ${itemsList}</p>
                <p style="margin:5px 0;"><b>Total Amount:</b> ৳${o.totalAmount} (${o.paymentMethod})</p>
                <p style="margin:5px 0;"><b>Status Update:</b> <span style="color:${statusColor}; font-weight:bold;">${statusText}</span></p>
                <p style="margin:5px 0; color:#666; font-size:12px;"><b>Date:</b> ${new Date(o.createdAt).toLocaleString()}</p>
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
});

// ================= Checkout & Order Flow =================

app.get('/buy-now/:id', async (req, res) => {
    let product = await Product.findById(req.params.id);
    if (!product) return res.send('Product not found');

    if (!req.user) {
        return res.redirect('/login?redirect=/buy-now/' + product._id);
    }

    let codOptionHTML = req.user.isBlocked ? 
        `<p style="color:red; font-size:12px;"><b>Note:</b> Cash on Delivery is disabled for your account. Please pay via bKash/Nagad.</p>` :
        `<option value="COD">Cash on Delivery</option>`;

    let advanceWarning = req.user.isBlocked ? 
        `<div style="background:#fff3cd; padding:10px; border-radius:4px; margin-bottom:10px; color:#856404; font-size:13px;">⚠️ <b>Notice:</b> Please pay via bKash/Nagad to process your order.</div>` : '';

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Checkout</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container" style="max-width:600px; background:white; padding:20px; border-radius:6px;">
                <h3 style="margin-top:0;">Checkout Order</h3>
                ${advanceWarning}
                <p style="font-size:14px;"><b>Product:</b> ${product.name}</p>
                <p style="font-size:14px;"><b>Price:</b> ৳${product.price}</p>
                <form action="/api/place-order" method="POST">
                    <input type="hidden" name="productId" value="${product._id}">
                    <input type="hidden" name="productName" value="${product.name}">
                    <input type="hidden" name="price" value="${product.price}">
                    
                    <label style="font-size:13px; font-weight:600;">Full Name:</label><br>
                    <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>

                    <label style="font-size:13px; font-weight:600;">Phone Number:</label><br>
                    <input type="text" name="phone" value="${req.user.phone || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br>

                    <label style="font-size:13px; font-weight:600;">Delivery Address:</label><br>
                    <textarea name="address" style="width:100%; height:60px; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required>${req.user.address || ''}</textarea><br>

                    <label style="font-size:13px; font-weight:600;">Payment Method:</label><br>
                    <select name="paymentMethod" id="paymentMethod" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" onchange="togglePaymentFields()" required>
                        ${codOptionHTML}
                        <option value="bKash">বিকাশ (এই নাম্বারে পেমেন্ট করুন)</option>
                        <option value="Nagad">নগদ (এই নাম্বারে পেমেন্ট করুন)</option>
                    </select><br>

                    <div id="onlinePaymentDiv" style="display:${req.user.isBlocked ? 'block' : 'none'}; background:#f9f9f9; padding:10px; border-radius:4px; margin-bottom:10px;">
                        <p style="font-size:13px; color:#555; margin:0 0 8px 0;">এই নাম্বারে পেমেন্ট করুন: <b>01700000000</b></p>
                        
                        <label style="font-size:12px;">Sender Phone Number <span style="color:red;">*</span>:</label><br>
                        <input type="text" name="senderNumber" id="senderNumber" placeholder="e.g. 01XXXXXXXXX" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                        
                        <label style="font-size:12px;">Paid Amount (Tk) <span style="color:red;">*</span>:</label><br>
                        <input type="number" name="paidAmount" id="paidAmount" placeholder="Amount sent" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br>
                        
                        <label style="font-size:12px;">Transaction ID (TrxID - Optional):</label><br>
                        <input type="text" name="trxId" placeholder="Optional TrxID" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                    </div>

                    <button type="submit" class="btn btn-buy" style="width:100%; padding:12px; font-size:16px; margin-top:5px;">Confirm Order</button>
                </form>
            </div>
            <script>
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
});

app.post('/api/place-order', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    const { productId, productName, price, name, phone, address, paymentMethod, senderNumber, paidAmount, trxId } = req.body;

    if (req.user.isBlocked && paymentMethod === 'COD') {
        return res.send(`<script>alert('COD is disabled for your account. Please pay via bKash or Nagad.'); window.history.back();</script>`);
    }

    if ((paymentMethod === 'bKash' || paymentMethod === 'Nagad') && (!senderNumber || !paidAmount)) {
        return res.send(`<script>alert('বিকাশ বা নগদ সিলেক্ট করলে Sender Number এবং Paid Amount ঘর দুটি পূরণ করা বাধ্যতামূলক!'); window.history.back();</script>`);
    }

    await User.findByIdAndUpdate(req.user._id, { name, phone, address });
    await Product.findByIdAndUpdate(productId, { $inc: { stock: -1, soldCount: 1 } });

    await new Order({
        userEmail: req.user.email,
        items: [{ productId, productName, price }],
        totalAmount: Number(price),
        paymentMethod,
        senderNumber: senderNumber || '',
        paidAmount: Number(paidAmount) || 0,
        trxId: trxId || '',
        status: 'Pending',
        previousStatus: 'Pending'
    }).save();

    res.send(`<script>alert('Order placed successfully!'); window.location.href='/my-orders';</script>`);
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

app.post('/api/login', async (req, res) => {
    const { email, password, redirect } = req.body;
    let user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.send(`<script>alert('Invalid email or password!'); window.location.href='/login';</script>`);
    }
    res.cookie('userSession', JSON.stringify({ email: user.email, role: user.role }));
    res.redirect(redirect || '/');
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

app.post('/api/register', async (req, res) => {
    const { email, password, redirect } = req.body;
    let existing = await User.findOne({ email });
    if (existing) return res.send(`<script>alert('Email already exists!'); window.location.href='/register';</script>`);

    let role = (email === 'admin@onlineshop.com') ? 'admin' : 'user';
    let hashedPassword = await bcrypt.hash(password, 10);

    let newUser = new User({ email, password: hashedPassword, role });
    await newUser.save();
    res.cookie('userSession', JSON.stringify({ email: newUser.email, role: newUser.role }));
    res.redirect(redirect || '/dashboard');
});

app.get('/logout', (req, res) => {
    res.clearCookie('userSession');
    res.redirect('/');
});

app.get('/dashboard', async (req, res) => {
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
});

app.post('/api/update-profile', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    const { name, phone, address } = req.body;
    await User.findByIdAndUpdate(req.user._id, { name, phone, address });
    res.redirect('/dashboard');
});

app.get('/wishlist', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Wishlist</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container" style="background:white; padding:20px; border-radius:6px; text-align:center;"><h3>❤️ My Wishlist</h3><p style="color:#777;">Your wishlist items will appear here.</p></div></body></html>`);
});

app.get('/cart', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Cart</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container" style="background:white; padding:20px; border-radius:6px; text-align:center;"><h3>🛒 Shopping Cart</h3><p style="color:#777;">Your cart is empty.</p></div></body></html>`);
});

// ================= Admin Dashboard & Management =================

app.get('/admin-dashboard', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');

    let activeTab = req.query.tab || 'pending'; // pending, confirmed, completed, trash

    let products = await Product.find().sort({ _id: -1 });
    let chats = await Chat.find().sort({ _id: -1 });
    let users = await User.find({ role: 'user' });

    let pendingCount = await Order.countDocuments({ status: 'Pending' });
    let confirmedCount = await Order.countDocuments({ status: 'Confirmed' });
    let completedCount = await Order.countDocuments({ status: 'Delivered' });
    let trashCount = await Order.countDocuments({ status: 'Trash' });

    let queryStatus = 'Pending';
    if (activeTab === 'confirmed') queryStatus = 'Confirmed';
    if (activeTab === 'completed') queryStatus = 'Delivered';
    if (activeTab === 'trash') queryStatus = 'Trash';

    let orders = await Order.find({ status: queryStatus }).sort({ _id: -1 });

    let lowStockCount = products.filter(p => p.stock < 5).length;
    let totalSoldItems = products.reduce((acc, p) => acc + (p.soldCount || 0), 0);

    let productsHTML = products.map(p => `
        <tr style="${p.stock < 5 ? 'background:#fff3cd;' : ''}">
            <td><img src="/uploads/${p.mainImage}" width="35" height="35" style="object-fit:cover; border-radius:3px;"></td>
            <td>${p.name} ${p.stock < 5 ? '<span style="color:red; font-size:10px;">(Low)</span>' : ''}</td>
            <td>৳${p.price}</td>
            <td>${p.stock}</td>
            <td><b>${p.soldCount || 0}</b></td>
            <td><a href="/api/delete-product/${p._id}" class="btn" style="background:#d9534f; padding:3px 6px; font-size:11px;">Delete</a></td>
        </tr>
    `).join('');

    let ordersHTML = orders.map(o => {
        let actionButtons = '';
        if (o.status === 'Pending') {
            actionButtons = `
                <a href="/api/change-order-status/${o._id}/Confirmed?tab=${activeTab}" class="btn btn-buy" style="padding:4px 8px; font-size:11px; margin-right:4px;">Confirm Order</a>
            `;
        } else if (o.status === 'Confirmed') {
            actionButtons = `
                <a href="/api/change-order-status/${o._id}/Delivered?tab=${activeTab}" class="btn" style="background:#28a745; padding:4px 8px; font-size:11px; margin-right:4px;">Completed (Delivered)</a>
            `;
        } else if (o.status === 'Trash') {
            actionButtons = `
                <a href="/api/restore-order/${o._id}" class="btn" style="background:#17a2b8; padding:4px 8px; font-size:11px; margin-right:4px;">🔄 Restore</a>
            `;
        }

        let deleteBtnLink = o.status === 'Trash' ? `/api/permanent-delete-order/${o._id}` : `/api/move-to-trash/${o._id}`;
        let deleteBtnText = o.status === 'Trash' ? 'Permanent Delete' : 'Delete (Trash)';

        return `
            <tr>
                <td>${o._id}</td>
                <td>${o.userEmail}</td>
                <td>৳${o.totalAmount} (${o.paymentMethod}) <br><small>Sender: ${o.senderNumber || 'N/A'}, TrxID: ${o.trxId || 'N/A'}</small></td>
                <td>
                    <div style="margin-bottom:6px;"><span style="font-weight:bold; color:${o.status === 'Delivered' ? 'green' : (o.status === 'Confirmed' ? '#007bff' : (o.status === 'Trash' ? '#6c757d' : '#f85606'))};">${o.status}</span></div>
                    ${actionButtons}
                    <a href="${deleteBtnLink}" class="btn" style="background:#d9534f; padding:4px 8px; font-size:11px;" onclick="return confirm('Are you sure?');">${deleteBtnText}</a>
                </td>
            </tr>
        `;
    }).join('');

    let usersHTML = users.map(u => `
        <tr>
            <td>${u.email}</td>
            <td>${u.isBlocked ? '<span style="color:red; font-weight:bold;">Blocked</span>' : '<span style="color:green;">Active</span>'}</td>
            <td>
                <a href="/api/toggle-block/${u._id}" class="btn" style="background:${u.isBlocked ? '#28a745' : '#d9534f'}; padding:3px 6px; font-size:11px;">
                    ${u.isBlocked ? 'Unblock' : 'Block COD'}
                </a>
            </td>
        </tr>
    `).join('');

    let chatsHTML = chats.map(c => `
        <div style="background:#f9f9f9; padding:10px; margin-bottom:10px; border-radius:4px; font-size:13px;">
            <p style="margin:0 0 4px 0;"><b>Product:</b> ${c.productName} | <b>User:</b> ${c.userEmail}</p>
            <p style="margin:0 0 8px 0;"><b>Question:</b> ${c.message}</p>
            <form action="/api/reply-chat" method="POST" style="display:flex; gap:5px;">
                <input type="hidden" name="chatId" value="${c._id}">
                <input type="text" name="reply" value="${c.reply || ''}" placeholder="Write reply..." style="padding:5px; flex:1; border:1px solid #ccc; border-radius:4px; font-size:13px;" required>
                <button type="submit" class="btn" style="padding:5px 10px; font-size:12px;">Reply</button>
            </form>
        </div>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Admin Dashboard</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container">
                <h3 style="margin-bottom:15px;">⚙️ Admin Control Dashboard</h3>
                
                <div style="display:flex; gap:12px; margin-bottom:15px; flex-wrap:wrap;">
                    <div style="background:white; padding:12px; border-radius:6px; flex:1; min-width:140px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <h4 style="margin:0; font-size:13px; color:#666;">Total Sold Items</h4>
                        <p style="font-size:20px; color:#f85606; font-weight:bold; margin:5px 0 0 0;">${totalSoldItems}</p>
                    </div>
                    <div style="background:white; padding:12px; border-radius:6px; flex:1; min-width:140px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <h4 style="margin:0; font-size:13px; color:#666;">Low Stock Alerts</h4>
                        <p style="font-size:20px; color:red; font-weight:bold; margin:5px 0 0 0;">${lowStockCount}</p>
                    </div>
                </div>

                <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px;">
                    <h4 style="margin-top:0;">📦 Add New Product</h4>
                    <form action="/api/add-product" method="POST" enctype="multipart/form-data" style="display:grid; gap:8px; max-width:500px;">
                        <input type="text" name="name" placeholder="Product Name" style="padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;" required>
                        <select name="category" style="padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;" required>
                            <option value="Fashion">Fashion</option>
                            <option value="Electronics">Electronics</option>
                            <option value="Groceries">Groceries</option>
                            <option value="Home">Home & Living</option>
                            <option value="Beauty">Beauty & Health</option>
                        </select>
                        <input type="number" name="price" placeholder="Price (Tk)" style="padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;" required>
                        <input type="number" name="stock" placeholder="Stock Quantity" style="padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;" required>
                        <textarea name="description" placeholder="Product Description" style="padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;"></textarea>
                        
                        <label style="font-size:12px; font-weight:600;">Main Image:</label>
                        <input type="file" name="mainImage" accept="image/*" style="font-size:12px;" required>
                        
                        <label style="font-size:12px; font-weight:600;">Gallery Images (Up to 5):</label>
                        <input type="file" name="gallery" accept="image/*" multiple style="font-size:12px;">
                        
                        <button type="submit" class="btn" style="padding:8px;">Upload Product</button>
                    </form>
                </div>

                <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px;">
                    <h4 style="margin-top:0;">🎬 Add Facebook Post / Reels Video</h4>
                    <form action="/api/add-fb-content" method="POST" enctype="multipart/form-data" style="display:grid; gap:8px; max-width:500px;">
                        <input type="text" name="title" placeholder="Post Title / Description" style="padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;" required>
                        
                        <input type="text" name="productLink" placeholder="Product Link (e.g. /product/ID or /)" style="padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;">

                        <select name="mediaType" style="padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;" required>
                            <option value="image">Image</option>
                            <option value="reels">Reels Video</option>
                        </select>
                        <input type="file" name="mediaFile" accept="image/*,video/*" style="font-size:12px;" required>
                        <button type="submit" class="btn" style="padding:8px;">Publish FB Content</button>
                    </form>
                </div>

                <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px; overflow-x:auto;">
                    <h4 style="margin-top:0;">📋 Manage Products & Sold Tracking</h4>
                    <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse; font-size:13px;">
                        <tr><th>Img</th><th>Name</th><th>Price</th><th>Stock</th><th>Sold</th><th>Action</th></tr>
                        ${productsHTML}
                    </table>
                </div>

                <!-- ORDER ICON TABS SECTION (WITH TRASH BOX) -->
                <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px;">
                    <h4 style="margin-top:0;">🛍️ Customer Orders Management</h4>
                    
                    <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
                        <a href="/admin-dashboard?tab=pending" class="btn" style="background:${activeTab === 'pending' ? '#f85606' : '#ccc'}; text-decoration:none; padding:8px 14px; font-size:13px;">
                            ⏳ Pending Orders (${pendingCount})
                        </a>
                        <a href="/admin-dashboard?tab=confirmed" class="btn" style="background:${activeTab === 'confirmed' ? '#007bff' : '#ccc'}; text-decoration:none; padding:8px 14px; font-size:13px;">
                            📦 Confirmed Orders (${confirmedCount})
                        </a>
                        <a href="/admin-dashboard?tab=completed" class="btn" style="background:${activeTab === 'completed' ? '#28a745' : '#ccc'}; text-decoration:none; padding:8px 14px; font-size:13px;">
                            ✅ Completed Orders (${completedCount})
                        </a>
                        <a href="/admin-dashboard?tab=trash" class="btn" style="background:${activeTab === 'trash' ? '#6c757d' : '#ccc'}; text-decoration:none; padding:8px 14px; font-size:13px;">
                            🗑️ Trash Box (${trashCount})
                        </a>
                    </div>

                    <div style="overflow-x:auto;">
                        <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse; font-size:13px;">
                            <tr><th>Order ID</th><th>Customer</th><th>Details & Payment</th><th>Status & Actions</th></tr>
                            ${ordersHTML.length ? ordersHTML : '<tr><td colspan="4" style="text-align:center; padding:20px; color:#777;">No orders found in this section.</td></tr>'}
                        </table>
                    </div>
                </div>

                <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px; overflow-x:auto;">
                    <h4 style="margin-top:0;">🚫 User Blocklist</h4>
                    <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse; font-size:13px;">
                        <tr><th>User Email</th><th>COD Status</th><th>Action</th></tr>
                        ${usersHTML.length ? usersHTML : '<tr><td colspan="3" style="text-align:center;">No users registered yet.</td></tr>'}
                    </table>
                </div>

                <div style="background:white; padding:15px; border-radius:6px; margin-bottom:15px;">
                    <h4 style="margin-top:0;">💬 Customer Chatbox Inbox Queries</h4>
                    ${chatsHTML.length ? chatsHTML : '<p style="color:#777; font-size:13px;">No questions asked yet.</p>'}
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/add-product', upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'gallery', maxCount: 5 }]), async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    const { name, category, price, stock, description } = req.body;
    const mainImage = req.files['mainImage'] ? req.files['mainImage'][0].filename : '';
    const gallery = req.files['gallery'] ? req.files['gallery'].map(file => file.filename) : [];

    await new Product({
        name,
        category,
        price: Number(price),
        stock: Number(stock),
        description,
        mainImage,
        gallery
    }).save();

    res.redirect('/admin-dashboard');
});

app.get('/api/delete-product/:id', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/admin-dashboard');
});

app.get('/api/move-to-trash/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let order = await Order.findById(req.params.id);
        if (order) {
            order.previousStatus = order.status; 
            order.status = 'Trash';
            await order.save();
        }
        res.redirect('/admin-dashboard?tab=trash');
    } catch (err) {
        next(err);
    }
});

app.get('/api/restore-order/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let order = await Order.findById(req.params.id);
        if (order) {
            let targetTab = (order.previousStatus === 'Confirmed') ? 'confirmed' : (order.previousStatus === 'Delivered' ? 'completed' : 'pending');
            order.status = order.previousStatus || 'Pending';
            await order.save();
            return res.redirect(`/admin-dashboard?tab=${targetTab}`);
        }
        res.redirect('/admin-dashboard');
    } catch (err) {
        next(err);
    }
});

app.get('/api/permanent-delete-order/:id', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        await Order.findByIdAndDelete(req.params.id);
        res.redirect('/admin-dashboard?tab=trash');
    } catch (err) {
        next(err);
    }
});

app.get('/api/change-order-status/:id/:status', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        const { id, status } = req.params;
        
        let order = await Order.findByIdAndUpdate(id, { status, previousStatus: status });
        
        let redirectTab = 'pending';
        if (status === 'Confirmed') redirectTab = 'confirmed';
        if (status === 'Delivered') redirectTab = 'completed';

        res.redirect(`/admin-dashboard?tab=${redirectTab}`);
    } catch (err) {
        next(err);
    }
});

app.get('/api/toggle-block/:id', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    let user = await User.findById(req.params.id);
    if (user) {
        user.isBlocked = !user.isBlocked;
        await user.save();
    }
    res.redirect('/admin-dashboard');
});

app.post('/api/add-fb-content', upload.single('mediaFile'), async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let { title, mediaType, productLink } = req.body;
        let mediaUrl = req.file ? req.file.filename : '';
        await new FbContent({ 
            title, 
            mediaUrl, 
            mediaType, 
            productLink: productLink ? productLink.trim() : '/' 
        }).save();
        res.redirect('/admin-dashboard');
    } catch (err) {
        next(err);
    }
});

app.post('/api/reply-chat', async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
        let { chatId, reply } = req.body;
        await Chat.findByIdAndUpdate(chatId, { reply });
        res.redirect('/admin-dashboard');
    } catch (err) {
        next(err);
    }
});

// ================= Server Initialization =================

app.listen(PORT, () => {
    console.log(`Online Shop server is running on http://localhost:${PORT}`);
});
