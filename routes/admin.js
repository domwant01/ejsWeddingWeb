const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ตั้งค่า multer สำหรับการอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.body.category;
    let destinationPath = `public/images/${category}`;
    fs.mkdirSync(destinationPath, { recursive: true }); // สร้างโฟลเดอร์ถ้ายังไม่มีอยู่
    cb(null, destinationPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const modelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let destinationPath = 'public/images/models';
    fs.mkdirSync(destinationPath, { recursive: true }); // สร้างโฟลเดอร์ถ้ายังไม่มีอยู่
    cb(null, destinationPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });
const uploadModel = multer({ storage: modelStorage });

// เส้นทางเพื่อเพิ่มผลิตภัณฑ์ใหม่
router.get('/add-product', async (req, res) => {
  try {
    const [models] = await pool.query('SELECT model_id, model_name FROM model');
    res.render('admin/addProduct', { models });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลนายแบบ');
  }
});

router.post('/add-product', upload.single('productImage'), async (req, res) => {
  const { productName, price, category, modelId } = req.body;
  const productImage = req.file ? `/images/${category}/${req.file.filename}` : null;
  try {
    await pool.query('INSERT INTO products (product_name, products_image, price, category, model_id) VALUES (?, ?, ?, ?, ?)', [productName, productImage, price, category, modelId]);
    res.redirect('/admin/manageProducts');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการเพิ่มสินค้า');
  }
});

// เส้นทางเพื่อเพิ่มโมเดลใหม่
router.get('/add-model', (req, res) => {
  res.render('admin/addModel');
});

router.post('/add-model', uploadModel.single('modelImage'), async (req, res) => {
  const { modelName } = req.body;
  const modelImage = req.file ? `/images/models/${req.file.filename}` : null;
  try {
    await pool.query('INSERT INTO model (model_name, model_image) VALUES (?, ?)', [modelName, modelImage]);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการเพิ่มโมเดล');
  }
});

// เส้นทางสำหรับแสดงหน้า Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT p.*, m.model_name, m.model_image FROM products p LEFT JOIN model m ON p.model_id = m.model_id');
    const [models] = await pool.query('SELECT * FROM model');
    res.render('admin/dashboard', { title: 'Admin Dashboard', products, models });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับ Dashboard');
  }
});

// เส้นทางสำหรับแสดงรายการสินค้า
router.get('/manageProducts', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT p.*, m.model_name FROM products p LEFT JOIN model m ON p.model_id = m.model_id');
    res.render('admin/manageProducts', { title: 'Products List', products });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับ Products');
  }
});

// เส้นทางสำหรับแก้ไขสินค้า
router.get('/edit-product/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const [product] = await pool.query('SELECT * FROM products WHERE products_id = ?', [productId]);
    const [models] = await pool.query('SELECT model_id, model_name FROM model');
    if (product.length === 0) {
      return res.status(404).send('ไม่พบสินค้าที่ต้องการแก้ไข');
    }
    res.render('admin/editProduct', { product: product[0], models });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับแก้ไขสินค้า');
  }
});

router.post('/edit-product/:id', upload.single('productImage'), async (req, res) => {
  const productId = req.params.id;
  const { productName, price, category, modelId, existingImage } = req.body;
  const productImage = req.file ? `/images/${category}/${req.file.filename}` : existingImage;

  try {
    const [product] = await pool.query('SELECT * FROM products WHERE products_id = ?', [productId]);
    if (product.length === 0) {
      return res.status(404).send('ไม่พบสินค้าที่ต้องการแก้ไข');
    }

    await pool.query('INSERT INTO product_edits (product_id, old_product_name, new_product_name, old_products_image, new_products_image, old_price, new_price, old_category, new_category, old_model_id, new_model_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      product[0].products_id,
      product[0].product_name,
      productName,
      product[0].products_image,
      productImage,
      product[0].price,
      price,
      product[0].category,
      category,
      product[0].model_id,
      modelId
    ]);

    await pool.query('UPDATE products SET product_name = ?, products_image = ?, price = ?, category = ?, model_id = ? WHERE products_id = ?', [
      productName,
      productImage,
      price,
      category,
      modelId,
      productId
    ]);

    res.redirect('/admin/manageProducts');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการแก้ไขสินค้า');
  }
});

// เส้นทางสำหรับลบสินค้า
router.get('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const [product] = await pool.query('SELECT * FROM products WHERE products_id = ?', [productId]);
    if (product.length === 0) {
      return res.status(404).send('ไม่พบสินค้าที่ต้องการลบ');
    }
    res.render('admin/deleteProduct', { product: product[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับลบสินค้า');
  }
});

router.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const [product] = await pool.query('SELECT * FROM products WHERE products_id = ?', [productId]);
    if (product.length === 0) {
      return res.status(404).send('ไม่พบสินค้าที่ต้องการลบ');
    }

    await pool.query('INSERT INTO deleted_products (product_id, product_name, products_image, price, category, model_id) VALUES (?, ?, ?, ?, ?, ?)', [
      product[0].products_id,
      product[0].product_name,
      product[0].products_image,
      product[0].price,
      product[0].category,
      product[0].model_id
    ]);

    await pool.query('DELETE FROM products WHERE products_id = ?', [productId]);

    res.redirect('/admin/manageProducts');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการลบสินค้า');
  }
});

// เส้นทางสำหรับแสดงข้อความติดต่อ
router.get('/manage-messages', async (req, res) => {
  try {
    const [messages] = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.render('admin/manageMessages', { title: 'Manage Contact Messages', messages });
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงข้อมูลข้อความติดต่อ');
  }
});

module.exports = router;
