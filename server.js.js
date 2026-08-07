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

// Multer Storage Configuration for Images & Videos
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
    isBlocked: { type: Boolean, default: false },
    fakeOrdersCount: { type: Number, default: 0 }
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
    status: { type: String, default: 'Pending' },
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

// ================= Global Styles & Daraj-Style Layout =================
const globalHeaderHTML = `
    <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; overflow-x: hidden; }
        header { background: #f85606; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 5px rgba(0,0,0,0.1); width: 100%; }
        .logo { font-size: 22px; font-weight: bold; text-decoration: none; color: white; white-space: nowrap; }
        .search-bar { display: flex; flex: 1; max-width: 550px; margin: 0 15px; }
        .search-bar input { width: 100%; padding: 10px; border: none; border-radius: 4px 0 0 4px; outline: none; font-size: 14px; }
        .search-bar button { background: #ffe11b; border: none; padding: 0 18px; border-radius: 0 4px 4px 0; cursor: pointer; font-weight: bold; }
        .nav-icons { display: flex; gap: 15px; align-items: center; }
        .nav-icons a { color: white; text-decoration: none; font-size: 12px; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .categories-nav { background: white; padding: 10px 20px; display: flex; gap: 12px; overflow-x: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.05); white-space: nowrap; -webkit-overflow-scrolling: touch; position: sticky; top: 60px; z-index: 999; }
        .categories-nav::-webkit-scrollbar { display: none; }
        .categories-nav a { text-decoration: none; color: #333; font-size: 13px; padding: 6px 14px; background: #f0f0f0; border-radius: 4px; }
        .categories-nav a:hover { background: #f85606; color: white; }
        
        .container { max-width: 1200px; margin: 20px auto; padding: 0 15px; width: 100%; }
        
        /* পিক্সেল অনুযায়ী রেসপন্সিভ গ্রিড এবং আকর্ষণীয় সাইজ */
        .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 15px; }
        .product-card { background: white; padding: 12px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; justify-content: space-between; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; }
        .product-card:hover { transform: translateY(-3px); box-shadow: 0 5px 12px rgba(0,0,0,0.15); }
        
        .product-card img { width: 100%; height: 190px; object-fit: cover; border-radius: 4px; }
        .price { color: #f85606; font-size: 18px; font-weight: bold; margin: 8px 0; }
        
        .btn { background: #f85606; color: white; border: none; padding: 9px 14px; border-radius: 4px; cursor: pointer; text-decoration: none; text-align: center; display: inline-block; font-size: 14px; }
        .btn-buy { background: #ffe11b; color: #333; font-weight: bold; }

        @media (max-width: 480px) {
            .product-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .product-card img { height: 150px; }
            .logo { font-size: 18px; }
            .search-bar { margin: 0 8px; }
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
        <div class="nav-icons">
            <a href="/wishlist">❤️<br>Wishlist</a>
            <a href="/cart">🛒<br>Cart</a>
            <a href="/my-orders">📦<br>Orders</a>
            ${user ? `<a href="/dashboard">👤<br>Account</a>` : `<a href="/login">🔑<br>Login</a>`}
            ${user && user.role === 'admin' ? `<a href="/admin-dashboard" style="background:#ffe11b; color:#333; padding:5px 8px; border-radius:4px; font-weight:bold; text-align:center;">⚙️<br>Admin</a>` : ''}
        </div>
    </header>
    <div class="categories-nav">
        <a href="/category/Fashion">👗 Fashion</a>
        <a href="/category/Electronics">💻 Electronics</a>
        <a href="/category/Groceries">🍎 Groceries</a>
        <a href="/category/Home">🏠 Home & Living</a>
        <a href="/category/Beauty">💄 Beauty & Health</a>
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
            <h4 style="margin:8px 0 4px 0; font-size:14px; height:38px; overflow:hidden;">${p.name}</h4>
            <div class="price">৳${p.price}</div>
            <div style="font-size:12px; color:#888;">Stock: ${p.stock}</div>
        </a>
    `).join('');

    let fbHTML = fbContents.map(fb => `
        <div style="background:white; padding:15px; margin-bottom:15px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <p style="font-weight:bold; margin-bottom:8px;">${fb.title}</p>
            ${fb.mediaType === 'image' ? `<img src="/uploads/${fb.mediaUrl}" style="max-width:100%; height:auto; border-radius:4px;">` : `<video src="/uploads/${fb.mediaUrl}" controls style="max-width:100%; border-radius:4px;"></video>`}
            <br><a href="/" class="btn btn-buy" style="margin-top:10px; display:inline-block;">⚡ Order Now</a>
        </div>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Online Shop - Home</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container">
                <h2>Flash Sale & Recommended Products</h2>
                <div class="product-grid">${productsHTML}</div>
                
                <h2 style="margin-top:35px;">Facebook Posts & Reels Highlights</h2>
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
            <h4 style="margin:8px 0 4px 0; font-size:14px; height:38px; overflow:hidden;">${p.name}</h4>
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
                <h2>Category: ${catName}</h2>
                <div class="product-grid">${productsHTML.length ? productsHTML : '<p>No products found.</p>'}</div>
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
            <h4 style="margin:8px 0 4px 0; font-size:14px; height:38px; overflow:hidden;">${p.name}</h4>
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
                <h2>Search Results for "${keyword}"</h2>
                <div class="product-grid">${productsHTML.length ? productsHTML : '<p>No matching products found.</p>'}</div>
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

    let galleryHTML = product.gallery.map(img => `<img src="/uploads/${img}" style="width:70px; height:70px; object-fit:cover; border-radius:4px; border:1px solid #ccc;">`).join('');
    let chatsHTML = chats.map(c => `<div style="border-bottom:1px solid #eee; padding:8px 0;"><p><b>${c.userEmail}:</b> ${c.message}</p><p style="color:green; font-size:13px; margin-left:15px;"><b>Admin Reply:</b> ${c.reply || 'Pending reply'}</p></div>`).join('');
    
    let relatedHTML = relatedProducts.map(p => `
        <a href="/product/${p._id}" class="product-card">
            <img src="/uploads/${p.mainImage}" alt="${p.name}">
            <h4 style="margin:8px 0 4px 0; font-size:13px; height:32px; overflow:hidden;">${p.name}</h4>
            <div class="price" style="font-size:15px;">৳${p.price}</div>
        </a>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>${product.name}</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container" style="background:white; padding:25px; border-radius:6px;">
                <div style="display:flex; gap:30px; flex-wrap:wrap;">
                    <div>
                        <img src="/uploads/${product.mainImage}" style="width:320px; height:320px; object-fit:cover; border-radius:6px;"><br>
                        <div style="display:flex; gap:10px; margin-top:10px;">${galleryHTML}</div>
                    </div>
                    <div style="flex:1; min-width: 280px;">
                        <h2>${product.name}</h2>
                        <p><b>Category:</b> ${product.category}</p>
                        <div class="price">৳${product.price}</div>
                        <p><b>Stock Available:</b> ${product.stock}</p>
                        <p>${product.description}</p>
                        <br>
                        <a href="/buy-now/${product._id}" class="btn btn-buy" style="padding:12px 35px; font-size:16px;">Buy Now</a>
                    </div>
                </div>
                
                <hr style="margin:40px 0;">
                <h3>You May Also Like</h3>
                <div class="product-grid" style="margin-top:15px;">${relatedHTML.length ? relatedHTML : '<p>No related products.</p>'}</div>

                <hr style="margin:40px 0;">
                <h3>Ask Question About This Product</h3>
                <form action="/api/chat" method="POST">
                    <input type="hidden" name="productId" value="${product._id}">
                    <input type="hidden" name="productName" value="${product.name}">
                    <textarea name="message" placeholder="Ask your question here..." style="width:100%; height:80px; padding:8px; border:1px solid #ccc; border-radius:4px;" required></textarea><br>
                    <button type="submit" class="btn" style="margin-top:8px;">Send Question</button>
                </form>
                <div style="margin-top:20px;">
                    <h4>Customer Q&A:</h4>
                    ${chatsHTML.length ? chatsHTML : '<p>No questions yet.</p>'}
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

// ================= My Orders Page =================
app.get('/my-orders', async (req, res) => {
    if (!req.user) return res.redirect('/login?redirect=/my-orders');
    let orders = await Order.find({ userEmail: req.user.email }).sort({ _id: -1 });
    
    let ordersHTML = orders.map(o => `
        <div style="background:#fff; padding:15px; margin-bottom:15px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <p><b>Order ID:</b> ${o._id}</p>
            <p><b>Total Amount:</b> ৳${o.totalAmount} (${o.paymentMethod})</p>
            <p><b>Status:</b> <span style="color:${o.status === 'Delivered' ? 'green' : (o.status === 'Returned' ? 'red' : '#f85606')}; font-weight:bold;">${o.status}</span></p>
            <p><b>Date:</b> ${new Date(o.createdAt).toLocaleString()}</p>
        </div>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>My Orders</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container" style="max-width:800px;">
                <h2>📦 My Orders List</h2>
                ${ordersHTML.length ? ordersHTML : '<p>You have not placed any orders yet.</p>'}
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
        `<p style="color:red; font-size:13px;"><b>Note:</b> Cash on Delivery is disabled for your account. Please pay via bKash/Nagad.</p>` :
        `<option value="COD">Cash on Delivery</option>`;

    let advanceWarning = req.user.isBlocked ? 
        `<div style="background:#fff3cd; padding:10px; border-radius:4px; margin-bottom:10px; color:#856404; font-size:13px;">⚠️ <b>Notice:</b> Please pay via bKash/Nagad to process your order.</div>` : '';

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Checkout</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container" style="max-width:600px; background:white; padding:25px; border-radius:6px;">
                <h2>Checkout Order</h2>
                ${advanceWarning}
                <p><b>Product:</b> ${product.name}</p>
                <p><b>Price:</b> ৳${product.price}</p>
                <form action="/api/place-order" method="POST">
                    <input type="hidden" name="productId" value="${product._id}">
                    <input type="hidden" name="productName" value="${product.name}">
                    <input type="hidden" name="price" value="${product.price}">
                    
                    <label>Full Name:</label><br>
                    <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>

                    <label>Phone Number:</label><br>
                    <input type="text" name="phone" value="${req.user.phone || ''}" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>

                    <label>Delivery Address:</label><br>
                    <textarea name="address" style="width:100%; height:60px; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required>${req.user.address || ''}</textarea><br>

                    <label>Payment Method:</label><br>
                    <select name="paymentMethod" id="paymentMethod" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" onchange="togglePaymentFields()" required>
                        ${codOptionHTML}
                        <option value="bKash">bKash</option>
                        <option value="Nagad">Nagad</option>
                    </select><br>

                    <div id="onlinePaymentDiv" style="display:${req.user.isBlocked ? 'block' : 'none'}; background:#f9f9f9; padding:10px; border-radius:4px; margin-bottom:10px;">
                        <p style="font-size:13px; color:#555;">Send money to bKash/Nagad: <b>01700000000</b></p>
                        <label>Sender Phone Number:</label><br>
                        <input type="text" name="senderNumber" placeholder="e.g. 01XXXXXXXXX" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;"><br>
                        <label>Paid Amount (Tk):</label><br>
                        <input type="number" name="paidAmount" placeholder="Amount sent" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;"><br>
                        <label>Transaction ID (TrxID):</label><br>
                        <input type="text" name="trxId" placeholder="Optional TrxID" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;">
                    </div>

                    <button type="submit" class="btn btn-buy" style="width:100%; padding:12px; font-size:16px;">Confirm Order</button>
                </form>
            </div>
            <script>
                function togglePaymentFields() {
                    let method = document.getElementById('paymentMethod').value;
                    let div = document.getElementById('onlinePaymentDiv');
                    div.style.display = (method === 'bKash' || method === 'Nagad') ? 'block' : 'none';
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

    await User.findByIdAndUpdate(req.user._id, { name, phone, address });
    await Product.findByIdAndUpdate(productId, { $inc: { stock: -1, soldCount: 1 } });

    await new Order({
        userEmail: req.user.email,
        items: [{ productId, productName, price }],
        totalAmount: Number(price),
        paymentMethod,
        senderNumber: senderNumber || '',
        paidAmount: Number(paidAmount) || 0,
        trxId: trxId || ''
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
            <div class="container" style="max-width:350px; background:white; padding:25px; border-radius:6px; margin-top:40px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h2>Login</h2>
                <form action="/api/login" method="POST">
                    <input type="hidden" name="redirect" value="${redirectUrl}">
                    <label>Email:</label><br>
                    <input type="email" name="email" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                    <label>Password:</label><br>
                    <input type="password" name="password" style="width:100%; padding:8px; margin:5px 0 15px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                    <button type="submit" class="btn" style="width:100%;">Login</button>
                </form>
                <p style="font-size:13px; text-align:center; margin-top:15px;">New user? <a href="/register">Register here</a></p>
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
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Register</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container" style="max-width:350px; background:white; padding:25px; border-radius:6px; margin-top:40px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h2>Register Account</h2>
                <form action="/api/register" method="POST">
                    <label>Email:</label><br>
                    <input type="email" name="email" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                    <label>Password:</label><br>
                    <input type="password" name="password" style="width:100%; padding:8px; margin:5px 0 15px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                    <button type="submit" class="btn btn-buy" style="width:100%;">Register</button>
                </form>
                <p style="font-size:13px; text-align:center; margin-top:15px;">Already have an account? <a href="/login">Login here</a></p>
            </div>
        </body>
        </html>
    `);
});

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    let existing = await User.findOne({ email });
    if (existing) return res.send(`<script>alert('Email already exists!'); window.location.href='/register';</script>`);

    let role = (email === 'admin@onlineshop.com') ? 'admin' : 'user';
    let hashedPassword = await bcrypt.hash(password, 10);

    let newUser = new User({ email, password: hashedPassword, role });
    await newUser.save();
    res.cookie('userSession', JSON.stringify({ email: newUser.email, role: newUser.role }));
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    res.clearCookie('userSession');
    res.redirect('/');
});

