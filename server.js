require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET
});
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
// ================= Database Connection (MongoDB Atlas) =================
const MONGO_URI = process.env.MONGO_URI;
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
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ================= Durable Image Storage Helpers =================
function mediaUrl(value) {
let v = String(value || '').trim();
if (!v) return '';
if (/^https?:\/\//i.test(v) || v.startsWith('//') || v.startsWith('data:')) return v;
v = v.replace(/\\/g, '/');
v = v.replace(/^\/+/, '');
v = v.replace(/^public\/uploads\//i, '');
v = v.replace(/^uploads\//i, '');
return '/uploads/' + v;
}
function mediaClientUrl(value) {
return mediaUrl(value);
}

function uploadBufferToCloudinary(file, folder = 'oneline-shop') {
return new Promise((resolve, reject) => {
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return resolve('');
const stream = cloudinary.uploader.upload_stream({folder, resource_type:'auto', use_filename:true, unique_filename:true}, (error, result) => {
if (error) return reject(error);
resolve(result && result.secure_url ? result.secure_url : '');
});
stream.end(file.buffer);
});
}


// ================= Facebook Page Publishing (Meta Graph API) =================
// Uses the current Graph API version configured here. A Page Access Token is required.
const FACEBOOK_GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || 'v25.0';
const SITE_URL_FALLBACK = process.env.SITE_URL || 'https://oneline-shop.onrender.com';

function normalizeWhatsAppContact(value) {
let raw = String(value || '').trim();
if (!raw) return '';
if (/^https?:\/\//i.test(raw)) return raw;
raw = raw.replace(/[^0-9+]/g, '');
if (raw.startsWith('+')) raw = raw.slice(1);
if (raw.startsWith('00')) raw = raw.slice(2);
if (raw.startsWith('0')) raw = '88' + raw;
return raw ? `https://wa.me/${raw}` : '';
}

function isValidWhatsAppContact(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  if (/^https?:\/\/(www\.)?wa\.me\/\d{8,15}$/i.test(v)) return true;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function getWhatsAppContactUrl(value) {
  const url = normalizeWhatsAppContact(value);
  return /^https:\/\/wa\.me\/\d{8,15}$/i.test(url) ? url : '';
}

function getWhatsAppContactUrl(value) {
  const url = normalizeWhatsAppContact(value);
  return /^https:\/\/wa\.me\/\d{8,15}$/i.test(url) ? url : '';
}

function getProductWhatsAppUrl(product) {
const contact = normalizeWhatsAppContact(product && product.whatsappContact);
if (!contact) return '';
const productUrl = `${SITE_URL_FALLBACK}/product/${product._id}`;
const message = `আসসালামু আলাইকুম, আমি এই পণ্যটি সম্পর্কে জানতে চাই: ${product.name}। Product link: ${productUrl}`;
const separator = contact.includes('?') ? '&' : '?';
return `${contact}${separator}text=${encodeURIComponent(message)}`;
}

function facebookGraphUrl(pathname) {
return `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}${pathname}`;
}

async function facebookApiJson(url, options = {}) {
const response = await fetch(url, options);
let data = {};
try { data = await response.json(); } catch (_) { data = {}; }
if (!response.ok || data.error) {
const msg = data && data.error && data.error.message ? data.error.message : `Facebook API HTTP ${response.status}`;
throw new Error(msg);
}
return data;
}

async function publishFacebookImage(pageId, accessToken, file, caption) {
const form = new FormData();
form.append('access_token', accessToken);
form.append('caption', caption || '');
form.append('source', new Blob([file.buffer], { type: file.mimetype || 'image/jpeg' }), file.originalname || 'image.jpg');
return facebookApiJson(facebookGraphUrl(`/${encodeURIComponent(pageId)}/photos`), { method: 'POST', body: form });
}

async function publishFacebookVideo(pageId, accessToken, file, description) {
const form = new FormData();
form.append('access_token', accessToken);
form.append('description', description || '');
form.append('source', new Blob([file.buffer], { type: file.mimetype || 'video/mp4' }), file.originalname || 'video.mp4');
return facebookApiJson(facebookGraphUrl(`/${encodeURIComponent(pageId)}/videos`), { method: 'POST', body: form });
}

async function publishFacebookReel(pageId, accessToken, file, title, description) {
const startUrl = facebookGraphUrl(`/${encodeURIComponent(pageId)}/video_reels?upload_phase=start&access_token=${encodeURIComponent(accessToken)}`);
const start = await facebookApiJson(startUrl, { method: 'POST' });
if (!start.video_id || !start.upload_url) throw new Error('Facebook did not return a Reel upload session.');

const uploadResponse = await fetch(start.upload_url, {
method: 'POST',
headers: {
'Authorization': `OAuth ${accessToken}`,
'offset': '0',
'file_size': String(file.buffer.length),
'Content-Type': 'application/octet-stream'
},
body: file.buffer
});
let uploadData = {};
try { uploadData = await uploadResponse.json(); } catch (_) { uploadData = {}; }
if (!uploadResponse.ok || uploadData.error || uploadData.success === false) {
const msg = uploadData && uploadData.error && uploadData.error.message ? uploadData.error.message : `Facebook Reel upload HTTP ${uploadResponse.status}`;
throw new Error(msg);
}

const finishParams = new URLSearchParams({
access_token: accessToken,
video_id: start.video_id,
upload_phase: 'finish',
video_state: 'PUBLISHED',
title: title || '',
description: description || ''
});
return facebookApiJson(facebookGraphUrl(`/${encodeURIComponent(pageId)}/video_reels?${finishParams.toString()}`), { method: 'POST' });
}
// ================= Mongoose Schemas & Models =================
const userSchema = new mongoose.Schema({
email: { type: String, required: true, unique: true },
password: { type: String, required: true },
role: { type: String, default: 'user' },
name: { type: String, default: '' },
phone: { type: String, default: '' },
address: { type: String, default: '' },
isBlocked: { type: Boolean, default: false },
subAdminStatus: { type: String, default: 'pending' },
activationPlan: { type: String, default: 'paid' },
activationExpiresAt: { type: Date, default: null },
unlimitedFree: { type: Boolean, default: false },
subAdminShopName: { type: String, default: '' },
subAdminBusinessInfo: { type: String, default: '' },
subAdminWhatsApp: { type: String, default: '' },
subAdminBusinessCategories: { type: [String], default: [] },
subAdminWarning: { type: String, default: '' },
approvedBy: { type: String, default: '' },
approvedAt: { type: Date, default: null },
wishlist: { type: [String], default: [] }
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
whatsappContact: { type: String, default: '' },
ownerId: { type: String, default: '' },
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
ownerId: { type: String, default: '' },
createdAt: { type: Date, default: Date.now }
});
const Coupon = mongoose.model('Coupon', couponSchema);
const orderSchema = new mongoose.Schema({
userEmail: String,
userName: { type: String, default: '' },
userPhone: { type: String, default: '' },
userAddress: { type: String, default: '' },
items: Array,
sellerIds: [String],
productPrice: Number,
deliveryCharge: Number,
discountPrice: { type: Number, default: 0 },
totalAmount: Number,
deliveryArea: String,
customerNote: { type: String, default: '' },
paymentMethod: String, // COD, bKash, Nagad
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
ownerId: { type: String, default: '' },
productImage: String,
userEmail: String,
message: String,
reply: { type: String, default: '' },
senderRole: { type: String, default: 'user' },
senderEmail: { type: String, default: '' },
recipientEmail: { type: String, default: '' },
isRead: { type: Boolean, default: false },
createdAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', chatSchema);
const fbContentSchema = new mongoose.Schema({
title: String,
mediaUrl: String,
mediaType: String,
productLink: { type: String, default: '/' },
facebookPostId: { type: String, default: '' },
facebookPublished: { type: Boolean, default: false },
ownerId: { type: String, default: '' },
createdAt: { type: Date, default: Date.now }
});
const FbContent = mongoose.model('FbContent', fbContentSchema);
const siteSettingSchema = new mongoose.Schema({
bkashNumber: { type: String, default: '01700000000' },
nagadNumber: { type: String, default: '01800000000' },
pageId: { type: String, default: '' },
accessToken: { type: String, default: '' },
ownerId: { type: String, default: '' }
});
const SiteSetting = mongoose.model('SiteSetting', siteSettingSchema);
const subAdminSupportSchema = new mongoose.Schema({
subAdminId: { type: String, required: true },
subAdminEmail: { type: String, required: true },
message: { type: String, required: true },
reply: { type: String, default: '' },
requestedWhatsApp: { type: String, default: '' },
whatsappUpdateStatus: { type: String, default: 'none' },
requestType: { type: String, default: 'general' },
resetStatus: { type: String, default: 'none' },
resetAt: { type: Date, default: null },
createdAt: { type: Date, default: Date.now },
updatedAt: { type: Date, default: Date.now }
});
const SubAdminSupport = mongoose.model('SubAdminSupport', subAdminSupportSchema);

const productRequestSchema = new mongoose.Schema({
  userId: { type: String, default: '', index: true },
  userEmail: { type: String, required: true },
  userName: { type: String, default: '' },
  userPhone: { type: String, default: '' },
  userAddress: { type: String, default: '' },
  productName: { type: String, required: true },
  details: { type: String, default: '' },
  requestImage: { type: String, default: '' },
  status: { type: String, enum: ['new','broadcasted','accepted','closed'], default: 'new' },
  targetSubAdminIds: { type: [String], default: [] },
  acceptedBy: { type: String, default: '' },
  acceptedByEmail: { type: String, default: '' },
  acceptedAt: { type: Date, default: null },
  adminNote: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const ProductRequest = mongoose.model('ProductRequest', productRequestSchema);
const productRequestChatSchema = new mongoose.Schema({
  userId: { type: String, default: '', index: true },
  requestId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true, index: true },
  subAdminEmail: { type: String, required: true, index: true },
  senderEmail: { type: String, required: true },
  senderRole: { type: String, default: 'user' },
  recipientEmail: { type: String, required: true, index: true },
  message: { type: String, required: true },
  productName: { type: String, default: '' },
  requestImage: { type: String, default: '' },
  userName: { type: String, default: '' },
  userPhone: { type: String, default: '' },
  userAddress: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const ProductRequestChat = mongoose.model('ProductRequestChat', productRequestChatSchema);

const activityLogSchema = new mongoose.Schema({ userEmail:String, actorRole:String, action:String, targetType:String, targetId:String, createdAt:{type:Date,default:Date.now} });
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
async function logActivity(user, action, targetType='', targetId=''){ try{ if(user) await new ActivityLog({userEmail:normalizeEmail(user.email),actorRole:user.role,action:safeText(action,300),targetType,targetId:String(targetId||'')}).save(); }catch(e){ console.error('Activity log error:',e.message); } }

const notificationSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true },
  type: { type: String, default: 'general' },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  link: { type: String, default: '/dashboard' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);

async function createNotification(userEmail, title, message, link='/dashboard', type='general') {
  const email = normalizeEmail(userEmail);
  if (!email) return null;
  try {
    return await new Notification({ userEmail: email, title: safeText(title,200), message: safeText(message,1000), link: String(link || '/dashboard'), type: String(type || 'general') }).save();
  } catch (e) { console.error('Notification create error:', e.message); return null; }
}

// ================= Main Admin / Sub Admin Access Helpers =================
function isMainAdmin(user) {
  if (!user) return false;
  const email = normalizeEmail(user.email);
  const configured = normalizeEmail(process.env.MAIN_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '');
  // Main Admin is identified only by the protected admin role or an explicitly configured email.
  // This keeps normal users/Sub Admins from gaining admin privileges accidentally.
  return user.role === 'admin' || email === 'admin@onlineshop.com' || (!!configured && email === configured);
}
function requireMainAdmin(req, res) {
  if (!req.user || !isMainAdmin(req.user)) {
    res.status(403).send('<div style=\"font-family:Arial;padding:30px;max-width:700px;margin:auto;\"><h2>Unauthorized</h2><p>শুধু Main Admin এই কাজটি করতে পারবেন। আপনার Main Admin email যদি আলাদা হয়, Render/Local .env-এ MAIN_ADMIN_EMAIL সেট করুন।</p><a href=\"/admin-dashboard\">Admin Dashboard-এ ফিরে যান</a></div>');
    return false;
  }
  return true;
}
function isSubAdmin(user) { return !!user && user.role === 'subadmin'; }
function isStaff(user) { return isMainAdmin(user) || isSubAdmin(user); }
// Users with a Sub Admin application that is not yet active must continue using the shop as normal customers.
function isCustomerLike(user) { return !!user && (user.role === 'user' || (user.role === 'subadmin' && !subAdminIsActive(user))); }
function subAdminIsActive(user) {
if (!isSubAdmin(user)) return true;
if (user.subAdminStatus !== 'active') return false;
if (user.unlimitedFree) return true;
if (user.activationExpiresAt && new Date(user.activationExpiresAt).getTime() < Date.now()) return false;
return true;
}
function canManageStaffData(user) { return isMainAdmin(user) || subAdminIsActive(user); }
function dbReady() { return mongoose.connection.readyState === 1; }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function safeText(value, max=5000) { return String(value || '').trim().slice(0, max); }
function ownerFilter(user, field='ownerId') { return isMainAdmin(user) ? {} : { [field]: String(user._id) }; }
function orderBelongsToUser(order, user) {
if (isMainAdmin(user)) return true;
const items = Array.isArray(order && order.items) ? order.items : [];
return items.length > 0 && items.every(item => String(item.ownerId || '') === String(user._id));
}

// Middleware to load logged-in user
app.use(async (req, res, next) => {
try {
if (req.cookies && req.cookies.userSession) {
let sessionData = JSON.parse(req.cookies.userSession);
let user = await User.findOne({ email: sessionData.email });
if (user) {
if (user.role === 'subadmin' && user.subAdminStatus === 'active' && !user.unlimitedFree && user.activationExpiresAt && new Date(user.activationExpiresAt).getTime() < Date.now()) {
user.subAdminStatus = 'expired';
await user.save();
}
req.user = user;
}
}
} catch (e) {
req.user = null;
}
next();
});
// Categories list for auto-selection in admin & frontend
const ALL_CATEGORIES = [
'Fashion', 'Supershop', 'Pharmacy', 'Food', 'Sports', 'Books', 'Stationery', 'HomeDecor',
'BeautyCare', 'Electric'
];
// ================= Global Header & Image Modal Setup =================
const globalHeaderHTML = ` <link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#f85606"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"> <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"> <style> * { box-sizing: border-box; } body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0 0 65px 0; background: #f4f4f4; color: #222; -webkit-text-size-adjust: 100%; } header { background: #f85606; color: white; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 5px rgba(0,0,0,0.1); width: 100%; } .logo { font-size: 18px; font-weight: bold; text-decoration: none; color: white; white-space: nowrap; display: flex; align-items: center; gap: 5px; } .search-bar { display: flex; flex: 1; max-width: 550px; margin: 0 10px; } .search-bar input { width: 100%; padding: 8px 12px; border: none; border-radius: 4px 0 0 4px; outline: none; font-size: 14px; } .search-bar button { background: #ffe11b; border: none; padding: 0 15px; border-radius: 0 4px 4px 0; cursor: pointer; font-weight: bold; font-size: 14px; color: #333; } .categories-nav { background: white; padding: 10px 15px; display: flex; gap: 10px; overflow-x: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.05); white-space: nowrap; -webkit-overflow-scrolling: touch; position: sticky; top: 55px; z-index: 999; } .categories-nav::-webkit-scrollbar { display: none; } .categories-nav a { text-decoration: none; color: #333; font-size: 13px; font-weight: 500; padding: 6px 12px; background: #f0f0f0; border-radius: 20px; transition: 0.2s; } .categories-nav a:hover { background: #f85606; color: white; } .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; background: #fff; display: flex; justify-content: space-around; padding: 8px 0; border-top: 1px solid #ddd; z-index: 1000; box-shadow: 0 -2px 5px rgba(0,0,0,0.05); } .bottom-nav a { text-decoration: none; color: #666; font-size: 11px; display: flex; flex-direction: column; align-items: center; text-align: center; font-weight: 500; } .bottom-nav a span { font-size: 18px; margin-bottom: 2px; } .bottom-nav a:hover, .bottom-nav a.active { color: #f85606; } .container { max-width: 1200px; margin: 15px auto; padding: 0 10px; width: 100%; } .product-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; } .product-card { background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; justify-content: space-between; text-decoration: none; color: inherit; transition: transform 0.2s; } .product-card img { width: 100%; height: 160px; object-fit: contain; background: #fff; border-radius: 4px; cursor: pointer; } .product-card h4 { font-size: 14px; color: #222; margin: 8px 0 4px 0; height: 38px; overflow: hidden; line-height: 1.3; font-weight: 600; } .price { color: #f85606; font-size: 16px; font-weight: bold; margin: 4px 0; } .btn { background: #f85606; color: white; border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer; text-decoration: none; text-align: center; display: inline-block; font-size: 14px; font-weight: 600; } .btn-buy { background: #ffe11b; color: #333; font-weight: bold; } @media (min-width: 768px) { .product-grid { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 15px; } .product-card img { height: 190px; } .bottom-nav { display: none; } body { padding-bottom: 0; } } </style> <!-- Image Modal CSS for Large Preview --> <div id="imageModal" style="display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.8); justify-content:center; align-items:center;"> <span onclick="closeImageModal()" style="position:absolute; top:20px; right:30px; color:#fff; font-size:40px; font-weight:bold; cursor:pointer;">&times;</span> <img id="modalImg" style="max-width:90%; max-height:90%; border-radius:6px; box-shadow:0 0 20px rgba(255,255,255,0.3);"> </div> <script> function openImageModal(src) { document.getElementById('modalImg').src = src; document.getElementById('imageModal').style.display = 'flex'; } function closeImageModal() { document.getElementById('imageModal').style.display = 'none'; } </script>  <script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}</script>`;
const getNavbarHTML = (user) => ` <header> <a href="/" class="logo">🛒Online Shop</a> <form action="/search" method="GET" class="search-bar"> <input type="text" name="q" placeholder="Search in Online Shop..." required> <button type="submit">🔍</button> </form> </header> <div class="categories-nav"> <a href="/">🔥All</a> <a href="/category/Fashion">👗ফ্যাশন</a> <a href="/category/Supershop">🛒সুপার শপ</a> <a href="/category/Pharmacy">💊ফার্মেসি</a> <a href="/category/Food">🍲খাদ্যপণ্য</a> <a href="/category/Sports">⚽স্পোর্ট স</a> <a href="/category/Books">📚বই</a> <a href="/category/Stationery">✏️স্টেশনারি</a> <a href="/category/HomeDecor">🛋️হোম ডেকোর ও ফার্নিচার</a> <a href="/category/BeautyCare">💄বিউটি পার্লার কেয়ার</a> <a href="/category/Electric">⚡ইলেকট্রিক</a> </div> <div class="bottom-nav"> <a href="/"><span>🏠</span>Home</a> <a href="/wishlist"><span>❤️</span>Wishlist</a> <a href="/cart"><span>🛒</span>Cart</a> <a href="/my-orders"><span>📦</span>Orders</a> ${user ? `<a href="/notifications" style="position:relative;"><span>🔔</span>Alerts <b id="notificationBadge" style="display:none;position:absolute;top:-3px;right:8px;background:#dc3545;color:#fff;border-radius:20px;padding:1px 5px;font-size:9px;">0</b></a><a href="/request-inbox" style="position:relative;"><span>📥</span>Inbox <b id="requestInboxBadge" style="display:none;position:absolute;top:-3px;right:8px;background:#dc3545;color:#fff;border-radius:20px;padding:1px 5px;font-size:9px;">0</b></a><a href="/dashboard"><span>👤</span>Account</a>` : `<a href="/login"><span>🔑</span>Login</a>`} ${user && ((isMainAdmin(user)) || (user.role === 'subadmin' && subAdminIsActive(user))) ? `<a href="/admin-dashboard"><span>⚙️</span>${isMainAdmin(user) ? 'Admin' : 'Seller Admin'}</a>` : ''} </div> ${user ? `<script>(async()=>{try{const r=await fetch('/api/request-chat/unread-count');const d=await r.json();const b=document.getElementById('requestInboxBadge');if(b&&d.count>0){b.textContent=d.count>99?'99+':d.count;b.style.display='inline-block';};const nr=await fetch('/api/notifications/unread-count');const nd=await nr.json();const nb=document.getElementById('notificationBadge');if(nb&&nd.count>0){nb.textContent=nd.count>99?'99+':nd.count;nb.style.display='inline-block';}}catch(e){}})();</script>` : ''} ${user && user.role !== 'admin' ? `
<div style="position: fixed; bottom: 75px; right: 20px; z-index: 1001;">
<button onclick="toggleUserChatBox()" style="background: #f85606; color: white; border: none; border-radius: 50px; padding: 12px 18px; font-size: 15px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px;">
💬মেসেজ বক্স
</button>
<div id="userChatModal" style="display: none; position: fixed; bottom: 135px; right: 20px; width: 320px; max-height: 450px; background: white; border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); z-index: 1002; flex-direction: column; overflow: hidden; border: 1px solid #ddd;">
<div style="background: #f85606; color: white; padding: 12px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
<span>💬প্রোডাক্ট ইনবক্স ও চ্যাট</span>
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
container.innerHTML = '<p style="text-align: center; color: #777; padding: 20px;">কোনো প্রশ্ন বা চ্যাট নেই</p>';
} else {
container.innerHTML = chats.map(c =>
'<div style="background: #f9f9f9; padding: 8px; margin-bottom: 8px; border-radius: 4px; display:flex; gap:8px; align-items:center;">' +
(c.productImage ? '<img src="' + c.productImage + '" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px; border:1px solid #ccc; cursor:pointer;" onclick="openImageModal(\'/uploads/' + c.productImage + '\')">' : '') +
'<div style="flex:1;">' +
'<p style="margin: 0 0 2px 0; font-weight: bold; color: #333; font-size: 13px;">পণ্য: ' + (c.productName || 'N/A') + '</p>' +
'<p style="margin: 0 0 2px 0; color: #555; font-size: 12px;">প্রশ্ন: ' +
c.message + '</p>' +
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
` : ''} `;
// ================= Public & Homepage Routes =================
app.get('/', async (req, res, next) => {
try {
let categoryFilter = req.query.category;
let query = categoryFilter ? { category: categoryFilter } : {};
let products = await Product.find(query).sort({ _id: -1 });
let fbContents = await FbContent.find().sort({ _id: -1 });
let productsHTML = products.map(p => ` <div class="product-card" onclick="window.location.href='/product/${p._id}'" style="cursor: pointer;"> <img src="${mediaUrl(p.mainImage)}" alt="${p.name}"> <div class="price">৳${p.price}</div> <div style="font-size:11px; color:#888;">Stock: ${p.stock} | Max Limit: ${p.maxOrderLimit || ''}</div> </div> `).join('');
let fbHTML = fbContents.map(fb => ` <div style="background:white; padding:15px; margin-bottom:15px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"> <p style="font-weight:bold; margin-bottom:8px;">${fb.title}</p> ${fb.mediaType === 'image' ? `<img src="${mediaUrl(fb.mediaUrl)}"
style="max-width:100%; height:auto; border-radius:4px; cursor:pointer;"
onclick="openImageModal('${mediaUrl(fb.mediaUrl)}')">` : `<video src="${mediaUrl(fb.mediaUrl)}"
controls style="max-width:100%; border-radius:4px;"></video>`} <br><a href="${fb.productLink || '/'}" class="btn btn-buy" style="margin-top:10px; display:inline-block;">⚡Order Now (Buy Direct)</a> </div> `).join('');
res.send(` <!DOCTYPE html> <html> <head><title>Online Shop - Home</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container"> <h3 style="margin: 10px 0 15px 0; font-size: 17px; color: #333;">Flash Sale & Recommended</h3> <div class="product-grid">${productsHTML.length ? productsHTML : '<p style="padding:20px; background:white; text-align:center;">No products found.</p>'}</div> <h3 style="margin-top:30px; font-size: 17px;">Facebook Posts & Reels Highlights</h3> <div>${fbHTML}</div> </div> </body> </html> `);
} catch (err) {
next(err);
}
});
app.get('/category/:name', async (req, res, next) => {
try {
let catName = req.params.name;
let products = await Product.find({ category: catName });
let productsHTML = products.map(p => ` <div class="product-card" onclick="window.location.href='/product/${p._id}'"> <img src="${mediaUrl(p.mainImage)}" alt="${p.name}" onclick="event.stopPropagation(); openImageModal('${mediaUrl(p.mainImage)}');"> <h4>${p.name}</h4> <div class="price">৳${p.price}</div> </div> `).join('');
res.send(` <!DOCTYPE html> <html> <head><title>${catName} - Online Shop</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container"> <h3 style="margin: 10px 0 15px 0;">Category: ${catName}</h3> <div class="product-grid">${productsHTML.length ? productsHTML : '<div style="background:white; padding:30px; text-align:center; border-radius:6px; grid-column: span 2;"><h3>No products found.</h3></div>'}</div> </div> </body> </html> `);
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
let productsHTML = products.map(p => ` <div class="product-card" onclick="window.location.href='/product/${p._id}'"> <img src="${mediaUrl(p.mainImage)}" alt="${p.name}" onclick="event.stopPropagation(); openImageModal('${mediaUrl(p.mainImage)}');"> <h4>${p.name}</h4> <div class="price">৳${p.price}</div> </div> `).join('');
res.send(` <!DOCTYPE html> <html> <head><title>Search: ${keyword}</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container"> <h3 style="margin: 10px 0 15px 0;">Search Results for "${keyword}"</h3> <div class="product-grid">${productsHTML.length ? productsHTML : '<div style="background:white; padding:30px; text-align:center; border-radius:6px; grid-column: span 2;"><h3>No matching products found.</h3></div>'}</div> </div> </body> </html> `);
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
let relatedProducts = await Product.find({ category: product.category, _id: { $ne:
product._id } }).limit(4);
let allImages = [product.mainImage, ...((product.additionalImages || []).filter(Boolean))].filter(Boolean).map(x => String(x || ''));
let galleryData = allImages.map((img, idx) => ({ index: idx, raw: img, src: mediaUrl(img) }));
const validGalleryImages = new Set(allImages.map(String));
let requestedPreviewImage = String(req.query.previewImage || req.query.selectedImage || product.mainImage || '');
if (!validGalleryImages.has(requestedPreviewImage)) requestedPreviewImage = String(product.mainImage || '');
let allowedMax = Math.min(Math.max(1, Number(product.maxOrderLimit || 5)), Math.max(1, Number(product.stock || 0)));
let currentQtyFromQuery = Number(req.query.qty) || 1;
let currentQty = Math.min(allowedMax, Math.max(1, Math.floor(currentQtyFromQuery)));
let selectedGalleryIndex = Math.max(0, allImages.findIndex(x => String(x) === requestedPreviewImage));
if (selectedGalleryIndex < 0) selectedGalleryIndex = 0;
let galleryHTML = galleryData.map((item, idx) => {
  const fallbackHref = `/product/${product._id}?previewImage=${encodeURIComponent(item.raw)}&qty=${currentQty}`;
  return ` <a href="${fallbackHref}" class="thumb-link" data-gallery-index="${idx}" aria-label="Product image ${idx+1}" aria-current="${idx===selectedGalleryIndex?'true':'false'}" style="padding:0;margin:0;border:0;background:transparent;cursor:pointer;display:block;flex:0 0 auto;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;text-decoration:none;"><img src="${item.src}" class="thumb-img" alt="Product image ${idx+1}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:${idx === selectedGalleryIndex ? '2px solid #f85606' : '1px solid #ccc'};cursor:pointer;display:block;pointer-events:none;user-select:none;" draggable="false" onerror="this.style.opacity='0.35'"></a> `;
}).join('');
let chatsHTML = chats.map(c => {
  const img = mediaUrl(c.productImage);
  const from = c.senderRole === 'admin' || c.senderRole === 'subadmin' ? 'Admin' : c.userEmail;
  return `<div style="background:#fff; padding:10px; margin-bottom:8px; border-radius:6px; border:1px solid #ddd;">
    <div style="display:flex; gap:10px; align-items:flex-start;">
      ${img ? `<img src="${img}" width="70" height="70" style="object-fit:cover; border-radius:5px; cursor:pointer; flex:none;" onclick="openImageModal(this.src)" onerror="this.style.display='none'">` : ''}
      <div style="flex:1;"><b>${from}:</b> ${c.message || ''}<br><span style="font-size:11px;color:#777;">Product: ${c.productName || product.name}</span>${c.reply ? `<div style="margin-top:6px;color:#087f23;"><b>Admin Reply:</b> ${c.reply}</div>` : ''}</div>
    </div>
    ${req.user && isStaff(req.user) ? `<form action="/admin/reply-chat/${c._id}" method="POST" style="margin-top:8px; display:flex; gap:5px;"><input type="text" name="reply" placeholder="Reply to customer..." style="flex:1; padding:6px;" required><button type="submit" class="btn" style="padding:6px 10px;">Reply</button></form>` : ''}
  </div>`;
}).join('');
let reviewsHTML = reviews.map(r => ` <div style="border-bottom:1px solid #eee; padding:8px 0; font-size:13px;"> <p style="margin:0 0 2px 0;"><b>${r.userEmail}</b> - <span style="color:#ff9800; font-weight:bold;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></p> <p style="margin:0; color:#444;">${r.comment}</p> </div> `).join('');
let relatedHTML = relatedProducts.map(p => ` <div class="product-card" onclick="window.location.href='/product/${p._id}'"> <img src="${mediaUrl(p.mainImage)}" alt="${p.name}" onclick="event.stopPropagation(); openImageModal('${mediaUrl(p.mainImage)}');"> <h4 style="font-size:13px; height:32px;">${p.name}</h4> <div class="price" style="font-size:15px;">৳${p.price}</div> </div> `).join(''); 
res.send(` <!DOCTYPE html> <html> <head><title>${product.name}</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container" style="background:white; padding:15px; border-radius:6px;"> <div style="display:flex; gap:20px; flex-wrap:wrap;"> <div style="width:100%; max-width:320px; margin:0 auto;"> <img id="mainProductImg" src="${mediaUrl(requestedPreviewImage)}" style="width:100%; height:300px; object-fit:cover; border-radius:6px; border:1px solid #ddd; cursor:pointer;" onclick="openImageModal(this.src)"><br> <div id="productGallery" style="display:flex; gap:8px; margin-top:10px; overflow-x:auto; padding:2px;">${galleryHTML}</div> </div> <div style="flex:1; min-width: 260px;"> <h2 style="font-size:18px; margin-top:0;">${product.name}</h2> <p style="font-size:13px; color:#666;"><b>Category:</b> ${product.category}</p> <div class="price">৳${product.price}</div> ${isCustomerLike(req.user) ? `<form action="/wishlist/toggle/${product._id}" method="POST" style="margin:8px 0;"><button type="submit" class="btn" style="background:#e91e63;color:#fff;padding:7px 12px;">❤️ ${Array.isArray(req.user.wishlist) && req.user.wishlist.map(String).includes(String(product._id)) ? 'Remove from Wishlist' : 'Add to Wishlist'}</button></form>` : ''} <p style="font-size:13px;"><b>Stock Available:</b> ${product.stock}</p> <p style="font-size:13px; color:#d9534f;"><b>Maximum Order Limit:</b> ${product.maxOrderLimit || 5}</p> <p style="font-size:13px; color:#007bff;"><b>Delivery Charge:</b> ৳${product.deliveryCharge || 150}</p> <p style="font-size:14px; color:#440;">${product.description}</p> <br> <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;"> <span style="font-weight:600; font-size:13px;">Quantity:</span> <a id="qtyMinusBtn" href="/product/${product._id}?previewImage=${encodeURIComponent(requestedPreviewImage)}&qty=${Math.max(1,currentQty-1)}" style="padding:6px 12px; font-size:16px; font-weight:bold; background:#ddd; color:#000; border-radius:4px; cursor:pointer; text-decoration:none; display:inline-block;">-</a> <span id="qtyDisplay" style="font-size:16px; font-weight:bold; min-width:25px; text-align:center;">${currentQty}</span> <a id="qtyPlusBtn" href="/product/${product._id}?previewImage=${encodeURIComponent(requestedPreviewImage)}&qty=${Math.min(allowedMax,currentQty+1)}" style="padding:6px 12px; font-size:16px; font-weight:bold; background:#ddd; color:#000; border-radius:4px; cursor:pointer; text-decoration:none; display:inline-block;">+</a> </div> <div style="display: flex; gap: 10px; flex-wrap:wrap;"> <a id="buyNowBtn" href="/buy-now/${product._id}?qty=${currentQty}&selectedImage=${encodeURIComponent(String(requestedPreviewImage || ''))}" class="btn btn-buy" style="flex:1; min-width:140px; padding:12px; font-size:15px; text-align:center;">Buy Now</a> <a id="addToCartBtn" href="/api/add-to-cart/${product._id}?qty=${currentQty}&selectedImage=${encodeURIComponent(String(requestedPreviewImage || ''))}" class="btn" style="flex:1; min-width:140px; padding:12px; font-size:15px; text-align:center; background:#28a745;">🛒Add to Cart</a> ${getProductWhatsAppUrl(product) ? `<a href="${getProductWhatsAppUrl(product)}" target="_blank" rel="noopener noreferrer" class="btn" style="flex:1; min-width:140px; padding:12px; font-size:15px; text-align:center; background:#25D366; color:#fff; text-decoration:none;">💬 WhatsApp-এ কথা বলুন</a>` : ''} </div> </div> </div> <script>
const galleryImages = ${JSON.stringify(galleryData)};
let currentQty = ${currentQty};
const productMaxLimit = Math.max(0, Number(${Number(product.maxOrderLimit || 5)}) || 5);
const productStock = Math.max(0, Number(${Number(product.stock ?? 0)}) || 0);
const allowedMax = Math.min(productMaxLimit || 5, productStock);
let selectedImage = ${JSON.stringify(requestedPreviewImage)};
function resolveGalleryUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^(https?:)?\/\//i.test(v) || v.startsWith('data:') || v.startsWith('blob:')) return v;
  return '/uploads/' + v.replace(/\\/g,'/').replace(/^\/+/, '').replace(/^uploads\//i, '');
}
function updateOrderLinks() {
  const buyBtn = document.getElementById('buyNowBtn');
  const cartBtn = document.getElementById('addToCartBtn');
  const productId = ${JSON.stringify(String(product._id))};
  const encodedImage = encodeURIComponent(selectedImage || '');
  if (buyBtn) buyBtn.href = '/buy-now/' + productId + '?qty=' + Math.max(1,currentQty) + '&selectedImage=' + encodedImage;
  if (cartBtn) cartBtn.href = '/api/add-to-cart/' + productId + '?qty=' + Math.max(1,currentQty) + '&selectedImage=' + encodedImage;
}
function refreshQtyUI() {
  if (currentQty < 1) currentQty = 1;
  if (allowedMax > 0 && currentQty > allowedMax) currentQty = allowedMax;
  const display = document.getElementById('qtyDisplay');
  const minus = document.getElementById('qtyMinusBtn');
  const plus = document.getElementById('qtyPlusBtn');
  if (display) display.textContent = String(currentQty);
  if (minus) { minus.disabled = currentQty <= 1; minus.style.opacity = currentQty <= 1 ? '0.5' : '1'; }
  if (plus) { plus.style.opacity = (allowedMax <= 1 || currentQty >= allowedMax) ? '0.5' : '1'; plus.style.pointerEvents = (allowedMax <= 1 || currentQty >= allowedMax) ? 'none' : 'auto'; plus.href = '/product/' + ${JSON.stringify(String(product._id))} + '?previewImage=' + encodeURIComponent(selectedImage || '') + '&qty=' + Math.min(allowedMax,currentQty+1); }
  if (minus) { minus.style.opacity = currentQty <= 1 ? '0.5' : '1'; minus.style.pointerEvents = currentQty <= 1 ? 'none' : 'auto'; minus.href = '/product/' + ${JSON.stringify(String(product._id))} + '?previewImage=' + encodeURIComponent(selectedImage || '') + '&qty=' + Math.max(1,currentQty-1); }
  updateOrderLinks();
}
function incrementQty() {
  if (allowedMax > 0 && currentQty < allowedMax) { currentQty += 1; refreshQtyUI(); }
  return false;
}
function decrementQty() {
  if (currentQty > 1) { currentQty -= 1; refreshQtyUI(); }
  return false;
}
function setMainProductImage(index, element) {
  const item = galleryImages[Number(index)];
  const main = document.getElementById('mainProductImg');
  if (!item || !main) return false;
  const src = String(item.src || resolveGalleryUrl(item.raw || '')).trim();
  if (!src) return false;
  selectedImage = String(item.raw || item.src || '');
  main.src = src;
  main.setAttribute('data-selected-image', selectedImage);
  document.querySelectorAll('.thumb-img').forEach(t => { t.style.border = '1px solid #ccc'; });
  document.querySelectorAll('.thumb-link').forEach(t => t.setAttribute('aria-current','false'));
  const thumb = element || document.querySelector('.thumb-btn[data-gallery-index=\"' + Number(index) + '\"]');
  if (thumb) {
    const image = thumb.classList && thumb.classList.contains('thumb-img') ? thumb : thumb.querySelector('.thumb-img');
    if (image) image.style.border = '2px solid #f85606';
    if (thumb.classList && thumb.classList.contains('thumb-link')) thumb.setAttribute('aria-current','true');
    else if (thumb.closest('.thumb-link')) thumb.closest('.thumb-link').setAttribute('aria-current','true');
  }
  updateOrderLinks();
  return false;
}
window.incrementQty = incrementQty;
window.decrementQty = decrementQty;
window.setMainProductImage = setMainProductImage;
function bindProductControlEvents() {
  const plus = document.getElementById('qtyPlusBtn');
  const minus = document.getElementById('qtyMinusBtn');
  const gallery = document.getElementById('productGallery');
  if (plus) plus.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); incrementQty(); }, {passive:false});
  if (minus) minus.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); decrementQty(); }, {passive:false});
  if (gallery) gallery.addEventListener('click', function(ev){
    const thumb = ev.target.closest('.thumb-link');
    if (!thumb || !gallery.contains(thumb)) return;
    ev.preventDefault(); ev.stopPropagation();
    setMainProductImage(Number(thumb.dataset.galleryIndex), thumb);
  }, {passive:false});
}
function initProductControls() {
  bindProductControlEvents();
  refreshQtyUI();
  if (galleryImages.length) setMainProductImage(${selectedGalleryIndex}, document.querySelector('.thumb-link[data-gallery-index="${selectedGalleryIndex}"]'));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initProductControls);
else initProductControls();
</script> <hr style="margin:30px 0; border:0; border-top:1px solid #eee;"> <h3>Ratings & Reviews</h3> <form action="/api/add-review" method="POST" style="background:#f9f9f9; padding:12px; border-radius:4px; margin-bottom:15px;"> <input type="hidden" name="productId" value="${product._id}"> <label style="font-size:13px; font-weight:600;">Rate this product:</label> <select name="rating" style="padding:5px; margin-bottom:8px; border-radius:4px; border:1px solid #ccc;" required> <option value="5">★★★★★ (5 Stars)</option> <option value="4">★★★★☆ (4 Stars)</option> <option value="3">★★★☆☆ (3 Stars)</option> <option value="2">★★☆☆☆ (2 Stars)</option> <option value="1">★☆☆☆☆ (1 Star)</option> </select><br> <textarea name="comment" placeholder="Write your review here..." style="width:100%; height:50px; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px;" required></textarea> <button type="submit" class="btn" style="padding:6px 12px; font-size:12px; margin-top:5px;">Submit Review</button> </form> <div>${reviewsHTML.length ? reviewsHTML : '<p style="color:#777; font-size:13px;">No reviews yet.</p>'}</div> <hr style="margin:30px 0; border:0; border-top:1px solid #eee;"> <h3>You May Also Like</h3> <div class="product-grid" style="margin-top:10px;">${relatedHTML.length ? relatedHTML : '<p>No related products.</p>'}</div> <hr style="margin:30px 0; border:0; border-top:1px solid #eee;"> <h3>Ask Question About This Product</h3> <form action="/api/chat" method="POST"> <input type="hidden" name="productId" value="${product._id}"> <input type="hidden" name="productName" value="${product.name}"> <input type="hidden" name="productImage" value="${product.mainImage}"> <textarea name="message" placeholder="Ask your question here..." style="width:100%; height:70px; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:14px;" required></textarea><br> <button type="submit" class="btn" style="margin-top:6px; padding:8px 14px;">Send Question</button> </form> <div style="margin-top:20px;"> <h4 style="margin-bottom:10px;">Customer Q&A (পণ্যের বিষয়ে আপনার ও এডমিনের কথোপকথন):</h4> ${chatsHTML.length ? chatsHTML : '<p style="color:#777; font-size:13px;">No questions yet.</p>'} </div> </div> </body> </html> `);
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
if (!req.user) return res.redirect('/login');
const productId = String(req.body.productId || '');
const message = safeText(req.body.message, 3000);
if (!productId || !message) return res.send(`<script>alert('Product এবং Message দুটোই প্রয়োজন।'); window.history.back();</script>`);
const product = await Product.findById(productId).lean();
if (!product) return res.status(404).send('Product not found');
let recipientEmail = '';
if (product.ownerId) {
const owner = await User.findById(product.ownerId).select('email').lean();
if (owner) recipientEmail = owner.email;
}
if (!recipientEmail) {
const admin = await User.findOne({role:'admin'}).select('email').lean();
recipientEmail = admin ? admin.email : '';
}
await new Chat({
productId: product._id,
productName: product.name,
ownerId: String(product.ownerId || ''),
productImage: product.mainImage || '',
userEmail: req.user.email,
message,
reply:'',
senderRole: 'user',
senderEmail: req.user.email,
recipientEmail,
isRead:false
}).save();
res.redirect('back');
} catch (err) { next(err); }
});
app.get('/api/user-chats-json', async (req, res, next) => {
try {
if (!req.user) return res.json([]);
const chats = await Chat.find({ $or: [ { userEmail: req.user.email }, { recipientEmail: req.user.email } ] }).sort({ _id: -1 }).limit(100).lean();
res.json(chats.map(c => ({...c, productImage: mediaUrl(c.productImage)})));
} catch (err) { res.json([]); }
});

app.get('/messages', async (req, res, next) => {
try {
  if (!req.user) return res.redirect('/login?redirect=/messages');
  const email = normalizeEmail(req.user.email);
  const chats = await Chat.find({ $or: [ { userEmail: email }, { recipientEmail: email } ] }).sort({ _id: -1 }).limit(200).lean();
  const canReplyToAdmin = isSubAdmin(req.user);
  const cards = chats.map(c => {
    const img=mediaUrl(c.productImage);
    const senderEmail=normalizeEmail(c.senderEmail || c.userEmail);
    const recipientEmail=normalizeEmail(c.recipientEmail || '');
    const mine=senderEmail===email;
    const adminConversation = (c.senderRole==='admin' || c.senderRole==='subadmin' || recipientEmail===email && c.ownerId===String(req.user._id));
    const replyForm = canReplyToAdmin && !mine && c.senderRole==='admin'
      ? `<form action="/sub-admin/reply-admin/${c._id}" method="POST" style="display:flex;gap:6px;margin-top:8px;"><input type="text" name="message" required maxlength="2000" placeholder="Main Admin-কে reply লিখুন..." style="flex:1;padding:8px;border:1px solid #ccc;border-radius:7px;"><button class="btn" style="padding:7px 11px;background:#007bff;color:#fff;">Reply</button></form>` : '';
    return `<div style="background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:12px;margin-bottom:10px;display:flex;gap:10px;align-items:flex-start;box-shadow:0 1px 3px rgba(0,0,0,.04);">${img?`<img src="${img}" onerror="this.style.display='none'" width="62" height="62" style="object-fit:cover;border-radius:8px;cursor:pointer;" onclick="openImageModal(this.src)">`:''}<div style="flex:1"><div style="font-size:12px;color:#f85606;font-weight:700;">${c.productName||'Main Admin Message'}</div><div style="font-size:11px;color:#777;margin:2px 0 6px;">${mine?'আপনি':(c.senderRole==='admin'?'Main Admin':c.senderRole==='subadmin'?'Shop Admin':'Customer')}</div><div style="font-size:14px;line-height:1.45;">${c.message||''}</div>${c.reply?`<div style="margin-top:6px;padding:7px;background:#eefaf0;border-radius:7px;color:#087f23;font-size:13px;"><b>Reply:</b> ${c.reply}</div>`:''}${replyForm}</div></div>`;
  }).join('');
  res.send(`<!DOCTYPE html><html><head><title>My Messages</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container" style="max-width:760px"><div style="background:#fff;padding:18px;border-radius:12px"><h2 style="margin-top:0">💬 My Messages</h2><p style="color:#777;font-size:13px">Main Admin, Customer এবং Product সম্পর্কিত কথোপকথন এখানে থাকবে।</p>${cards||'<div style="padding:30px;text-align:center;color:#777">কোনো মেসেজ নেই।</div>'}</div></div></body></html>`);
  await Chat.updateMany({recipientEmail:email,isRead:false},{$set:{isRead:true}});
} catch(e){ next(e); }
});

app.post('/sub-admin/reply-admin/:id', async (req,res,next)=>{
try {
  if(!isSubAdmin(req.user)) return res.status(403).send('Sub Admin access required');
  const email=normalizeEmail(req.user.email);
  const original=await Chat.findOne({_id:req.params.id,recipientEmail:email,senderRole:'admin'});
  if(!original) return res.status(404).send('Admin message not found');
  const message=safeText(req.body.message,2000);
  if(!message) return res.redirect('/messages');
  await new Chat({productId:original.productId||null,productName:original.productName||'Main Admin Message',ownerId:String(req.user._id),productImage:original.productImage||'',userEmail:email,message,reply:'',senderRole:'subadmin',senderEmail:email,recipientEmail:normalizeEmail(original.senderEmail||''),isRead:false}).save();
  if(original.senderEmail) await createNotification(normalizeEmail(original.senderEmail),'Sub Admin Reply',message,'/admin-dashboard#subAdminSec','message');
  res.redirect('/messages');
} catch(e){next(e);}
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
const validImages = [product.mainImage, ...((product.additionalImages || []).filter(Boolean))].map(x => String(x));
if (!validImages.includes(String(selectedImage))) selectedImage = String(product.mainImage || '');
let cart = [];
try { cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : []; if (!Array.isArray(cart)) cart = []; } catch (_) { cart = []; }
let maxLimit = Math.min(Number(product.maxOrderLimit || 5), Math.max(0, Number(product.stock) || 0));
let itemDeliveryCharge = product.deliveryCharge || 150;
let existingIndex = cart.findIndex(item => item.productId === productId && item.mainImage
=== selectedImage);
if (existingIndex > -1) {
let newTotalQty = cart[existingIndex].quantity + requestedQty;
if (newTotalQty > maxLimit) {
return res.send(`<script>alert('দুঃখিত! সর্বোচ্চ ক্রয়ের সীমা হলো ' + ${maxLimit} টি।'); window.location.href='/cart';</script>`);
}
cart[existingIndex].quantity = newTotalQty;
} else {
if (requestedQty > maxLimit) requestedQty = maxLimit;
if (requestedQty < 1) requestedQty = 1;
cart.push({
productId: product._id.toString(),
productName: product.name,
price: product.price,
deliveryCharge: itemDeliveryCharge,
mainImage: selectedImage,
quantity: requestedQty,
maxOrderLimit: maxLimit,
ownerId: String(product.ownerId || '')
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
let cart = [];
try { cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : []; if (!Array.isArray(cart)) cart = []; } catch (_) { cart = []; }
let itemIndex = cart.findIndex(item => item.productId === productId);
if (itemIndex > -1) {
let product = await Product.findById(productId);
let maxLimit = product ? Math.min(Number(product.maxOrderLimit || 5), Math.max(0, Number(product.stock) || 0)) : Number(cart[itemIndex].maxOrderLimit || 5);
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
let cart = [];
try { cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : []; if (!Array.isArray(cart)) cart = []; } catch (_) { cart = []; }
cart = cart.filter(item => item.productId !== productId);
res.cookie('cart', JSON.stringify(cart));
res.redirect('/cart');
});
app.get('/cart', async (req, res, next) => {
try {
let cart = [];
try { cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : []; if (!Array.isArray(cart)) cart = []; } catch (_) { cart = []; }
let subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
let maxDeliveryCharge = cart.length > 0 ? Math.max(...cart.map(i => i.deliveryCharge ||
150)) : 150;
let cartItemsHTML = cart.map(item => ` <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px; margin-bottom:10px; border-radius:4px; flex-wrap:wrap; gap:10px;"> <div style="display:flex; align-items:center; gap:10px;"><input type="checkbox" class="cartSelect" value="${item.productId}" checked onchange="updateSelectedCheckout()" style="width:18px;height:18px;"> <img src="${mediaUrl(item.mainImage)}" width="50" height="50" style="object-fit:cover; border-radius:4px; border:1px solid #f85606; cursor:pointer;" onclick="openImageModal('${mediaUrl(item.mainImage)}')"> <div> <h4 style="margin:0 0 4px 0; font-size:14px;">${item.productName}</h4> <p style="margin:0; color:#f85606; font-weight:bold;">৳${item.price} × ${item.quantity || 1} = ৳${item.price * (item.quantity || 1)}</p> <p style="margin:2px 0 0 0; font-size:11px; color:#555;">ডেলিভারি চার্জ : ৳${item.deliveryCharge || 150}</p> </div> </div> <div style="display:flex; align-items:center; gap:15px;"> <div style="display:flex; align-items:center; gap:6px;"> <a href="/api/update-cart-qty/${item.productId}/dec" class="btn" style="padding:2px 8px; font-size:14px; background:#ccc; color:#000; text-decoration:none;">-</a> <span style="font-weight:bold; font-size:14px;">${item.quantity || 1}</span> <a href="/api/update-cart-qty/${item.productId}/inc" class="btn" style="padding:2px 8px; font-size:14px; background:#ccc; color:#000; text-decoration:none;">+</a> </div> <a href="/api/remove-from-cart/${item.productId}" class="btn" style="background:#dc3545; padding:5px 10px; font-size:12px;">Remove</a> </div> </div> `).join('');
let checkoutBtn = cart.length > 0 ? `<a id="checkoutSelectedBtn" href="/cart-checkout?selected=${encodeURIComponent(cart.map(i=>String(i.productId)).join(','))}" class="btn btn-buy" style="width:100%; text-align:center; padding:12px; margin-top:15px; display:block; font-size:16px;">Proceed to Checkout (Selected)</a>` : '';
res.send(` <!DOCTYPE html> <html> <head><title>Shopping Cart</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container" style="max-width:700px; background:white; padding:20px; border-radius:6px;"> <h3 style="margin-top:0;">🛒Shopping Cart</h3> ${cart.length ? `<label style="display:flex;align-items:center;gap:7px;margin-bottom:10px;font-size:13px;font-weight:600;"><input type="checkbox" id="selectAllCart" checked onchange="toggleAllCart(this)" style="width:18px;height:18px;"> Select All Products</label>` : ''} ${cartItemsHTML.length ? cartItemsHTML : '<p style="color:#777; text-align:center; padding:30px;">Your cart is empty.</p>'} ${cart.length > 0 ? `<hr style="border:0; border-top:1px solid #ddd; margin:15px 0;"><h4 style="text-align:right; margin:0;">Subtotal: ৳${subtotal} <br><span
style="font-size:13px; color:#666;">Standard Delivery Charge:
৳${maxDeliveryCharge}</span></h4>` : ''} ${checkoutBtn} </div> <script>function toggleAllCart(cb){document.querySelectorAll('.cartSelect').forEach(x=>x.checked=cb.checked);updateSelectedCheckout();} function updateSelectedCheckout(){const ids=[...document.querySelectorAll('.cartSelect:checked')].map(x=>x.value);const b=document.getElementById('checkoutSelectedBtn');if(!b)return;if(!ids.length){b.style.pointerEvents='none';b.style.opacity='.5';b.textContent='Select at least one product';return;}b.style.pointerEvents='auto';b.style.opacity='1';b.textContent='Proceed to Checkout (Selected)';b.href='/cart-checkout?selected='+encodeURIComponent(ids.join(','));} document.addEventListener('DOMContentLoaded',updateSelectedCheckout);</script>
<script>
(function(){
  function organizeAdminDashboard(){
    const root=document.querySelector('.container');
    if(!root || root.dataset.adminOrganized==='1') return false;

    const sectionIds=['addProductSec','ordersSec','usersSec','messageSendSec','chatsSec','couponsSec','facebookSec','settingsSec','subAdminSec','productRequestsSec','productsSec'];
    const nav=[...root.children].find(el => el.tagName==='DIV' && /Add Product/.test(el.textContent||'') && /Sell Products/.test(el.textContent||''));
    if(nav){
      nav.classList.add('admin-section-nav');
      nav.querySelectorAll('a').forEach(a=>a.classList.add('admin-menu-item'));
    }

    // Only direct children are used as section anchors. Each anchor and every sibling
    // belonging to it are moved into one closed card, so controls cannot remain loose below.
    const headings=sectionIds.map(id=>document.getElementById(id)).filter(h=>h && h.parentElement===root);
    if(!headings.length) return false;

    headings.forEach(h=>{
      if(h.closest('.admin-section-card')) return;
      const card=document.createElement('section');
      card.className='admin-section-card';
      card.dataset.sectionId=h.id;
      const header=document.createElement('button');
      header.type='button';
      header.className='admin-section-header';
      header.setAttribute('aria-expanded','false');
      header.innerHTML='<span class="admin-section-title">'+h.innerHTML+'</span><span class="admin-section-arrow">＋</span>';
      const body=document.createElement('div');
      body.className='admin-section-body';
      body.hidden=true;
      h.parentNode.insertBefore(card,h);
      card.appendChild(header);
      card.appendChild(body);
      body.appendChild(h);

      let node=card.nextSibling;
      while(node){
        const next=node.nextSibling;
        if(node.nodeType===1 && node.tagName==='H3' && sectionIds.includes(node.id)) break;
        if(node.nodeType===1 && node.tagName==='HR'){ node.remove(); node=next; continue; }
        body.appendChild(node);
        node=next;
      }

      header.addEventListener('click',()=>{
        const opening=body.hidden;
        body.hidden=!opening;
        header.setAttribute('aria-expanded',String(opening));
        card.classList.toggle('open',opening);
        const arrow=header.querySelector('.admin-section-arrow');
        if(arrow) arrow.textContent=opening?'−':'＋';
      });
    });

    root.dataset.adminOrganized='1';
    return true;
  }
  function boot(){
    if(organizeAdminDashboard()) return;
    setTimeout(organizeAdminDashboard,50);
    setTimeout(organizeAdminDashboard,250);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
</script>
<style>
.admin-section-nav{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px!important;padding:12px!important;background:#f7f9fc;border:1px solid #e2e8f0;border-radius:16px!important;box-shadow:0 4px 16px rgba(0,0,0,.05);position:sticky;top:62px;z-index:20}
.admin-menu-item{margin:0!important;width:100%;min-height:58px;display:flex!important;align-items:center;justify-content:center;line-height:1.2;border-radius:12px!important;box-shadow:0 2px 7px rgba(0,0,0,.06);font-size:12px!important;padding:9px 8px!important}
.admin-section-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;margin:16px 0;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.06);scroll-margin-top:145px}
.admin-section-header{width:100%;border:0;background:linear-gradient(135deg,#fff7f0,#fff);padding:15px 16px;display:flex;align-items:center;justify-content:space-between;text-align:left;cursor:pointer;font-size:16px;font-weight:800;color:#222}
.admin-section-header:hover{background:#fff3e8}
.admin-section-card.open{border-color:#ffd2b8;box-shadow:0 7px 24px rgba(248,86,6,.10)}
.admin-section-card.open .admin-section-header{background:#fff4ec;color:#d94801}
.admin-section-title{display:block;flex:1}
.admin-section-arrow{font-size:24px;line-height:1;min-width:28px;text-align:center;color:#f85606;font-weight:400}
.admin-section-body{padding:0 14px 16px;background:#fff}
.admin-section-body>h3{display:none}
.admin-section-body>form,.admin-section-body>div{margin-top:12px}
@media(max-width:600px){.admin-section-nav{grid-template-columns:repeat(2,1fr);top:56px}.admin-menu-item{min-height:52px}.admin-section-header{font-size:14px;padding:13px}.admin-section-body{padding:0 9px 12px}}
</style>
</body> </html> `);
} catch (err) {
next(err);
}
});
// ================= Cart Checkout & Order Flow (Mandatory Address & Phone Validation)
app.get('/cart-checkout', async (req, res, next) => {
try {
let cart = [];
try { cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : []; if (!Array.isArray(cart)) cart = []; } catch (_) { cart = []; }
if (cart.length === 0) return res.redirect('/cart');
const selectedRaw = String(req.query.selected || '').split(',').map(x=>x.trim()).filter(Boolean);
if (selectedRaw.length) cart = cart.filter(item => selectedRaw.includes(String(item.productId)));
if (cart.length === 0) return res.redirect('/cart');
if (!req.user) {
return res.redirect('/login?redirect=/cart-checkout');
}
let subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
let deliveryCharge = cart.length > 0 ? Math.max(...cart.map(i => i.deliveryCharge || 150)) :
150;
let sellerOwnerIds = [...new Set(cart.map(i => String(i.ownerId || '')).filter(Boolean))];
let siteSetting = sellerOwnerIds.length ? await SiteSetting.findOne({ ownerId: sellerOwnerIds[0] }) : null;
siteSetting = siteSetting || await SiteSetting.findOne() || { bkashNumber: '01700000000', nagadNumber: '01800000000' };
let codOptionHTML = req.user.isBlocked ?
`<p style="color:red; font-size:12px;"><b>Note:</b> Cash on Delivery is disabled for your account.</p>` :
`<option value="COD">Cash on Delivery</option>`;
let advanceWarning = req.user.isBlocked ?
`<div style="background:#fff3cd; padding:10px; border-radius:4px; margin-bottom:10px; color:#856404; font-size:13px;">⚠️<b>Notice:</b> Please pay via bKash/Nagad.</div>` : '';
let itemsSummaryHTML = cart.map(i => ` <div style="display:flex; align-items:center; gap:8px; margin:4px 0;"> <img src="${mediaUrl(i.mainImage)}" width="35" height="35" style="object-fit:cover; border-radius:3px; cursor:pointer;" onclick="openImageModal('${mediaUrl(i.mainImage)}')"> <span style="font-size:13px;">• ${i.productName} (৳${i.price} × ${i.quantity || 1})</span> </div> `).join('');
res.send(` <!DOCTYPE html> <html> <head><title>Cart Checkout</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container" style="max-width:600px; background:white; padding:20px; border-radius:6px;"> <h3 style="margin-top:0;">Cart Order Checkout</h3> ${advanceWarning} <div style="background:#f9f9f9; padding:10px; border-radius:4px; margin-bottom:15px;"> <p style="margin:0 0 5px 0; font-weight:bold;">Selected Items:</p> ${itemsSummaryHTML} </div> <form action="/api/place-cart-order" method="POST" onsubmit="return validateAndPrepareOrder()"> <input type="hidden" name="selectedProductIds" value="${cart.map(i=>String(i.productId)).join(',')}"> <input type="hidden" name="discountPrice" id="discountPriceInput" value="0"> <input type="hidden" name="deliveryCharge" value="${deliveryCharge}"> <input type="hidden" name="address" id="fullAddressInput"> <label style="font-size:13px; font-weight:600;">Full Name:</label><br> <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px; font-weight:600;">Phone Number (বাধ্যতামূলক):</label><br> <input type="text" id="inputPhone" name="phone" value="${req.user.phone || ''}" placeholder="যেমন: 017XXXXXXXX" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <!-- সুনির্দিষ্ট ডেলিভারি এড্রেস ঘরসমূহ (বাধ্যতামূলক) --> <div style="background:#fdfdfd; padding:12px; border:1px solid #e0e0e0; border-radius:6px; margin-bottom:10px;"> <label style="font-size:13px; font-weight:600; color:#f85606;">জেলা (District) *:</label><br> <input type="text" id="inputDistrict" placeholder="" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px; font-weight:600; color:#f85606;">থানা (Thana / Upazila) *:</label><br> <input type="text" id="inputThana" placeholder="" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px; font-weight:600; color:#f85606;">মেইন এড্রেস (গ্রাম / রোড / বাসা নং) *:</label><br> <textarea id="inputVillage" placeholder="" style="width:100%; height:50px; padding:8px; margin:3px 0 5px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required></textarea> </div> <label style="font-size:13px; font-weight:600;">Coupon Code:</label><br> <div style="display:flex; gap:5px; margin:4px 0 10px 0;"> <input type="text" name="couponCode" id="couponCodeInput" placeholder="Enter Coupon Code" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;"> <button type="button" onclick="applyCoupon()" class="btn" style="padding:8px 12px; font-size:12px;">Apply</button> </div> <p id="couponMsg" style="font-size:12px; margin:0 0 10px 0; color:green;"></p> <label style="font-size:13px; font-weight:600;">Customer Note:</label><br> <input type="text" name="customerNote" placeholder="" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;"><br> <div style="background:#f0f8ff; padding:12px; border-radius:4px; margin-bottom:12px; font-size:14px; border:1px solid #bce8f1;"> <p style="margin:2px 0;">Subtotal Price: ৳<span id="subtotalPrice">${subtotal}</span></p> <p style="margin:2px 0;">Delivery Charge: ৳<span id="deliveryChargeText">${deliveryCharge}</span></p> <p style="margin:2px 0; color:red; display:none;" id="discountRow">Discount: -৳<span id="discountText">0</span></p> <hr style="border:0; border-top:1px solid #ccc; margin:6px 0;"> <p style="margin:2px 0; font-weight:bold; color:#f85606; font-size:16px;">Total Payable Amount: ৳<span id="totalAmountText">${subtotal + deliveryCharge}</span></p> </div> <label style="font-size:13px; font-weight:600;">Payment Method:</label><br> <select name="paymentMethod" id="paymentMethod" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" onchange="togglePaymentFields()" required> ${codOptionHTML} <option value="bKash">বিকাশ (বিকাশ পার্সোনাল পেমেন্ট)</option> <option value="Nagad">নগদ (নগদ পার্সোনাল পেমেন্ট)</option> </select><br> <div id="onlinePaymentDiv" style="display:${req.user.isBlocked ? 'block' : 'none'}; background:#f9f9f9; padding:12px; border-radius:4px; margin-bottom:10px; border:1px dashed #f85606;"> <p style="font-size:13px; color:#333; margin:0 0 6px 0;">বিকাশ: <b style="color:#f85606;">${siteSetting.bkashNumber}</b> | নগদ: <b style="color:#f85606;">${siteSetting.nagadNumber}</b></p> <label style="font-size:12px; font-weight:600;">আপনার বিকাশ/নগদ নাম্বার:</label><br> <input type="text" name="senderNumber" id="senderNumber" placeholder="যেমন: 01XXXXXXXXX" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br> <label style="font-size:12px; font-weight:600;">প্রেরিত টাকার পরিমাণ:</label><br> <input type="number" name="paidAmount" id="paidAmount" placeholder="যেমন: মোট টাকা" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br> <label style="font-size:12px; font-weight:600;">ট্রানজেকশন আইডি (TrxID):</label><br> <input type="text" name="trxId" placeholder="যেমন: 9N7A6..." style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"> </div> <button type="submit" class="btn btn-buy" style="width:100%; padding:12px; font-size:16px; margin-top:5px;">⚡Confirm Cart Order</button> </form> </div> <script> let appliedDiscount = 0; let currentDeliveryCharge = ${deliveryCharge}; function validateAndPrepareOrder() { let phone = document.getElementById('inputPhone').value.trim(); let dist = document.getElementById('inputDistrict').value.trim(); let thana = document.getElementById('inputThana').value.trim(); let village = document.getElementById('inputVillage').value.trim(); if(!phone) { alert('দয়া করে আপনার ফোন নম্বর প্রদান করুন!'); return false; } if(!dist || !thana || !village) { alert('ডেলিভারির জন্য জেলা, থানা এবং সম্পূর্ণ ঠিকানা বাধ্যতামূলক!'); return false; } let fullAddr = "জেলা: " + dist + ", থানা: " + thana + ", ঠিকানা: " + village; document.getElementById('fullAddressInput').value = fullAddr; return true; } async function applyCoupon() { let code = document.getElementById('couponCodeInput').value; let msg = document.getElementById('couponMsg'); if(!code) return; try { let res = await fetch('/api/verify-coupon', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code}) }); let data = await res.json(); if(data.success) { appliedDiscount = data.discountAmount; document.getElementById('discountPriceInput').value = appliedDiscount; document.getElementById('discountText').innerText = appliedDiscount; document.getElementById('discountRow').style.display = 'block'; msg.style.color = 'green'; msg.innerText = 'Coupon applied successfully!'; calculateTotal(); } else { msg.style.color = 'red'; msg.innerText = data.message; } } catch(e) { msg.style.color = 'red'; msg.innerText = 'Invalid coupon request.'; } } function calculateTotal() { let subtotal = Number(document.getElementById('subtotalPrice').innerText); let total = (subtotal + currentDeliveryCharge) - appliedDiscount; if(total < 0) total = 0; document.getElementById('totalAmountText').innerText = total; } function togglePaymentFields() { let method = document.getElementById('paymentMethod').value; let div = document.getElementById('onlinePaymentDiv'); let senderInput = document.getElementById('senderNumber'); let amountInput = document.getElementById('paidAmount'); if (method === 'bKash' || method === 'Nagad') { div.style.display = 'block'; senderInput.setAttribute('required', 'true'); amountInput.setAttribute('required', 'true'); } else { div.style.display = 'none'; senderInput.removeAttribute('required'); amountInput.removeAttribute('required'); } } </script> </body> </html> `);
} catch (err) {
next(err);
}
});
app.post('/api/place-cart-order', async (req, res, next) => {
try {
if (!req.user) return res.redirect('/login');
let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
if (cart.length === 0) return res.redirect('/cart');
const selectedIds = String(req.body.selectedProductIds || '').split(',').map(x=>x.trim()).filter(Boolean);
if (selectedIds.length) cart = cart.filter(item => selectedIds.includes(String(item.productId)));
if (cart.length === 0) return res.redirect('/cart');
const { name, phone, address, discountPrice, customerNote, paymentMethod,
senderNumber, paidAmount, trxId, deliveryCharge } = req.body;
if(!phone || !address) {
return res.send(`<script>alert('ফোন নম্বর এবং ঠিকানা বাধ্যতামূলক!'); window.history.back();</script>`);
}
if (req.user.isBlocked && paymentMethod === 'COD') {
return res.send(`<script>alert('COD is disabled for your account.'); window.history.back();</script>`);
}
if ((paymentMethod === 'bKash' || paymentMethod === 'Nagad') && (!senderNumber ||
!paidAmount)) {
return res.send(`<script>alert('বিকাশ বা নগদ সিলেক্ট করলে নাম্বার ও পরিমাণ দিতে হবে!'); window.history.back();</script>`);
}
const liveItems = [];
for (const cartItem of cart) {
  const product = await Product.findById(cartItem.productId);
  if (!product) return res.send(`<script>alert('কার্টের একটি পণ্য আর পাওয়া যাচ্ছে না। কার্ট আপডেট করে আবার চেষ্টা করুন।'); window.location.href='/cart';</script>`);
  const maxLimit = Math.min(Number(product.maxOrderLimit || 5), Math.max(0, Number(product.stock) || 0));
  const qty = Math.floor(Number(cartItem.quantity) || 1);
  if (qty < 1 || qty > maxLimit) return res.send(`<script>alert('${String(product.name).replace(/'/g, "\'")} এর স্টক/সর্বোচ্চ অর্ডার সীমা পরিবর্তিত হয়েছে। কার্ট আপডেট করে আবার চেষ্টা করুন।'); window.location.href='/cart';</script>`);
  const validImages = [product.mainImage, ...((product.additionalImages || []).filter(Boolean))].map(x => String(x));
  const safeImage = validImages.includes(String(cartItem.mainImage || '')) ? String(cartItem.mainImage) : String(product.mainImage || '');
  liveItems.push({ productId:String(product._id), productName:product.name, price:Number(product.price)||0, deliveryCharge:Number(product.deliveryCharge)||150, mainImage:safeImage, quantity:qty, maxOrderLimit:maxLimit, ownerId:String(product.ownerId||'') });
}
cart = liveItems;
let dCharge = cart.length ? Math.max(...cart.map(item => item.deliveryCharge || 150)) : 150;
let productPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
let sellerIds = [...new Set(cart.map(item => String(item.ownerId || '')).filter(Boolean))];
let discount = Math.max(0, Number(discountPrice) || 0);
if (discount > productPrice + dCharge) discount = productPrice + dCharge;
let totalAmount = (productPrice + dCharge) - discount;
await User.findByIdAndUpdate(req.user._id, { name, phone, address });
const decremented = [];
try {
  for (const item of cart) {
    const stockUpdate = await Product.updateOne({ _id: item.productId, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity, soldCount: item.quantity } });
    if (!stockUpdate || stockUpdate.modifiedCount !== 1) {
      throw new Error('STOCK_CHANGED');
    }
    decremented.push({ productId: item.productId, quantity: item.quantity });
  }
  await new Order({
  userEmail: req.user.email,
  userName: name || '',
  userPhone: phone || '',
  userAddress: address || '',
  items: cart,
  sellerIds,
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
} catch (orderErr) {
  for (const item of decremented) {
    await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity, soldCount: -item.quantity } });
  }
  if (orderErr && orderErr.message === 'STOCK_CHANGED') {
    return res.send(`<script>alert('কার্টের একটি পণ্যের স্টক পরিবর্তিত হয়েছে। কার্ট আপডেট করে আবার চেষ্টা করুন।'); window.location.href='/cart';</script>`);
  }
  throw orderErr;
}
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
const buyNowValidImages = [product.mainImage, ...((product.additionalImages || []).filter(Boolean))].map(x => String(x));
if (!buyNowValidImages.includes(String(selectedImage))) selectedImage = String(product.mainImage || '');
let maxLimit = Math.min(Number(product.maxOrderLimit || 5), Math.max(0, Number(product.stock) || 0));
if (qty > maxLimit) qty = maxLimit;
if (qty < 1) qty = 1;
let deliveryCharge = product.deliveryCharge || 150;
let sellerOwnerId = String(product.ownerId || '');
let siteSetting = (sellerOwnerId ? await SiteSetting.findOne({ ownerId: sellerOwnerId }) : null) || await SiteSetting.findOne() || { bkashNumber: '01700000000',
nagadNumber: '01800000000' };
let codOptionHTML = req.user.isBlocked ?
`<p style="color:red; font-size:12px;"><b>Note:</b> Cash on Delivery is disabled.</p>` :
`<option value="COD">Cash on Delivery</option>`;
let advanceWarning = req.user.isBlocked ?
`<div style="background:#fff3cd; padding:10px; border-radius:4px; margin-bottom:10px; color:#856404; font-size:13px;">⚠️<b>Notice:</b> Please pay via bKash/Nagad.</div>` : '';
let totalPriceWithoutDelivery = product.price * qty;
res.send(` <!DOCTYPE html> <html> <head><title>Checkout</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container" style="max-width:600px; background:white; padding:20px; border-radius:6px;"> <h3 style="margin-top:0;">Checkout Order</h3> ${advanceWarning} <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;"> <img src="${mediaUrl(selectedImage)}" width="60" height="60" style="object-fit:cover; border-radius:4px; border:1px solid #f85606; cursor:pointer;" onclick="openImageModal(this.src)"> <div> <p style="font-size:14px; margin:0; font-weight:bold;">${product.name}</p> <p style="font-size:14px; margin:4px 0 0 0; color:#f85606;">Price: ৳${product.price} × ${qty} = ৳${totalPriceWithoutDelivery}</p> <p style="font-size:12px; color:#666; margin:2px 0 0 0;">ডেলিভারি চার্জ : ৳${deliveryCharge}</p> </div> </div> <form action="/api/place-order" method="POST" onsubmit="return validateAndPrepareOrder()"> <input type="hidden" name="productId" value="${product._id}"> <input type="hidden" name="productName" value="${product.name}"> <input type="hidden" name="mainImage" value="${selectedImage}"> <input type="hidden" name="price" value="${product.price}"> <input type="hidden" name="quantity" value="${qty}"> <input type="hidden" name="deliveryCharge" value="${deliveryCharge}"> <input type="hidden" name="discountPrice" id="discountPriceInput" value="0"> <input type="hidden" name="address" id="fullAddressInput"> <label style="font-size:13px; font-weight:600;">Full Name:</label><br> <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px; font-weight:600;">Phone Number (বাধ্যতামূলক):</label><br> <input type="text" id="inputPhone" name="phone" value="${req.user.phone || ''}" placeholder="যেমন: 017XXXXXXXX" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <!-- জেলা, থানা ও গ্রাম ইনপুট ঘর (বাধ্যতামূলক) --> <div style="background:#fdfdfd; padding:12px; border:1px solid #e0e0e0; border-radius:6px; margin-bottom:10px;"> <label style="font-size:13px; font-weight:600; color:#f85606;">জেলা (District) *:</label><br> <input type="text" id="inputDistrict" placeholder="" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px; font-weight:600; color:#f85606;">থানা (Thana / Upazila) *:</label><br> <input type="text" id="inputThana" placeholder="" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px; font-weight:600; color:#f85606;">মেইন এড্রেস (গ্রাম / রোড / বাসা নং) *:</label><br> <textarea id="inputVillage" placeholder="" style="width:100%; height:50px; padding:8px; margin:3px 0 5px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required></textarea> </div> <label style="font-size:13px; font-weight:600;">Coupon Code:</label><br> <div style="display:flex; gap:5px; margin:4px 0 10px 0;"> <input type="text" name="couponCode" id="couponCodeInput" placeholder="Enter Coupon Code" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:13px;"> <button type="button" onclick="applyCoupon()" class="btn" style="padding:8px 12px; font-size:12px;">Apply</button> </div> <p id="couponMsg" style="font-size:12px; margin:0 0 10px 0; color:green;"></p> <label style="font-size:13px; font-weight:600;">Customer Note:</label><br> <input type="text" name="customerNote" placeholder="" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;"><br> <div style="background:#f0f8ff; padding:12px; border-radius:4px; margin-bottom:12px; font-size:14px; border:1px solid #bce8f1;"> <p style="margin:2px 0;">Product Price: ৳<span id="productPriceText">${totalPriceWithoutDelivery}</span></p> <p style="margin:2px 0;">Delivery Charge: ৳<span id="deliveryChargeText">${deliveryCharge}</span></p> <p style="margin:2px 0; color:red; display:none;" id="discountRow">Discount: -৳<span id="discountText">0</span></p> <hr style="border:0; border-top:1px solid #ccc; margin:6px 0;"> <p style="margin:2px 0; font-weight:bold; color:#f85606; font-size:16px;">Total Payable Amount: ৳<span id="totalAmountText">${totalPriceWithoutDelivery + deliveryCharge}</span></p> </div> <label style="font-size:13px; font-weight:600;">Payment Method:</label><br> <select name="paymentMethod" id="paymentMethod" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" onchange="togglePaymentFields()" required> ${codOptionHTML} <option value="bKash">বিকাশ (বিকাশ পার্সোনাল পেমেন্ট)</option> <option value="Nagad">নগদ (নগদ পার্সোনাল পেমেন্ট)</option> </select><br> <div id="onlinePaymentDiv" style="display:${req.user.isBlocked ? 'block' : 'none'}; background:#f9f9f9; padding:12px; border-radius:4px; margin-bottom:10px; border:1px dashed #f85606;"> <p style="font-size:13px; color:#333; margin:0 0 6px 0;">বিকাশ: <b style="color:#f85606;">${siteSetting.bkashNumber}</b> | নগদ: <b style="color:#f85606;">${siteSetting.nagadNumber}</b></p> <label style="font-size:12px; font-weight:600;">আপনার বিকাশ/নগদ নাম্বার:</label><br> <input type="text" name="senderNumber" id="senderNumber" placeholder="যেমন: 01XXXXXXXXX" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br> <label style="font-size:12px; font-weight:600;">প্রেরিত টাকার পরিমাণ:</label><br> <input type="number" name="paidAmount" id="paidAmount" placeholder="যেমন: মোট টাকা" style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"><br> <label style="font-size:12px; font-weight:600;">ট্রানজেকশন আইডি (TrxID):</label><br> <input type="text" name="trxId" placeholder="যেমন: 9N7A6..." style="width:100%; padding:8px; margin:3px 0 8px 0; border:1px solid #ccc; border-radius:4px; font-size:13px;"> </div> <button type="submit" class="btn btn-buy" style="width:100%; padding:12px; font-size:16px; margin-top:5px;">⚡Order Confirm করুন</button> </form> </div> <script> let appliedDiscount = 0; let currentDeliveryCharge = ${deliveryCharge}; function validateAndPrepareOrder() { let phone = document.getElementById('inputPhone').value.trim(); let dist = document.getElementById('inputDistrict').value.trim(); let thana = document.getElementById('inputThana').value.trim(); let village = document.getElementById('inputVillage').value.trim(); if(!phone) { alert('দয়া করে আপনার ফোন নম্বর প্রদান করুন!'); return false; } if(!dist || !thana || !village) { alert('ডেলিভারির জন্য জেলা, থানা এবং সম্পূর্ণ ঠিকানা বাধ্যতামূলক!'); return false; } let fullAddr = "জেলা: " + dist + ", থানা: " + thana + ", ঠিকানা: " + village; document.getElementById('fullAddressInput').value = fullAddr; return true; } async function applyCoupon() { let code = document.getElementById('couponCodeInput').value; let msg = document.getElementById('couponMsg'); if(!code) return; try { let res = await fetch('/api/verify-coupon', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code}) }); let data = await res.json(); if(data.success) { appliedDiscount = data.discountAmount; document.getElementById('discountPriceInput').value = appliedDiscount; document.getElementById('discountText').innerText = appliedDiscount; document.getElementById('discountRow').style.display = 'block'; msg.style.color = 'green'; msg.innerText = 'Coupon applied successfully!'; calculateTotal(); } else { msg.style.color = 'red'; msg.innerText = data.message; } } catch(e) { msg.style.color = 'red'; msg.innerText = 'Invalid coupon request.'; } } function calculateTotal() { let productPrice = Number(document.getElementById('productPriceText').innerText); let total = (productPrice + currentDeliveryCharge) - appliedDiscount; if(total < 0) total = 0; document.getElementById('totalAmountText').innerText = total; } function togglePaymentFields() { let method = document.getElementById('paymentMethod').value; let div = document.getElementById('onlinePaymentDiv'); let senderInput = document.getElementById('senderNumber'); let amountInput = document.getElementById('paidAmount'); if (method === 'bKash' || method === 'Nagad') { div.style.display = 'block'; senderInput.setAttribute('required', 'true'); amountInput.setAttribute('required', 'true'); } else { div.style.display = 'none'; senderInput.removeAttribute('required'); amountInput.removeAttribute('required'); } } </script> </body> </html> `);
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
const { productId, productName, mainImage, price, quantity, name, phone, address,
discountPrice, customerNote, paymentMethod, senderNumber, paidAmount, trxId,
deliveryCharge } = req.body;
if(!phone || !address) {
return res.send(`<script>alert('ফোন নম্বর এবং ঠিকানা বাধ্যতামূলক!'); window.history.back();</script>`);
}
if (req.user.isBlocked && paymentMethod === 'COD') {
return res.send(`<script>alert('COD is disabled.'); window.history.back();</script>`);
}
if ((paymentMethod === 'bKash' || paymentMethod === 'Nagad') && (!senderNumber ||
!paidAmount)) {
return res.send(`<script>alert('বিকাশ বা নগদ সিলেক্ট করলে তথ্য দিতে হবে!'); window.history.back();</script>`);
}
let qty = Math.floor(Number(quantity) || 1);
if (qty < 1) qty = 1;
let productRecord = await Product.findById(productId);
if (!productRecord) return res.send(`<script>alert('Product not found!'); window.history.back();</script>`);
let maxLimit = Math.min(Number(productRecord.maxOrderLimit || 5), Math.max(0, Number(productRecord.stock) || 0));
if (qty > maxLimit) return res.send(`<script>alert('এই পণ্যের সর্বোচ্চ ক্রয়ের সীমা/স্টক অনুযায়ী ${maxLimit} টি পর্যন্ত অর্ডার করা যাবে।'); window.history.back();</script>`);
const validImages = [productRecord.mainImage, ...((productRecord.additionalImages || []).filter(Boolean))].map(x => String(x));
const safeMainImage = validImages.includes(String(mainImage || '')) ? String(mainImage) : String(productRecord.mainImage || '');
const unitPrice = Number(productRecord.price) || 0;
const dCharge = Number(productRecord.deliveryCharge) || 150;
const productPrice = unitPrice * qty;
let discount = Math.max(0, Number(discountPrice) || 0);
if (discount > productPrice + dCharge) discount = productPrice + dCharge;
let totalAmount = (productPrice + dCharge) - discount;
await User.findByIdAndUpdate(req.user._id, { name, phone, address });
const stockUpdate = await Product.updateOne({ _id: productId, stock: { $gte: qty } }, { $inc: { stock: -qty, soldCount: qty } });
if (!stockUpdate || stockUpdate.modifiedCount !== 1) {
  return res.send(`<script>alert('স্টক পরিবর্তন হয়েছে। আবার চেষ্টা করুন।'); window.location.href='/product/${productId}';</script>`);
}
let orderedItemObj = {
productId,
productName: productRecord.name,
mainImage: safeMainImage,
price: unitPrice,
quantity: qty,
ownerId: String(productRecord.ownerId || '')
};
try {
  await new Order({
  userEmail: req.user.email,
  userName: name || '',
  userPhone: phone || '',
  userAddress: address || '',
  items: [orderedItemObj],
  sellerIds: [String(productRecord.ownerId || '')].filter(Boolean),
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
} catch (saveErr) {
  await Product.updateOne({ _id: productId }, { $inc: { stock: qty, soldCount: -qty } });
  throw saveErr;
}
res.send(`<script>alert('Order placed successfully!'); window.location.href='/my-orders';</script>`);
} catch (err) {
next(err);
}
});

// ================= Customer Product Request / Seller Broadcast System =================
app.post('/api/product-request', upload.single('requestImage'), async (req,res,next) => {
  try {
    if (!req.user) return res.redirect('/login');
    if (!dbReady()) return res.status(503).send(`<script>alert('Database এখনো সংযুক্ত হয়নি।');window.history.back();</script>`);
    const productName = safeText(req.body.productName, 200);
    const details = safeText(req.body.details, 3000);
    const userName = safeText(req.body.name, 120);
    const userPhone = safeText(req.body.phone, 40);
    const userAddress = safeText(req.body.address, 1000);
    if (!productName || !userName || !userPhone || !userAddress) return res.send(`<script>alert('পণ্যের নাম, নাম, ফোন এবং ঠিকানা পূরণ করুন।');window.history.back();</script>`);
    let requestImage = '';
    if (req.file) {
      requestImage = await uploadBufferToCloudinary(req.file,'oneline-shop/product-requests');
      if (!requestImage) {
        const safeName = String(req.file.originalname || 'request-image').replace(/[^a-zA-Z0-9._-]/g,'_');
        requestImage = `${Date.now()}-request-${safeName}`;
        fs.writeFileSync(path.join(uploadDir, requestImage), req.file.buffer);
      }
    }
    await new ProductRequest({ userId:String(req.user._id || ''), userEmail:normalizeEmail(req.user.email), userName, userPhone, userAddress, productName, details, requestImage }).save();
    await User.findByIdAndUpdate(req.user._id,{name:userName,phone:userPhone,address:userAddress});
    res.send(`<script>alert('আপনার পণ্যের অনুরোধ Main Admin-এর কাছে পাঠানো হয়েছে।');window.location.href='/dashboard';</script>`);
  } catch(e){ next(e); }
});

app.get('/api/product-requests', async (req,res,next) => {
  try {
    if (!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.status(403).json({error:'Unauthorized'});
    const filter = isMainAdmin(req.user) ? {} : { targetSubAdminIds:String(req.user._id) };
    const rows = await ProductRequest.find(filter).sort({_id:-1}).limit(200).lean();
    res.json(rows.map(r=>({...r,requestImage:mediaUrl(r.requestImage)})));
  } catch(e){ next(e); }
});

// ================= User Authentication & Dashboard =================
app.get('/login', (req, res) => {
let redirectUrl = req.query.redirect || '/';
res.send(` <!DOCTYPE html> <html> <head><title>Login</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container" style="max-width:350px; background:white; padding:20px; border-radius:6px; margin-top:30px; box-shadow:0 2px 5px rgba(0,0,0,0.1);"> <h3 style="margin-top:0;">Login</h3> <form action="/api/login" method="POST"> <input type="hidden" name="redirect" value="${redirectUrl}"> <label style="font-size:13px; font-weight:600;">Email:</label><br> <input type="email" name="email" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px; font-weight:600;">Password:</label><br><div style="position:relative;"><input id="loginPassword" type="password" name="password" style="width:100%; padding:10px 42px 10px 10px; margin:4px 0 15px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><button type="button" onclick="toggleLoginPassword()" aria-label="Show password" style="position:absolute;right:6px;top:6px;border:0;background:transparent;font-size:20px;cursor:pointer;">👁️</button></div> <button type="submit" class="btn" style="width:100%; padding:10px;">Login</button> </form><div style="margin-top:12px;padding:10px;background:#fff8e1;border:1px solid #ffe08a;border-radius:7px;font-size:12px;"><b>🔑 Password ভুলে গেছেন?</b><br><a href="/login-help" style="color:#007bff;">Admin Help-এ Password Reset Request পাঠান</a></div><p style="font-size:13px; text-align:center; margin-top:15px;">New user? <a href="/register?redirect=${encodeURIComponent(redirectUrl)}">Register here</a></p><script>function toggleLoginPassword(){const x=document.getElementById('loginPassword');if(x)x.type=x.type==='password'?'text':'password';}</script> </div> </body> </html> `);
});
app.get('/login-help', (req,res)=>{
  res.send(`<!DOCTYPE html><html><head><title>Password Help</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container" style="max-width:520px;background:#fff;padding:20px;border-radius:8px;margin-top:25px;"><h2 style="margin-top:0;">🔑 Password Help</h2><p style="font-size:13px;color:#666;">আপনার account-এর password ভুলে গেলে Main Admin-এর কাছে reset request পাঠান। নিরাপত্তার জন্য পুরোনো password কখনো দেখানো বা সংরক্ষণ করা হবে না।</p><form action="/api/login-help" method="POST"><label>Email *</label><input type="email" name="email" required style="width:100%;padding:9px;margin:4px 0 10px"><label>WhatsApp / Phone *</label><input type="text" name="contact" required style="width:100%;padding:9px;margin:4px 0 10px"><label>Message *</label><textarea name="message" required placeholder="আমি password ভুলে গেছি। আমার account যাচাই করে নতুন password reset করে দিন।" style="width:100%;height:90px;padding:9px;margin:4px 0 10px"></textarea><button class="btn" type="submit" style="width:100%;">📨 Send Help Request</button></form></div></body></html>`);
});
app.post('/api/login-help', async(req,res,next)=>{try{
  if(!dbReady()) return res.status(503).send(`<script>alert('Database এখনো সংযুক্ত হয়নি।');window.location.href='/login-help';</script>`);
  const email=normalizeEmail(req.body.email); const contact=safeText(req.body.contact,200); const message=safeText(req.body.message,1500);
  if(!email||!contact||!message) return res.send(`<script>alert('সব তথ্য পূরণ করুন।');window.history.back();</script>`);
  const user=await User.findOne({email});
  if(!user) return res.send(`<script>alert('এই Email-এর কোনো account পাওয়া যায়নি।');window.history.back();</script>`);
  await new SubAdminSupport({subAdminId:String(user._id),subAdminEmail:email,message:`Contact: ${contact}\n${message}`,requestType:'login_password_reset',resetStatus:'pending'}).save();
  return res.send(`<script>alert('Password reset request Main Admin-এর কাছে পাঠানো হয়েছে।');window.location.href='/login';</script>`);
}catch(e){next(e);}});
app.post('/api/login', async (req, res, next) => {
try {
if (!dbReady()) return res.status(503).send(`<script>alert('Database এখনো সংযুক্ত হয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।'); window.location.href='/login';</script>`);
const email = normalizeEmail(req.body.email);
const password = String(req.body.password || '');
const redirect = req.body.redirect;
let user = await User.findOne({ email });
if (!user || !(await bcrypt.compare(password, user.password))) {
return res.send(`<script>alert('Invalid email or password!'); window.location.href='/login?redirect=' + encodeURIComponent(${JSON.stringify(redirect || '/')} );</script>`);
}
// A pending/rejected/suspended/expired Sub Admin keeps normal customer access. Only the Seller Admin panel is gated by subAdminIsActive().
res.cookie('userSession', JSON.stringify({ email: user.email, role: user.role }));
let safeRedirect = (typeof redirect === 'string' && redirect.startsWith('/')) ? redirect : '/';
res.redirect(safeRedirect);
} catch (err) {
next(err);
}
});
app.get('/register', (req, res) => {
let redirectUrl = req.query.redirect || '/dashboard';
res.send(` <!DOCTYPE html> <html> <head><title>Register</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container" style="max-width:350px; background:white; padding:20px; border-radius:6px; margin-top:30px; box-shadow:0 2px 5px rgba(0,0,0,0.1);"> <h3 style="margin-top:0;">Register Account</h3> <form action="/api/register" method="POST"> <input type="hidden" name="redirect" value="${redirectUrl}"> <label style="font-size:13px; font-weight:600;">Email:</label><br> <input type="email" name="email" style="width:100%; padding:10px; margin:4px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px; font-weight:600;">Password:</label><br> <input type="password" name="password" style="width:100%; padding:10px; margin:4px 0 15px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <button type="submit" class="btn btn-buy" style="width:100%; padding:10px;">Register</button> </form> <p style="font-size:13px; text-align:center; margin-top:15px;">Already have an account? <a href="/login?redirect=${encodeURIComponent(redirectUrl)}">Login here</a></p> </div> </body> </html> `);
});
// ================= Sub Admin Registration / Approval =================
app.get('/sub-admin/apply', (req, res) => res.redirect('/sub-admin/register'));
app.get('/sub-admin/register', (req, res) => {
const categoryLabels={Fashion:'👗 ফ্যাশন',Supershop:'🛒 সুপার শপ',Pharmacy:'💊 ফার্মেসি',Food:'🍲 খাদ্যপণ্য',Sports:'⚽ স্পোর্টস',Books:'📚 বই',Stationery:'✏️ স্টেশনারি',HomeDecor:'🛋️ হোম ডেকোর ও ফার্নিচার',BeautyCare:'💄 বিউটি কেয়ার',Electric:'⚡ ইলেকট্রিক'};
const categoryHTML=ALL_CATEGORIES.map(c=>`<label style="display:flex;align-items:center;gap:7px;padding:7px 9px;background:#fafafa;border:1px solid #eee;border-radius:7px;cursor:pointer;"><input type="checkbox" name="businessCategories" value="${c}" class="businessCategory"> <span>${categoryLabels[c]||c}</span></label>`).join('');
res.send(`<!DOCTYPE html><html><head><title>Sub Admin Registration</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container" style="max-width:620px;background:#fff;padding:20px;border-radius:8px;"><h2 style="margin-top:0;color:#f85606;">Sub Admin / Seller Registration</h2><p style="font-size:13px;color:#666;">আবেদন পাঠানোর পরে Main Admin অনুমোদন করলে আপনার Seller Admin Panel Active হবে।</p><form action="/sub-admin/register" method="POST"><label>Email *</label><input type="email" name="email" required style="width:100%;padding:9px;margin:4px 0 10px"><label>Password *</label><input type="password" name="password" required minlength="6" style="width:100%;padding:9px;margin:4px 0 10px"><label>নাম *</label><input type="text" name="name" required style="width:100%;padding:9px;margin:4px 0 10px"><label>Phone *</label><input type="text" name="phone" required style="width:100%;padding:9px;margin:4px 0 10px"><label>Shop Name</label><input type="text" name="shopName" style="width:100%;padding:9px;margin:4px 0 10px"><label>Address *</label><textarea name="address" required style="width:100%;height:70px;padding:9px;margin:4px 0 10px"></textarea><label>WhatsApp Number / Link *</label><input type="text" name="whatsapp" required placeholder="017XXXXXXXX অথবা https://wa.me/..." style="width:100%;padding:9px;margin:4px 0 10px"><label style="display:block;font-weight:700;margin:8px 0 6px;">আপনি কোন Category-তে Business করবেন? *</label><label style="display:flex;align-items:center;gap:7px;padding:8px 9px;background:#fff7f2;border:1px solid #ffd7c2;border-radius:7px;cursor:pointer;margin-bottom:7px;"><input type="checkbox" id="businessAll"> <b>🔥 All — সব Category</b></label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px;">${categoryHTML}</div><small style="display:block;color:#777;margin:7px 0 12px;">একাধিক Category নির্বাচন করতে পারবেন। All নির্বাচন করলে সব বর্তমান Category নির্বাচন হবে।</small><label>Business Information</label><textarea name="businessInfo" style="width:100%;height:70px;padding:9px;margin:4px 0 10px"></textarea><button class="btn" type="submit" style="width:100%;padding:11px">Submit Application</button></form></div><script>const all=document.getElementById('businessAll');const cats=[...document.querySelectorAll('.businessCategory')];all.addEventListener('change',()=>cats.forEach(c=>c.checked=all.checked));cats.forEach(c=>c.addEventListener('change',()=>{all.checked=cats.length>0&&cats.every(x=>x.checked)}));document.querySelector('form').addEventListener('submit',e=>{if(!cats.some(c=>c.checked)){e.preventDefault();alert('কমপক্ষে একটি Business Category নির্বাচন করুন।');}});</script></body></html>`);
});
app.post('/sub-admin/register', async (req, res, next) => {
try {
if (!dbReady()) return res.status(503).send(`<script>alert('Database এখনো সংযুক্ত হয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।'); window.location.href='/sub-admin/register';</script>`);
const { email, password, name, phone, shopName, address, whatsapp, businessInfo } = req.body;
const selectedCategories=Array.isArray(req.body.businessCategories)?req.body.businessCategories:[req.body.businessCategories].filter(Boolean);
const validCategories=selectedCategories.filter(c=>ALL_CATEGORIES.includes(String(c)));
if (!isValidWhatsAppContact(whatsapp)) return res.send(`<script>alert('সঠিক WhatsApp Number / wa.me Link বাধ্যতামূলক।'); window.history.back();</script>`);
if (!String(address||'').trim()) return res.send(`<script>alert('ঠিকানা বাধ্যতামূলক।'); window.history.back();</script>`);
if (!validCategories.length) return res.send(`<script>alert('কমপক্ষে একটি Business Category নির্বাচন করুন।'); window.history.back();</script>`);
let existing = await User.findOne({ email: normalizeEmail(email) });
if (existing && ['admin','subadmin'].includes(existing.role)) return res.send(`<script>alert('এই Email দিয়ে ইতিমধ্যে Admin/Sub Admin account আছে।'); window.location.href='/sub-admin/register';</script>`);
if (existing && existing.role === 'user') {
  // Existing normal customers can apply without creating a second account.
  // Keep their existing password; only update application/profile fields.
  existing.name = name || existing.name || '';
  existing.phone = phone || existing.phone || '';
  existing.address = address || existing.address || '';
  existing.subAdminStatus = 'pending';
  existing.activationPlan = 'paid';
  existing.subAdminShopName = shopName || existing.subAdminShopName || '';
  existing.subAdminWhatsApp = whatsapp || existing.subAdminWhatsApp || '';
  existing.subAdminBusinessInfo = businessInfo || existing.subAdminBusinessInfo || '';
  existing.subAdminBusinessCategories = validCategories;
  existing.role = 'subadmin';
  existing.approvedBy = '';
  existing.approvedAt = null;
  existing.activationExpiresAt = null;
  existing.unlimitedFree = false;
  await existing.save();
  return res.send(`<script>alert('আপনার বর্তমান User account-টিকেই Sub Admin আবেদন হিসেবে Main Admin-এর কাছে পাঠানো হয়েছে।'); window.location.href='/login';</script>`);
}
const hashedPassword = await bcrypt.hash(password, 10);
await new User({ email: normalizeEmail(email), password: hashedPassword, role:'subadmin', name, phone, address, subAdminStatus:'pending', activationPlan:'paid', subAdminShopName:shopName || '', subAdminWhatsApp:whatsapp || '', subAdminBusinessInfo:businessInfo || '', subAdminBusinessCategories:validCategories }).save();
res.send(`<script>alert('আপনার Sub Admin আবেদন Main Admin-এর কাছে পাঠানো হয়েছে। অনুমোদনের পরে Login করতে পারবেন।'); window.location.href='/login';</script>`);
} catch (err) { next(err); }
});

app.post('/api/register', async (req, res, next) => {
try {
if (!dbReady()) return res.status(503).send(`<script>alert('Database এখনো সংযুক্ত হয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।'); window.location.href='/register';</script>`);
const email = normalizeEmail(req.body.email);
const password = String(req.body.password || '');
const redirect = req.body.redirect;
if (!email || password.length < 6) return res.send(`<script>alert('সঠিক Email এবং কমপক্ষে ৬ অক্ষরের Password দিন।'); window.history.back();</script>`);
let existing = await User.findOne({ email });
if (existing) return res.send(`<script>alert('Email already exists!'); window.location.href='/register?redirect=' + encodeURIComponent(${JSON.stringify(redirect || '/dashboard')} );</script>`);
let role = (email === 'admin@onlineshop.com') ? 'admin' : 'user';
let hashedPassword = await bcrypt.hash(password, 10);
let newUser = new User({ email, password: hashedPassword, role });
await newUser.save();
res.cookie('userSession', JSON.stringify({ email: newUser.email, role: newUser.role }));
let safeRedirect = (typeof redirect === 'string' && redirect.startsWith('/')) ? redirect : '/dashboard';
res.redirect(safeRedirect);
} catch (err) {
next(err);
}
});
app.post('/api/delete-account', async (req, res) => {
  if (!req.user) return res.status(401).send('Login required');
  if (isMainAdmin(req.user)) return res.status(403).send('Main Admin account cannot be deleted from this panel.');
  if (isSubAdmin(req.user)) return res.status(403).send('Sub Admin account deletion requires Main Admin approval.');
  return res.status(403).send('Account deletion is disabled from this panel.');
});

app.get('/logout', (req, res) => {
res.clearCookie('userSession');
res.redirect('/');
});
app.get('/dashboard', async (req, res, next) => {
try {
if (!req.user) return res.redirect('/login');
let orders = await Order.find({ userEmail: req.user.email });
let ordersHTML = orders.map(o =>
`<tr><td>${o._id}</td><td>৳${o.totalAmount}</td><td>${o.paymentMethod}</td><td>${o.status} </td></tr>`).join('');
let blockStatusNotice = req.user.isBlocked ? `<p style="color:red; font-weight:bold; font-size:13px;">Account Status: Cash on Delivery Restricted</p>` : `<p style="color:green; font-weight:bold; font-size:13px;">Account Status: Good Standing</p>`;
let subAdminSupportHTML='';
if(isSubAdmin(req.user)){ const tickets=await SubAdminSupport.find({subAdminId:String(req.user._id)}).sort({_id:-1}).limit(30).lean(); subAdminSupportHTML=`<div style="margin-top:18px;background:#eef7ff;border:1px solid #cfe5ff;border-radius:12px;padding:14px;"><h4 style="margin:0 0 8px 0;">🆘 Main Admin Help Center</h4><p style="font-size:12px;color:#666;margin:0 0 10px;">Account বন্ধ/সাসপেন্ড/মেয়াদ শেষ হলেও এখান থেকে Main Admin-কে message পাঠাতে পারবেন।</p><form action="/sub-admin/support" method="POST"><textarea name="message" required placeholder="Main Admin-এর কাছে সাহায্যের কথা লিখুন..." style="width:100%;height:65px;padding:8px;border:1px solid #ccc;border-radius:6px;"></textarea><input type="text" name="requestedWhatsApp" placeholder="নতুন WhatsApp (ঐচ্ছিক)" style="width:100%;padding:8px;margin-top:6px;border:1px solid #ccc;border-radius:6px;"><button class="btn" style="margin-top:7px;padding:7px 12px;">📨 Send to Main Admin</button></form><div style="margin-top:12px;">${tickets.length?tickets.map(t=>`<div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:9px;margin-top:7px;"><b>আপনার:</b> ${t.message}<br>${t.reply?`<div style="margin-top:6px;color:#087f23;"><b>Main Admin:</b> ${t.reply}</div>`:'<span style="color:#999;font-size:12px;">Reply pending...</span>'}</div>`).join(''):'<div style="color:#777;font-size:12px;">এখনও কোনো support message নেই।</div>'}</div></div>`; }
res.send(` <!DOCTYPE html> <html> <head><title>User Dashboard</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container" style="background:white; padding:20px; border-radius:6px;"> <h3 style="margin-top:0;">My Account Dashboard</h3> <p style="font-size:14px;"><b>Email:</b> ${req.user.email}</p> ${blockStatusNotice} <form action="/api/update-profile" method="POST" style="max-width:400px; margin-top:20px;"> <h4 style="margin-bottom:10px;">Update Profile Info</h4> <label style="font-size:13px;">Name:</label><br> <input type="text" name="name" value="${req.user.name || ''}" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px;">Phone:</label><br> <input type="text" name="phone" value="${req.user.phone || ''}" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required><br> <label style="font-size:13px;">Address:</label><br> <textarea name="address" style="width:100%; height:60px; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px; font-size:14px;" required>${req.user.address || ''}</textarea><br> <button type="submit" class="btn" style="padding:8px 16px;">Save Profile</button> </form><div style="margin-top:18px;background:linear-gradient(135deg,#fff7f0,#fff);border:1px solid #ffd7bd;border-radius:12px;padding:14px;"><div style="font-weight:700;font-size:15px;">🏪 নিজের ব্যবসা চালাতে চান?</div><p style="font-size:12px;color:#666;margin:6px 0 10px;">Sub Admin / Seller হিসেবে নিজের দোকান ও Product Management চালানোর জন্য আবেদন করুন। Main Admin অনুমোদন করলে আপনার Seller Admin Panel চালু হবে।</p>${req.user.role==='subadmin' ? `<div style="font-size:12px;color:#087f23;">আপনার Sub Admin Status: <b>${req.user.subAdminStatus}</b></div>` : `<a href="/sub-admin/apply" class="btn" style="padding:8px 12px;">➕ Sub Admin হওয়ার আবেদন করুন</a>`}</div>${subAdminSupportHTML}<a href="/messages" class="btn" style="margin-top:10px;background:#17a2b8;">💬 My Messages</a> <hr style="margin:25px 0; border:0; border-top:1px solid #eee;"> <h4 style="margin-bottom:10px;">My Orders History</h4> <div style="overflow-x:auto;"> <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin-top:5px; font-size:13px;"> <tr><th>Order ID</th><th>Total</th><th>Payment</th><th>Status</th></tr> ${ordersHTML.length ? ordersHTML : '<tr><td colspan="4" style="text-align:center;">No orders placed yet.</td></tr>'} </table> </div> 
<hr style="margin:25px 0;border:0;border-top:1px solid #eee;">
<div style="background:#fff8f2;border:1px solid #ffd2b8;border-radius:12px;padding:15px;margin-bottom:15px;">
<h4 style="margin:0 0 6px 0;">🔎 পণ্য খুঁজে পাচ্ছেন না?</h4>
<p style="font-size:12px;color:#666;margin:0 0 10px 0;">আপনি কী পণ্য খুঁজছেন তা Main Admin-এর কাছে পাঠান। চাইলে পণ্যের ছবি, নাম, ফোন ও ঠিকানাও দিতে পারবেন।</p>
<form action="/api/product-request" method="POST" enctype="multipart/form-data">
<input type="text" name="productName" placeholder="আপনি যে পণ্যটি খুঁজছেন" required style="width:100%;padding:9px;margin:4px 0;border:1px solid #ccc;border-radius:6px;">
<textarea name="details" placeholder="পণ্য সম্পর্কে অতিরিক্ত তথ্য..." style="width:100%;height:70px;padding:9px;margin:4px 0;border:1px solid #ccc;border-radius:6px;"></textarea>
<input type="text" name="name" value="${req.user.name || ''}" placeholder="আপনার নাম" required style="width:100%;padding:9px;margin:4px 0;border:1px solid #ccc;border-radius:6px;">
<input type="text" name="phone" value="${req.user.phone || ''}" placeholder="ফোন নম্বর" required style="width:100%;padding:9px;margin:4px 0;border:1px solid #ccc;border-radius:6px;">
<textarea name="address" placeholder="ঠিকানা" required style="width:100%;height:60px;padding:9px;margin:4px 0;border:1px solid #ccc;border-radius:6px;">${req.user.address || ''}</textarea>
<input type="file" name="requestImage" accept="image/*" style="margin:6px 0;">
<button class="btn" style="margin-top:6px;">📨 Admin-কে পাঠান</button>
</form></div>
<br><a href="/logout" class="btn" style="background:#d9534f; padding:8px 16px;">Logout</a> </div> </body> </html> `);
} catch (err) {
next(err);
}
});
app.post('/api/update-profile', async (req, res, next) => {
try {
if (!req.user) return res.redirect('/login');
if (!dbReady()) return res.status(503).send(`<script>alert('Database সংযোগ পাওয়া যাচ্ছে না।'); window.history.back();</script>`);
const name = safeText(req.body.name, 120);
const phone = safeText(req.body.phone, 40);
const address = safeText(req.body.address, 1000);
if (!name || !phone || !address) return res.send(`<script>alert('নাম, ফোন এবং ঠিকানা পূরণ করুন।'); window.history.back();</script>`);
await User.findByIdAndUpdate(req.user._id, { name, phone, address }, { runValidators: true });
res.redirect('/dashboard');
} catch (err) {
next(err);
}
});
app.get('/my-orders', async (req, res, next) => {
try {
if (!req.user) return res.redirect('/login');
let orders = await Order.find({ userEmail: req.user.email }).sort({ _id: -1 });
let ordersHTML = orders.map(o => `
<div style="background:#fff; padding:10px; margin-bottom:10px; border-radius:6px; border:1px solid #ddd; font-size:13px;">
<p style="margin:0 0 4px 0;"><b>Order ID:</b> ${o._id} | <b>Status:</b> <span style="color:#f85606;">${o.status}</span></p>
<p style="margin:0 0 4px 0;"><b>Customer:</b> ${o.userName} (${o.userPhone}) - ${o.userAddress}</p>
<p style="margin:0 0 4px 0; color:#007bff;"><b>Payment Info:</b> Method: <b>${o.paymentMethod}</b> ${o.paymentMethod !== 'COD' ? `| TrxID: <b>${o.paymentTrx || 'N/A'}</b>` : ''}</p>
<p style="margin:0 0 6px 0;"><b>Total Amount:</b> ৳${o.totalAmount}</p>
<div style="display:flex; gap:8px; flex-wrap:wrap; margin:6px 0 8px 0;">
${(o.items || []).map(item => {
  const img = item.mainImage ? mediaUrl(item.mainImage) : '';
  return `<div style="display:flex; align-items:center; gap:6px; background:#f8f8f8; border:1px solid #eee; border-radius:5px; padding:5px;">
    ${img ? `<img src="${img}" width="55" height="55" style="object-fit:cover; border-radius:4px; cursor:pointer;" onclick="openImageModal('${img}')">` : ''}
    <div><b>${item.productName || item.name || 'Product'}</b><br><span>৳${item.price || 0} × ${item.quantity || 1}</span></div>
  </div>`;
}).join('')}
</div>
<div style="margin-top:8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
<span style="font-size:12px; color:#555;"><b>Order Status:</b> ${o.status}</span>
${o.status === 'Pending' ? `<form action="/api/cancel-order/${o._id}" method="POST" style="margin:0;" onsubmit="return confirm('আপনি কি এই অর্ডারটি বাতিল করতে চান?');"><button type="submit" class="btn" style="background:#dc3545; padding:6px 10px; font-size:12px;">✕ Cancel Order</button></form>` : `<span style="font-size:12px; color:#888;">শিপিং/প্রসেস শুরু হয়ে গেলে অর্ডার ক্যানসেল করা যাবে না।</span>`}
</div>
</div>`).join('');
res.send(` <!DOCTYPE html> <html> <head><title>My Orders</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container" style="max-width:700px; background:white; padding:20px; border-radius:6px;"> <h3 style="margin-top:0;">📦My Orders</h3> <div>${ordersHTML.length ? ordersHTML : '<p style="color:#777;">No orders found.</p>'}</div> </div> </body> </html> `);
} catch (err) {
next(err);
}
});
app.post('/api/cancel-order/:id', async (req, res, next) => {
try {
if (!req.user) return res.redirect('/login');
let order = await Order.findById(req.params.id);
if (!order || order.userEmail !== req.user.email) return res.status(403).send('Unauthorized: Main Admin access required');
if (order.status !== 'Pending') return res.send(`<script>alert('এই অর্ডারটি এখন ক্যানসেল করা যাবে না।'); window.location.href='/my-orders';</script>`);
order.previousStatus = order.status;
order.status = 'Cancelled';
await order.save();
res.redirect('/my-orders');
} catch (err) {
next(err);
}
});
app.get('/wishlist', async (req, res, next) => {
try {
  if (!req.user) return res.redirect('/login?redirect=/wishlist');
  const ids = Array.isArray(req.user.wishlist) ? req.user.wishlist : [];
  const products = ids.length ? await Product.find({ _id: { $in: ids } }).lean() : [];
  const cards = products.map(p => `<div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:10px;"><img src="${mediaUrl(p.mainImage)}" style="width:100%;height:170px;object-fit:contain;cursor:pointer" onclick="openImageModal(this.src)"><h4 style="margin:7px 0 4px">${p.name}</h4><div class="price">৳${p.price}</div><a class="btn" href="/product/${p._id}">View Product</a> <form action="/wishlist/toggle/${p._id}" method="POST" style="display:inline"><button class="btn" type="submit" style="background:#777">Remove</button></form></div>`).join('');
  res.send(`<!DOCTYPE html><html><head><title>Wishlist</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container"><h3>❤️ My Wishlist</h3><div class="product-grid">${cards || '<div style="background:#fff;padding:25px;border-radius:8px">আপনার Wishlist এখনো খালি।</div>'}</div></div></body></html>`);
} catch(e){ next(e); }
});
app.post('/wishlist/toggle/:id', async (req,res,next)=>{
try {
  if(!req.user) return res.redirect('/login');
  const product=await Product.findById(req.params.id).lean(); if(!product) return res.status(404).send('Product not found');
  const ids=Array.isArray(req.user.wishlist)?req.user.wishlist.map(String):[]; const id=String(product._id);
  req.user.wishlist = ids.includes(id) ? ids.filter(x=>x!==id) : [...ids,id]; await req.user.save();
  res.redirect(req.get('Referer') || '/wishlist');
} catch(e){ next(e); }
});
// ================= Seller Product Catalog / Send Product =================
app.get('/admin/sell-products', async (req,res,next)=>{
  try {
    if(!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.redirect('/login');
    const filter=isMainAdmin(req.user)?{}:{ownerId:String(req.user._id)};
    const prods=await Product.find(filter).sort({_id:-1}).lean();
    const users=await User.find({$or:[{role:'user'},{role:'subadmin',subAdminStatus:{$ne:'active'}}]}).select('name email phone address role subAdminStatus').sort({_id:-1}).lean();
    const cards=prods.map(p=>`<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:12px;margin-bottom:12px;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;"><img src="${mediaUrl(p.mainImage)}" width=90 height=90 style="object-fit:cover;border-radius:8px;cursor:pointer" onclick="openImageModal(this.src)"><div style="flex:1;min-width:230px"><h3 style="margin:0 0 5px">${p.name}</h3><div>৳${p.price} • Stock: ${p.stock} • ${p.category}</div><p style="font-size:12px;color:#666">${p.description||'No description'}</p><a class="btn" href="/product/${p._id}">View Full Product</a><form action="/admin/send-message" method="POST" style="margin-top:8px;display:grid;gap:6px"><input type="hidden" name="productId" value="${p._id}"><div style="border:1px solid #ddd;border-radius:7px;padding:7px;max-height:130px;overflow:auto"><label style="display:block;font-size:12px;font-weight:700"><input type="checkbox" onchange="toggleProductRecipients(this, '${p._id}')"> Select All Customers</label>${users.map(u=>`<label style="display:block;font-size:12px;margin:3px 0"><input type="checkbox" name="userEmails" value="${u.email}" class="prodRecipient-${p._id}"> ${u.name||u.email} — ${u.email}</label>`).join('')}</div><textarea name="message" required placeholder="Customer-কে product সম্পর্কে message লিখুন..." style="min-height:55px"></textarea><button class="btn">📨 Send Product to Customer</button></form></div></div>`).join('');
    res.send(`<!DOCTYPE html><html><head><title>Sell Products</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container" style="max-width:900px"><div style="background:#fff;padding:18px;border-radius:12px"><h2 style="margin-top:0">🛍️ Sell Products</h2><p style="color:#777;font-size:13px">সম্পূর্ণ product details দেখে customer নির্বাচন করে সরাসরি product message পাঠান।</p>${cards||'<div style="padding:30px;text-align:center;color:#777">কোনো product নেই।</div>'}</div></div><script>function toggleProductRecipients(cb,id){document.querySelectorAll('.prodRecipient-'+id).forEach(x=>x.checked=cb.checked);}</script></body></html>`);
  }catch(e){next(e);}
});

// ================= Centralized Admin Action Guard =================
function requireActiveStaff(req, res) {
  if (!req.user) { res.redirect('/login'); return false; }
  if (isMainAdmin(req.user)) return true;
  if (isSubAdmin(req.user) && subAdminIsActive(req.user)) return true;
  res.status(403).send('<div style="font-family:Arial;padding:30px;max-width:700px;margin:auto"><h2>Unauthorized</h2><p>আপনার Seller Admin access বর্তমানে Active নয়। তবে সাধারণ Customer হিসেবে site ব্যবহার করতে পারবেন।</p><a href="/">Home</a></div>');
  return false;
}
// ================= Admin Panel Advanced Features =================
app.get('/admin-dashboard', async (req, res, next) => {
try {
if (!requireActiveStaff(req, res)) return;
// Product-request privacy: once a request is accepted, only Main Admin and the
// accepting Sub Admin may see that request/customer details. Other Sub Admins
// must not receive the accepted request in the dashboard HTML at all.
res.set('Cache-Control','no-store, private, max-age=0');
let dataFilter = isMainAdmin(req.user) ? {} : { ownerId: String(req.user._id) };
let products = await Product.find(dataFilter).sort({ _id: -1 });
let orders = isMainAdmin(req.user) ? await Order.find().sort({ _id: -1 }) : await Order.find({ 'items.ownerId': String(req.user._id) }).sort({ _id: -1 });
let users = await User.find().sort({ _id: -1 });
let chats = isMainAdmin(req.user) ? await Chat.find().sort({ _id: -1 }) : await Chat.find(dataFilter).sort({ _id: -1 });
let coupons = await Coupon.find(dataFilter).sort({ _id: -1 });
let siteSetting = (isMainAdmin(req.user) ? await SiteSetting.findOne() : await SiteSetting.findOne({ ownerId: String(req.user._id) })) || { bkashNumber: '01700000000',
nagadNumber: '01800000000', pageId: '', accessToken: '' };
let categoryOptions = ALL_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
let productRequestRows = isMainAdmin(req.user)
  ? await ProductRequest.find().sort({_id:-1}).limit(50).lean()
  : await ProductRequest.find({
      targetSubAdminIds: String(req.user._id),
      status: 'broadcasted'
    }).sort({_id:-1}).limit(50).lean();
let activeSubAdmins = await User.find({role:'subadmin',subAdminStatus:'active'}).sort({_id:-1}).lean();
// Main Admin business visibility: keep each active seller's operational data inside
// that seller's own box. These metrics are derived from the same Product/Order data
// already used by the Seller Admin dashboard; no seller/customer credentials are exposed.
const activeSubAdminBusiness = await Promise.all(activeSubAdmins.map(async sa => {
  const sellerId = String(sa._id);
  const [sellerProducts, sellerOrders] = await Promise.all([
    Product.find({ownerId:sellerId}).select('price stock soldCount').lean(),
    Order.find({'items.ownerId':sellerId}).select('items userEmail userName userPhone status createdAt').sort({_id:-1}).lean()
  ]);
  let unitsSold = 0, grossSales = 0;
  const customerSet = new Set();
  const statusCounts = {Pending:0, Processing:0, Shipped:0, Delivered:0, Cancelled:0};
  for (const order of sellerOrders) {
    const items = Array.isArray(order.items) ? order.items.filter(it => String(it.ownerId||'') === sellerId) : [];
    if (!items.length) continue;
    if (order.userEmail) customerSet.add(normalizeEmail(order.userEmail));
    const status = String(order.status || 'Pending');
    if (Object.prototype.hasOwnProperty.call(statusCounts,status)) statusCounts[status]++;
    for (const item of items) {
      const qty = Math.max(0, Number(item.quantity)||0);
      const price = Math.max(0, Number(item.price)||0);
      unitsSold += qty;
      grossSales += price * qty;
    }
  }
  const stockUnits = sellerProducts.reduce((n,p)=>n + Math.max(0,Number(p.stock)||0),0);
  const recordedSold = sellerProducts.reduce((n,p)=>n + Math.max(0,Number(p.soldCount)||0),0);
  return { ...sa, _sellerId:sellerId, productCount:sellerProducts.length, stockUnits, unitsSold, recordedSold, grossSales, orderCount:sellerOrders.length, customerCount:customerSet.size, statusCounts };
}));
const activeSubAdminBusinessById = new Map(activeSubAdminBusiness.map(x=>[String(x._id),x]));

let productsHTML = products.map(p => ` <div style="background:#fff; padding:10px; margin-bottom:8px; border-radius:4px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;"> <div style="display:flex; align-items:center; gap:8px;"> <img src="${mediaUrl(p.mainImage)}" width="40" height="40" style="object-fit:cover; border-radius:4px; cursor:pointer;" onclick="openImageModal('${mediaUrl(p.mainImage)}')"> <div> <b style="font-size:13px;">${p.name}</b><br> <span style="font-size:12px; color:#f85606;">৳${p.price} | Stock: ${p.stock}</span><br> <span style="font-size:11px; color:#007bff; background:#eef; padding:1px 4px; border-radius:3px;">ID: ${p._id}</span> </div> </div> <div> <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;"> <input id="productLink-${p._id}" type="text" value="https://oneline-shop.onrender.com/product/${p._id}" readonly style="font-size:12px; padding:7px; width:260px; max-width:100%; border:1px solid #ccc; border-radius:4px; background:#fff;" onclick="this.select()"> <button type="button" class="btn" style="padding:7px 10px; font-size:11px; background:#007bff;" onclick="copyProductLink('${p._id}')">📋 Copy Link</button> <a href="/admin/delete-product/${p._id}" class="btn" style="background:#dc3545; padding:7px 8px; font-size:11px;" onclick="return confirm('এই Product টি ডিলিট করবেন?');">Delete</a> </div> </div> </div> `).join('');
let ordersHTML = orders.map(o => ` <div style="background:#fff; padding:10px; margin-bottom:10px; border-radius:6px; border:1px solid #ddd; font-size:13px;"> <p style="margin:0 0 4px 0;"><b>Order ID:</b> ${o._id} | <b>Status:</b> <span style="color:#f85606;">${o.status}</span></p> <p style="margin:0 0 4px 0;"><b>Customer:</b> ${o.userName} (${o.userPhone}) - ${o.userAddress}</p> <p style="margin:0 0 4px 0; color:#007bff;"><b>Payment Info:</b> Method: <b>${o.paymentMethod}</b> ${o.paymentMethod !== 'COD' ? `| Sender: ${o.senderNumber} | Paid: ৳${o.paidAmount} | TrxID: ${o.trxId}` : ''}</p> <p style="margin:0 0 4px 0;"><b>Total Amount:</b> ৳${o.totalAmount} (Delivery: ৳${o.deliveryCharge})</p> <div style="margin:8px 0; padding:8px; background:#f9f9f9; border-radius:4px; border:1px solid #eee;"> <b style="display:block; margin-bottom:6px;">Products in this order:</b> ${(o.items || []).map(item => ` <div style="display:flex; align-items:center; gap:8px; margin:6px 0; padding:6px; background:#fff; border-radius:4px; border:1px solid #eee;"> ${item.mainImage ? `<img src="${mediaUrl(item.mainImage)}" width=60 height=60 style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:1px solid #f85606; cursor:pointer;" onclick="openImageModal('${mediaUrl(item.mainImage)}')" title="Click to view larger">` : `<div style="width:60px; height:60px; display:flex; align-items:center; justify-content:center; background:#eee; color:#777; border-radius:4px; font-size:10px; text-align:center;">No image</div>`} <div style="flex:1; min-width:0;"> <div style="font-weight:bold;">${item.productName || 'Product'}</div> <div style="font-size:12px; color:#666;">Price: ৳${item.price || 0} × ${item.quantity || 1}</div> </div> </div> `).join('') || '<span style="color:#777;">No product details saved in this order.</span>'} </div> <form action="/admin/update-order-status/${o._id}" method="POST" style="margin-top:6px; display:flex; gap:6px;"> <select name="status" style="padding:4px; font-size:12px;"> <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option> <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option> <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option> <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option> <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option> </select> <button type="submit" class="btn" style="padding:4px 10px; font-size:12px;">Update</button> </form> <form action="/admin/delete-order/${o._id}" method="POST" style="margin-top:6px;" onsubmit="return confirm('এই অর্ডারটি স্থায়ীভাবে ডিলিট করবেন?');"> <button type="submit" class="btn" style="background:#dc3545; padding:4px 10px; font-size:12px;">🗑️ Delete Order</button> </form> </div> `).join('');
let usersHTML = users.map(u => ` <div style="background:#fff; padding:8px; margin-bottom:6px; border-radius:4px; border:1px solid #eee; font-size:13px; display:flex; justify-content:space-between; align-items:center;"> <div> <b>${u.name || 'No Name'}</b> (${u.email})<br> <span>Phone: ${u.phone || 'N/A'} | Addr: ${u.address || 'N/A'}</span> </div> <div> <span style="color:${u.isBlocked ? 'red' : 'green'}; font-weight:bold; margin-right:8px;">${u.isBlocked ? 'Blocked (COD Off)' : 'Active'}</span> <a href="/admin/toggle-block-user/${u._id}" class="btn" style="background:${u.isBlocked ? '#28a745' : '#dc3545'}; padding:4px 8px; font-size:11px;">${u.isBlocked ? 'Unblock' : 'Block COD'}</a> </div> </div> `).join('');
let chatsHTML = chats.map(c => ` <div style="background:#fff; padding:10px; margin-bottom:8px; border-radius:4px; border:1px solid #eee; font-size:13px;"> <div style="display:flex; align-items:flex-start; gap:10px;"> ${c.productImage ? `<img src="${mediaUrl(c.productImage)}" width=65 height=65 style="width:65px; height:65px; object-fit:cover; border-radius:5px; border:1px solid #f85606; cursor:pointer; flex-shrink:0;" onclick="openImageModal('${mediaUrl(c.productImage)}')" title="Click to view larger">` : `<div style="width:65px; height:65px; display:flex; align-items:center; justify-content:center; background:#eee; color:#777; border-radius:5px; font-size:10px; text-align:center; flex-shrink:0;">No image</div>`} <div style="flex:1; min-width:0;"> <p style="margin:0 0 4px 0;"><b>User:</b> ${c.userEmail} | <b>Product:</b> ${c.productName || 'N/A'}</p> <p style="margin:0 0 4px 0; color:#333;"><b>Question:</b> ${c.message}</p> </div> </div> <form action="/admin/reply-chat/${c._id}" method="POST" style="margin-top:6px; display:flex; gap:6px;"> <input type="text" name="reply" value="${c.reply || ''}" placeholder="Write reply..." style="flex:1; padding:4px; font-size:12px;" required> <button type="submit" class="btn" style="padding:4px 10px; font-size:12px;">Reply</button> </form> <form action="/admin/delete-chat/${c._id}" method="POST" style="margin-top:6px;" onsubmit="return confirm('এই মেসেজটি স্থায়ীভাবে ডিলিট করবেন?');"> <button type="submit" class="btn" style="background:#dc3545; padding:4px 10px; font-size:12px;">🗑️ Delete Message</button> </form> </div> `).join('');
let couponsHTML = coupons.map(coup => ` <div style="background:#fff; padding:8px; margin-bottom:6px; border-radius:4px; border:1px solid #eee; font-size:13px; display:flex; justify-content:space-between; align-items:center;"> <span><b>Code:</b> ${coup.code} | <b>Discount:</b> ৳${coup.discountAmount}</span> <a href="/admin/delete-coupon/${coup._id}" class="btn" style="background:#dc3545; padding:4px 8px; font-size:11px;">Delete</a> </div> `).join('');
res.send(` <!DOCTYPE html> <html> <head><title>Admin Dashboard</title>${globalHeaderHTML}</head> <body> ${getNavbarHTML(req.user)} <div class="container" style="background:white; padding:20px; border-radius:6px;"> <h2 style="margin-top:0; color:#f85606;">⚙️Admin Control Panel</h2>${isMainAdmin(req.user) ? `<div style="background:#e8f5e9;border:1px solid #b7dfb9;padding:8px;border-radius:8px;margin:8px 0;font-size:12px;">🔐 Main Admin verified: ${req.user.email}</div>` : ''}${isSubAdmin(req.user) ? `<div style="background:#fff3cd;padding:10px;border-radius:6px;margin-bottom:12px;"><b>Seller Admin:</b> ${req.user.subAdminShopName || req.user.name || req.user.email} | Status: ${req.user.subAdminStatus} | ${req.user.unlimitedFree ? 'Unlimited Free' : (req.user.activationExpiresAt ? 'Expiry: '+new Date(req.user.activationExpiresAt).toLocaleDateString() : 'Expiry not set')} ${req.user.subAdminWarning ? `<br><span style="color:#b94a48;"><b>Notice:</b> ${req.user.subAdminWarning}</span>` : ''}</div>` : ''}${isSubAdmin(req.user) ? `<div style="background:#eef7ff;padding:12px;border-radius:6px;margin-bottom:12px;"><h4 style="margin:0 0 8px 0;">🆘 Main Admin Help / Support</h4><form action="/sub-admin/support" method="POST"><textarea name="message" required placeholder="Main Admin-এর কাছে সাহায্যের কথা লিখুন..." style="width:100%;height:60px;padding:8px;border:1px solid #ccc;border-radius:5px;"></textarea><label style="display:block;font-size:12px;font-weight:600;margin-top:8px;">WhatsApp নম্বর হারিয়ে গেলে নতুন WhatsApp নম্বর দিন (ঐচ্ছিক)</label><input type="text" name="requestedWhatsApp" placeholder="017XXXXXXXX অথবা https://wa.me/..." style="width:100%;padding:8px;border:1px solid #ccc;border-radius:5px;"><small style="display:block;color:#777;margin-top:5px;">নতুন নম্বর দিলে Main Admin যাচাই করে account-এর WhatsApp নম্বর পরিবর্তন করতে পারবেন।</small><button class="btn" style="margin-top:6px;padding:7px 12px;">Send Help Request</button></form></div>` : ''} <style>
.admin-section-launcher{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin:16px 0 20px}
.admin-launch-box{appearance:none;border:1px solid #e2e7ee;background:linear-gradient(145deg,#fff,#f7f9fc);border-radius:14px;padding:14px 12px;text-align:left;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.05);transition:.18s;min-height:94px}
.admin-launch-box:hover{transform:translateY(-2px);box-shadow:0 7px 18px rgba(0,0,0,.09);border-color:#f85606}
.admin-launch-icon{display:block;font-size:24px;margin-bottom:6px}.admin-launch-box b{display:block;color:#222;font-size:14px}.admin-launch-box small{display:block;color:#777;font-size:11px;margin-top:4px}
.admin-section-box{border:1px solid #e1e6ec;border-radius:15px;background:#fff;margin:12px 0;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,.045)}
.admin-section-box>summary{list-style:none;cursor:pointer;padding:16px 18px;font-size:16px;font-weight:700;display:flex;align-items:center;gap:9px;background:linear-gradient(90deg,#fff,#f8fafc)}
.admin-section-box>summary::-webkit-details-marker{display:none}.admin-section-box>summary:after{content:'＋';margin-left:auto;font-size:21px;color:#777}.admin-section-box[open]>summary:after{content:'−'}
.admin-section-body{padding:0 16px 16px;border-top:1px solid #edf0f3}.admin-section-body>h3{display:none}.admin-section-body>hr{display:none}
.admin-section-body .admin-inner-card{background:#f8fafc;border:1px solid #e7ebef;border-radius:12px;padding:12px;margin-top:12px}
</style><script>function openAdminSection(id){const d=document.getElementById(id);if(!d)return;document.querySelectorAll('details.admin-section-box').forEach(x=>{if(x!==d)x.open=false});d.open=true;setTimeout(()=>d.scrollIntoView({behavior:'smooth',block:'start'}),20);}</script><div class="admin-section-launcher"> <button type="button" class="admin-launch-box" onclick="openAdminSection('addProductBox')"><span class="admin-launch-icon">➕</span><b>Add Product</b><small>নতুন পণ্য যোগ করুন</small></button> <button type="button" class="admin-launch-box" onclick="openAdminSection('sellProductsBox')"><span class="admin-launch-icon">🛍️</span><b>Sell Products</b><small>Customer-কে পণ্য পাঠান</small></button> <button type="button" class="admin-launch-box" onclick="openAdminSection('ordersBox')"><span class="admin-launch-icon">📦</span><b>Orders (${orders.length})</b><small>সব অর্ডার ম্যানেজ করুন</small></button> <button type="button" class="admin-launch-box" onclick="openAdminSection('usersBox')"><span class="admin-launch-icon">👥</span><b>Users (${users.length})</b><small>Customer ও COD control</small></button> <button type="button" class="admin-launch-box" onclick="openAdminSection('qaBox')"><span class="admin-launch-icon">💬</span><b>Q&A (${chats.length})</b><small>Message ও customer Q&A</small></button> <button type="button" class="admin-launch-box" onclick="openAdminSection('couponsBox')"><span class="admin-launch-icon">🏷️</span><b>Coupons</b><small>Coupon তৈরি ও ম্যানেজ</small></button> <button type="button" class="admin-launch-box" onclick="openAdminSection('facebookBox')"><span class="admin-launch-icon">📘</span><b>Facebook</b><small>Page, Video, Image, Reel</small></button> <button type="button" class="admin-launch-box" onclick="openAdminSection('settingsBox')"><span class="admin-launch-icon">🛠️</span><b>Settings</b><small>Payment ও Site Settings</small></button> </div> <details class="admin-section-box" id="sellProductsBox"><summary>🛍️ Sell Products</summary><div class="admin-section-body"><p style="color:#666;font-size:13px;margin:14px 0 10px">Customer নির্বাচন করে product details পাঠাতে এই section খুলুন।</p><a href="/admin/sell-products" class="btn" style="display:inline-block;background:#28a745;padding:9px 14px">🛍️ Open Sell Products</a></div></details><details class="admin-section-box" id="addProductBox"><summary>➕ Add New Product</summary><div class="admin-section-body"><hr style="margin:20px 0;"> <h3 id="addProductSec">Add New Product</h3> <form action="/admin/add-product" method="POST" enctype="multipart/form-data" style="background:#f9f9f9; padding:15px; border-radius:6px; margin-bottom:20px;"> <label style="font-size:13px;">Product Name:</label><br> <input type="text" name="name" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br> <label style="font-size:13px;">Category:</label><br> <select name="category" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required> ${categoryOptions} </select><br> <div style="display:flex; gap:10px;"> <div style="flex:1;"> <label style="font-size:13px;">Price (৳):</label><br> <input type="number" name="price" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required> </div> <div style="flex:1;"> <label style="font-size:13px;">Stock Qty:</label><br> <input type="number" name="stock" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required> </div> </div> <div style="display:flex; gap:10px;"> <div style="flex:1;"> <label style="font-size:13px;">Max Order Limit:</label><br> <input type="number" name="maxOrderLimit" value="5" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;"> </div> <div style="flex:1;"> <label style="font-size:13px;">Delivery Charge (৳):</label><br> <input type="number" name="deliveryCharge" value="150" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;"> </div> </div> <label style="font-size:13px;">Description:</label><br> <textarea name="description" style="width:100%; height:60px; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;"></textarea><br> <label style="font-size:13px;">WhatsApp Number / Link ${isSubAdmin(req.user) ? '*' : ''}:</label><br> <input type="text" name="whatsappContact" ${isSubAdmin(req.user) ? 'required' : ''} placeholder="যেমন: 017XXXXXXXX অথবা https://wa.me/8801XXXXXXXXX" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;"><small style="display:block;color:#777;margin-bottom:10px;">${isSubAdmin(req.user) ? 'Sub Admin-এর জন্য WhatsApp Number / Link বাধ্যতামূলক।' : 'এই Product-এর জন্য Customer সরাসরি WhatsApp-এ কথা বলতে পারবে।'}</small> <label style="font-size:13px;">Main Image:</label><br> <input type="file" name="mainImage" accept="image/*" style="margin:3px 0 10px 0;" required><br> <label style="font-size:13px;">Additional Product Images (ছোট ছোট ছবি):</label><br> <input type="file" name="additionalImages" accept="image/*" multiple style="margin:3px 0 10px 0;"><br> <small style="display:block;color:#777;margin-bottom:8px;">প্রয়োজনে একসাথে একাধিক ছবি নির্বাচন করতে পারবেন। এগুলো Product-এর নিচে thumbnail হিসেবে দেখা যাবে।</small> <button type="submit" class="btn" style="padding:8px 16px;">Save Product</button> </form></div></details> <hr style="margin:20px 0;"> <details class="admin-section-box" id="ordersBox"><summary>📦 Manage Orders</summary><div class="admin-section-body"><h3 id="ordersSec">Manage Orders</h3> <div style="max-height:400px; overflow-y:auto; background:#f9f9f9; padding:10px; border-radius:6px; margin-bottom:20px;"> ${ordersHTML.length ? ordersHTML : '<p style="color:#777;">No orders found.</p>'} </div></div></details> <hr style="margin:20px 0;"> <details class="admin-section-box" id="usersBox"><summary>👥 Manage Users & COD</summary><div class="admin-section-body"><h3 id="usersSec">Manage Users & COD Restrictions</h3> <div style="max-height:300px; overflow-y:auto; background:#f9f9f9; padding:10px; border-radius:6px; margin-bottom:20px;"> ${usersHTML.length ? usersHTML : '<p style="color:#777;">No users found.</p>'} </div></div></details> <hr style="margin:20px 0;"><details class="admin-section-box" id="qaBox"><summary>💬 Q&A & Customer Messages</summary><div class="admin-section-body"><h3 id="messageSendSec">📨 Send Product Message</h3><div style="background:#fff;padding:14px;border:1px solid #eee;border-radius:12px;margin-bottom:15px;"><form action="/admin/send-message" method="POST" style="display:grid;gap:8px;"><label style="font-size:13px;font-weight:600;">Customers</label><div style="border:1px solid #ddd;border-radius:8px;padding:8px;max-height:180px;overflow:auto;background:#fafafa;"><label style="display:block;font-size:12px;margin-bottom:6px;font-weight:700;"><input type="checkbox" id="sendMsgAllCustomers" onchange="toggleSendMsgCustomers(this)"> All Customers</label>${users.filter(u=>u.role==='user' || (u.role==='subadmin' && u.subAdminStatus!=='active')).map(u=>`<label style="display:block;font-size:12px;margin:4px 0;"><input type="checkbox" name="userEmails" value="${u.email}" class="sendMsgCustomer"> ${u.name||u.email} — ${u.email}</label>`).join('')}</div><label style="font-size:13px;font-weight:600;">Product</label><select name="productId" required style="padding:9px;border:1px solid #ccc;border-radius:7px;"><option value="">Select Product</option>${products.map(p=>`<option value="${p._id}">${p.name} — ৳${p.price}</option>`).join('')}</select><textarea name="message" required maxlength=3000 placeholder="Product সম্পর্কে customer-কে message লিখুন..." style="min-height:80px;padding:9px;border:1px solid #ccc;border-radius:7px;"></textarea><button class="btn" type="submit">📨 Send Message</button></form></div><script>function toggleSendMsgCustomers(cb){document.querySelectorAll('.sendMsgCustomer').forEach(x=>x.checked=cb.checked);} </script> <h3 id="chatsSec">Customer Q&A Inbox</h3> <div style="max-height:300px; overflow-y:auto; background:#f9f9f9; padding:10px; border-radius:6px; margin-bottom:20px;"> ${chatsHTML.length ? chatsHTML : '<p style="color:#777;">No chats found.</p>'} </div> <hr style="margin:20px 0;"> </div></details> <hr style="margin:20px 0;"> <details class="admin-section-box" id="couponsBox"><summary>🏷️ Manage Coupons</summary><div class="admin-section-body"><h3 id="couponsSec">Manage Coupons</h3> <form action="/admin/add-coupon" method="POST" style="background:#f9f9f9; padding:15px; border-radius:6px; margin-bottom:15px; display:flex; gap:10px; flex-wrap:wrap;"> <input type="text" name="code" placeholder="Coupon Code" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;" required> <input type="number" name="discountAmount" placeholder="Discount Amount (৳)" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;" required> <button type="submit" class="btn" style="padding:8px 16px;">Add Coupon</button> </form> <div style="background:#f9f9f9; padding:10px; border-radius:6px; margin-bottom:20px;"> ${couponsHTML.length ? couponsHTML : '<p style="color:#777;">No coupons found.</p>'} </div> </div></details> <hr style="margin:20px 0;"> <details class="admin-section-box" id="facebookBox"><summary>📘 Facebook Page / Video / Image / Reel</summary><div class="admin-section-body"><h3 id="facebookSec">📘 Facebook Page / Video / Image / Reel</h3>
<div style="background:#f9f9f9; padding:15px; border-radius:6px; margin-bottom:20px; border:1px solid #eee;">
<p style="font-size:13px; color:#555; margin-top:0;">Facebook Page ID ও Page Access Token নিচের Settings-এ একবার Save করুন। এরপর এখান থেকে ছবি, ভিডিও বা Reel সরাসরি আপনার Facebook Page-এ publish করা যাবে।</p>
<form action="/admin/publish-facebook" method="POST" enctype="multipart/form-data">
<label style="font-size:13px;">Post / Reel Title:</label><br>
<input type="text" name="title" placeholder="যেমন: নতুন পণ্যের ভিডিও" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;"><br>
<label style="font-size:13px;">Caption / Description:</label><br>
<textarea name="caption" placeholder="Facebook-এ যে লেখা যাবে..." style="width:100%; height:70px; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;"></textarea><br>
<label style="font-size:13px;">Media Type:</label><br>
<select name="mediaType" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required>
<option value="image">🖼️ Image</option>
<option value="video">🎬 Video</option>
<option value="reel">📱 Reel Video</option>
</select><br>
<label style="font-size:13px; font-weight:600;">Choose Product (Order Now link):</label><br>
<input type="hidden" name="productId" id="selectedFacebookProductId" value="">
<div id="facebookProductPicker" style="border:1px solid #ddd; border-radius:6px; background:#fff; max-height:320px; overflow-y:auto; padding:8px; margin:3px 0 10px 0;">
<div style="color:#777; font-size:12px; padding:8px;">Product-এ চাপ দিলে ছবি, দাম, stock, description ও Product link দেখা যাবে এবং সেটিই Order Now link হিসেবে নির্বাচন হবে।</div>
${products.map(p => `<div class="fb-product-option" data-id="${p._id}" onclick="selectFacebookProduct('${p._id}')" style="display:flex; gap:10px; align-items:center; padding:9px; margin:5px 0; border:1px solid #eee; border-radius:6px; cursor:pointer; background:#fff;">
<img src="${mediaUrl(p.mainImage)}" style="width:62px;height:62px;object-fit:cover;border-radius:5px;border:1px solid #ddd;flex-shrink:0;" onerror="this.style.display='none'">
<div style="flex:1;min-width:0;"><b style="font-size:13px;">${p.name}</b><div style="font-size:12px;color:#f85606;margin-top:2px;">৳${p.price}</div><div style="font-size:11px;color:#666;margin-top:2px;">Stock: ${p.stock} | Category: ${p.category}</div><div style="font-size:11px;color:#555;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${String(p.description || 'Description নেই').replace(/</g,'&lt;').slice(0,140)}</div></div>
</div>`).join('')}
</div>
<div id="selectedFacebookProduct" style="display:none; margin:8px 0 12px 0; padding:10px; border:2px solid #f85606; border-radius:6px; background:#fff7f2;"></div>
<br>
<label style="font-size:13px;">Image / Video File:</label><br>
<input type="file" name="mediaFile" accept="image/*,video/*" style="margin:3px 0 10px 0;" required><br>
<small style="display:block;color:#777;margin-bottom:10px;">Reel-এর জন্য Meta-এর নির্ধারিত Reel video requirements পূরণ করতে হবে।</small>
<button type="submit" class="btn" style="padding:9px 16px;">🚀 Publish Directly to Facebook</button>
</form>
</div> <hr style="margin:20px 0;"> </div></details> <details class="admin-section-box" id="settingsBox"><summary>🛠️ Site Settings & Payment</summary><div class="admin-section-body"><h3 id="settingsSec">Site Settings & Payment Numbers</h3> <form action="/admin/update-settings" method="POST" style="background:#f9f9f9; padding:15px; border-radius:6px; margin-bottom:20px;"> <label style="font-size:13px;">bKash Number:</label><br> <input type="text" name="bkashNumber" value="${siteSetting.bkashNumber}" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br> <label style="font-size:13px;">Nagad Number:</label><br> <input type="text" name="nagadNumber" value="${siteSetting.nagadNumber}" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;" required><br> <hr style="margin:15px 0; border:0; border-top:1px solid #ddd;"> <h4 style="margin:5px 0 8px 0;">📘 Facebook API Settings</h4> <label style="font-size:13px;">Facebook Page ID:</label><br> <input type="text" name="pageId" value="${siteSetting.pageId || ''}" placeholder="Facebook Page ID" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;"><br> <label style="font-size:13px;">Facebook Page Access Token:</label><br> <input type="password" name="accessToken" placeholder="নতুন Page Access Token দিলে সেটি Save হবে; খালি রাখলে আগের Token থাকবে" style="width:100%; padding:8px; margin:3px 0 10px 0; border:1px solid #ccc; border-radius:4px;"><small style="display:block;color:#777;margin-bottom:10px;">Token কাউকে দেবেন না। এটি শুধু server-side Facebook API call-এর জন্য ব্যবহৃত হবে।</small> <button type="submit" class="btn" style="padding:8px 16px;">Update Settings</button> </form> </div></details> ${isMainAdmin(req.user) ? `<hr style="margin:20px 0;"><h3 id="subAdminSec">🛡️ Sub Admin Control Center</h3>
<div class="sub-admin-control-center" style="background:linear-gradient(135deg,#fff,#f7f9fc);padding:14px;border:1px solid #e5e7eb;border-radius:14px;margin-bottom:20px;box-shadow:0 3px 12px rgba(0,0,0,.05);">
<style>
.sub-admin-box-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:14px}
.sub-admin-box{background:#fff;border:1px solid #dfe5ec;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.sub-admin-box>summary{list-style:none;cursor:pointer;padding:16px;min-height:78px;display:flex;align-items:center;gap:12px;font-weight:700}
.sub-admin-box>summary::-webkit-details-marker{display:none}
.sub-admin-box>summary:after{content:'＋';margin-left:auto;font-size:20px;color:#777}
.sub-admin-box[open]>summary:after{content:'−'}
.sub-admin-box-body{padding:0 12px 12px}
.sub-admin-account{background:#fff;border:1px solid #e2e2e2;border-radius:10px;padding:10px;margin:8px 0}
.sub-admin-account details>summary{cursor:pointer;font-weight:700;padding:5px 0}
.sub-admin-account-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
.sub-admin-account-actions form{margin:0}
.sub-admin-mini{font-size:12px;color:#666;line-height:1.55}
.sub-admin-empty{padding:12px;background:#f8f9fa;border-radius:8px;color:#777;font-size:13px}
</style>
<div class="sub-admin-box-grid">
<details class="sub-admin-box" id="pendingSubAdmins">
<summary style="background:#fff8e1"><span style="font-size:25px">🆕</span><span>নতুন Admin Request<br><span style="font-size:24px;color:#e67e22">${(await User.countDocuments({role:'subadmin',subAdminStatus:'pending'}))}</span></span></summary>
<div class="sub-admin-box-body">
${(await User.find({role:'subadmin',subAdminStatus:'pending'}).sort({_id:-1})).map(sa=>`<div class="sub-admin-account"><details><summary>${sa.name||'No Name'} <span class="sub-admin-mini">(${sa.email})</span></summary><div class="sub-admin-mini">Shop: ${sa.subAdminShopName||'N/A'} | Phone: ${sa.phone||'N/A'} | WhatsApp: ${sa.subAdminWhatsApp||'N/A'}<br>Address: ${sa.address||'N/A'}<br>Business Categories: ${(Array.isArray(sa.subAdminBusinessCategories)&&sa.subAdminBusinessCategories.length?sa.subAdminBusinessCategories.join(', '):'N/A')}<br>Status: <b>${sa.subAdminStatus}</b> | Plan: ${sa.activationPlan||'N/A'}</div><div class="sub-admin-account-actions">${getWhatsAppContactUrl(sa.subAdminWhatsApp)?`<a class="btn" href="${getWhatsAppContactUrl(sa.subAdminWhatsApp)}" target="_blank" rel="noopener noreferrer" style="padding:5px 8px;background:#25D366;color:#fff;text-decoration:none;">💬 WhatsApp</a>`:''}<form action="/admin/subadmin/action/${sa._id}" method="POST" style="display:flex;gap:4px;"><input type="number" name="days" value="30" min="1" style="width:70px;padding:5px;"><input type="hidden" name="action" value="approve"><button class="btn" style="padding:5px 8px;background:#28a745">Approve/Extend</button></form><form action="/admin/subadmin/action/${sa._id}" method="POST"><input type="hidden" name="action" value="reject"><button class="btn" style="padding:5px 8px;background:#343a40">Reject</button></form></div></details></div>`).join('')||'<div class="sub-admin-empty">কোনো নতুন Sub Admin request নেই।</div>'}
<div style="margin-top:10px;padding:10px;background:#eef7ff;border-radius:8px"><b>Sub Admin Registration</b><br><a href="/sub-admin/register" target="_blank">/sub-admin/register</a></div>
</div></details>

<details class="sub-admin-box" id="activeSubAdmins">
<summary style="background:#eaf8ee"><span style="font-size:25px">👥</span><span>বর্তমান Sub Admin<br><span style="font-size:24px;color:#218838">${(await User.countDocuments({role:'subadmin',subAdminStatus:'active'}))}</span></span></summary>
<div class="sub-admin-box-body">
${activeSubAdminBusiness.map(sa=>`<div class="sub-admin-account"><details><summary>${sa.name||'No Name'} <span class="sub-admin-mini">(${sa.email})</span></summary><div class="sub-admin-mini">Shop: ${sa.subAdminShopName||'N/A'} | Phone: ${sa.phone||'N/A'} | WhatsApp: ${sa.subAdminWhatsApp||'N/A'}<br>Address: ${sa.address||'N/A'}<br>Business Categories: ${(Array.isArray(sa.subAdminBusinessCategories)&&sa.subAdminBusinessCategories.length?sa.subAdminBusinessCategories.join(', '):'N/A')}<br>Status: <b>${sa.subAdminStatus}</b> | Plan: ${sa.unlimitedFree?'Unlimited':(sa.activationExpiresAt?new Date(sa.activationExpiresAt).toLocaleDateString():'Not set')}</div><div style="margin-top:10px;padding:10px;background:#f6fbff;border:1px solid #cfe8ff;border-radius:10px;"><b>📊 Seller Business Overview</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:7px;margin-top:8px;"><div style="background:#fff;padding:8px;border-radius:8px;border:1px solid #e7eef5;"><span class="sub-admin-mini">Products</span><br><b>${sa.productCount}</b></div><div style="background:#fff;padding:8px;border-radius:8px;border:1px solid #e7eef5;"><span class="sub-admin-mini">Stock Units</span><br><b>${sa.stockUnits}</b></div><div style="background:#fff;padding:8px;border-radius:8px;border:1px solid #e7eef5;"><span class="sub-admin-mini">Units Sold</span><br><b>${sa.unitsSold || sa.recordedSold}</b></div><div style="background:#fff;padding:8px;border-radius:8px;border:1px solid #e7eef5;"><span class="sub-admin-mini">Orders</span><br><b>${sa.orderCount}</b></div><div style="background:#fff;padding:8px;border-radius:8px;border:1px solid #e7eef5;"><span class="sub-admin-mini">Customers</span><br><b>${sa.customerCount}</b></div><div style="background:#fff;padding:8px;border-radius:8px;border:1px solid #e7eef5;"><span class="sub-admin-mini">Gross Sales</span><br><b>৳${sa.grossSales.toLocaleString('en-US')}</b></div></div><div class="sub-admin-mini" style="margin-top:7px;">Pending: ${sa.statusCounts.Pending} · Processing: ${sa.statusCounts.Processing} · Shipped: ${sa.statusCounts.Shipped} · Delivered: ${sa.statusCounts.Delivered} · Cancelled: ${sa.statusCounts.Cancelled}</div><div style="margin-top:8px;color:#356;font-size:11px;">Main Admin এই seller-এর product, order, sales ও customer activity দেখতে পারবেন।</div></div><div class="sub-admin-account-actions">${getWhatsAppContactUrl(sa.subAdminWhatsApp)?`<a class="btn" href="${getWhatsAppContactUrl(sa.subAdminWhatsApp)}" target="_blank" rel="noopener noreferrer" style="padding:5px 8px;background:#25D366;color:#fff;text-decoration:none;">💬 WhatsApp</a>`:''}<form action="/admin/subadmin/message/${sa._id}" method="POST" style="display:flex;gap:4px;flex:1;min-width:220px;"><input type="text" name="message" placeholder="Message to Sub Admin" required style="flex:1;padding:5px;"><button class="btn" style="padding:5px 8px;background:#007bff;color:#fff;">📨 Send Message</button></form></div></details></div>`).join('')||'<div class="sub-admin-empty">কোনো active Sub Admin নেই।</div>'}
</div></details>

<details class="sub-admin-box" id="controlSubAdmins">
<summary style="background:#eef5ff"><span style="font-size:25px">🎛️</span><span>Admin Control<br><span style="font-size:12px;color:#356">সব Sub Admin-এর তথ্য ও control: Approve • Block • Suspend • Warn</span></span></summary>
<div class="sub-admin-box-body">
${(await User.find({role:'subadmin'}).sort({_id:-1})).map(sa=>{ const expired=!sa.unlimitedFree && sa.activationExpiresAt && new Date(sa.activationExpiresAt)<new Date(); const days=sa.unlimitedFree?'Unlimited':sa.activationExpiresAt?Math.max(0,Math.ceil((new Date(sa.activationExpiresAt)-Date.now())/86400000))+' days':'Not set'; return `<div class="sub-admin-account"><details><summary>${sa.name||'No Name'} <span class="sub-admin-mini">(${sa.email}) — ${sa.subAdminStatus}</span></summary><div class="sub-admin-mini">Shop: ${sa.subAdminShopName||'N/A'} | Phone: ${sa.phone||'N/A'} | WhatsApp: ${sa.subAdminWhatsApp||'N/A'}<br>Address: ${sa.address||'N/A'}<br>Business Categories: ${(Array.isArray(sa.subAdminBusinessCategories)&&sa.subAdminBusinessCategories.length?sa.subAdminBusinessCategories.join(', '):'N/A')}<br>Plan: ${sa.activationPlan||'N/A'} | Remaining: ${days}${expired?' | ⚠️ Expired':''}</div><div class="sub-admin-account-actions">${getWhatsAppContactUrl(sa.subAdminWhatsApp)?`<a class="btn" href="${getWhatsAppContactUrl(sa.subAdminWhatsApp)}" target="_blank" rel="noopener noreferrer" style="padding:5px 8px;background:#25D366;color:#fff;text-decoration:none;">💬 WhatsApp</a>`:`<span style="padding:5px 8px;background:#eee;color:#777;border-radius:4px;font-size:12px;">WhatsApp যাচাই প্রয়োজন</span>`}<form action="/admin/subadmin/action/${sa._id}" method="POST" style="display:flex;gap:4px;"><input type="number" name="days" value="30" min="1" style="width:60px;padding:5px"><input type="hidden" name="action" value="approve"><button class="btn" style="padding:5px 8px;background:#28a745">Approve/Extend</button></form><form action="/admin/subadmin/action/${sa._id}" method="POST"><input type="hidden" name="action" value="free-unlimited"><button class="btn" style="padding:5px 8px;background:#6f42c1">Free Unlimited</button></form><form action="/admin/subadmin/action/${sa._id}" method="POST" style="display:flex;gap:4px"><input type="number" name="days" value="30" min="1" style="width:60px;padding:5px"><input type="hidden" name="action" value="free-days"><button class="btn" style="padding:5px 8px;background:#20c997">Free Days</button></form><form action="/admin/subadmin/action/${sa._id}" method="POST"><input type="hidden" name="action" value="reject"><button class="btn" style="padding:5px 8px;background:#343a40">Reject</button></form><form action="/admin/subadmin/action/${sa._id}" method="POST"><input type="hidden" name="action" value="suspend"><button class="btn" style="padding:5px 8px;background:#dc3545">Suspend</button></form><form action="/admin/subadmin/action/${sa._id}" method="POST"><input type="hidden" name="action" value="expire"><button class="btn" style="padding:5px 8px;background:#6c757d">Expire</button></form><form action="/admin/subadmin/action/${sa._id}" method="POST" style="display:flex;gap:4px;flex:1;min-width:220px;"><input type="hidden" name="action" value="warn"><input type="text" name="message" placeholder="Warning / Notice message" style="flex:1;padding:5px" required><button class="btn" style="padding:5px 8px;background:#f0ad4e">Send Warning</button></form><form action="/admin/subadmin/message/${sa._id}" method="POST" style="display:flex;gap:4px;flex:1;min-width:220px;"><input type="text" name="message" placeholder="Message to Sub Admin" required style="flex:1;padding:5px"><button class="btn" style="padding:5px 8px;background:#007bff;color:#fff">📨 Send Message</button></form></div></details></div>`;}).join('')||'<div class="sub-admin-empty">কোনো Sub Admin account নেই।</div>'}
<div style="margin-top:12px;padding:10px;background:#fff;border:1px solid #ddd;border-radius:8px;"><b>🆘 Sub Admin Help Requests</b>${(await SubAdminSupport.find().sort({_id:-1}).limit(50)).map(sm=>`<div style="margin-top:8px;padding:8px;background:#f9f9f9;border-radius:5px;"><b>${sm.subAdminEmail}</b><br><span style="font-size:12px;">${sm.message}</span>${sm.requestedWhatsApp?`<div style="margin-top:5px;color:#0b63ce;"><b>Requested New WhatsApp:</b> ${sm.requestedWhatsApp}</div>`:''}${sm.reply?`<div style="margin-top:5px;color:#087f23;"><b>Your Reply:</b> ${sm.reply}</div>`:''}<form action="/admin/subadmin/support/${sm._id}" method="POST" style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;"><input type="text" name="reply" value="${sm.reply||''}" placeholder="Reply to Sub Admin" style="flex:1;padding:6px;min-width:180px;"><button class="btn" style="padding:5px 9px;">Reply</button></form>${sm.requestedWhatsApp?`<form action="/admin/subadmin/update-whatsapp/${sm.subAdminId}" method="POST" style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;"><input type="text" name="whatsapp" value="${sm.requestedWhatsApp||''}" required style="flex:1;padding:6px;min-width:180px;"><button class="btn" style="padding:5px 9px;background:#25D366;color:#fff;">✅ Verify & Update WhatsApp</button></form>`:''}</div>`).join('')||'<p style="color:#777">No help requests.</p>'}</div>
<div style="margin-top:12px;padding:10px;background:#fff5f5;border:1px solid #ffd1d1;border-radius:8px;"><b>🔑 Password Reset Requests</b>${(await SubAdminSupport.find({requestType:'login_password_reset'}).sort({_id:-1}).limit(50)).map(sm=>`<div style="margin-top:8px;padding:8px;background:#fff;border-radius:5px;border:1px solid #eee;"><b>${sm.subAdminEmail}</b><br><span style="font-size:12px;white-space:pre-wrap;">${sm.message}</span><br><span style="font-size:12px;color:#666;">Status: ${sm.resetStatus}</span>${sm.resetStatus!=='completed'?`<form action="/admin/login-help/reset/${sm._id}" method="POST" style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;"><input type="password" name="newPassword" minlength="6" required placeholder="নতুন Password সেট করুন" style="flex:1;padding:6px;min-width:180px;"><button class="btn" style="padding:5px 9px;background:#28a745;">✅ Reset Password</button></form>`:''}</div>`).join('')||'<p style="color:#777">No password reset requests.</p>'}</div>
</div></details>
</div></div>` : ''} 
<hr style="margin:20px 0;">
<h3 id="productRequestsSec">🔎 Customer Product Requests</h3>
<div style="background:#fff8f2;border:1px solid #ffd2b8;border-radius:12px;padding:12px;margin-bottom:15px;">
<p style="font-size:12px;color:#666;margin-top:0;">Customer যে পণ্য খুঁজে পাচ্ছেন না তার request এখানে দেখুন। Main Admin চাইলে সব Sub Admin অথবা নির্দিষ্ট Sub Admin-কে পাঠাতে পারবেন। যে Sub Admin আগে Accept করবে, requestটি তার নামে locked হয়ে যাবে।</p>
${isMainAdmin(req.user) ? `
${(() => {
  const subs = activeSubAdmins;
  return productRequestRows.map(r=>{
  const assigned = Array.isArray(r.targetSubAdminIds) ? r.targetSubAdminIds : [];
  const statusLabel = r.status==='accepted' ? `Accepted by ${r.acceptedByEmail}` : r.status;
  return `<div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:10px;margin:8px 0;">
  <div style="display:flex;gap:10px;align-items:flex-start;">
    ${r.requestImage ? `<img src="${mediaUrl(r.requestImage)}" width="70" height="70" style="object-fit:cover;border-radius:6px;cursor:pointer;" onclick="openImageModal(this.src)">` : ''}
    <div style="flex:1;"><b>${r.productName}</b><br><span style="font-size:12px;">User: ${r.userName} (${r.userEmail})</span><br><span style="font-size:12px;">Phone: ${r.userPhone} | Address: ${r.userAddress}</span><br><span style="font-size:12px;color:#555;">${r.details || ''}</span><br><span style="font-size:12px;color:#007bff;">Status: <b>${statusLabel}</b></span></div>
  </div>
  ${r.status!=='accepted' && r.status!=='closed' ? `<form action="/admin/product-request/broadcast/${r._id}" method="POST" style="margin-top:8px;">
  <label style="font-size:12px;font-weight:600;">কাদের কাছে পাঠাবেন?</label>
  <div style="max-height:120px;overflow:auto;border:1px solid #ddd;padding:6px;border-radius:6px;background:#fafafa;">
  <label style="display:block;font-size:12px;margin-bottom:5px;font-weight:700;"><input type="checkbox" name="broadcastAll" value="1" onchange="toggleRequestSubs(this)"> সব Active Sub Admin-কে পাঠান</label>
  ${subs.map(sa=>`<label style="display:block;font-size:12px;"><input type="checkbox" name="subAdminIds" value="${sa._id}" class="requestSubCheck"> ${sa.name||sa.email} — ${sa.email}</label>`).join('')}
  </div><script>function toggleRequestSubs(cb){document.querySelectorAll('.requestSubCheck').forEach(x=>x.checked=cb.checked);}</script>
  <button class="btn" style="margin-top:6px;padding:7px 11px;">📨 Send to Sub Admins</button></form>` : ''}
  </div>`;
}).join('') || '<p style="color:#777;">কোনো customer request নেই।</p>';
})()}
` : `
${(await ProductRequest.find({targetSubAdminIds:String(req.user._id),status:'broadcasted'}).sort({_id:-1}).limit(50)).map(r=>`<div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:10px;margin:8px 0;"><div style="display:flex;gap:10px;align-items:flex-start;">${r.requestImage?`<img src="${mediaUrl(r.requestImage)}" width="70" height="70" style="object-fit:cover;border-radius:6px;cursor:pointer;" onclick="openImageModal(this.src)">`:''}<div style="flex:1;"><b>${r.productName}</b><br><span style="font-size:12px;">Customer: ${r.userName} | ${r.userPhone}</span><br><span style="font-size:12px;">Address: ${r.userAddress}</span><br><span style="font-size:12px;">${r.details||''}</span><br><form action="/subadmin/product-request/accept/${r._id}" method="POST" style="margin-top:7px;"><button class="btn" style="padding:7px 12px;background:#28a745;">✅ Accept Product Request</button></form></div></div></div>`).join('') || '<p style="color:#777;">আপনার কাছে কোনো নতুন product request নেই।</p>'}
`}
</div>
<hr style="margin:20px 0;"> <h3 id="productsSec">All Products List</h3> <div style="max-height:400px; overflow-y:auto; background:#f9f9f9; padding:10px; border-radius:6px;"> ${productsHTML.length ? productsHTML : '<p style="color:#777;">No products found.</p>'} </div> </div> <script>
const facebookProductData = ${JSON.stringify(products.map(p => ({ id:String(p._id), name:p.name, price:p.price, stock:p.stock, category:p.category, description:p.description||'', image:mediaUrl(p.mainImage), url:`${SITE_URL_FALLBACK}/product/${p._id}` })))};
function selectFacebookProduct(id) {
const p=facebookProductData.find(x=>x.id===String(id));
const hidden=document.getElementById('selectedFacebookProductId');
const box=document.getElementById('selectedFacebookProduct');
if(!p||!hidden||!box)return;
hidden.value=p.id; box.style.display='block';
box.innerHTML='<div style="display:flex;gap:10px;align-items:flex-start;"><img src="'+p.image+'" style="width:90px;height:90px;object-fit:cover;border-radius:6px;border:1px solid #ddd;"><div style="flex:1;"><b style="font-size:15px;">'+p.name+'</b><div style="color:#f85606;font-weight:bold;margin-top:3px;">৳'+p.price+'</div><div style="font-size:12px;color:#555;margin-top:2px;">Stock: '+p.stock+' | Category: '+p.category+'</div><div style="font-size:12px;color:#444;margin-top:5px;">'+(p.description||'Description নেই')+'</div><a href="'+p.url+'" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:7px;color:#007bff;font-size:12px;">🔗 Product খুলুন</a></div></div>';
document.querySelectorAll('.fb-product-option').forEach(el=>{el.style.borderColor=el.dataset.id===p.id?'#f85606':'#eee';el.style.background=el.dataset.id===p.id?'#fff7f2':'#fff';});
}

async function copyProductLink(id) {
const input = document.getElementById('productLink-' + id);
if (!input) return;
const text = input.value;
try {
await navigator.clipboard.writeText(text);
alert('Product link copied!');
} catch (e) {
input.select();
document.execCommand('copy');
alert('Product link copied!');
}
}
</script> </body> </html> `);
} catch (err) {
next(err);
}
});
// ================= Main Admin Sub Admin Control Routes =================
app.post('/sub-admin/support', async (req,res,next)=>{ try { if(!isSubAdmin(req.user)) return res.redirect('/login'); const message=String(req.body.message||'').trim(); const requestedWhatsApp=String(req.body.requestedWhatsApp||'').trim(); if(!message) return res.redirect('/admin-dashboard'); if(requestedWhatsApp && !isValidWhatsAppContact(requestedWhatsApp)) return res.send(`<script>alert('সঠিক WhatsApp Number / wa.me Link দিন।');window.history.back();</script>`); await new SubAdminSupport({subAdminId:String(req.user._id),subAdminEmail:req.user.email,message,requestedWhatsApp,whatsappUpdateStatus:requestedWhatsApp?'pending':'none'}).save(); res.redirect('/admin-dashboard'); } catch(e){next(e);} });
app.post('/admin/subadmin/update-whatsapp/:id', async (req,res,next)=>{ try { if(!isMainAdmin(req.user)) return res.status(403).send('Unauthorized: Main Admin access required'); const whatsapp=String(req.body.whatsapp||'').trim(); if(!isValidWhatsAppContact(whatsapp)) return res.status(400).send('Invalid WhatsApp number or wa.me link'); const sa=await User.findOne({_id:req.params.id,role:'subadmin'}); if(!sa) return res.status(404).send('Sub Admin not found'); sa.subAdminWhatsApp=whatsapp; await sa.save(); await SubAdminSupport.updateMany({subAdminId:String(sa._id),requestedWhatsApp:whatsapp,whatsappUpdateStatus:'pending'},{$set:{whatsappUpdateStatus:'approved',updatedAt:new Date()}}); res.redirect('/admin-dashboard#subAdminSec'); } catch(e){next(e);} });
app.post('/admin/login-help/reset/:id', async(req,res,next)=>{try{
  if(!isMainAdmin(req.user)) return res.status(403).send('Unauthorized: Main Admin access required');
  const newPassword=String(req.body.newPassword||'');
  if(newPassword.length<6) return res.status(400).send('New password must be at least 6 characters');
  const ticket=await SubAdminSupport.findById(req.params.id);
  if(!ticket || ticket.requestType!=='login_password_reset') return res.status(404).send('Password reset request not found');
  const user=await User.findOne({email:normalizeEmail(ticket.subAdminEmail)});
  if(!user) return res.status(404).send('User account not found');
  user.password=await bcrypt.hash(newPassword,10); await user.save();
  ticket.resetStatus='completed'; ticket.resetAt=new Date(); ticket.reply='Password reset completed by Main Admin. A new password was set securely.'; ticket.updatedAt=new Date(); await ticket.save();
  res.redirect('/admin-dashboard#subAdminSec');
}catch(e){next(e);}});
app.post('/admin/subadmin/support/:id', async (req,res,next)=>{ try { if(!isMainAdmin(req.user)) return res.status(403).send('Unauthorized: Main Admin access required'); const ticket=await SubAdminSupport.findById(req.params.id); if(!ticket) return res.status(404).send('Support request not found'); const reply=safeText(req.body.reply,2000); ticket.reply=reply; ticket.updatedAt=new Date(); await ticket.save(); if(reply){ await new Chat({productId:null,productName:'Main Admin Help / Support',ownerId:String(ticket.subAdminId),productImage:'',userEmail:normalizeEmail(ticket.subAdminEmail),message:reply,reply:'',senderRole:'admin',senderEmail:normalizeEmail(req.user.email),recipientEmail:normalizeEmail(ticket.subAdminEmail),isRead:false}).save(); await createNotification(normalizeEmail(ticket.subAdminEmail),'Main Admin Reply',reply,'/messages','message'); } res.redirect('/admin-dashboard#subAdminSec'); } catch(e){next(e);} });
app.post('/admin/subadmin/action/:id', async (req,res,next)=>{
  try {
    if (!requireMainAdmin(req,res)) return;
    const action=String(req.body.action||'').trim().toLowerCase();
    const sa=await User.findOne({_id:req.params.id,role:'subadmin'});
    if(!sa) return res.status(404).send('Sub Admin not found');
    let note='';
    if(action==='approve' || action==='free-days'){
      const days=Math.max(1,Number(req.body.days)||30);
      const base=(sa.activationExpiresAt && new Date(sa.activationExpiresAt)>new Date() && sa.subAdminStatus==='active') ? new Date(sa.activationExpiresAt).getTime() : Date.now();
      sa.subAdminStatus='active';
      sa.activationPlan=action==='approve'?'paid':'free';
      sa.unlimitedFree=false;
      sa.activationExpiresAt=new Date(base+days*86400000);
      sa.approvedBy=normalizeEmail(req.user.email); sa.approvedAt=new Date();
      note=action==='approve'?`Main Admin approved your Seller Admin access for ${days} days.`:`Main Admin granted ${days} free days for your Seller Admin access.`;
    } else if(action==='free-unlimited'){
      sa.subAdminStatus='active'; sa.activationPlan='free'; sa.unlimitedFree=true; sa.activationExpiresAt=null; sa.approvedBy=normalizeEmail(req.user.email); sa.approvedAt=new Date();
      note='Main Admin granted you Unlimited Free Seller Admin access.';
    } else if(action==='reject'){
      sa.subAdminStatus='rejected'; sa.unlimitedFree=false; note='Your Sub Admin application was rejected by Main Admin.';
    } else if(action==='suspend'){
      sa.subAdminStatus='suspended'; sa.unlimitedFree=false; note='Your Seller Admin access was suspended by Main Admin.';
    } else if(action==='expire'){
      sa.subAdminStatus='expired'; sa.activationExpiresAt=new Date(); sa.unlimitedFree=false; note='Your Seller Admin access has expired.';
    } else if(action==='warn'){
      const msg=safeText(req.body.message,2000); if(!msg) return res.status(400).send('Warning message is required');
      sa.subAdminWarning=msg; note=`Main Admin notice: ${msg}`;
    } else return res.status(400).send('Unknown Sub Admin action');
    await sa.save();
    if(note) await createNotification(normalizeEmail(sa.email),'Main Admin Update',note,'/dashboard','subadmin');
    res.redirect('/admin-dashboard#subAdminSec');
  } catch(e){ next(e); }
});

app.post('/admin/subadmin/message/:id', async (req,res,next)=>{
  try {
    if (!requireMainAdmin(req,res)) return;
    const sa=await User.findOne({_id:req.params.id,role:'subadmin'});
    if(!sa) return res.status(404).send('Sub Admin not found');
    const message=safeText(req.body.message,2000);
    if(!message) return res.status(400).send('Message is required');
    await new Chat({productId:null,productName:'',ownerId:String(sa._id),userEmail:normalizeEmail(sa.email),message,reply:'',senderRole:'admin',senderEmail:normalizeEmail(req.user.email),recipientEmail:normalizeEmail(sa.email),isRead:false}).save();
    await createNotification(normalizeEmail(sa.email),'Main Admin Message',message,'/messages','message');
    res.redirect('/admin-dashboard#subAdminSec');
  } catch(e){ next(e); }
});

app.get('/api/request-chat/unread-count', async (req,res,next)=>{
  try {
    if(!req.user) return res.json({count:0});
    const count=await ProductRequestChat.countDocuments({recipientEmail:normalizeEmail(req.user.email),isRead:false});
    res.json({count});
  } catch(e){res.json({count:0});}
});

app.get('/request-inbox', async (req,res,next)=>{
  try{
    if(!req.user) return res.redirect('/login?redirect=/request-inbox');
    // Do not let the browser cache customer PII or accepted-request conversations.
    res.set('Cache-Control','no-store, private, max-age=0');
    const email=normalizeEmail(req.user.email);
    let requests=[];
    if(isMainAdmin(req.user)) requests=await ProductRequest.find({status:{$in:['accepted','closed']}}).sort({_id:-1}).limit(100).lean();
    else if(isSubAdmin(req.user)) requests=await ProductRequest.find({acceptedByEmail:email,status:{$in:['accepted','closed']}}).sort({_id:-1}).limit(100).lean();
    else requests=await ProductRequest.find({userEmail:email,status:{$in:['accepted','closed']}}).sort({_id:-1}).limit(100).lean();
    let html='';
    for(const r of requests){
      const msgs=await ProductRequestChat.find({requestId:String(r._id)}).sort({_id:1}).limit(200).lean();
      const unread=await ProductRequestChat.countDocuments({requestId:String(r._id),recipientEmail:email,isRead:false});
      const isAcceptedSeller = isSubAdmin(req.user) && normalizeEmail(r.acceptedByEmail)===email;
      const currentUserId = String(req.user._id || '');
      const currentPhone = String(req.user.phone || '').replace(/\D/g,'');
      const requestPhone = String(r.userPhone || '').replace(/\D/g,'');
      const samePhoneAndName = !!currentPhone && !!requestPhone && currentPhone === requestPhone && String(req.user.name || '').trim().toLowerCase() === String(r.userName || '').trim().toLowerCase();
      // Customer identity check is deliberately independent of the current role label.
      // This keeps older/legacy customer accounts able to reply after a request is accepted,
      // while still preventing Main Admin or an active Shop Admin from impersonating the customer.
      const isPrivilegedStaff = isMainAdmin(req.user) || (isSubAdmin(req.user) && subAdminIsActive(req.user));
      const sameUserId = !!currentUserId && !!String(r.userId || '') && String(r.userId || '') === currentUserId;
      const sameEmail = !!email && !!normalizeEmail(r.userEmail) && normalizeEmail(r.userEmail) === email;
      const isRequestCustomer = !isPrivilegedStaff && (sameUserId || sameEmail || samePhoneAndName);
      const canChat = (r.status==='accepted' || r.status==='closed') && (isAcceptedSeller || isRequestCustomer);
      html+=`<div style="background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:14px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.05)"><div style="display:flex;gap:12px;align-items:flex-start">${r.requestImage?`<img src="${mediaUrl(r.requestImage)}" width="72" height="72" style="object-fit:cover;border-radius:9px;cursor:pointer" onclick="openImageModal(this.src)">`:''}<div style="flex:1"><b style="color:#f85606">${r.productName}</b><div style="font-size:12px;color:#666;margin-top:3px">Customer: ${r.userName||''} | ${r.userPhone||''}</div><div style="font-size:12px;color:#666">Address: ${r.userAddress||''}</div><div style="font-size:12px;color:#555;margin-top:3px">${r.details||''}</div><div style="font-size:12px;color:#087f23;margin-top:4px"><b>Accepted by:</b> ${r.acceptedByEmail||''} ${unread?`<span style="background:#dc3545;color:#fff;border-radius:10px;padding:2px 6px;margin-left:5px">${unread} নতুন</span>`:''}</div></div></div><div style="margin-top:12px;background:#fafafa;border:1px solid #eee;border-radius:10px;padding:10px;max-height:260px;overflow:auto">${msgs.length?msgs.map(m=>`<div style="padding:7px 9px;margin:5px 0;border-radius:9px;background:${m.senderEmail===email?'#fff1e8':'#eef7ff'}"><div style="font-size:11px;color:#777">${m.senderEmail===email?'আপনি':m.senderRole==='subadmin'?'Shop Admin':'Customer'} • ${new Date(m.createdAt).toLocaleString()}</div><div style="font-size:14px;margin-top:2px">${m.message}</div></div>`).join(''):'<div style="color:#777;text-align:center;padding:15px">এখনও কোনো মেসেজ নেই।</div>'}</div>${canChat?`<form action="/request-inbox/send" method="POST" style="display:flex;gap:6px;margin-top:9px;align-items:center;flex-wrap:wrap"><input type="hidden" name="requestId" value="${r._id}"><input type="text" name="message" required maxlength="3000" placeholder="${isRequestCustomer?'Shop Admin-কে reply লিখুন...':'Customer-কে reply লিখুন...'}" style="flex:1;min-width:220px;padding:9px;border:1px solid #ccc;border-radius:8px"><button class="btn" type="submit" style="padding:8px 12px">📨 ${isRequestCustomer?'Reply':'Send'}</button></form>`:''}</div>`;
      if(!isMainAdmin(req.user)) await ProductRequestChat.updateMany({requestId:String(r._id),recipientEmail:email,isRead:false},{$set:{isRead:true}});
    }
    res.send(`<!DOCTYPE html><html><head><title>Request Inbox</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container" style="max-width:820px"><div style="background:#fff;padding:18px;border-radius:14px"><h2 style="margin-top:0">📥 Product Request Inbox</h2><p style="color:#777;font-size:13px">Customer ও Accepted Shop Admin-এর private conversation এখানে থাকবে।</p>${html||'<div style="padding:35px;text-align:center;color:#777">কোনো accepted product request নেই।</div>'}</div></div></body></html>`);
  }catch(e){next(e);}
});

app.post('/request-inbox/send', async(req,res,next)=>{
  try{
    if(!req.user) return res.redirect('/login');
    const request=await ProductRequest.findById(req.body.requestId);
    if(!request || !['accepted','closed'].includes(request.status)) return res.status(404).send('Request not available');
    const email=normalizeEmail(req.user.email);
    let allowed=false, recipient='';
    if(isSubAdmin(req.user) && subAdminIsActive(req.user) && normalizeEmail(request.acceptedByEmail)===email){
      allowed=true;
      recipient=normalizeEmail(request.userEmail);
    } else {
      const currentUserId=String(req.user._id || '');
      const currentPhone=String(req.user.phone || '').replace(/\D/g,'');
      const requestPhone=String(request.userPhone || '').replace(/\D/g,'');
      const sameUserId=!!currentUserId && !!String(request.userId || '') && String(request.userId || '')===currentUserId;
      const sameEmail=!!email && !!normalizeEmail(request.userEmail) && normalizeEmail(request.userEmail)===email;
      const samePhoneAndName=!!currentPhone && !!requestPhone && currentPhone===requestPhone && String(req.user.name || '').trim().toLowerCase()===String(request.userName || '').trim().toLowerCase();
      const isPrivilegedStaff=isMainAdmin(req.user) || (isSubAdmin(req.user) && subAdminIsActive(req.user));
      // A request owner may reply even if their legacy account role is not exactly 'user'.
      if(!isPrivilegedStaff && (sameUserId || sameEmail || samePhoneAndName)){
        allowed=true;
        recipient=normalizeEmail(request.acceptedByEmail);
      }
    }
    if(!allowed || !recipient) return res.status(403).send('এই Product Request-এর কথোপকথনে আপনার অনুমতি নেই।');
    const message=safeText(req.body.message,3000); if(!message) return res.redirect('/request-inbox');
    await new ProductRequestChat({requestId:String(request._id),userId:String(request.userId || ''),userEmail:normalizeEmail(request.userEmail),subAdminEmail:normalizeEmail(request.acceptedByEmail),senderEmail:email,senderRole:req.user.role==='subadmin'?'subadmin':'user',recipientEmail:recipient,message,productName:request.productName,requestImage:request.requestImage,userName:request.userName,userPhone:request.userPhone,userAddress:request.userAddress,isRead:false}).save();
    await createNotification(recipient,'Product Request Message',`${request.productName} সম্পর্কে নতুন message এসেছে।`,'/request-inbox','message');
    res.redirect('/request-inbox');
  }catch(e){next(e);}
});

app.post('/admin/product-request/broadcast/:id', async (req,res,next)=>{
  try {
    if (!isMainAdmin(req.user)) return res.status(403).send('Unauthorized: Main Admin access required');
    const request = await ProductRequest.findOne({_id:req.params.id,status:{$in:['new','broadcasted']}});
    if (!request) return res.send(`<script>alert('এই request আর broadcast করা যাবে না।');window.location.href='/admin-dashboard#productRequestsSec';</script>`);
    let ids = [];
    if (req.body.broadcastAll === '1') {
      ids = (await User.find({role:'subadmin',subAdminStatus:'active'}).select('_id').lean()).map(x=>String(x._id));
    } else {
      const raw = req.body.subAdminIds;
      ids = (Array.isArray(raw)?raw:[raw]).filter(Boolean).map(String);
      ids = [...new Set(ids)];
    }
    if (!ids.length) return res.send(`<script>alert('কমপক্ষে একজন Active Sub Admin নির্বাচন করুন।');window.history.back();</script>`);
    const active = await User.find({role:'subadmin',subAdminStatus:'active',_id:{$in:ids}}).select('_id').lean();
    const activeIds = active.map(x=>String(x._id));
    if (!activeIds.length) return res.send(`<script>alert('নির্বাচিত Sub Admin Active নেই।');window.history.back();</script>`);
    request.targetSubAdminIds = activeIds;
    request.status = 'broadcasted';
    await request.save();
    res.redirect('/admin-dashboard#productRequestsSec');
  } catch(e){next(e);}
});

app.post('/subadmin/product-request/accept/:id', async (req,res,next)=>{
  try {
    if (!isSubAdmin(req.user) || !subAdminIsActive(req.user)) return res.status(403).send('Unauthorized: Main Admin access required');
    const id = String(req.params.id);
    const accepted = await ProductRequest.findOneAndUpdate(
      {_id:id,status:'broadcasted',targetSubAdminIds:String(req.user._id)},
      {$set:{status:'accepted',acceptedBy:String(req.user._id),acceptedByEmail:req.user.email,acceptedAt:new Date()}},
      {new:true}
    );
    if (!accepted) return res.send(`<script>alert('এই request ইতিমধ্যে অন্য Sub Admin Accept করেছে অথবা আর available নেই।');window.location.href='/admin-dashboard#productRequestsSec';</script>`);
    await new ProductRequestChat({requestId:String(accepted._id),userId:String(accepted.userId || ''),userEmail:normalizeEmail(accepted.userEmail),subAdminEmail:normalizeEmail(req.user.email),senderEmail:normalizeEmail(req.user.email),senderRole:'subadmin',recipientEmail:normalizeEmail(accepted.userEmail),message:`আপনার product request আমি Accept করেছি। এখন আপনি এখান থেকে আমার সাথে সরাসরি যোগাযোগ করতে পারবেন।`,productName:accepted.productName,requestImage:accepted.requestImage,userName:accepted.userName,userPhone:accepted.userPhone,userAddress:accepted.userAddress,isRead:false}).save();
    res.send(`<script>alert('Request সফলভাবে Accept করেছেন। Customer-এর সাথে Private Inbox Chat এখন চালু হয়েছে।');window.location.href='/request-inbox';</script>`);
  } catch(e){next(e);}
});

// Admin Actions Backend Routes
app.post('/admin/add-product', upload.fields([{ name: 'mainImage', maxCount: 1 }, { name: 'additionalImages', maxCount: 8 }]), async (req, res, next) => {
try {
if (!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.redirect('/login');
const productWhatsApp = String(req.body.whatsappContact || '').trim();
if (isSubAdmin(req.user)) {
  if (!isValidWhatsAppContact(productWhatsApp)) return res.send(`<script>alert('Sub Admin-এর Product যোগ করতে WhatsApp Number / wa.me Link বাধ্যতামূলক।'); window.history.back();</script>`);
  const accountWhatsApp = normalizeWhatsAppContact(req.user.subAdminWhatsApp || '');
  const submittedWhatsApp = normalizeWhatsAppContact(productWhatsApp);
  if (!accountWhatsApp || accountWhatsApp !== submittedWhatsApp) return res.send(`<script>alert('Product-এর WhatsApp নম্বরটি আপনার Sub Admin account-এ অনুমোদিত WhatsApp নম্বরের সঙ্গে মিলতে হবে। নম্বর হারিয়ে গেলে Help Center থেকে Main Admin-এর কাছে নতুন নম্বর পরিবর্তনের আবেদন করুন।'); window.history.back();</script>`);
}
let mainImageFilename = '';
let additionalImageFilenames = [];
const mainImageFile = req.files && req.files.mainImage && req.files.mainImage[0];
const additionalImageFiles = (req.files && req.files.additionalImages) || [];

if (mainImageFile) {
const cloudUrl=await uploadBufferToCloudinary(mainImageFile,'oneline-shop/products');
if(cloudUrl) mainImageFilename=cloudUrl;
else { mainImageFilename=Date.now()+'-'+mainImageFile.originalname; fs.writeFileSync(path.join(uploadDir,mainImageFilename),mainImageFile.buffer); }
}

for (let i = 0; i < additionalImageFiles.length; i++) {
const extraFile=additionalImageFiles[i];
const cloudUrl=await uploadBufferToCloudinary(extraFile,'oneline-shop/products/gallery');
if(cloudUrl) additionalImageFilenames.push(cloudUrl);
else { const extraName=Date.now()+'-extra-'+i+'-'+extraFile.originalname; fs.writeFileSync(path.join(uploadDir,extraName),extraFile.buffer); additionalImageFilenames.push(extraName); }
}
await new Product({
name: req.body.name,
category: req.body.category,
price: Number(req.body.price),
stock: Number(req.body.stock),
maxOrderLimit: Number(req.body.maxOrderLimit) || 5,
deliveryCharge: Number(req.body.deliveryCharge) || 150,
description: req.body.description || '',
mainImage: mainImageFilename,
additionalImages: additionalImageFilenames,
whatsappContact: productWhatsApp,
ownerId: String(req.user._id)
}).save();
res.redirect('/admin-dashboard');
} catch (err) {
next(err);
}
});
app.get('/admin/delete-product/:id', async (req, res, next) => {
try {
if (!req.user || !isMainAdmin(req.user)) return res.status(403).send('শুধু Main Admin Product delete করতে পারবেন।');
let productToDelete = await Product.findById(req.params.id);
if (!productToDelete || (!isMainAdmin(req.user) && String(productToDelete.ownerId || '') !== String(req.user._id))) return res.status(403).send('Unauthorized: Main Admin access required');
await Product.findByIdAndDelete(req.params.id);
res.redirect('/admin-dashboard#productsSec');
} catch (err) {
next(err);
}
});
app.post('/admin/update-order-status/:id', async (req, res, next) => {
try {
if (!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.redirect('/login');
let order = await Order.findById(req.params.id);
if (order && !orderBelongsToUser(order, req.user)) return res.status(403).send('Unauthorized: Main Admin access required');
if (order) {
order.previousStatus = order.status;
order.status = req.body.status;
await order.save();
}
res.redirect('/admin-dashboard');
} catch (err) {
next(err);
}
});
app.get('/admin/toggle-block-user/:id', async (req, res, next) => {
try {
if (!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.redirect('/login');
let targetUser = await User.findById(req.params.id);
if (targetUser) {
targetUser.isBlocked = !targetUser.isBlocked;
await targetUser.save();
await logActivity(req.user,`${targetUser.isBlocked ? 'Blocked' : 'Unblocked'} user ${targetUser.email}`,'User',targetUser._id);
await createNotification(targetUser.email,targetUser.isBlocked?'Account blocked':'Account unblocked',targetUser.isBlocked?'আপনার account block করা হয়েছে।':'আপনার account আবার চালু করা হয়েছে।','/dashboard','security');
}
res.redirect('/admin-dashboard');
} catch (err) {
next(err);
}
});
app.post('/admin/delete-order/:id', async (req, res, next) => {
try {
if (!req.user || !isMainAdmin(req.user)) return res.status(403).send('শুধু Main Admin Order delete করতে পারবেন।');
let orderToDelete = await Order.findById(req.params.id);
if (!orderToDelete || !orderBelongsToUser(orderToDelete, req.user)) return res.status(403).send('Unauthorized: Main Admin access required');
await Order.findByIdAndDelete(req.params.id);
res.redirect('/admin-dashboard');
} catch (err) {
next(err);
}
});
app.post('/admin/delete-chat/:id', async (req, res, next) => {
try {
if (!req.user || !isMainAdmin(req.user)) return res.status(403).send('শুধু Main Admin Chat delete করতে পারবেন।');
let chatToDelete = await Chat.findById(req.params.id);
if (!chatToDelete || (!isMainAdmin(req.user) && String(chatToDelete.ownerId || '') !== String(req.user._id))) return res.status(403).send('Unauthorized: Main Admin access required');
await Chat.findByIdAndDelete(req.params.id);
res.redirect('/admin-dashboard');
} catch (err) {
next(err);
}
});
app.post('/admin/send-message', async (req, res, next) => {
try {
if (!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.redirect('/login');
const rawRecipients = Array.isArray(req.body.userEmails) ? req.body.userEmails : [req.body.userEmails || req.body.userEmail];
const recipientEmails = [...new Set(rawRecipients.map(normalizeEmail).filter(Boolean))];
const productId = String(req.body.productId || '');
const message = safeText(req.body.message, 3000);
if (!recipientEmails.length || !productId || !message) return res.send(`<script>alert('কমপক্ষে একজন Customer, Product এবং Message নির্বাচন করুন।'); window.history.back();</script>`);
const product = await Product.findById(productId).lean();
if (!product) return res.status(404).send('Product not found');
if (!isMainAdmin(req.user) && String(product.ownerId || '') !== String(req.user._id)) return res.status(403).send('Unauthorized: Main Admin access required');
for (const recipientEmail of recipientEmails) { await new Chat({ productId: product._id, productName: product.name, ownerId:String(product.ownerId||req.user._id), productImage:product.mainImage||'', userEmail:recipientEmail, message, reply:'', senderRole:req.user.role, senderEmail:req.user.email, recipientEmail, isRead:false }).save(); await createNotification(recipientEmail,'New Product Message',`${product.name} সম্পর্কে নতুন message এসেছে।`,'/messages','message'); }
res.redirect('/admin-dashboard#chatsSec');
} catch(e){ next(e); }
});
app.post('/admin/reply-chat/:id', async (req, res, next) => {
try {
if (!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.redirect('/login');
let chatToReply = await Chat.findById(req.params.id);
if (!chatToReply || (!isMainAdmin(req.user) && String(chatToReply.ownerId || '') !== String(req.user._id))) return res.status(403).send('Unauthorized: Main Admin access required');
const reply = safeText(req.body.reply, 3000);
chatToReply.reply = reply;
chatToReply.isRead = true;
await chatToReply.save();
if (reply) {
  await new Chat({ productId:chatToReply.productId, productName:chatToReply.productName, ownerId:String(chatToReply.ownerId||req.user._id), productImage:chatToReply.productImage||'', userEmail:chatToReply.userEmail, message:reply, reply:'', senderRole:req.user.role, senderEmail:req.user.email, recipientEmail:chatToReply.userEmail, isRead:false }).save();
}
res.redirect('/admin-dashboard#chatsSec');
} catch (err) {
next(err);
}
});
app.post('/admin/add-coupon', async (req, res, next) => {
try {
if (!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.redirect('/login');
const { code, discountAmount } = req.body;
await new Coupon({ code: code.trim(), discountAmount: Number(discountAmount), ownerId: String(req.user._id) }).save();
res.redirect('/admin-dashboard');
} catch (err) {
next(err);
}
});
app.get('/admin/delete-coupon/:id', async (req, res, next) => {
try {
if (!req.user || !isMainAdmin(req.user)) return res.status(403).send('শুধু Main Admin Coupon delete করতে পারবেন।');
let couponToDelete = await Coupon.findById(req.params.id);
if (!couponToDelete || (!isMainAdmin(req.user) && String(couponToDelete.ownerId || '') !== String(req.user._id))) return res.status(403).send('Unauthorized: Main Admin access required');
await Coupon.findByIdAndDelete(req.params.id);
res.redirect('/admin-dashboard');
} catch (err) {
next(err);
}
});

// ================= Direct Facebook Publishing =================
app.post('/admin/publish-facebook', upload.single('mediaFile'), async (req, res, next) => {
try {
if (!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.redirect('/login');
const setting = isMainAdmin(req.user) ? await SiteSetting.findOne() : await SiteSetting.findOne({ ownerId: String(req.user._id) });
if (!setting || !setting.pageId || !setting.accessToken) {
return res.status(400).send(`<script>alert('Facebook Page ID এবং Page Access Token আগে Admin Settings-এ Save করুন।'); window.location.href='/admin-dashboard#facebookSec';</script>`);
}
if (!req.file) return res.status(400).send(`<script>alert('একটি Image/Video file নির্বাচন করুন।'); window.history.back();</script>`);

const mediaType = req.body.mediaType || 'image';
if (!['image','video','reel'].includes(mediaType)) return res.status(400).send('Invalid Facebook media type.');
if (mediaType === 'image' && !String(req.file.mimetype || '').startsWith('image/')) return res.status(400).send('Image media type-এর জন্য image file দিন।');
if ((mediaType === 'video' || mediaType === 'reel') && !String(req.file.mimetype || '').startsWith('video/')) return res.status(400).send('Video/Reel media type-এর জন্য video file দিন।');

let productLink = '/';
let product = null;
if (req.body.productId) {
product = await Product.findById(req.body.productId).lean();
if (!product) return res.status(400).send('Selected product not found.');
if (!isMainAdmin(req.user) && String(product.ownerId || '') !== String(req.user._id)) return res.status(403).send('Unauthorized: Main Admin access required');
productLink = `${SITE_URL_FALLBACK}/product/${product._id}`;
}

const title = String(req.body.title || '').trim();
let caption = String(req.body.caption || '').trim();
if (product) {
caption = `${caption}${caption ? '\n\n' : ''}🛒 Order Now: ${productLink}`;
}

let fbResult;
if (mediaType === 'image') {
fbResult = await publishFacebookImage(setting.pageId, setting.accessToken, req.file, caption);
} else if (mediaType === 'video') {
fbResult = await publishFacebookVideo(setting.pageId, setting.accessToken, req.file, caption);
} else {
fbResult = await publishFacebookReel(setting.pageId, setting.accessToken, req.file, title, caption);
}

const safeName = String(req.file.originalname || 'media').replace(/[^a-zA-Z0-9._-]/g, '_');
let savedName = await uploadBufferToCloudinary(req.file,'oneline-shop/facebook');
if(!savedName){ savedName=`${Date.now()}-fb-${safeName}`; fs.writeFileSync(path.join(uploadDir,savedName),req.file.buffer); }
await new FbContent({
title: title || product?.name || 'Facebook Content',
mediaUrl: savedName,
mediaType: mediaType === 'reel' ? 'video' : mediaType,
productLink,
facebookPostId: fbResult.id || fbResult.video_id || '',
facebookPublished: true,
ownerId: String(req.user._id)
}).save();

res.send(`<script>alert('Facebook-এ ${mediaType === 'image' ? 'ছবি' : mediaType === 'reel' ? 'Reel' : 'ভিডিও'} সফলভাবে publish হয়েছে।'); window.location.href='/admin-dashboard#facebookSec';</script>`);
} catch (err) {
console.error('Facebook publish error:', err);
res.status(500).send(`<div style="font-family:Arial;padding:20px"><h3>Facebook publish failed</h3><p>${String(err.message || err).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p><a href="/admin-dashboard#facebookSec">Back to Admin</a></div>`);
}
});

app.post('/admin/update-settings', async (req, res, next) => {
try {
if (!req.user || !isStaff(req.user) || !subAdminIsActive(req.user)) return res.redirect('/login');
const { bkashNumber, nagadNumber, pageId, accessToken } = req.body;
let setting = isMainAdmin(req.user) ? await SiteSetting.findOne() : await SiteSetting.findOne({ ownerId: String(req.user._id) });
if (setting) {
setting.bkashNumber = bkashNumber;
setting.nagadNumber = nagadNumber;
if (pageId !== undefined) setting.pageId = String(pageId || '').trim();
if (accessToken && String(accessToken).trim()) setting.accessToken = String(accessToken).trim();
if (!isMainAdmin(req.user)) setting.ownerId = String(req.user._id);
await setting.save();
} else {
await new SiteSetting({
bkashNumber,
nagadNumber,
pageId: String(pageId || '').trim(),
accessToken: String(accessToken || '').trim(),
ownerId: String(req.user._id)
}).save();
}
res.redirect('/admin-dashboard');
} catch (err) {
next(err);
}
});
// ================= V11 Notification Center =================
app.get('/admin/flow-health', async (req,res,next)=>{
  try {
    if (!req.user || !isMainAdmin(req.user)) return res.status(403).send('Main Admin access required');
    const mongooseReady = mongoose.connection.readyState === 1;
    const requiredRoutes = [
      '/', '/product/:id', '/api/add-to-cart/:id', '/api/update-cart-qty/:id/:action',
      '/cart', '/buy-now/:id', '/cart-checkout', '/api/place-cart-order', '/api/place-order',
      '/wishlist', '/wishlist/toggle/:id', '/request-inbox', '/request-inbox/send',
      '/messages', '/sub-admin/reply-admin/:id', '/admin-dashboard'
    ];
    const routeInventory = app._router && app._router.stack ? app._router.stack.filter(x=>x.route).map(x=>x.route.path) : [];
    const missing = requiredRoutes.filter(r => !routeInventory.includes(r));
    const checks = [
      ['MongoDB connection', mongooseReady],
      ['Product detail route', !missing.includes('/product/:id')],
      ['Quantity update route', !missing.includes('/api/update-cart-qty/:id/:action')],
      ['Cart checkout route', !missing.includes('/cart-checkout')],
      ['Final order route', !missing.includes('/api/place-cart-order') || !missing.includes('/api/place-order')],
      ['Wishlist route', !missing.includes('/wishlist/toggle/:id')],
      ['Request inbox chat', !missing.includes('/request-inbox/send')],
      ['Admin dashboard', !missing.includes('/admin-dashboard')]
    ];
    const ok = checks.every(x=>x[1]);
    res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flow Health</title></head><body style="font-family:Arial;padding:20px;background:#f5f5f5"><div style="max-width:760px;margin:auto;background:#fff;padding:20px;border-radius:12px"><h2>🧪 Full Flow Health Check</h2><p><b>Status:</b> ${ok?'✅ Basic flow contracts OK':'⚠️ Review required'}</p>${checks.map(c=>`<div style="padding:9px;border-bottom:1px solid #eee">${c[1]?'✅':'❌'} ${c[0]}</div>`).join('')}${missing.length?`<h3>Missing route contracts</h3><pre>${missing.join('\n')}</pre>`:''}<p style="color:#666;font-size:13px;margin-top:18px">This checks server-side route contracts and database readiness. Browser clicks and real customer data still need a local/Render browser test.</p></div></body></html>`);
  } catch(e){ next(e); }
});
app.get('/api/notifications/unread-count', async (req,res,next)=>{
  try { if(!req.user) return res.json({count:0}); const count=await Notification.countDocuments({userEmail:normalizeEmail(req.user.email),isRead:false}); res.json({count}); } catch(e){ next(e); }
});
app.get('/notifications', async (req,res,next)=>{
  try {
    if(!req.user) return res.redirect('/login?redirect=/notifications');
    const email=normalizeEmail(req.user.email);
    const list=await Notification.find({userEmail:email}).sort({_id:-1}).limit(100).lean();
    await Notification.updateMany({userEmail:email,isRead:false},{$set:{isRead:true}});
    const html=list.map(n=>`<a href="${n.link || '/dashboard'}" style="display:block;text-decoration:none;color:#222;background:#fff;border:1px solid #eee;border-radius:10px;padding:12px;margin:8px 0;"><b>${n.title}</b><div style="font-size:13px;color:#555;margin-top:3px">${n.message || ''}</div><small style="color:#888">${new Date(n.createdAt).toLocaleString()}</small></a>`).join('');
    res.send(`<!DOCTYPE html><html><head><title>Notifications</title>${globalHeaderHTML}</head><body>${getNavbarHTML(req.user)}<div class="container"><h3>🔔 Notifications</h3>${html || '<div style="background:#fff;padding:25px;border-radius:8px;color:#777">কোনো নতুন notification নেই।</div>'}</div></body></html>`);
  } catch(e){ next(e); }
});

// ================= PWA / Installable Web App =================
app.get('/manifest.json', (req, res) => {
  res.type('application/manifest+json').send(JSON.stringify({
    name: 'Online Shop',
    short_name: 'Online Shop',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f4f4',
    theme_color: '#f85606',
    description: 'Online Shop Marketplace',
    icons: [
      { src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  }));
});

app.get('/sw.js', (req, res) => {
  res.type('application/javascript').send(`const CACHE_NAME='online-shop-v34-static-v1';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(()=>caches.match('/')));
  }
});`);
});

app.get('/pwa-icon-192.png', (req,res)=>res.sendFile(path.join(__dirname,'pwa-icon-192.png')));
app.get('/pwa-icon-512.png', (req,res)=>res.sendFile(path.join(__dirname,'pwa-icon-512.png')));

// Register the service worker on pages using the shared header.
// ================= End PWA / Installable Web App =================

// ================= Central Error Handler =================
app.use((err, req, res, next) => {
console.error('Unhandled server error:', err && err.stack ? err.stack : err);
if (res.headersSent) return next(err);
const msg = (err && err.message) ? String(err.message) : 'Unknown server error';
res.status(500).send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Server Error</title><style>body{font-family:Arial;background:#f6f6f6;padding:20px}.box{max-width:650px;margin:30px auto;background:#fff;padding:20px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08)}a{display:inline-block;margin-top:12px;padding:9px 14px;background:#f85606;color:#fff;text-decoration:none;border-radius:6px}</style></head><body><div class="box"><h3>⚠️ অনুরোধটি সম্পন্ন করা যায়নি</h3><p>সার্ভার সমস্যার কারণে কাজটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।</p><p style="font-size:12px;color:#777;word-break:break-word">${msg.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p><a href="/">হোমে ফিরুন</a></div></body></html>`);
});

// Start Server
app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});
