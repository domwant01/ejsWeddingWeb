const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

function calculateAge(birthdate) {
  const birthDate = new Date(birthdate);
  const diff_ms = Date.now() - birthDate.getTime();
  const age_dt = new Date(diff_ms);
  return Math.abs(age_dt.getUTCFullYear() - 1970);
}

// หน้าแรก
router.get('/', async (req, res) => {
  try {
    const [thaiTraditionalDress] = await pool.query(`
      SELECT DISTINCT m.model_id, m.model_name, m.model_image
      FROM model m
      JOIN products p ON m.model_id = p.model_id
      WHERE p.category = 'thaiTraditionalDress'
    `);

    const [bridalDress] = await pool.query(`
      SELECT DISTINCT m.model_id, m.model_name, m.model_image
      FROM model m
      JOIN products p ON m.model_id = p.model_id
      WHERE p.category = 'bridalDress'
    `);

    const [groomSuit] = await pool.query(`
      SELECT DISTINCT m.model_id, m.model_name, m.model_image
      FROM model m
      JOIN products p ON m.model_id = p.model_id
      WHERE p.category = 'groomSuit'
    `);

    res.render('index', {
      title: 'ร้านเช่าชุดแต่งงาน',
      thaiTraditionalDress: thaiTraditionalDress,
      bridalDress: bridalDress,
      groomSuit: groomSuit,
      user: req.session.user
    });
  } catch (err) {
    res.status(500).send(err);
  }
});

// หน้าติดต่อเรา
router.get('/about', (req, res) => {
  res.render('about', { title: 'เกี่ยวกับเรา', user: req.session.user });
});

router.get('/contact', (req, res) => {
  res.render('contact', { title: 'ติดต่อเรา', user: req.session.user });
});

router.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await pool.query('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
    res.redirect('/contact');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการส่งข้อความ');
  }
});

// หน้าสินค้าของโมเดล
router.get('/products/model/:modelId', async (req, res) => {
  const modelId = req.params.modelId;
  try {
    const [model] = await pool.query('SELECT * FROM model WHERE model_id = ?', [modelId]);
    const [products] = await pool.query('SELECT * FROM products WHERE model_id = ?', [modelId]);

    if (model.length === 0) {
      return res.status(404).send('ไม่พบโมเดลที่ต้องการ');
    }

    res.render('modelProducts', {
      model: model[0],
      products: products,
      user: req.session.user
    });
  } catch (err) {
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูล');
  }
});

// เพิ่มสินค้าในตะกร้า
router.post('/cart/add', async (req, res) => {
  const { productId } = req.body;
  if (!req.session.cart) {
    req.session.cart = [];
  }
  req.session.cart.push(productId);
  res.redirect('back');
});

// หน้าตะกร้าสินค้า
router.get('/cart', async (req, res) => {
  if (!req.session.cart) {
    req.session.cart = [];
  }

  if (req.session.cart.length === 0) {
    return res.render('cart', { title: 'ตะกร้าสินค้า', products: [], user: req.session.user });
  }

  try {
    const productIds = req.session.cart;
    const [products] = await pool.query(`SELECT * FROM products WHERE products_id IN (?)`, [productIds]);
    
    res.render('cart', { title: 'ตะกร้าสินค้า', products, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลตะกร้าสินค้า');
  }
});

// หน้าสมัครสมาชิก
router.get('/signup', (req, res) => {
  res.render('signup', { title: 'Sign Up', user: req.session.user });
});

router.post('/signup', async (req, res) => {
  const { email, fullname, birthdate, phone, address, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const age = calculateAge(birthdate);

  try {
    const memberId = uuidv4();

    await pool.query('INSERT INTO users (member_id, fullname, email, birthdate, age, phone, address, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [memberId, fullname, email, birthdate, age, phone, address, hashedPassword]);
    
    res.redirect('/signin');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการสมัครสมาชิก');
  }
});

// หน้าเข้าสู่ระบบ
router.get('/signin', (req, res) => {
  res.render('signin', { title: 'Sign In', user: req.session.user });
});

router.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [user] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (user.length === 0) {
      return res.status(401).send('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const validPassword = await bcrypt.compare(password, user[0].password);
    if (!validPassword) {
      return res.status(401).send('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    req.session.userId = user[0].id;
    req.session.user = user[0]; // เก็บข้อมูล user ทั้งหมดใน session
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
  }
});

// หน้าข้อมูลลูกค้า
router.get('/profile', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/signin');
  }
  res.render('profile', { title: 'ข้อมูลลูกค้า', user: req.session.user });
});

// หน้าประวัติการเช่าซื้อ
router.get('/history', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/signin');
  }
  res.render('history', { title: 'ประวัติการเช่าซื้อ', user: req.session.user });
});

// เส้นทางออกจากระบบ
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
    res.redirect('/');
  });
});

// เส้นทาง GET ชำระเงิน
router.get('/checkout', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/signin');
  }

  if (!req.session.cart || req.session.cart.length === 0) {
    return res.redirect('/cart');
  }

  res.render('checkout', { title: 'ชำระเงิน', user: req.session.user });
});

// เส้นทาง POST ชำระเงิน
router.post('/checkout', async (req, res) => {
  const { fullname, address, phone, payment_method } = req.body;
  const userId = req.session.user.id;

  try {
    const [orderResult] = await pool.query(
      'INSERT INTO orders (user_id, fullname, address, phone, payment_method, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, fullname, address, phone, payment_method, 'Pending']
    );

    const orderId = orderResult.insertId;
    req.session.lastOrderId = orderId; // เก็บเลขที่ใบจองในเซสชัน

    // ดึงข้อมูลสินค้าเพื่อใช้งานใน order_items
    const cartProductIds = req.session.cart;
    const [products] = await pool.query(`SELECT products_id FROM products WHERE products_id IN (?)`, [cartProductIds]);

    const orderItems = products.map(product => [
      orderId,
      product.products_id,
      1
    ]);

    await pool.query(
      'INSERT INTO order_items (order_id, product_id, quantity) VALUES ?',
      [orderItems]
    );

    req.session.cart = []; // เคลียร์ตะกร้าสินค้า
    res.redirect('/order-confirmation');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดำเนินการชำระเงิน');
  }
});


// เส้นทางสำหรับหน้าใบจอง
router.get('/order-confirmation', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/signin');
  }

  const orderId = req.session.lastOrderId;

  if (!orderId) {
    return res.redirect('/');
  }

  try {
    const [orderDetails] = await pool.query(`
      SELECT o.order_id, o.fullname, o.address, o.phone, o.created_at, oi.quantity, p.product_name, p.products_image, p.price
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      JOIN products p ON oi.product_id = p.products_id
      WHERE o.order_id = ?
    `, [orderId]);

    if (orderDetails.length === 0) {
      return res.redirect('/');
    }

    res.render('orderConfirmation', {
      title: 'ใบจอง',
      user: req.session.user,
      order: orderDetails
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลใบจอง');
  }
});

module.exports = router;