app.get('/dashboard', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    let orders = await Order.find({ userEmail: req.user.email });
    let ordersHTML = orders.map(o => `<tr><td>${o._id}</td><td>৳${o.totalAmount}</td><td>${o.paymentMethod}</td><td>${o.status}</td></tr>`).join('');

    let blockStatusNotice = req.user.isBlocked ? `<p style="color:red; font-weight:bold;">Account Status: Cash on Delivery Restricted</p>` : `<p style="color:green; font-weight:bold;">Account Status: Good Standing</p>`;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>User Dashboard</title>${globalHeaderHTML}</head>
        <body>
            ${getNavbarHTML(req.user)}
            <div class="container" style="background:white; padding:25px; border-radius:6px;">
                <h2>My Account Dashboard</h2>
                <p><b>Email:</b> ${req.user.email}</p>
                ${blockStatusNotice}
                
                <form action="/api/update-profile" method="POST" style="max-width:400px; margin-top:20px;">
                    <h3>Update Profile Info</h3>
                    <label>Name:</label><br>
                    <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                    <label>Phone:</label><br>
                    <input type="text" name="phone" value="${req.user.phone || ''}" style="width:100%; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br>
                    <label>Address:</label><br>
                    <textarea name="address" style="width:100%; height:60px; padding:8px; margin:5px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required>${req.user.address || ''}</textarea><br>
                    <button type="submit" class="btn">Save Profile</button>
                </form>
                <hr style="margin:30px 0;">
                <h3>My Orders History</h3>
                <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin-top:10px;">
                    <tr><th>Order ID</th><th>Total</th><th>Payment</th><th>Status</th></tr>
                    ${ordersHTML.length ? ordersHTML : '<tr><td colspan="4">No orders placed yet.</td></tr>'}
                </table>
                <br><a href="/logout" class="btn" style="background:#d9534f;">Logout</a>
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
    res.send(`<!DOCTYPE html><html><head><title>Wishlist</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container"><h2>❤️ My Wishlist</h2><p>Your wishlist items will appear here.</p></div></body></html>`);
});

app.get('/cart', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Cart</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container"><h2>🛒 Shopping Cart</h2><p>Your cart is empty.</p></div></body></html>`);
});

// ================= Admin Dashboard & Management =================
app.get('/admin-dashboard', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');

    let products = await Product.find().sort({ _id: -1 });
    let orders = await Order.find().sort({ _id: -1 });
    let chats = await Chat.find().sort({ _id: -1 });
    let users = await User.find({ role: 'user' });

    let lowStockCount = products.filter(p => p.stock < 5).length;
    let totalSoldItems = products.reduce((acc, p) => acc + (p.soldCount || 0), 0);

    let productsHTML = products.map(p => `
        <tr style="${p.stock < 5 ? 'background:#fff3cd;' : ''}">
            <td><img src="/uploads/${p.mainImage}" width="40" height="40" style="object-fit:cover;"></td>
            <td>${p.name} ${p.stock < 5 ? '<span style="color:red; font-size:11px;">(Low Stock!)</span>' : ''}</td>
            <td>৳${p.price}</td>
            <td>${p.stock}</td>
            <td><b>${p.soldCount || 0}</b></td>
            <td><a href="/api/delete-product/${p._id}" class="btn" style="background:#d9534f; padding:4px 8px; font-size:12px;">Delete</a></td>
        </tr>
    `).join('');

    let ordersHTML = orders.map(o => `
        <tr>
            <td>${o._id}</td>
            <td>${o.userEmail}</td>
            <td>৳${o.totalAmount} (${o.paymentMethod}) <br><small>Sender: ${o.senderNumber || 'N/A'}, TrxID: ${o.trxId || 'N/A'}</small></td>
            <td>
                <form action="/api/update-order-status" method="POST" style="display:flex; gap:5px;">
                    <input type="hidden" name="orderId" value="${o._id}">
                    <select name="status" style="padding:3px;">
                        <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="Returned" ${o.status === 'Returned' ? 'selected' : ''}>Returned</option>
                    </select>
                    <button type="submit" class="btn" style="padding:3px 6px; font-size:12px;">Update</button>
                </form>
            </td>
        </tr>
    `).join('');

    let usersHTML = users.map(u => `
        <tr>
            <td>${u.email}</td>
            <td>${u.isBlocked ? '<span style="color:red; font-weight:bold;">Blocked (COD Disabled)</span>' : '<span style="color:green;">Active</span>'}</td>
            <td>
                <a href="/api/toggle-block/${u._id}" class="btn" style="background:${u.isBlocked ? '#28a745' : '#d9534f'}; padding:4px 8px; font-size:12px;">
                    ${u.isBlocked ? 'Unblock COD' : 'Block COD'}
                </a>
            </td>
        </tr>
    `).join('');

    let chatsHTML = chats.map(c => `
        <div style="background:#f9f9f9; padding:10px; margin-bottom:10px; border-radius:4px;">
            <p><b>Product:</b> ${c.productName} | <b>User:</b> ${c.userEmail}</p>
            <p><b>Question:</b> ${c.message}</p>
            <form action="/api/reply-chat" method="POST">
                <input type="hidden" name="chatId" value="${c._id}">
                <input type="text" name="reply" value="${c.reply || ''}" placeholder="Write reply..." style="padding:6px; width:70%; border:1px solid #ccc; border-radius:4px;" required>
                <button type="submit" class="btn" style="padding:6px 12px;">Reply</button>
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
                <h2>⚙️ Admin Control Dashboard</h2>
                
                <div style="display:flex; gap:15px; margin:20px 0; flex-wrap:wrap;">
                    <div style="background:white; padding:15px; border-radius:6px; flex:1; min-width:200px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <h4>Total Sold Items</h4>
                        <p style="font-size:22px; color:#f85606; font-weight:bold;">${totalSoldItems}</p>
                    </div>
                    <div style="background:white; padding:15px; border-radius:6px; flex:1; min-width:200px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <h4>Low Stock Alerts</h4>
                        <p style="font-size:22px; color:red; font-weight:bold;">${lowStockCount}</p>
                    </div>
                </div>

                <div style="background:white; padding:20px; border-radius:6px; margin-top:20px;">
                    <h3>📦 Add New Product</h3>
                    <form action="/api/add-product" method="POST" enctype="multipart/form-data" style="display:grid; gap:10px; max-width:500px;">
                        <input type="text" name="name" placeholder="Product Name" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                        <select name="category" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                            <option value="Fashion">Fashion</option>
                            <option value="Electronics">Electronics</option>
                            <option value="Groceries">Groceries</option>
                            <option value="Home">Home & Living</option>
                            <option value="Beauty">Beauty & Health</option>
                        </select>
                        <input type="number" name="price" placeholder="Price (Tk)" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                        <input type="number" name="stock" placeholder="Stock Quantity" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                        <textarea name="description" placeholder="Product Description" style="padding:8px; border:1px solid #ccc; border-radius:4px;"></textarea>
                        
                        <label>Main Image:</label>
                        <input type="file" name="mainImage" accept="image/*" required>
                        
                        <label>Gallery Images (Up to 5 photos):</label>
                        <input type="file" name="gallery" accept="image/*" multiple>
                        
                        <button type="submit" class="btn">Upload Product</button>
                    </form>
                </div>

                <div style="background:white; padding:20px; border-radius:6px; margin-top:20px;">
                    <h3>🎬 Add Facebook Post / Reels Video</h3>
                    <form action="/api/add-fb-content" method="POST" enctype="multipart/form-data" style="display:grid; gap:10px; max-width:500px;">
                        <input type="text" name="title" placeholder="Post Title / Description" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                        <select name="mediaType" style="padding:8px; border:1px solid #ccc; border-radius:4px;" required>
                            <option value="image">Image</option>
                            <option value="reels">Reels Video</option>
                        </select>
                        <input type="file" name="mediaFile" accept="image/*,video/*" required>
                        <button type="submit" class="btn">Publish FB Content</button>
                    </form>
                </div>

                <div style="background:white; padding:20px; border-radius:6px; margin-top:20px; overflow-x:auto;">
                    <h3>📋 Manage Products & Sold Tracking</h3>
                    <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin-top:10px;">
                        <tr><th>Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Sold</th><th>Action</th></tr>
                        ${productsHTML}
                    </table>
                </div>

                <div style="background:white; padding:20px; border-radius:6px; margin-top:20px; overflow-x:auto;">
                    <h3>🛍️ Customer Orders Management</h3>
                    <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin-top:10px;">
                        <tr><th>Order ID</th><th>Customer</th><th>Details & Payment</th><th>Status Update</th></tr>
                        ${ordersHTML.length ? ordersHTML : '<tr><td colspan="4">No orders received yet.</td></tr>'}
                    </table>
                </div>

                <div style="background:white; padding:20px; border-radius:6px; margin-top:20px; overflow-x:auto;">
                    <h3>🚫 User Blocklist</h3>
                    <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin-top:10px;">
                        <tr><th>User Email</th><th>COD Status</th><th>Action</th></tr>
                        ${usersHTML.length ? usersHTML : '<tr><td colspan="3">No users registered yet.</td></tr>'}
                    </table>
                </div>

                <div style="background:white; padding:20px; border-radius:6px; margin-top:20px;">
                    <h3>💬 Customer Chatbox Inbox Queries</h3>
                    ${chatsHTML.length ? chatsHTML : '<p>No questions asked yet.</p>'}
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

app.post('/api/update-order-status', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    const { orderId, status } = req.body;
    let order = await Order.findByIdAndUpdate(orderId, { status });
    if (status === 'Returned' && order) {
        await User.findOneAndUpdate({ email: order.userEmail }, { isBlocked: true });
    }
    res.redirect('/admin-dashboard');
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

app.post('/api/add-fb-content', upload.single('mediaFile'), async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    const { title, mediaType } = req.body;
    const mediaUrl = req.file ? req.file.filename : '';
    await new FbContent({ title, mediaUrl, mediaType }).save();
    res.redirect('/admin-dashboard');
});

app.post('/api/reply-chat', async (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    const { chatId, reply } = req.body;
    await Chat.findByIdAndUpdate(chatId, { reply });
    res.redirect('/admin-dashboard');
});

// ================= Server Initialization =================
app.listen(PORT, () => {
    console.log(`Online Shop server is running on http://localhost:${PORT}`);
});
